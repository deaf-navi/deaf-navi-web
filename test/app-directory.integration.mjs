import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const dir=mkdtempSync(join(tmpdir(),'deafnavi-app-api-'));
const env={...process.env,DEAFNAVI_DATA_DIR:dir,DEAFNAVI_LOCAL_TEST:'1'};
function php(code){const result=spawnSync('php',['-r',`require 'server/core.php';${code}`],{cwd:root,env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout;}
const password=spawnSync('php',['test/directory-hash.php'],{cwd:root,input:randomBytes(20).toString('hex'),encoding:'utf8'});
const init=spawnSync('php',['server/cli.php','init'],{cwd:root,env,input:JSON.stringify({username:'appfixture',password_hash:password.stdout}),encoding:'utf8'});
assert.equal(init.status,0,init.stderr);
php(`$p=json_decode(query("SELECT payload FROM records WHERE id='knot'")->fetchColumn(),true);$p['review_notes']='PRIVATE_REVIEW_SENTINEL';$p['email']='PRIVATE_EMAIL_SENTINEL';$p['beginner_welcome']=true;$p['writing_support']=null;query("UPDATE records SET payload=? WHERE id='knot'",[json($p)]);`);
const server=spawn('php',['-S','127.0.0.1:5237','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let errors='';server.stderr.on('data',d=>errors+=d);
const url='http://127.0.0.1:5237/connect/sign-cafe/app-v1.json';
try {
  for(let i=0;i<50;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const before=php(`echo json(query('SELECT * FROM records ORDER BY id')->fetchAll());`);
  const response=await fetch(url);assert.equal(response.status,200);
  const raw=await response.text(),data=JSON.parse(raw);
  assert.equal(data.schemaVersion,'deaf-navi-directory.v1');assert.ok(Array.isArray(data.cafes)&&Array.isArray(data.events));
  assert.ok(!raw.includes('PRIVATE_')&&!raw.includes('review_notes')&&!raw.includes('password'));
  assert.ok(!data.cafes.some(p=>p.id==='biwako-wa'),'unpublished records stay private');
  const knot=data.cafes.find(p=>p.id==='knot');assert.equal(knot.beginnerWelcome,true);assert.equal(knot.writingSupport,null);
  assert.ok(data.cafes.every(p=>p.group!=='events'),'single events are separate');
  assert.equal(php(`echo json(query('SELECT * FROM records ORDER BY id')->fetchAll());`),before,'GET never modifies records');
  assert.equal((await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
  assert.equal(await (await fetch(url,{method:'HEAD'})).text(),'');
  assert.equal((await fetch(url,{method:'POST'})).status,405);
  php(`query("UPDATE records SET publication='pending' WHERE id='knot'");`);
  const changed=await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(changed.status,200);
  assert.ok(!(await changed.json()).cafes.some(p=>p.id==='knot'),'withdrawals disappear from next snapshot');
  php(`query("UPDATE records SET publication='pending'");`);
  const empty=await (await fetch(url)).json();assert.deepEqual(empty.cafes,[]);assert.deepEqual(empty.events,[]);
  const ended=JSON.parse(php(`require 'server/app-directory.php';$p=json_decode(query("SELECT payload FROM records WHERE id='knot'")->fetchColumn(),true);$p['status']='permanently_closed';$p['activity_date']='2099-01-01';echo json(app_directory_event($p));`));
  assert.equal(ended.status,'ended','closure is not evidence that a particular event was cancelled');
  assert.equal(ended.period,'past');
  assert.ok(!errors.includes('PHP Fatal error'),errors);
  console.log('App directory: privacy, tri-state fields, read-only, conditional requests, withdrawal and empty snapshot passed.');
} finally {server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));rmSync(dir,{recursive:true,force:true});}
