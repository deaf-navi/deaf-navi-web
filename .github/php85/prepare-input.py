#!/usr/bin/env python3
"""Export only the checked-in tree; never pass .git or runner credentials to tests."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

BASE_COMMIT = 'df9d171b03117efb70cdd4107cfaefe48e8a52eb'
EXPECTED_TREE = '1f67efcf87de4e9b549ed3c1be757a5f3bbef683b64cc9e952161dad59c62c98'


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: prepare-input.py SOURCE_TAR EVIDENCE_DIR')
    archive, output = Path(sys.argv[1]), Path(sys.argv[2])
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    raw = subprocess.check_output(['git', 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'])
    rows = []
    for row in raw.split(b'\0'):
        if not row:
            continue
        path = row.split(b'\t', 1)[1]
        if path == b'.github/workflows/ci.yml' or path.startswith(b'.github/php85/'):
            continue
        rows.append(row)
    fingerprint = hashlib.sha256(b'\0'.join(rows) + b'\0').hexdigest()
    if fingerprint != EXPECTED_TREE:
        raise SystemExit('Application/source tree differs from deployed baseline; stop and reassess inputs')
    # Untracked files, credential helper configuration and .git are absent from git archive.
    subprocess.run(['git', 'archive', '--format=tar', '--output', str(archive), 'HEAD'], check=True)
    (output / 'source-commit.txt').write_text(commit + '\n', encoding='utf-8')
    with archive.open('rb') as exported:
        archive_sha = hashlib.file_digest(exported, 'sha256').hexdigest()
    data = {'workflow_commit': commit, 'deployed_application_base': BASE_COMMIT,
            'protected_tree_sha256': fingerprint, 'protected_tree_entries': len(rows),
            'allowed_changed_paths': ['.github/workflows/ci.yml', '.github/php85/'],
            'archive_sha256': archive_sha,
            'input_kind': 'committed public seed/research fixtures and synthetic temporary DB/log/account data',
            'production_database_or_upload_or_log_fetched': False}
    (output / 'input-manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
