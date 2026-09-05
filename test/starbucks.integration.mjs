import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,cpSync,writeFileSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),dir=mkdtempSync(join(tmpdir(),'deafnavi-starbucks-')),backend=join(dir,'backend'),backup=join(dir,'backup');mkdirSync(backup);cpSync(join(root,'server'),backend,{recursive:true});
const baseline=spawnSync('git',['show','df7639338d20458414925381384c8dd245911ce8:server/seed.json'],{cwd:root,encoding:'utf8'});assert.equal(baseline.status,0);writeFileSync(join(backend,'seed.json'),baseline.stdout);
const env={...process.env,DEAFNAVI_DATA_DIR:join(dir,'data'),DEAFNAVI_LOCAL_TEST:'1'},run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});
const password=randomBytes(24).toString('hex'),hash=run(['test/directory-hash.php'],password).stdout;
assert.equal(run([join(backend,'cli.php'),'init'],JSON.stringify({username:'testadmin',password_hash:hash})).status,0);
const core=join(root,'server/core.php').replaceAll('\\','/');
const state=()=>JSON.parse(run(['-r',`require '${core}';echo json(['users'=>query('SELECT * FROM users')->fetchAll(),'settings'=>query('SELECT * FROM settings')->fetchAll(),'submissions'=>query('SELECT * FROM submissions')->fetchAll(),'outbox'=>query('SELECT * FROM outbox')->fetchAll(),'records'=>query('SELECT * FROM records ORDER BY id')->fetchAll()]);`]).stdout);
const before=state(),result=run(['server/import-starbucks.php','content/connect/starbucks-observed-20260905.json',backup]);assert.equal(result.status,0,result.stderr);
const after=state();for(const k of ['users','settings','submissions','outbox'])assert.deepEqual(after[k],before[k]);for(const row of before.records)assert.deepEqual(after.records.find(r=>r.id===row.id),row);assert.equal(after.records.length,29);assert.equal(readdirSync(backup).length,1);
assert.equal(run(['server/import-starbucks.php','content/connect/starbucks-observed-20260905.json',backup]).status,1);assert.deepEqual(state(),after);
const server=spawn('php',['-S','127.0.0.1:5189','-t','docs','server/local-router.php'],{cwd:root,env,stdio:'ignore'});let cookie='';
const request=async(path,data)=>{const r=await fetch('http://127.0.0.1:5189'+path,{method:data?'POST':'GET',redirect:'manual',headers:{cookie,...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});for(const c of r.headers.getSetCookie())if(c.startsWith('deafnavi_directory='))cookie=c.split(';')[0];return {status:r.status,text:await r.text()};};
const token=t=>t.match(/name="csrf" value="([a-f0-9]+)"/)[1];
const reset=()=>assert.equal(run(['-r',`require '${core}';query('DELETE FROM limits');`]).status,0);
try{
for(let i=0;i<50;i++){try{await request('/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
let r=await request('/connect/sign-cafe/starbucks/');assert.equal((r.text.match(/class="dn-observed-card"/g)||[]).length,3);
assert.equal((await request('/connect/sign-cafe/starbucks/observed-machida-pario/')).text.includes('"@type":"Event"'),false);
const fixture={form_kind:'starbucks',store_id:'starbucks-machida-pario',report_state:'scheduled',event_date:'',conditions:'あ'.repeat(500),consent:'1'};
for(const bad of [{conditions:'あ'.repeat(501)},{event_date:'2026-02-30'},{start_time:'24:00'},{start_time:'12:00',end_time:'11:00'},{source_url:'javascript:alert(1)'},{store_id:'knot'},{consent:'0'},{store_id:'',store_name:'新店舗',prefecture:''}]){
 reset();r=await request('/submit/?category=starbucks');const csrf=token(r.text);await new Promise(r=>setTimeout(r,3100));assert.equal((await request('/submit/',{...fixture,...bad,csrf})).status,400);
}
reset();r=await request('/submit/?category=starbucks');let csrf=token(r.text);await new Promise(r=>setTimeout(r,3100));
assert.equal((await request('/submit/',{...fixture,csrf:'invalid'})).status,403);assert.equal((await request('/submit/',{...fixture,csrf})).status,303);
r=await request('/submit/?category=starbucks');csrf=token(r.text);await new Promise(r=>setTimeout(r,3100));assert.equal((await request('/submit/',{...fixture,store_id:'',store_name:'検証用の未掲載店舗',prefecture:'東京都',conditions:'店頭で見ました',csrf})).status,303);
const saved=state();assert.equal(saved.submissions.length,2);assert.ok(saved.submissions.every(s=>s.status==='pending'));assert.equal(saved.outbox.length,2);assert.ok(saved.outbox.every(s=>s.status==='pending'));assert.deepEqual(saved.records,after.records);
assert.equal((await request('/connect/sign-cafe/starbucks/')).text.includes('検証用の未掲載店舗'),false);
console.log(JSON.stringify({result:'STARBUCKS_TESTS_OK',importAdded:6,existingRowsPreserved:23,repeatRejected:true,validationCases:8,pendingSubmissions:2,noAutoPublication:true,noEmailSent:true}));
}finally{server.kill();}
