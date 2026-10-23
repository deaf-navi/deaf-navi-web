import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createComplimentaryClient,keyFingerprint,validateAllowance,publicTextFingerprint,summarizeComplimentaryUsage} from '../scripts/complimentary-text-client.mjs';
import {prepareReviewItem} from '../scripts/curation-review-contract.mjs';
const now=Date.parse('2026-10-18T03:00:00Z'),key='sk-proj-fixture-not-a-secret',project='proj_fixture';
const lease={version:1,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-6.1-sol',utcDay:'2026-10-18',checkedAt:'2026-10-18T02:00:00Z',expiresAt:'2026-10-19T00:00:00Z',enrolled:true,sharingEnabled:true,balancePositive:true,publicDataOnly:true,groupDailyLimit:1_000_000,observedGroupTokens:0,dailyBudget:100_000};
const items=[{id:'0',topic:'文化',original_title:'Captioned theatre on 2026-10-25',original_summary:'The city theatre offers Japanese captions.'}];
async function fixture(t,overrides={}){const dir=await mkdtemp(join(tmpdir(),'dn-free-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(join(dir,'allowance.json'),JSON.stringify({...lease,approvedTextHashes:items.map(publicTextFingerprint),...overrides}));return dir;}
const result=()=>new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{id:'0',title:'字幕付き演劇',summary:'市立劇場で日本語字幕を提供します。'}]})}]}]}),{status:200});
test('completed review keeps valid evidence and isolates invalid evidence after recording all usage',async t=>{
 const reviewItems=['one','two'].map(id=>prepareReviewItem({kind:'event',sourceUrl:'https://example.org/'+id,title:'手話交流会',text:'手話交流会を開催します。開催日2026年11月14日。会場は市民会館。'}));
 const dir=await fixture(t,{approvedTextHashes:reviewItems.map(publicTextFingerprint)});
 const decisions=reviewItems.map((item,i)=>({id:item.id,relevance:'yes',contentType:'announcement',evidence:i?'偽の根拠文です':'手話交流会を開催します。',facts:[]}));
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>new Response(JSON.stringify({status:'completed',model:'gpt-6.1-sol',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items:decisions})}]}]}))});
 const answer=await run(reviewItems,{purpose:'curation_review'});assert.equal(answer.items.length,1);assert.deepEqual(answer.rejectedItems,[{id:reviewItems[1].id,reason:'api-evidence-invalid',validationCode:'quote-not-in-source'}]);
 const ledger=JSON.parse(await readFile(join(dir,'usage-2026-10-18.json'),'utf8'));assert.equal(ledger.records[0].status,'completed');assert.equal(ledger.records[0].outputTokens,50);
});
test('no request without current-day project-bound complimentary eligibility',async t=>{
 for(const override of [{projectId:'other'},{keySha256:'bad'},{model:'other'},{model:'gpt-5.6-sol'},{enrolled:false},{sharingEnabled:false},{balancePositive:false},{utcDay:'2026-10-17'},{expiresAt:'invalid'},{expiresAt:'2026-10-18T03:01:00Z'},{dailyBudget:100001},{observedGroupTokens:999999}]){
  const dir=await fixture(t,override);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return result();}});
  await assert.rejects(()=>run(items));assert.equal(calls,0);
 }
 assert.deepEqual(validateAllowance(lease,{key,project,now}),{day:'2026-10-18',budget:100000});
});
test('sends only bounded public text, records actual usage without storing prompt or credentials',async t=>{
 const dir=await fixture(t);let sent;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);assert.equal(options.headers['OpenAI-Project'],project);return result();}});
 const answer=await run(items);assert.equal(answer.engine,'openai_complimentary');assert.equal(answer.items[0].title,'字幕付き演劇');assert.equal(sent.tools,undefined);assert.equal(sent.store,false);assert.equal(sent.service_tier,'default');
 assert.equal(sent.model,'gpt-6.1-sol');assert.deepEqual(sent.reasoning,{effort:'low'});assert.equal(sent.temperature,undefined);
 const raw=await readFile(join(dir,'usage-2026-10-18.json'),'utf8'),log=JSON.parse(raw);assert.equal(log.records[0].inputTokens,100);assert.equal(log.records[0].outputTokens,50);assert.equal(log.records[0].billedCostUsd,null);assert.ok(log.reserved>150);assert.ok(!raw.includes(key)&&!raw.includes(items[0].original_title));
});
test('private case data, secrets and unsupported purposes never reach the API',async t=>{
 const dir=await fixture(t);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return result();}});
 for(const entry of [{...items[0],topic:'医療・健康'},{...items[0],original_summary:'Email someone@example.com'},{...items[0],original_summary:'password: test'},{...items[0],original_summary:'A patient was diagnosed'}])await assert.rejects(()=>run([entry]));
 await assert.rejects(()=>run(items,{purpose:'arbitrary_agent'}));assert.equal(calls,0);
});

