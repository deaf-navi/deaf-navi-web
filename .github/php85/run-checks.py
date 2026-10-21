#!/usr/bin/env python3
"""Offline CI supervisor; existing application tests run only in this container."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

ROOT = Path('/workspace')
OUT = Path('/evidence')
COMMANDS = [
    ['node', 'test/stories.integration.mjs'],
    ['node', 'test/directory.integration.mjs'],
    ['node', 'test/admin-dashboard.integration.mjs'],
    ['node', 'test/access-logs.integration.mjs'],
    ['php', 'test/access-quality.test.php'],
    ['node', 'test/access-visitors.integration.mjs'],
    ['node', 'test/engagement.integration.mjs'],
    ['node', 'test/access-sw.test.mjs'],
    ['node', '--test', 'test/directory-safety.test.mjs'],
    ['python3', 'test/access-maintenance.test.py'],
    ['node', 'test/overseas-cafes.integration.mjs'],
    ['php', 'test/world-cafes.php'],
    ['node', 'test/cafe-seo.integration.mjs'],
    ['php', 'test/cafe-event-recovery.php'],
    ['node', 'test/cafe-event-recovery.integration.mjs'],
    ['node', 'test/cafe-events.integration.mjs'],
    ['node', 'test/cafe-event-curation.integration.mjs'],
    ['php', 'test/public-profile.test.php'],
    ['node', 'test/social-import.mjs'],
]


def main():
    started = time.monotonic()
    summary = {'status': 'running', 'started_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
               'php_version_required': '8.5.12', 'node_version_required': 'v22.23.4',
               'commands_expected': len(COMMANDS), 'commands': [], 'lint_count': 0,
               'network': None, 'production_secrets': False, 'production_databases': False}
    result = 1
    try:
        if os.geteuid() == 0:
            raise RuntimeError('Test container must run without root privileges')
        interfaces = sorted(p.name for p in Path('/sys/class/net').iterdir())
        if interfaces != ['lo']:
            raise RuntimeError('Expected Docker network none; only loopback may exist')
        summary['network'] = {'interfaces': interfaces, 'external_access': False}
        for key in ('GITHUB_TOKEN', 'GH_TOKEN', 'SSH_AUTH_SOCK', 'ACTIONS_RUNTIME_TOKEN'):
            if os.getenv(key):
                raise RuntimeError('Runner credential must not enter the container')
        for directory in ('/tmp/home', '/tmp/default-directory', '/tmp/default-visitors', '/tmp/default-access-logs'):
            Path(directory).mkdir(parents=True, exist_ok=True)
        for source in Path('/opt/php85/evidence').iterdir():
            if source.is_file():
                shutil.copyfile(source, OUT / source.name)
        php = subprocess.check_output(['php', '-r', 'echo PHP_VERSION;'], text=True).strip()
        if php != '8.5.12':
            raise RuntimeError('Incorrect PHP version: ' + php)
        summary['php_version'] = php
        (OUT / 'php-version.txt').write_bytes(subprocess.check_output(['php', '--version']))
        ext = subprocess.check_output(['php', '-r', 'echo json_encode(["extensions"=>get_loaded_extensions(),"pdo_drivers"=>PDO::getAvailableDrivers(),"gd"=>gd_info(),"sapi"=>PHP_SAPI], JSON_PRETTY_PRINT);'])
        (OUT / 'php-extensions.json').write_bytes(ext)
        required = {'gd', 'sqlite3', 'pdo_sqlite', 'mbstring', 'curl', 'mysqli', 'pdo_mysql', 'openssl', 'zlib', 'intl', 'zip'}
        if not required.issubset(set(json.loads(ext)['extensions'])):
            raise RuntimeError('Required PHP extension missing')
        if json.loads(ext)['gd'].get('WebP Support') is not True:
            raise RuntimeError('GD WebP support required')
        summary['gd_webp_support'] = True
        bare_mb = subprocess.check_output(['php', '-n', '-r', 'echo function_exists("mb_strlen") ? "1" : "0";'], text=True)
        if bare_mb != '0':
            raise RuntimeError('Existing no-mbstring fixture requires a shared mbstring extension')
        node = subprocess.check_output(['node', '--version'], text=True).strip()
        if node != 'v22.23.4':
            raise RuntimeError('Incorrect Node version: ' + node)
        (OUT / 'node-version.txt').write_text(node + '\n', encoding='utf-8')
        (OUT / 'python-version.txt').write_text(sys.version + '\n', encoding='utf-8')

        # Refuse command drift relative to the deployed workflow, without executing YAML.
        deploy = (ROOT / '.github/workflows/deploy-xserver.yml').read_text(encoding='utf-8').splitlines()
        first = next(i for i, line in enumerate(deploy) if line.strip() == 'node test/stories.integration.mjs')
        last = next(i for i in range(first, len(deploy)) if deploy[i].strip().startswith('tar '))
        expected = [line.strip() for line in deploy[first:last] if line.strip()]
        if expected != [' '.join(cmd) for cmd in COMMANDS]:
            raise RuntimeError('Deployment test command list/order changed')
        manifest = []
        with (OUT / 'lint.log').open('w', encoding='utf-8') as log:
            for path in sorted([*ROOT.joinpath('server').rglob('*.php'), *ROOT.joinpath('test').rglob('*.php')]):
                rel = path.relative_to(ROOT).as_posix()
                manifest.append({'path': rel, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
                subprocess.run(['php', '-l', rel], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=30)
                summary['lint_count'] += 1
        (OUT / 'lint-inputs.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        subprocess.run(['php', '-r', 'json_decode(file_get_contents("server/seed.json"),true,512,JSON_THROW_ON_ERROR);'], cwd=ROOT, check=True, timeout=30)
        with (OUT / 'tests.log').open('w', encoding='utf-8') as log:
            for index, command in enumerate(COMMANDS, 1):
                label = ' '.join(command)
                print(f'[{index}/{len(COMMANDS)}] {label}', flush=True)
                log.write('\n=== ' + label + ' ===\n')
                log.flush()
                begin = time.monotonic()
                item = {'command': label, 'exit_code': None}
                summary['commands'].append(item)
                completed = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=min(180, max(1, 450 - (time.monotonic() - started))))
                item.update(exit_code=completed.returncode, seconds=round(time.monotonic() - begin, 3))
                if completed.returncode != 0:
                    raise RuntimeError('Existing test failed: ' + label)
        summary['status'] = 'passed'
        result = 0
    except Exception as exc:
        summary['status'] = 'failed'
        summary['error'] = str(exc)
        print('FAIL: ' + str(exc), file=sys.stderr, flush=True)
    finally:
        errors = Path('/tmp/php-errors.log')
        if errors.exists():
            shutil.copyfile(errors, OUT / 'php-errors.log')
        diagnostics = '\n'.join(p.read_text(encoding='utf-8', errors='replace') for p in (OUT / 'lint.log', OUT / 'tests.log', OUT / 'php-errors.log') if p.exists())
        summary['deprecation_lines'] = len(re.findall(r'(?m)^.*(?:PHP )?Deprecated:', diagnostics))
        if summary['deprecation_lines'] and result == 0:
            summary['status'] = 'failed_deprecations'
            result = 1
        summary['elapsed_seconds'] = round(time.monotonic() - started, 3)
        summary['exit_code'] = result
        (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    return result


if __name__ == '__main__':
    raise SystemExit(main())
