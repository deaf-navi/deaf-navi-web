import json
from pathlib import Path
import re

def compare(root):
    summary = {'status':'PASS', 'scenarios':{}, 'real_mail_delivery_tested':False}
    for scenario in ('default','smtp'):
        old, new = root / scenario / 'old', root / scenario / 'new'
        before = json.loads((old / 'snapshot.json').read_text())
        after = json.loads((new / 'snapshot.json').read_text())
        checks = {
            'versions': before['plugin_version']=='4.9.0' and after['plugin_version']=='4.10.3',
            'selected_settings_equal': before['selected_settings_sha256']==after['selected_settings_sha256'],
            'raw_options_equal': before['raw_option_sha256']==after['raw_option_sha256'],
            'dummy_values_as_expected': before['expected_dummy_values'] and after['expected_dummy_values'],
            'password_roundtrip': before['smtp_dummy_password_roundtrip'] and after['smtp_dummy_password_roundtrip'],
            'active': before['active'] and after['active'],
        }
        install = json.loads((old / (scenario+'-install-runtime.json')).read_text())
        checks['installation_mail_blocked'] = install['mail_blocked'] >= 1 and install['mail_delivery_success'] is False
        runtimes = [json.loads(p.read_text()) for p in new.glob('*-runtime.json')]
        checks['new_runtime_diagnostics_clear'] = bool(runtimes) and all(not r['diagnostics'] and not r['fatal'] for r in runtimes)
        new_lint = json.loads((new / 'lint.json').read_text())
        old_lint = json.loads((old / 'lint.json').read_text())
        checks['new_compile_diagnostics_clear'] = bool(new_lint) and all(r['rc']==0 and not r['diagnostics'] for r in new_lint)
        checks['new_stderr_clear'] = all(not p.read_text().strip() for p in new.glob('*.stderr'))
        checks['new_public_log_clear'] = not re.search(r'(?:PHP )?(?:Warning|Deprecated|Fatal error|Parse error):', (new/'public-server.log').read_text())
        for label, folder in [('old',old),('new',new)]:
            public = json.loads((folder/'public.json').read_text())
            checks[label+'_public_ok'] = public['status']==200 and public['synthetic_title_present']
        summary['scenarios'][scenario] = {'checks':checks,'old_compile_diagnostic_files':sum(bool(r['diagnostics']) for r in old_lint),'new_php_files':len(new_lint)}
        if not all(checks.values()):
            summary['status']='FAIL'
    return summary
