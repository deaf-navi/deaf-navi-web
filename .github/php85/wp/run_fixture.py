import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from fetch_verified import acquire
from compare_results import compare

MYSQL = 'mysql@sha256:6f3a50835c54d61ffdcf78d71381ba268c27804cd96755231d2fd6f180f822f0'
HERE = Path(__file__).resolve().parent

def main():
    if len(sys.argv)!=3 or os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('RUNNER_ENVIRONMENT')!='github-hosted' or os.environ.get('RUNNER_OS')!='Linux':
        raise RuntimeError('Fresh GitHub-hosted Linux runner and IMAGE EVIDENCE_DIR required')
    image = sys.argv[1]
    if not image or image.startswith('-') or any(c.isspace() for c in image):
        raise RuntimeError('Invalid supplied local PHP image')
    evidence_arg = Path(sys.argv[2]).absolute()
    if evidence_arg.is_symlink() or (evidence_arg.exists() and any(evidence_arg.iterdir())):
        raise RuntimeError('Evidence directory must be new or empty and not a symlink')
    evidence = evidence_arg.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    runner_temp = Path(os.environ['RUNNER_TEMP']).resolve()
    if not runner_temp.is_dir() or runner_temp == Path('/'):
        raise RuntimeError('Expected scoped runner temporary directory')
    run_id = os.environ.get('GITHUB_RUN_ID','')
    if not run_id.isdigit():
        raise RuntimeError('Numeric GitHub run ID required')
    ident = 'wp85-' + run_id + '-' + uuid.uuid4().hex[:10]
    scratch = Path(tempfile.mkdtemp(prefix=ident+'-', dir=runner_temp)).resolve()
    if not scratch.is_relative_to(runner_temp):
        raise RuntimeError('Scratch boundary violation')
    network, db = ident+'-net', ident+'-db'
    names = [db]
    deadline = time.monotonic()+450
    result = {'status':'RUNNING','run_id':ident,'production_data_used':False,'mail_delivery_tested':False,'mysql_image':MYSQL}
    def cmd(args, limit=60, check=True):
        remaining = deadline-time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Fixture overall time budget exhausted')
        proc = subprocess.run(args, capture_output=True, timeout=min(limit,remaining))
        if check and proc.returncode:
            raise RuntimeError('Command failed: '+args[0]+' '+(args[1] if len(args)>1 else '')+'; '+proc.stderr.decode(errors='replace')[-1500:])
        return proc
    def stop_on_signal(signum, frame):
        raise TimeoutError('Fixture time limit/cancellation received')
    signal.signal(signal.SIGTERM, stop_on_signal)
    signal.signal(signal.SIGINT, stop_on_signal)
    def own_resource(kind, name):
        inspected = subprocess.run(['docker',kind,'inspect',name], capture_output=True,timeout=8)
        if inspected.returncode:
            return False
        obj = json.loads(inspected.stdout)[0]
        labels = obj.get('Labels',{}) if kind=='network' else obj.get('Config',{}).get('Labels',{})
        return (labels or {}).get('codex.fixture.id')==ident
    try:
        image_info = json.loads(cmd(['docker','image','inspect',image]).stdout)[0]
        result['php_image_id'] = image_info['Id']
        verified = acquire(scratch/'packages')
        (evidence/'official-package-verification.json').write_text(json.dumps(verified,indent=2))
        cmd(['docker','pull',MYSQL],limit=140)
        cmd(['docker','network','create','--internal','--label','codex.fixture.id='+ident,network])
        network_info = json.loads(cmd(['docker','network','inspect',network]).stdout)[0]
        if not network_info.get('Internal'):
            raise RuntimeError('Network external isolation flag missing')
        (evidence/'internal-network.json').write_text(json.dumps(network_info,indent=2))
        init_sql = scratch/'init.sql'
        init_sql.write_text("CREATE DATABASE IF NOT EXISTS wp_fixture_smtp;\nGRANT ALL ON wp_fixture_smtp.* TO 'fixture'@'%';\n")
        init_sql.chmod(0o644)
        cmd(['docker','run','-d','--name',db,'--label','codex.fixture.id='+ident,'--network',network,'--network-alias','fixture-db','--dns','127.0.0.1','--memory','1536m','--pids-limit','256',
             '--tmpfs','/var/lib/mysql:rw,size=1073741824,mode=1777','-e','MYSQL_ROOT_PASSWORD=Fixture-Only-Root-Password-42!','-e','MYSQL_DATABASE=wp_fixture_default','-e','MYSQL_USER=fixture','-e','MYSQL_PASSWORD=Fixture-Only-DB-Password-42!',
             '--mount',f'type=bind,src={init_sql},dst=/docker-entrypoint-initdb.d/fixture.sql,readonly',MYSQL],limit=45)
        for attempt in range(70):
            ready = cmd(['docker','exec','-e','MYSQL_PWD=Fixture-Only-DB-Password-42!',db,'mysql','-h','127.0.0.1','-ufixture','-Nse','SELECT 1','wp_fixture_smtp'],limit=5,check=False)
            if ready.returncode==0 and ready.stdout.strip()==b'1':
                break
            time.sleep(0.7)
        else:
            raise RuntimeError('Disposable MySQL readiness timeout')
        db_info = json.loads(cmd(['docker','container','inspect',db]).stdout)[0]
        if set(db_info['NetworkSettings']['Networks']) != {network} or db_info['HostConfig'].get('PortBindings'):
            raise RuntimeError('Unexpected DB network or exposed ports')
        db_ip = db_info['NetworkSettings']['Networks'][network]['IPAddress']
        fixture = scratch/'fixture'
        fixture.mkdir()
        for name in ('bootstrap-fixture.php','fixture-guard.php','wp-config.fixture.php','container-check.py'):
            shutil.copyfile(HERE/name,fixture/name)
        (fixture/'FIXTURE_ONLY').write_text('Synthetic disposable fixture only\n')
        def protected_hashes(site):
            return {p.relative_to(site).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(site.rglob('*')) if p.is_file() and not p.relative_to(site).as_posix().startswith('wp-content/plugins/wp-mail-smtp/')}
        def plugin_matches(site, version):
            folder=site/'wp-content/plugins/wp-mail-smtp'
            expected={r['path']:r['sha256'] for r in verified['packages'][version]['files']}
            actual={p.relative_to(folder).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file()}
            if actual != expected:
                raise RuntimeError('Installed plugin bytes differ from official manifest')
        for scenario in ('default','smtp'):
            site=scratch/('site-'+scenario)
            shutil.copytree(scratch/'packages/wordpress',site)
            target=site/'wp-content/plugins/wp-mail-smtp'
            if target.exists():
                raise RuntimeError('Unexpected plugin destination in fresh core')
            shutil.copytree(scratch/'packages/4.9.0',target)
            shutil.copyfile(fixture/'wp-config.fixture.php',site/'wp-config.php')
            mu=site/'wp-content/mu-plugins'
            mu.mkdir(exist_ok=True)
            shutil.copyfile(fixture/'fixture-guard.php',mu/'000-fixture-guard.php')
            immutable=protected_hashes(site)
            for stage,version in [('old','4.9.0'),('new','4.10.3')]:
                if stage=='new':
                    if target.resolve()!=site.resolve()/'wp-content/plugins/wp-mail-smtp' or target.is_symlink():
                        raise RuntimeError('Plugin replacement boundary violation')
                    target.rename(scratch/('saved-old-plugin-'+scenario))
                    shutil.copytree(scratch/'packages/4.10.3',target)
                plugin_matches(site,version)
                out=evidence/scenario/stage
                out.mkdir(parents=True)
                out.chmod(0o777)
                name=ident+'-'+scenario+'-'+stage
                names.append(name)
                args=['docker','create','--name',name,'--label','codex.fixture.id='+ident,'--user','10001:10001','--network',network,'--dns','127.0.0.1','--add-host','fixture-db:'+db_ip,'--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--tmpfs','/tmp:rw,mode=1777','--memory','768m','--pids-limit','128','--workdir','/var/www/html',
                      '-e','FIXTURE_ONLY=1','-e','FIXTURE_SCENARIO='+scenario,'-e','HTTP_PROXY=','-e','HTTPS_PROXY=','-e','ALL_PROXY=','-e','http_proxy=','-e','https_proxy=','-e','all_proxy=',
                      '--mount',f'type=bind,src={site},dst=/var/www/html,readonly','--mount',f'type=bind,src={fixture},dst=/fixture,readonly','--mount',f'type=bind,src={out},dst=/evidence','--entrypoint','python3',image,'/fixture/container-check.py',stage]
                cmd(args)
                inspected=json.loads(cmd(['docker','container','inspect',name]).stdout)[0]
                if set(inspected['NetworkSettings']['Networks'])!={network} or inspected['HostConfig'].get('PortBindings'):
                    raise RuntimeError('Unexpected app network or exposed ports')
                run=cmd(['docker','start','-a',name],limit=110,check=False)
                (out/'container.stdout').write_bytes(run.stdout)
                (out/'container.stderr').write_bytes(run.stderr)
                final=json.loads(cmd(['docker','container','inspect',name]).stdout)[0]
                if run.returncode or final['State']['ExitCode']!=0:
                    raise RuntimeError('Fixture container failed: '+scenario+'/'+stage)
                if protected_hashes(site)!=immutable:
                    raise RuntimeError('Non-plugin fixture source changed')
                plugin_matches(site,version)
            (evidence/scenario/'immutable-source-sha256.json').write_text(json.dumps(immutable,indent=2))
        result.update(compare(evidence))
        result['immutable_inputs_preserved']=True
        if result['status']!='PASS':
            raise RuntimeError('Synthetic fixture comparison failed; see report checks')
    except Exception as exc:
        result['status']='FAIL'
        result['error_type']=type(exc).__name__
        result['error']=str(exc)
    finally:
        result['finished_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        cleanup=[]
        for name in reversed(names):
            try:
                if own_resource('container',name):
                    removed=subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=15)
                    cleanup.append({'container':name,'rc':removed.returncode})
            except Exception as exc:
                cleanup.append({'container':name,'error':type(exc).__name__})
        try:
            if own_resource('network',network):
                removed=subprocess.run(['docker','network','rm',network],capture_output=True,timeout=10)
                cleanup.append({'network':network,'rc':removed.returncode})
        except Exception as exc:
            cleanup.append({'network':network,'error':type(exc).__name__})
        if scratch.is_dir() and not scratch.is_symlink() and scratch.parent==runner_temp and scratch.name.startswith(ident+'-'):
            shutil.rmtree(scratch)
        result['cleanup']=cleanup
        (evidence/'result.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({'status':result['status'],'evidence':str(evidence)}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':
    raise SystemExit(main())
