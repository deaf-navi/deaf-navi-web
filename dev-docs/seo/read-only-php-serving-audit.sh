#!/usr/bin/env bash
# Manual read-only probe through an existing authorized VPS connection.
# No service reload, cache invalidation, deployment, configuration or DB writes.
set -euo pipefail

audit_root=/srv/deafnavi
if [[ ! -L "$audit_root/current" ]]; then
  printf '%s\n' 'STOP: this is not the expected Deaf Navi VPS (current symlink unavailable).'
  exit 2
fi
audit_release=$(readlink -f "$audit_root/current")
case "$audit_release" in
  "$audit_root"/releases/*) ;;
  *) printf '%s\n' 'STOP: current resolves outside the expected release directory.'; exit 2 ;;
esac
printf 'current_realpath=%s\n' "$audit_release"
if [[ -r "$audit_root/shared/last-release" ]]; then
  printf 'last_release='; head -n 1 "$audit_root/shared/last-release"
fi
for audit_file in index.php views.php cafe-ui.php cafe-seo.php core.php public-profile.php; do
  if [[ -r "$audit_release/_backend/$audit_file" ]]; then
    sha256sum "$audit_release/_backend/$audit_file"
  else
    printf 'unreadable_backend_file=%s\n' "$audit_file"
  fi
done

python3 - <<'PY'
from pathlib import Path
import glob
import json
import re
import sqlite3
import urllib.request
from html.parser import HTMLParser

# Only relevant, non-secret directives; do not dump configurations or phpinfo.
config = Path('/etc/caddy/deafnavi.caddy')
pattern = re.compile(r'^\s*(root\s|rewrite\s|php_fastcgi\s|resolve_root_symlink\b|@directory\s|import\s)')
if config.is_file():
    try:
        lines = config.read_text().splitlines()
        print(json.dumps({'caddySnippet': str(config), 'relevantDirectives': [
            {'line': i, 'text': line.strip()} for i, line in enumerate(lines, 1)
            if pattern.search(line)
        ]}, ensure_ascii=False))
    except PermissionError:
        print('caddySnippet=unreadable')
else:
    print('caddySnippet=not_found_at_documented_path')

for pattern in ('/etc/php/*/fpm/php.ini', '/etc/php/*/fpm/conf.d/*opcache*.ini',
                '/etc/php/*/fpm/pool.d/deafnavi*.conf'):
    for name in sorted(glob.glob(pattern)):
        try:
            relevant = [line.strip() for line in Path(name).read_text().splitlines()
                        if re.match(r'^\s*(?:opcache\.(?:enable|validate_timestamps|revalidate_freq|revalidate_path|use_cwd)|realpath_cache_(?:size|ttl))\s*=|^\s*php_(?:admin_)?value\[(?:opcache\.(?:enable|validate_timestamps|revalidate_freq|revalidate_path|use_cwd)|realpath_cache_(?:size|ttl))\]', line)]
            print(json.dumps({'phpConfigFile': name, 'relevantDirectives': relevant}))
        except PermissionError:
            print(json.dumps({'phpConfigFile': name, 'unreadable': True}))
# These are file settings, not proof of the values in the active FPM process.

database = Path('/srv/deafnavi/shared/directory/directory.sqlite')
try:
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as connection:
        connection.execute('PRAGMA query_only=ON')
        connection.row_factory = sqlite3.Row
        rows = connection.execute("""
            SELECT slug, name, kind, country_code, prefecture, city, type,
                   json_extract(payload, '$.shop_type') AS shop_type
            FROM records
            WHERE publication='public' AND slug IN ('very-you', 'rendeaf')
            ORDER BY slug
        """).fetchall()
        print(json.dumps({'publicRecordTitleInputs': [dict(row) for row in rows]}, ensure_ascii=False))
except (sqlite3.Error, PermissionError):
    print('publicRecordTitleInputs=unavailable_with_existing_read_permissions')

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = {'title': '', 'h1': '', 'ogTitle': None, 'twitterTitle': None, 'canonical': None}
        self.capture = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('title', 'h1'):
            self.capture = tag
        if tag == 'meta':
            if attrs.get('property') == 'og:title': self.result['ogTitle'] = attrs.get('content')
            if attrs.get('name') == 'twitter:title': self.result['twitterTitle'] = attrs.get('content')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.result['canonical'] = attrs.get('href')
    def handle_data(self, data):
        if self.capture: self.result[self.capture] += data
    def handle_endtag(self, tag):
        if tag == self.capture: self.capture = None

for slug in ('very-you', 'rendeaf'):
    url = f'https://deafnavi.com/connect/sign-cafe/{slug}/?dn_client=codex'
    request = urllib.request.Request(url, headers={
        'User-Agent': 'Codex-DeafNavi-Verification',
        'X-DeafNavi-Client': 'codex', 'Cache-Control': 'no-cache'
    })
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            parser = Metadata()
            parser.feed(response.read().decode('utf-8'))
            print(json.dumps({'url': url, 'status': response.status,
                              'cafeSeoHeader': response.headers.get('X-DeafNavi-Cafe-SEO'),
                              'cacheControl': response.headers.get('Cache-Control'),
                              **parser.result}, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'url': url, 'readErrorType': type(error).__name__}))
PY
