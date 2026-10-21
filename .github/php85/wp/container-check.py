import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error

stage = sys.argv[1]
if stage not in ('old', 'new') or os.environ.get('FIXTURE_ONLY') != '1':
    raise SystemExit('Fixture stage/environment required')
evidence = Path('/evidence')
Path('/tmp/home').mkdir(exist_ok=True)
flags = ['-d', 'error_reporting=-1', '-d', 'display_errors=stderr', '-d', 'log_errors=0', '-d', 'disable_functions=mail', '-d', 'sendmail_path=/bin/false']
subprocess.run(['php', '-r', 'if(PHP_VERSION!=="8.5.12"||!extension_loaded("mysqli"))exit(1);'], check=True)
for phase in (['install', 'seed', 'snapshot'] if stage == 'old' else ['snapshot']):
    result = subprocess.run(['php'] + flags + ['/fixture/bootstrap-fixture.php', phase], capture_output=True, timeout=65)
    (evidence / (phase + '.stdout')).write_bytes(result.stdout)
    (evidence / (phase + '.stderr')).write_bytes(result.stderr)
    if result.returncode:
        raise SystemExit('Bootstrap phase failed: ' + phase)
    if phase == 'snapshot':
        (evidence / 'snapshot.json').write_text(json.dumps(json.loads(result.stdout), indent=2))

def lint(path):
    result = subprocess.run(['php','-n','-d','error_reporting=-1','-d','display_errors=stderr','-d','log_errors=0','-l',str(path)], capture_output=True, timeout=15)
    combined = (result.stdout + result.stderr).decode(errors='replace')
    diagnostics = [line for line in combined.splitlines() if line.strip() and not line.startswith('No syntax errors detected in ')]
    return {'path': str(path.relative_to('/var/www/html')), 'rc': result.returncode, 'diagnostics': diagnostics}

files = sorted(Path('/var/www/html/wp-content/plugins/wp-mail-smtp').rglob('*.php'))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    lints = list(pool.map(lint, files))
(evidence / 'lint.json').write_text(json.dumps(lints, indent=2))
if not files or any(row['rc'] for row in lints):
    raise SystemExit('Plugin syntax failed')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('Local fixture response redirected; not following')

with (evidence / 'public-server.log').open('wb') as log:
    server = subprocess.Popen(['php'] + flags + ['-S','127.0.0.1:8080','-t','/var/www/html'], stdout=log, stderr=log)
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        for attempt in range(30):
            try:
                req = urllib.request.Request('http://127.0.0.1:8080/', headers={'Host':'fixture.invalid','User-Agent':'Synthetic-Offline-Fixture'})
                with opener.open(req, timeout=3) as response:
                    body = response.read(2 * 1024**2 + 1)
                    if len(body) > 2 * 1024**2:
                        raise RuntimeError('Rendered response cap exceeded')
                    public = {'status':response.status,'synthetic_title_present':b'Synthetic Fixture Site' in body}
                break
            except ConnectionError:
                time.sleep(0.15)
            except urllib.error.URLError as exc:
                if isinstance(exc.reason, ConnectionRefusedError):
                    time.sleep(0.15)
                else:
                    raise
        else:
            raise RuntimeError('Local fixture server did not start')
        (evidence / 'public.html').write_bytes(body)
        (evidence / 'public.json').write_text(json.dumps(public, indent=2))
        if public['status'] != 200 or not public['synthetic_title_present']:
            raise RuntimeError('Synthetic public rendering failed')
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
