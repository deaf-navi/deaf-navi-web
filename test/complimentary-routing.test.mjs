import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createComplimentaryClient,keyFingerprint,publicTextFingerprint,selectComplimentaryModel,validateAllowance} from '../scripts/complimentary-text-client.mjs';
const now=Date.parse('2026-10-18T04:00:00Z'),key='sk-proj-fixture',project='proj_fixture';
const items=[{id:'0',title:'字幕付き公演のお知らせ',summary:'劇場で日本語字幕を提供します。'}];
const groups={high:{model:'gpt-6.1-sol',eligible:true,modelAccessVerified:true,groupDailyLimit:1000000,observedGroupTokens:1000000},light:{model:'gpt-5.6-terra',eligible:true,modelAccessVerified:true,groupDailyLimit:10000000,observedGroupTokens:10}};
const lease={version:1,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-6.1-sol',utcDay:'2026-10-18',checkedAt:'2026-10-18T03:00:00Z',expiresAt:'2026-10-19T00:00:00Z',enrolled:true,sharingEnabled:true,balancePositive:true,publicDataOnly:true,groupDailyLimit:1000000,observedGroupTokens:1000000,dailyBudget:100000,groups,approvedTextHashes:items.map(publicTextFingerprint)};
const response=model=>new Response(JSON.stringify({model,status:'completed',usage:{input_tokens:50,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items})}]}]}));
async function fixture(t,overrides={}){const dir=await mkdtemp(join(tmpdir(),'dn-routing-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(join(dir,'allowance.json'),JSON.stringify({...lease,...overrides}));return dir;}
test('separate verified light group handles depleted high group before sending',()=>{
 assert.deepEqual(validateAllowance(lease,{key,project,now}),{day:'2026-10-18',budget:100000});
 assert.equal(selectComplimentaryModel(lease,{records:[]},12000),'gpt-5.6-terra');
 const high={...lease,groups:{...groups,high:{...groups.high,observedGroupTokens:0}}};
 assert.equal(selectComplimentaryModel(high,{records:[]},12000),'gpt-6.1-sol');
 for(const light of [{...groups.light,eligible:false},{...groups.light,model:'gpt-6-luna'},{...groups.light,groupDailyLimit:1000000}])assert.throws(()=>validateAllowance({...lease,groups:{...groups,light}},{key,project,now}));
 for(const light of [{...groups.light,modelAccessVerified:false},{...groups.light,observedGroupTokens:9999999}])assert.throws(()=>selectComplimentaryModel({...lease,groups:{...groups,light}},{records:[]},12000));
});
test('research is explicit, has no request-count cap, and cannot reset routine or token accounting',async t=>{
 const dir=await fixture(t);const records=Array.from({length:16},()=>({status:'completed',model:'gpt-6.1-sol',reservedTokens:100,inputTokens:50,outputTokens:20}));
 await writeFile(join(dir,'usage-2026-10-18.json'),JSON.stringify({version:1,day:'2026-10-18',projectId:project,reserved:1600,records}));
 let calls=0;const options={key,project,stateDir:dir,clock:()=>now,fetchImpl:async(_url,options)=>{calls++;return response(JSON.parse(options.body).model);}};
 const run=createComplimentaryClient({...options,allowResearch:true});
 await assert.rejects(()=>run(items),/budget reached/);
 await assert.rejects(()=>createComplimentaryClient(options)(items,{runMode:'research'}),/authorization/);
 for(let i=0;i<3;i++)assert.equal((await run(items,{runMode:'research'})).model,'gpt-5.6-terra');
 const ledger=JSON.parse(await readFile(join(dir,'usage-2026-10-18.json'),'utf8'));
 assert.deepEqual(ledger.records.slice(0,16),records);assert.equal(ledger.records.length,19);assert.equal(calls,3);
 await assert.rejects(()=>run(items),/budget reached/);
 await writeFile(join(dir,'allowance.json'),JSON.stringify({...lease,dailyBudget:1000}));
 await assert.rejects(()=>run(items,{runMode:'research'}),/budget reached/);assert.equal(calls,3);
});
test('HTTP rejection does not cause model switching or a second request',async t=>{
 const dir=await fixture(t,{observedGroupTokens:0,groups:{...groups,high:{...groups.high,observedGroupTokens:0}}});let calls=0;
 const run=createComplimentaryClient({key,project,stateDir:dir,clock:()=>now,fetchImpl:async()=>{calls++;return new Response('{}',{status:429});}});
 await assert.rejects(()=>run(items));assert.equal(calls,1);
});
test('local usage after account inspection reduces each group and probe never authorizes routine fallback',()=>{
 const used={records:[{timestamp:new Date(now).toISOString(),model:'gpt-5.6-terra',status:'rejected',reservedTokens:999000}]};
 assert.throws(()=>selectComplimentaryModel(lease,used,12000));
 const pending={...lease,groups:{...groups,light:{...groups.light,modelAccessVerified:false}}};
 assert.throws(()=>selectComplimentaryModel(pending,{records:[]},12000));
 assert.equal(selectComplimentaryModel(pending,{records:[]},12000,{research:true,modelOverride:'gpt-5.6-terra'}),'gpt-5.6-terra');
 assert.throws(()=>selectComplimentaryModel(pending,{records:[]},12000,{modelOverride:'gpt-5.6-terra'}));
});
