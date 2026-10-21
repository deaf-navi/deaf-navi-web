import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {accountGate,reuseReviewedText,runServerCuration,updateExceptionQueue} from '../scripts/server-curation.mjs';
import {keyFingerprint,publicTextFingerprint} from '../scripts/complimentary-text-client.mjs';
import {evidenceHash,prepareReviewItem} from '../scripts/curation-review-contract.mjs';
import {discoverLinks,runSourceDiscovery} from '../scripts/source-discovery.mjs';
const now=Date.parse('2026-10-21T01:00:00Z'),key='sk-proj-fixture-not-a-secret',project='proj_fixture';
const text='手話交流会を開催します。開催日 2026年11月14日。会場 市民会館。';
const target={kind:'event',recordId:'fixture-event',title:'手話交流会',sourceUrl:'https://example.org/event',sourceMode:'html',officialVerified:true,
  sharingReviewedAt:'2026-10-18T00:00:00Z',approvedDocumentHash:evidenceHash(text),fragments:[text]};
const task={...target,text,sourceTextHash:evidenceHash(text),sourceDocumentHash:evidenceHash(text),retrievedAt:new Date(now).toISOString(),baseline:{startDate:'2026-11-14',venue:'市民会館'}};
const record={kind:'event',recordId:'fixture-event',title:target.title,sourceUrl:target.sourceUrl,sourceMode:'html',publication:'public',verification:'verified',verifiedAt:new Date(now-60000).toISOString(),baseline:task.baseline};
const lease={version:1,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-6.1-sol',utcDay:'2026-10-21',checkedAt:'2026-10-21T00:30:00Z',expiresAt:'2026-10-22T00:00:00Z',enrolled:true,sharingEnabled:true,balancePositive:true,publicDataOnly:true,groupDailyLimit:1_000_000,observedGroupTokens:0,dailyBudget:100_000,approvedTextHashes:[]};
async function fixture(t,value=lease){const stateDir=await mkdtemp(join(tmpdir(),'dn-server-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));if(value)await writeFile(join(stateDir,'allowance.json'),JSON.stringify(value));return {stateDir,key,project,now};}
const prepare=async targets=>({tasks:targets.map(t=>({...task,...t,text,sourceTextHash:evidenceHash(text),sourceDocumentHash:evidenceHash(text),retrievedAt:new Date(now).toISOString()})),exceptions:[]});
const generate=async items=>({model:'gpt-6.1-sol',items:items.map(item=>({id:item.id,relevance:'yes',contentType:'announcement',evidence:'手話交流会を開催します。',facts:[{field:'startDate',value:'2026-11-14',evidence:'開催日 2026年11月14日。'},{field:'venue',value:'市民会館',evidence:'会場 市民会館。'}]}))});
const discover=async()=>({reused:true,scanned:0,candidates:0,newCandidates:0});

test('missing/expired account evidence stops submission without renewing eligibility',async t=>{
 for(const value of [null,{...lease,utcDay:'2026-10-20'},{...lease,sharingEnabled:false}]){
  const opts=await fixture(t,value),before=value?await readFile(join(opts.stateDir,'allowance.json'),'utf8'):null;
  assert.equal((await accountGate(opts)).ready,false);let calls=0;
  const r=await runServerCuration({...opts,records:[record],catalog:{version:1,targets:[target]},prepare,discover,generate:async()=>{calls++;}});
  assert.equal(calls,0);assert.equal(r.status,'account-check-required');assert.equal(r.submittedThisRun,0);
  if(value)assert.equal(await readFile(join(opts.stateDir,'allowance.json'),'utf8'),before);
 }
});
test('unknown in-flight use stops API even when the daily allowance is valid',async t=>{
 const opts=await fixture(t);await writeFile(join(opts.stateDir,'inflight.json'),'{}');assert.equal((await accountGate(opts)).ready,false);
});
test('exact reviewed text is reusable across days but does not move account or review dates',async t=>{
 const opts=await fixture(t);const hashes=await reuseReviewedText([task],[target],opts);
 assert.deepEqual([...hashes],[publicTextFingerprint(prepareReviewItem(task))]);
 const actual=JSON.parse(await readFile(join(opts.stateDir,'allowance.json')));
 const {approvedTextHashes,reusedSharingReviews,...preserved}=actual;const {approvedTextHashes:ignored,...expected}=lease;
 assert.deepEqual(preserved,expected);assert.equal(reusedSharingReviews[0].sharingReviewedAt,target.sharingReviewedAt);
 const before=await readFile(join(opts.stateDir,'allowance.json'),'utf8');await reuseReviewedText([task],[target],opts);
 assert.equal(await readFile(join(opts.stateDir,'allowance.json'),'utf8'),before);
});
test('changed title, excerpt, URL, body, stale fetch or visual source cannot inherit sharing approval',async t=>{
 const opts=await fixture(t);
 for(const changed of [{title:'別の手話交流会'},{text:text+'追加内容'},{sourceUrl:'https://example.org/other'},{sourceDocumentHash:'b'.repeat(64)},
   {sourceMode:'visual'},{retrievedAt:'2026-10-20T00:00:00Z'}])assert.equal((await reuseReviewedText([{...task,...changed}],[target],opts)).size,0);
 assert.deepEqual(JSON.parse(await readFile(join(opts.stateDir,'allowance.json'))).approvedTextHashes,[]);
});
test('server routine matches existing comparison and uses cache on repeated runs without publishing',async t=>{
 const opts=await fixture(t);let calls=0;
 const options={...opts,records:[record],catalog:{version:1,targets:[target]},prepare,discover,generate:async items=>{calls++;return generate(items);}};
 const original=JSON.stringify(record),first=await runServerCuration(options);
 assert.equal(first.corroborated,1);assert.equal(first.submittedThisRun,1);assert.equal(calls,1);
 const second=await runServerCuration(options);assert.equal(second.cached,1);assert.equal(second.submittedThisRun,0);assert.equal(second.comparison.matched,1);
 await runServerCuration(options);assert.equal(calls,1);assert.equal(JSON.stringify(record),original);
 assert.equal(first.publication.changed,0);assert.equal(first.publication.manualReviewTimestampsChanged,false);
});
test('comparison mode never sends or grants text even with valid allowance',async t=>{
 const opts=await fixture(t);let calls=0;
 const r=await runServerCuration({...opts,comparisonOnly:true,records:[record],catalog:{version:1,targets:[target]},prepare,discover,generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.submittedThisRun,0);assert.deepEqual(JSON.parse(await readFile(join(opts.stateDir,'allowance.json'))).approvedTextHashes,[]);
});
test('same-day 48-hour expiry and source changes stay exceptions',async t=>{
 const opts=await fixture(t);let calls=0;
 const r=await runServerCuration({...opts,records:[{...record,verifiedAt:new Date(now-48*3600000).toISOString()}],catalog:{version:1,targets:[target]},prepare,discover,generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.exceptions,1);
 const q=JSON.parse(await readFile(join(opts.stateDir,'curation-exceptions.json')));assert.deepEqual(q.items[0].reasons,['publication-review-required']);
});
test('exception queue separates unchanged issues, changed reasons and resolved issues',()=>{
 const entry={kind:'event',recordId:'one',reasons:['missing-date']};const a=updateExceptionQueue(null,[entry],now);
 const b=updateExceptionQueue(a,[entry],now+1000);assert.deepEqual(b.newOrChanged,[]);assert.equal(b.items[0].firstSeenAt,a.items[0].firstSeenAt);
 const c=updateExceptionQueue(b,[{...entry,reasons:['source-document-changed']}],now+2000);assert.deepEqual(c.newOrChanged,['event:one']);
 const d=updateExceptionQueue(c,[],now+3000);assert.equal(d.items.length,0);assert.equal(d.resolved.length,1);
});
test('discovery links remain private candidates and reject off-origin, private operations, unrelated links',()=>{
 const html='<a href="/event/1">手話カフェ交流会を開催</a><a href="https://other.org/2">手話カフェ交流会を開催</a><a href="/admin">手話カフェ交流会を開催</a><a href="/general">英会話イベント開催</a><a href="/event/2?token=secret">手話カフェ交流会を開催</a>';
 const found=discoverLinks(html,{id:'source',url:'https://example.org/'});assert.equal(found.length,1);assert.equal(found[0].publicationApproved,false);assert.equal(found[0].reviewedAt,null);
 assert.equal(discoverLinks(html,{id:'source',url:'https://example.org/'},['https://example.org/event/1']).length,0);
});
test('daily discovery is bounded and not fetched again after account approval',async t=>{
 const opts=await fixture(t);let calls=0;
 const sources=Array.from({length:12},(_,i)=>({id:'source-'+i,url:'https://example.org/'+i}));
 const options={...opts,sources,fetchResource:async()=>{calls++;return {status:200,headers:{'content-type':'text/html'},text:'<a href="/event/1">手話カフェ交流会を開催</a>'};}};
 const first=await runSourceDiscovery(options);assert.equal(first.scanned,8);assert.equal(calls,8);assert.equal(first.candidates,1);
 assert.equal((await runSourceDiscovery(options)).reused,true);assert.equal(calls,8);
});