test('new or changed public text and corrupted reservations cannot spend the allowance',async t=>{
 const dir=await fixture(t);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return result();}});
 await assert.rejects(()=>run([{...items[0],original_title:'Another public story'}]),/not been approved/);
 await writeFile(join(dir,'usage-2026-10-18.json'),JSON.stringify({version:1,day:'2026-10-18',projectId:project,reserved:0,records:[{status:'completed',reservedTokens:20000}]}));
 await assert.rejects(()=>run(items),/reconciliation/);assert.equal(calls,0);
});
test('unknown result is charged conservatively to the local budget and blocks automatic retry',async t=>{
 const dir=await fixture(t);let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;throw new Error('timeout');}});
 await assert.rejects(()=>run(items));await assert.rejects(()=>run(items));assert.equal(calls,1);
 const log=JSON.parse(await readFile(join(dir,'usage-2026-10-18.json'),'utf8'));assert.equal(log.records[0].status,'uncertain');assert.ok(log.reserved>0);
});
test('budget is reserved before transmission and concurrent requests cannot spend it twice',async t=>{
 const dir=await fixture(t,{dailyBudget:30000});let calls=0;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return result();}});
 const results=await Promise.allSettled([run(items),run(items)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(calls,1);
 for(let i=1;i<16;i++)await run(items);
 await assert.rejects(()=>run(items),/Daily complimentary budget reached/);assert.equal(calls,16);
 const ledger=JSON.parse(await readFile(join(dir,'usage-2026-10-18.json'),'utf8'));
 assert.ok(ledger.reserved>30000);assert.equal(summarizeComplimentaryUsage(ledger,{day:lease.utcDay,project}).accountedTokens,2400);
});

test('model rejection records a support reference without storing error body or releasing budget',async t=>{
 const dir=await fixture(t);
 const requestId='req_rejected_fixture';
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>new Response(JSON.stringify({error:{code:'model_not_found',type:'invalid_request_error',message:'Private detail '+key}}),{status:403,headers:{'x-request-id':requestId}})});
 await assert.rejects(()=>run(items),/OpenAI request unavailable/);
 const raw=await readFile(join(dir,'usage-2026-10-18.json'),'utf8'),ledger=JSON.parse(raw),record=ledger.records[0];
 assert.equal(record.requestId,requestId);assert.equal(record.apiErrorCode,'model_not_found');assert.equal(record.apiErrorType,'invalid_request_error');
 assert.equal(record.status,'rejected');assert.equal(record.httpStatus,403);assert.ok(!raw.includes(key)&&!raw.includes('Private detail'));
 assert.equal(summarizeComplimentaryUsage(ledger,{day:lease.utcDay,project}).heldTokens,record.reservedTokens);
});

test('existing v1 successful reservations settle to measured usage without rewriting history',async t=>{
 const dir=await fixture(t,{dailyBudget:30000});
 const old={version:1,day:lease.utcDay,projectId:project,reserved:29000,records:[
  {status:'completed',reservedTokens:18000,inputTokens:300,outputTokens:100},
  {status:'rejected',httpStatus:403,reservedTokens:11000,inputTokens:null,outputTokens:null},
 ]};
 await writeFile(join(dir,'usage-2026-10-18.json'),JSON.stringify(old));
 let calls=0;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return result();}});
 await run(items);assert.equal(calls,1);
 const ledger=JSON.parse(await readFile(join(dir,'usage-2026-10-18.json'),'utf8'));
 assert.deepEqual(ledger.records.slice(0,2),old.records);
 const summary=summarizeComplimentaryUsage(ledger,{day:lease.utcDay,project});
 assert.equal(summary.actualTokens,550);assert.equal(summary.heldTokens,11000);assert.equal(summary.accountedTokens,11550);
 assert.ok(summary.historicalReservedTokens>30000);
});

