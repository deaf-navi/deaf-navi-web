#!/usr/bin/env python3
"""Archive closed access logs only after a verified gzip copy exists."""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile

JST = dt.timezone(dt.timedelta(hours=9))
LOG_NAME = re.compile(r"^access(?:-v[0-9]+)?(?:-[0-9T.Z:+-]+(?:-(?:size|time))?)?\.log$")


def sync_directory(path):
    if os.name == "posix":
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def archive_path(root, month, name):
    for folder in (root / "archive", root / "archive" / month):
        if folder.is_symlink():
            raise RuntimeError("Archive directory symlink refused")
        folder.mkdir(exist_ok=True, mode=0o750)
        if not folder.resolve().is_relative_to(root):
            raise RuntimeError("Archive escaped storage root")
    return root / "archive" / month / name


def atomic_json(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".state-", mode="w", delete=False) as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
        tmp = Path(f.name)
    os.chmod(tmp, 0o640)
    os.replace(tmp, path)
    sync_directory(path.parent)


def digest(path, compressed=False):
    h = hashlib.sha256()
    size = 0
    opener = gzip.open if compressed else open
    with opener(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
            size += len(chunk)
    return h.hexdigest(), size


def verified_gzip(source, target):
    """Idempotent: an existing archive must match before a source may be removed."""
    if target.is_symlink():
        raise RuntimeError("Archive symlink refused")
    original = digest(source)
    if target.exists():
        if digest(target, True) != original:
            raise RuntimeError("Existing archive differs; source retained")
        return original
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".compress-", delete=False) as f:
        temporary = Path(f.name)
        with gzip.GzipFile(fileobj=f, mode="wb", filename="", mtime=0, compresslevel=6) as z:
            with source.open("rb") as incoming:
                while chunk := incoming.read(65536):
                    z.write(chunk)
        f.flush()
        os.fsync(f.fileno())
    try:
        if digest(temporary, True) != original:
            raise RuntimeError("Compressed copy failed verification")
        os.chmod(temporary, 0o640)
        os.link(temporary, target)  # Fail rather than overwrite another archive.
        sync_directory(target.parent)
        return original
    finally:
        temporary.unlink(missing_ok=True)


def archive_logs(root, cutoff, active="access-v2.log", index=None):
    archived = []
    for source in sorted(root.glob("access*.log")):
        if source.name == active:
            continue
        if source.is_symlink() or not LOG_NAME.fullmatch(source.name) or source.resolve().parent != root:
            raise RuntimeError("Unexpected log target")
        before = source.stat()
        if before.st_size == 0:
            continue
        latest = 0
        earliest = float("inf")
        with source.open("rb") as f:
            for line in f:
                if len(line) > 1024 * 1024 or not line.endswith(b"\n"):
                    raise RuntimeError("Incomplete log retained")
                r = json.loads(line)
                stamp = float(r["ts"])
                if not 0 < stamp < 4102444800:
                    raise RuntimeError("Invalid timestamp; log retained")
                latest = max(latest, stamp)
                earliest = min(earliest, stamp)
        if latest >= cutoff.timestamp():
            after = source.stat()
            if index is not None and (before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns):
                index[source.name] = {"bytes": before.st_size, "mtime": int(before.st_mtime), "first": earliest, "last": latest}
            continue
        month = dt.datetime.fromtimestamp(latest, JST).strftime("%Y-%m")
        target = archive_path(root, month, source.name + ".gz")
        checksum, size = verified_gzip(source, target)
        after = source.stat()
        if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise RuntimeError("Log changed during archive; source retained")
        if digest(source) != (checksum, size):
            raise RuntimeError("Source changed; source retained")
        atomic_json(target.with_suffix(".json"), {"source": source.name, "sha256": checksum, "bytes": size,
            "gzip_bytes": target.stat().st_size, "latest": latest, "verified": True})
        # Exact, closed, regular file in the validated root, with verified recovery copy.
        source.unlink()
        sync_directory(root)
        archived.append({"source": source.name, "bytes": size, "gzip_bytes": target.stat().st_size})
    return archived


