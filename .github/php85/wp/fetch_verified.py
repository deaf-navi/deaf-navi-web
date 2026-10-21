"""Official distribution acquisition only; never executes downloaded code."""
import hashlib
import json
from pathlib import Path
import re
import stat
import urllib.parse
import urllib.request
import zipfile

HOSTS = {'wordpress.org', 'downloads.wordpress.org', 'api.wordpress.org'}

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname not in HOSTS:
            raise RuntimeError('Unexpected official download redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url, target, cap):
    req = urllib.request.Request(url, headers={'User-Agent': 'Codex-Offline-Compatibility-Fixture/1.0'})
    opener = urllib.request.build_opener(Redirects())
    total = 0
    with opener.open(req, timeout=35) as response, target.open('xb') as out:
        declared = response.headers.get('Content-Length')
        if declared and int(declared) > cap:
            raise RuntimeError('Download declared size exceeds cap')
        while chunk := response.read(min(1024 * 1024, cap - total + 1)):
            total += len(chunk)
            if total > cap:
                raise RuntimeError('Download size exceeds cap')
            out.write(chunk)
    return {'url': url, 'bytes': total, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

def verify_extract(archive, destination, prefix, checksums, core=False):
    if destination.exists():
        raise RuntimeError('Fresh extraction directory required')
    reserved = {'CON','PRN','AUX','NUL'} | {f'COM{i}' for i in range(1,10)} | {f'LPT{i}' for i in range(1,10)}
    files = []
    seen = set()
    expanded = 0
    with zipfile.ZipFile(archive) as package:
        infos = package.infolist()
        if len(infos) > 20000:
            raise RuntimeError('Archive entry cap exceeded')
        for info in infos:
            name = info.filename
            parts = name.rstrip('/').split('/')
            if (not name or '\\' in name or name.startswith('/') or '\x00' in name
                or parts[0] != prefix or any(p in ('','..','.') or ':' in p or p.endswith((' ','.'))
                or p.split('.')[0].upper() in reserved for p in parts)):
                raise RuntimeError('Unsafe archive path')
            folded = name.rstrip('/').casefold()
            if folded in seen:
                raise RuntimeError('Duplicate/case-colliding archive path')
            seen.add(folded)
            mode = stat.S_IFMT(info.external_attr >> 16)
            if mode not in (0, stat.S_IFREG, stat.S_IFDIR) or info.flag_bits & 1:
                raise RuntimeError('Symlink/special/encrypted entry rejected')
            expanded += info.file_size
            if expanded > 256 * 1024**2 or info.file_size > 32 * 1024**2 or info.file_size / max(info.compress_size, 1) > 250:
                raise RuntimeError('Archive expansion cap exceeded')
            if not info.is_dir():
                relative = '/'.join(parts[1:])
                if not relative:
                    raise RuntimeError('Missing relative filename')
                files.append((info, relative))
        paths = {name for _, name in files}
        if paths != set(checksums):
            raise RuntimeError('Official checksum file set differs: missing=%d extra=%d' % (len(set(checksums)-paths), len(paths-set(checksums))))
        manifest = []
        for info, name in files:
            data = package.read(info)
            md5 = hashlib.md5(data).hexdigest()
            sha256 = hashlib.sha256(data).hexdigest()
            expected = checksums[name]
            if core:
                if md5 not in (expected if isinstance(expected, list) else [expected]):
                    raise RuntimeError('Official WordPress checksum mismatch: ' + name)
            elif expected['md5'] != md5 or expected['sha256'] != sha256:
                raise RuntimeError('Official plugin checksum mismatch: ' + name)
            manifest.append({'path': name, 'sha256': sha256, 'md5': md5, 'bytes': len(data)})
        destination.mkdir()
        for info, name in files:
            target = destination / name
            if not target.resolve().is_relative_to(destination.resolve()):
                raise RuntimeError('Extraction boundary violation')
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as out:
                out.write(package.read(info))
        for entry in manifest:
            if hashlib.sha256((destination / entry['path']).read_bytes()).hexdigest() != entry['sha256']:
                raise RuntimeError('Extracted byte mismatch')
    return {'files': manifest, 'expanded_bytes': expanded, 'all_official_checksums_match': True}

def acquire(root):
    root.mkdir()
    report = {'downloads': [], 'packages': {}}
    core_zip = root / 'wordpress-7.1.3.zip'
    report['downloads'].append(fetch('https://wordpress.org/wordpress-7.1.3.zip', core_zip, 64 * 1024**2))
    core_sha = root / 'wordpress-7.1.3.zip.sha1'
    report['downloads'].append(fetch('https://wordpress.org/wordpress-7.1.3.zip.sha1', core_sha, 1024))
    expected_sha = core_sha.read_text().strip()
    if not re.fullmatch(r'[0-9a-fA-F]{40}', expected_sha) or hashlib.sha1(core_zip.read_bytes()).hexdigest() != expected_sha.lower():
        raise RuntimeError('Official WordPress archive SHA1 mismatch')
    core_checks = root / 'wordpress-checksums.json'
    report['downloads'].append(fetch('https://api.wordpress.org/core/checksums/1.0/?version=7.1.3&locale=en_US', core_checks, 4 * 1024**2))
    report['packages']['wordpress'] = verify_extract(core_zip, root / 'wordpress', 'wordpress', json.loads(core_checks.read_bytes())['checksums'], True)
    version_text = (root / 'wordpress/wp-includes/version.php').read_text()
    if not re.search(r"\$wp_version\s*=\s*['\"]7\.1\.3['\"]", version_text):
        raise RuntimeError('WordPress version header mismatch')
    for version in ('4.9.0', '4.10.3'):
        archive = root / f'wp-mail-smtp-{version}.zip'
        checksum_path = root / f'wp-mail-smtp-{version}-checksums.json'
        report['downloads'].append(fetch(f'https://downloads.wordpress.org/plugin/wp-mail-smtp.{version}.zip', archive, 32 * 1024**2))
        report['downloads'].append(fetch(f'https://downloads.wordpress.org/plugin-checksums/wp-mail-smtp/{version}.json', checksum_path, 4 * 1024**2))
        checks = json.loads(checksum_path.read_bytes())
        if checks['plugin'] != 'wp-mail-smtp' or checks['version'] != version:
            raise RuntimeError('Plugin checksum version mismatch')
        report['packages'][version] = verify_extract(archive, root / version, 'wp-mail-smtp', checks['files'])
    return report