test('rejects corrupted successful usage, exhausted actual budget and unresolved records',async t=>{
 for(const record of [
  {status:'completed',reservedTokens:25000,inputTokens:null,outputTokens:10},
  {status:'completed',reservedTokens:25000,inputTokens:24999,outputTokens:2},
  {status:'completed',reservedTokens:25000,inputTokens:20000,outputTokens:5000},
  {status:'uncertain',reservedTokens:25000,inputTokens:null,outputTokens:null},
 ]){
  const dir=await fixture(t,{dailyBudget:30000});
  await writeFile(join(dir,'usage-2026-10-18.json'),JSON.stringify({version:1,day:lease.utcDay,projectId:project,reserved:25000,records:[record]}));
  let calls=0;const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return result();}});
  await assert.rejects(()=>run(items));assert.equal(calls,0);
 }
});

test('inconsistent provider totals keep the reservation and block retry',async t=>{
 const dir=await fixture(t);let calls=0;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({usage:{input_tokens:100,output_tokens:50,total_tokens:151}}));}});
 await assert.rejects(()=>run(items),/Token usage unavailable/);
 await assert.rejects(()=>run(items),/Previous request requires reconciliation/);assert.equal(calls,1);
});

test('World can return reviewed items only without sending unreviewed text',async t=>{
 const dir=await fixture(t);let sent;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async(_url,options)=>{sent=JSON.parse(JSON.parse(options.body).input);return result();}});
 const answer=await run([...items,{id:'1',title:'Unreviewed story',summary:'Not approved for sharing.'}],{skipUnreviewed:true});
 assert.equal(answer.items.length,1);assert.equal(sent.length,1);assert.equal(sent[0].id,'0');
});

test('unknown request remains blocked after the UTC day and allowance change',async t=>{
 const dir=await fixture(t);let calls=0,time=now;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>time,fetchImpl:async()=>{calls++;throw new Error('timeout');}});
 await assert.rejects(()=>run(items));time+=86400000;
 await writeFile(join(dir,'allowance.json'),JSON.stringify({...lease,utcDay:'2026-10-19',checkedAt:'2026-10-19T02:00:00Z',expiresAt:'2026-10-20T00:00:00Z',approvedTextHashes:items.map(publicTextFingerprint)}));
 await assert.rejects(()=>run(items),/Previous request requires reconciliation/);assert.equal(calls,1);
});

test('daily recorder requires explicit current-model verification and preserves prior usage',async t=>{
 const dir=await fixture(t),keyFile=join(dir,'key');await writeFile(keyFile,key);
 const before=await readFile(join(dir,'allowance.json'),'utf8');
 const usageFile=join(dir,'usage-'+new Date().toISOString().slice(0,10)+'.json');
 const previousUsage=JSON.stringify({reserved:22161,records:[{model:'gpt-5.6-sol',status:'completed'}]});
 await writeFile(usageFile,previousUsage);
 const input={mode:'daily-account-check',checkedAt:new Date().toISOString(),keyProjectVerified:true,otherUsageReviewed:true,enrolled:true,sharingEnabled:true,balancePositive:true,groupDailyLimit:1000000,observedGroupTokens:486,dailyBudget:99000,publicDataReviewed:true,reviewedPublicItems:items};
 const record=model=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/record-complimentary-allowance.mjs'],{env:{...process.env,DEAFNAVI_OPENAI_KEY_FILE:keyFile,DEAFNAVI_OPENAI_PROJECT_ID:project,DEAFNAVI_AI_STATE_DIR:dir},stdio:['pipe','pipe','pipe']});
  let output='';child.stdout.on('data',x=>output+=x);child.stderr.resume();child.once('error',reject);child.once('close',code=>resolve({code,output}));child.stdin.end(JSON.stringify({...input,model}));
 });
 for(const model of [undefined,'gpt-5.6-sol']){assert.equal((await record(model)).code,1);assert.equal(await readFile(join(dir,'allowance.json'),'utf8'),before);}
 const result=await record('gpt-6.1-sol');assert.equal(result.code,0);assert.equal(JSON.parse(result.output).model,'gpt-6.1-sol');
 assert.equal(await readFile(usageFile,'utf8'),previousUsage);
 const recorded=JSON.parse(await readFile(join(dir,'allowance.json'),'utf8'));
 assert.equal(recorded.model,'gpt-6.1-sol');assert.equal(recorded.dailyBudget,99000);assert.deepEqual(recorded.approvedTextHashes,items.map(publicTextFingerprint));
});