def archive_visitors(root, cutoff, table="visits"):
    database = root / "visitors.sqlite"
    if not database.is_file():
        return []
    if database.is_symlink():
        raise RuntimeError("Visitor database symlink refused")
    db = sqlite3.connect(database, timeout=10)
    db.row_factory = sqlite3.Row
    archived = []
    try:
        if table not in ("visits", "excluded_visitors"):
            raise RuntimeError("Unexpected visitor table")
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
            return []
        prefix = "visitors-" if table == "visits" else "excluded-visitors-"
        order = "visitor,path" if table == "visits" else "visitor"
        # day is Japan time; leave a boundary day intact until every record is old enough.
        days = [r[0] for r in db.execute("SELECT DISTINCT day FROM " + table + " WHERE day < ? ORDER BY day", (cutoff.strftime("%Y-%m-%d"),))]
        for day in days:
            if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day):
                raise RuntimeError("Unexpected visitor day")
            db.execute("BEGIN IMMEDIATE")
            tmp = None
            try:
                rows = [dict(r) for r in db.execute("SELECT * FROM " + table + " WHERE day=? ORDER BY " + order, (day,))]
                with tempfile.NamedTemporaryFile(dir=root, prefix=".visitors-", mode="w", delete=False) as f:
                    tmp = Path(f.name)
                    for row in rows:
                        f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
                    f.flush()
                    os.fsync(f.fileno())
                target = archive_path(root, day[:7], prefix + day + ".jsonl.gz")
                checksum, size = verified_gzip(tmp, target)
                atomic_json(target.with_suffix(".json"), {"day": day, "rows": len(rows), "sha256": checksum, "bytes": size, "verified": True})
                db.execute("DELETE FROM " + table + " WHERE day=?", (day,))
                db.commit()
                archived.append({"table": table, "day": day, "rows": len(rows), "gzip_bytes": target.stat().st_size})
            except BaseException:
                db.rollback()
                raise
            finally:
                if tmp is not None:
                    tmp.unlink(missing_ok=True)
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Visitor database integrity error")
    finally:
        db.close()
    return archived


def maintain(root, visitor_root, now, force_monthly=False):
    root = root.resolve(strict=True)
    # Monthly archive at 180 days; a daily guard handles 31-day months or a missed run.
    monthly = force_monthly or now.day == 1
    # Two days of headroom for a daily closed log and the next scheduled check.
    days = 180 if monthly else 208
    cutoff = now - dt.timedelta(days=days)
    result = {"time": now.isoformat(), "mode": "monthly" if monthly else "210_day_guard", "retention_days": 180,
        "cutoff": cutoff.isoformat(), "status": "ok", "logs": [], "visitors": [], "file_index": {}}
    previous = root / "maintenance.json"
    if previous.is_file() and not previous.is_symlink():
        old = json.loads(previous.read_text())
        result["last_monthly"] = old.get("last_monthly")
    try:
        result["logs"] = archive_logs(root, cutoff, index=result["file_index"])
        if visitor_root.exists():
            result["visitors"] = archive_visitors(visitor_root.resolve(strict=True), cutoff)
            result["visitors"] += archive_visitors(visitor_root.resolve(strict=True), cutoff, "excluded_visitors")
    except Exception as ex:
        result["status"] = "error"
        result["error_type"] = type(ex).__name__  # No request data or secrets in operational output.
        atomic_json(root / "maintenance.json", result)
        raise
    result["raw_bytes"] = sum(p.stat().st_size for p in root.glob("access*.log") if p.is_file() and not p.is_symlink())
    result["archive_bytes"] = sum(p.stat().st_size for p in (root / "archive").glob("*/*.gz") if p.is_file())
    result["archive_files"] = sum(1 for _ in (root / "archive").glob("*/*.gz"))
    result["visitor_archive_bytes"] = sum(p.stat().st_size for p in (visitor_root / "archive").glob("*/*.gz") if p.is_file() and not p.is_symlink())
    if monthly:
        result["last_monthly"] = now.isoformat()
    atomic_json(root / "maintenance.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--monthly", action="store_true")
    args = parser.parse_args()
    root = Path("/srv/deafnavi/shared/access-logs")
    visitors = Path("/srv/deafnavi/shared/access-visitors")
    import fcntl
    with (root / ".maintenance.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = maintain(root, visitors, dt.datetime.now(JST), args.monthly)
    print(json.dumps(result, ensure_ascii=False))
