import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,cpSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),dir=mkdtempSync(join(tmpdir(),'deafnavi-social-')),backend=join(dir,'backend'),backup=join(dir,'backup');mkdirSync(backup);cpSync(join(root,'server'),backend,{recursive:true});
const baseline=JSON.parse(readFileSync(join(backend,'seed.json'),'utf8')),manifest=JSON.parse(readFileSync(join(root,'content/connect/social-links-20260906.json'),'utf8'));
for(const u of manifest.updates){const p=baseline.find(p=>p.id===u.id);for(const k of Object.keys(u.links))delete p[k];}
writeFileSync(join(backend,'seed.json'),JSON.stringify(baseline));
const env={...process.env,DEAFNAVI_DATA_DIR:join(dir,'data'),DEAFNAVI_LOCAL_TEST:'1'},run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});
const hash=run(['test/directory-hash.php'],randomBytes(24).toString('hex')).stdout;assert.equal(run([join(backend,'cli.php'),'init'],JSON.stringify({username:'testadmin',password_hash:hash})).status,0);
const core=join(root,'server/core.php').replaceAll('\\','/');
const state=()=>JSON.parse(run(['-r',`require '${core}';echo json(['users'=>query('SELECT * FROM users')->fetchAll(),'settings'=>query('SELECT * FROM settings')->fetchAll(),'submissions'=>query('SELECT * FROM submissions')->fetchAll(),'outbox'=>query('SELECT * FROM outbox')->fetchAll(),'records'=>query('SELECT * FROM records ORDER BY id')->fetchAll()]);`]).stdout);
const before=state();let result=run(['server/import-social-links.php','content/connect/social-links-20260906.json',backup]);assert.equal(result.status,0,result.stderr);
const after=state();for(const k of ['users','settings','submissions','outbox'])assert.deepEqual(after[k],before[k]);
assert.equal(after.records.length,29);let count=0;
for(const row of before.records){const next=after.records.find(r=>r.id===row.id),u=manifest.updates.find(u=>u.id===row.id);if(!u){assert.deepEqual(next,row);continue;}
 const original=JSON.parse(row.payload),updated=JSON.parse(next.payload);for(const [k,v] of Object.entries(original))if(!(k in u.links))assert.deepEqual(updated[k],v,k);for(const [k,v] of Object.entries(u.links)){assert.equal(updated[k],v);count++;}assert.equal(next.revision,row.revision+1);}
result=run(['server/import-social-links.php','content/connect/social-links-20260906.json',backup]);assert.equal(result.status,1);assert.deepEqual(state(),after);assert.equal(readdirSync(backup).length,1);
console.log(JSON.stringify({result:'SOCIAL_IMPORT_TESTS_OK',updated:8,links:count,recordsPreserved:29,unrelatedValuesUnchanged:true,repeatRejected:true}));
