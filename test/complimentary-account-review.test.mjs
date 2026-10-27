import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {keyFingerprint,publicTextFingerprint,validateAllowance,validateStoredAllowance,createComplimentaryClient,ACCOUNT_REVIEW_MAX_AGE} from '../scripts/complimentary-text-client.mjs';
import {accountGate} from '../scripts/server-curation.mjs';

const key='sk-proj-fixture-not-a-secret',project='proj_fixture',now=Date.parse('2026-10-27T04:00:00Z');
const groups={high:{model:'gpt-6.1-sol',eligible:true,modelAccessVerified:true,groupDailyLimit:1000000},light:{model:'gpt-5.6-terra',eligible:true,modelAccessVerified:true,groupDailyLimit:10000000}};
const review={version:1,status:'verified',projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-6.1-sol',checkedAt:'2026-10-25T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z',keyProjectVerified:true,enrolled:true,sharingEnabled:true,balancePositive:true,groups};
const daily={otherUsageReviewed:true,billingReviewed:true,billingUtcDay:'2026-10-26',billingStatus:'reconciled',settingsChanged:false,anomaliesDetected:false};
const item={id:'public',title:'Captioned theatre',summary:'The city theatre offers Japanese captions.'};
const lease={version:2,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-6.1-sol',utcDay:'2026-10-27',checkedAt:'2026-10-27T03:00:00Z',expiresAt:'2026-10-28T00:00:00Z',enrolled:true,sharingEnabled:true,balancePositive:true,publicDataOnly:true,groupDailyLimit:1000000,observedGroupTokens:0,dailyBudget:99000,accountReview:review,dailyReview:daily,groups:Object.fromEntries(Object.entries(groups).map(([name,g])=>[name,{...g,observedGroupTokens:0}])),approvedTextHashes:[publicTextFingerprint(item)]};
async function fixture(t,value=lease,current=review){const dir=await mkdtemp(join(tmpdir(),'dn-weekly-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(join(dir,'allowance.json'),JSON.stringify(value));if(current)await writeFile(join(dir,'account-review.json'),JSON.stringify(current));await writeFile(join(dir,'key'),key);return dir;}
const response=()=>new Response(JSON.stringify({status:'completed',model:'gpt-6.1-sol',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{id:item.id,title:'字幕付き演劇',summary:'市立劇場で日本語字幕を提供します。'}]})}]}]}));
const record=(dir,input)=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['scripts/record-complimentary-allowance.mjs'],{env:{...process.env,DEAFNAVI_OPENAI_KEY_FILE:join(dir,'key'),DEAFNAVI_OPENAI_PROJECT_ID:project,DEAFNAVI_AI_STATE_DIR:dir},stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('close',code=>resolve({code,stdout,stderr}));child.stdin.end(JSON.stringify(input));
});
test('daily usage reuses two-day-old settings without changing the original check',async t=>{
 const dir=await fixture(t),before=await readFile(join(dir,'account-review.json'),'utf8');let calls=0;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return response();}});
 assert.equal((await run([item])).engine,'openai_complimentary');assert.equal(calls,1);
 assert.equal(await readFile(join(dir,'account-review.json'),'utf8'),before);
 assert.equal((await accountGate({stateDir:dir,key,project,now})).nextSettingsReviewAt,review.expiresAt);
});
test('expired/future/extended settings, changed keys/models, unknown usage and billing cannot send',async t=>{
 const cases=[
  {...lease,checkedAt:'2026-10-26T03:00:00Z'},
  {...lease,accountReview:{...review,checkedAt:'2026-10-28T00:00:00Z'}},
  {...lease,accountReview:{...review,expiresAt:'2026-10-27T04:01:00Z'}},
  {...lease,accountReview:{...review,expiresAt:'2026-11-02T00:00:00Z'}},
  {...lease,accountReview:{...review,keySha256:'other'}},
  {...lease,accountReview:{...review,model:'other'}},
  {...lease,accountReview:{...review,status:'requires-review'}},
  {...lease,dailyReview:{...daily,billingReviewed:false}},
  {...lease,dailyReview:{...daily,billingUtcDay:'2026-10-25'}},
  {...lease,dailyReview:{...daily,billingStatus:'paid'}},
  {...lease,dailyReview:{...daily,settingsChanged:true}},
  {...lease,dailyReview:{...daily,anomaliesDetected:true}},
  {...lease,groups:{...lease.groups,light:{...lease.groups.light,groupDailyLimit:20000000}}},
 ];
 for(const value of cases){const dir=await fixture(t,value,value.accountReview);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return response();}});await assert.rejects(()=>run([item]));assert.equal(calls,0);assert.equal((await accountGate({stateDir:dir,key,project,now})).ready,false);}
});
test('an invalidated or replaced current record stops a previously issued daily permission',async t=>{
 for(const current of [null,{...review,status:'requires-review'},{...review,checkedAt:'2026-10-26T00:00:00Z'}]){
  const dir=await fixture(t,lease,current);await assert.rejects(()=>validateStoredAllowance(lease,{key,project,stateDir:dir,now}));
 }
 const legacy={...lease,version:1};const dir=await fixture(t,legacy,{...review,status:'requires-review'});
 await assert.rejects(()=>validateStoredAllowance(legacy,{key,project,stateDir:dir,now}));
});
test('week expiry cannot be hidden by daily expiry and billing display lag remains pending',()=>{
 assert.throws(()=>validateAllowance({...lease,utcDay:'2026-11-01',checkedAt:'2026-11-01T03:00:00Z',expiresAt:'2026-11-02T00:00:00Z'}, {key,project,now:Date.parse('2026-11-01T04:00:00Z')}),/Weekly/);
 assert.doesNotThrow(()=>validateAllowance({...lease,dailyReview:{...daily,billingStatus:'pending'}},{key,project,now}));
});
test('v2 retains token budget, 16 routine requests, private text and unresolved-request stops',async t=>{
 const dir=await fixture(t);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return response();}});
 await assert.rejects(()=>run([{...item,summary:'Email private@example.com'}]));assert.equal(calls,0);
 for(let i=0;i<16;i++)await run([item]);await assert.rejects(()=>run([item]),/budget/);assert.equal(calls,16);
 const tiny=await fixture(t,{...lease,dailyBudget:100});await assert.rejects(()=>createComplimentaryClient({key,project,stateDir:tiny,clock:()=>now,fetchImpl:async()=>{calls++;return response();}})([item]),/budget/);assert.equal(calls,16);
 await writeFile(join(dir,'inflight.json'),'{}');await assert.rejects(()=>run([item]),/reconciliation/);assert.equal(calls,16);
});
test('authentication failure requires new settings inspection; it never triggers fallback or releases reservation',async t=>{
 const dir=await fixture(t);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return new Response('{}',{status:403});}});
 await assert.rejects(()=>run([item]));await assert.rejects(()=>run([item]),/Weekly/);assert.equal(calls,1);
 const current=JSON.parse(await readFile(join(dir,'account-review.json'),'utf8'));assert.equal(current.status,'requires-review');assert.equal(current.checkedAt,review.checkedAt);
 const ledger=JSON.parse(await readFile(join(dir,'usage-2026-10-27.json'),'utf8'));assert.equal(ledger.records[0].status,'rejected');assert.ok(ledger.records[0].reservedTokens>0);
});
test('recorder separates settings/usage, preserves usage and exact-text approvals, and latches incidents',async t=>{
 const dir=await fixture(t),stamp=new Date().toISOString(),day=stamp.slice(0,10),priorDay=new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const usagePath=join(dir,'usage-'+day+'.json');await writeFile(usagePath,'{"preserve":"original ledger"}');
 const weekly={mode:'weekly-account-check',checkedAt:stamp,model:review.model,keyProjectVerified:true,enrolled:true,sharingEnabled:true,balancePositive:true,groups,browser:'chrome-fallback',evidenceReference:'private/operator-check.json'};
 assert.equal((await record(dir,{...weekly,checkedAt:'invalid'})).code,1);
 assert.equal((await record(dir,weekly)).code,0);
 const saved=await readFile(join(dir,'account-review.json'),'utf8'),settings=JSON.parse(saved);assert.equal(Date.parse(settings.expiresAt)-Date.parse(settings.checkedAt),ACCOUNT_REVIEW_MAX_AGE);
 const input={mode:'daily-usage-check',checkedAt:new Date().toISOString(),otherUsageReviewed:true,billingReviewed:true,billingUtcDay:priorDay,billingStatus:'reconciled',settingsChanged:false,anomaliesDetected:false,observedGroupTokens:{high:564,light:0},dailyBudget:99000,publicDataReviewed:true,reviewedPublicItems:[item]};
 assert.equal((await record(dir,input)).code,0);
 assert.equal((await record(dir,{...input,checkedAt:new Date().toISOString(),reviewedPublicItems:[]})).code,0);
 const next=JSON.parse(await readFile(join(dir,'allowance.json'),'utf8'));assert.equal(next.version,2);assert.equal(next.accountReview.checkedAt,stamp);assert.deepEqual(next.approvedTextHashes,[publicTextFingerprint(item)]);
 assert.equal(await readFile(join(dir,'account-review.json'),'utf8'),saved);assert.equal(await readFile(usagePath,'utf8'),'{"preserve":"original ledger"}');
 const before=await readFile(join(dir,'allowance.json'),'utf8');assert.equal((await record(dir,{...input,anomaliesDetected:true})).code,1);assert.equal(await readFile(join(dir,'allowance.json'),'utf8'),before);
 assert.equal((await record(dir,input)).code,1);assert.equal((await record(dir,{mode:'approve-text',publicDataReviewed:true,reviewedPublicItems:[item]})).code,1);
 assert.equal((await record(dir,{...weekly,mode:'daily-account-check',...input,mode:'daily-account-check'})).code,1);
 assert.equal((await record(dir,{...weekly,checkedAt:new Date().toISOString()})).code,0); // explicitly re-inspect settings
 assert.equal((await record(dir,{...input,checkedAt:new Date().toISOString()})).code,0);
});
