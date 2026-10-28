import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {accountGate,reuseReviewedText,runServerCuration,updateExceptionQueue} from '../scripts/server-curation.mjs';
import {keyFingerprint,publicTextFingerprint} from '../scripts/complimentary-text-client.mjs';
import {evidenceHash,prepareReviewItem} from '../scripts/curation-review-contract.mjs';
import {discoverLinks,runSourceDiscovery} from '../scripts/source-discovery.mjs';
import {planCurationAttention} from '../scripts/curation-attention.mjs';
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

test('optional thumbnail failure does not interrupt text review and comparison does not fetch images',async t=>{
 const opts=await fixture(t);let calls=0;
 const options={...opts,records:[],catalog:{version:1,targets:[]},discover,collectThumbnails:async()=>{calls++;throw Error('fixture metadata storage error');}};
 const result=await runServerCuration(options);
 assert.equal(result.overseasThumbnails.status,'metadata-check-failed');assert.equal(result.overseasThumbnails.fetched,null);
 assert.equal(result.submittedThisRun,0);assert.equal(result.publication.changed,0);
 const compared=await runServerCuration({...options,comparisonOnly:true});
 assert.equal(calls,1);assert.equal(compared.overseasThumbnails,null);
});

test('overseas tasks use the same daily account and exact-sharing gate as domestic tasks',async t=>{
 const excerpt='Our cafe is open Tuesday to Saturday.';
 const overseas={...target,kind:'overseas_cafe',role:'published',recordId:'overseas',facilityId:'overseas',fragments:[excerpt],approvedDocumentHash:evidenceHash(excerpt),publicationHash:'a'.repeat(64),baseline:{requiredFields:['businessHours'],facts:{businessHours:'Tuesday to Saturday'}}};
 const overseasSnapshot={records:[{id:'overseas',sourceUrls:[target.sourceUrl],publicationHash:overseas.publicationHash}]};
 for(const value of [null,lease]){
  const opts=await fixture(t,value);let calls=0;
  const result=await runServerCuration({...opts,records:[],catalog:{version:1,targets:[],overseasCafeTargets:[overseas]},overseasSnapshot,discover,
   prepare:async targets=>({tasks:targets.map(x=>({...x,text:excerpt,sourceDocumentHash:evidenceHash(excerpt),sourceTextHash:evidenceHash(excerpt),retrievedAt:new Date(now).toISOString()})),exceptions:[]}),
   generate:async items=>{calls++;return {model:'gpt-6.1-sol',items:items.map(i=>({id:i.id,relevance:'yes',contentType:'other',evidence:excerpt,facts:[{field:'businessHours',value:'Tuesday to Saturday',evidence:excerpt}]}))};}});
  assert.equal(calls,value?1:0);assert.equal(result.overseas.submittedThisRun,value?1:0);assert.equal(result.publication.changed,0);
  if(value){const stored=JSON.parse(await readFile(join(opts.stateDir,'allowance.json')));assert.equal(stored.checkedAt,value.checkedAt);assert.equal(stored.expiresAt,value.expiresAt);assert.equal(stored.dailyBudget,value.dailyBudget);}
 }
});

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

test('visual deadlines remain due without changing the API exception, and clear after a real review',()=>{
 const visual={...record,sourceMode:'visual',verifiedAt:new Date(now).toISOString()};
 const original=JSON.stringify(visual);
 const fresh=planCurationAttention([visual],null,now);assert.equal(fresh.counts.due,0);
 const expiring=planCurationAttention([visual],fresh,now+24*3600000);
 assert.equal(expiring.items[0].reason,'visual-review-due-before-next-run');assert.equal(expiring.newOrChanged.length,1);
 const same=planCurationAttention([visual],expiring,now+25*3600000);
 assert.equal(same.due.length,1);assert.equal(same.newOrChanged.length,0);
 const expired=planCurationAttention([visual],same,now+48*3600000);
 assert.equal(expired.items[0].reason,'freshness-expired');assert.equal(expired.newOrChanged.length,1);
 const recovered=planCurationAttention([{...visual,verifiedAt:new Date(now+48*3600000).toISOString()}],expired,now+48*3600000);
 assert.equal(recovered.due.length,0);assert.deepEqual(recovered.cleared,['event:fixture-event']);
 assert.equal(JSON.stringify(visual),original);assert.equal(recovered.manualReviewTimestampsChanged,false);
});
test('attention separates undated/far-future/past records and groups source reads while keeping every occurrence',()=>{
 const v={...record,sourceMode:'visual',verifiedAt:new Date(now-48*3600000).toISOString()};
 const r=planCurationAttention([v,{...v,recordId:'near',baseline:{startDate:'2026-10-22'}},
  {...v,recordId:'past',baseline:{startDate:'2026-10-20'}},
  {...v,recordId:'far',baseline:{startDate:'2027-03-04'}},
  {...v,recordId:'undated',baseline:{startDate:''}},
  {...v,recordId:'private',publication:'draft'},
  {...v,recordId:'theater',eventKind:'theater',baseline:{startDate:'2027-03-04'}}],null,now);
 assert.equal(r.items.length,3);assert.equal(r.items[0].recordId,'near');assert.equal(r.sourceGroups.length,1);
 assert.equal(r.sourceGroups[0].recordKeys.length,3);assert.equal(r.undated.length,1);assert.equal(r.outsideHorizon.length,2);
 const jst=planCurationAttention([{...v,baseline:{startDate:'2026-10-21'}}],null,Date.parse('2026-10-21T15:00:00Z'));
 assert.equal(jst.items.length,0);
});
test('HTML freshness, future dates and revision mismatches cannot be mistaken for a fresh approval',()=>{
 const r=planCurationAttention([{...record,recordId:'future',verifiedAt:new Date(now+1000).toISOString()},
  {...record,recordId:'old',verifiedAt:new Date(now-48*3600000).toISOString()},
  {...record,recordId:'revision',kind:'cafe',revision:2,sourceRecordRevision:1},
  {...record,recordId:'fresh',verifiedAt:new Date(now-36*3600000).toISOString()}],null,now);
 assert.deepEqual(r.items.map(x=>x.recordId).sort(),['future','old','revision']);
 assert.ok(r.items.every(x=>x.action==='check-source-change-or-recovery'));
});
test('attention is recomputed even when same-day visual API results are reused',async t=>{
 const opts=await fixture(t),v={...record,sourceMode:'visual',verifiedAt:new Date(now-47*3600000).toISOString()};
 const options={...opts,records:[v],catalog:{version:1,targets:[]},prepare,discover,generate:async()=>assert.fail('no API')};
 const first=await runServerCuration(options);assert.equal(first.attention.expiringVisual,1);
 const later=await runServerCuration({...options,now:now+3600000});assert.equal(later.attention.expired,1);assert.equal(later.reusedRun,true);
 assert.deepEqual(later.newOrChangedExceptions,[]);
});
test('discovery recognizes cafe announcement wording and exact specialist series without approving general events',()=>{
 const source={id:'cafe',url:'https://example.org/',discoveryGroup:'cafe',candidatePathPrefixes:['/news/'],cafeTitleTerms:['みみカフェ']};
 const found=discoverLinks('<a href=/news/1>11月 本好きさんの手話べり会</a><a href="/news/2">11月 ろう者とおしゃべり</a><a href="/news/3">保護者向け みみカフェ 11月</a><a href="/other/4">保護者向け みみカフェ 11月</a><a href="/news/5">11月の一般読書会</a>',source);
 assert.deepEqual(found.map(x=>x.url),['https://example.org/news/1','https://example.org/news/2','https://example.org/news/3']);
 assert.ok(found.every(x=>x.publicationApproved===false&&x.reviewedAt===null));
});
test('Starbucks sign cafe links use the ordinary unapproved candidate flow',()=>{
 const source={id:'community',url:'https://example.org/events/',discoveryGroup:'cafe'};
 const found=discoverLinks('<a href="/events/sign-cafe">スターバックスで手話カフェ開催</a><a href="/events/writing">スタバで筆談交流を開催</a><a href="/events/coffee">スターバックスのコーヒーセミナー開催</a><a href="/stores/1">スターバックス店舗案内</a>',source);
 assert.deepEqual(found.map(x=>x.url),['https://example.org/events/sign-cafe','https://example.org/events/writing']);
 assert.ok(found.every(x=>x.status==='unverified-candidate'&&x.publicationApproved===false&&x.reviewedAt===null));
});
test('discovery reserves cafe coverage, rotates fairly and retains eight-fetch limit after same-day input changes',async t=>{
 const opts=await fixture(t),sources=Array.from({length:16},(_,i)=>({id:'s'+i,url:'https://example.org/'+i,...(i<8?{discoveryGroup:'cafe'}:{})}));
 const calls=[];const options={...opts,sources,fetchResource:async url=>{calls.push(url);return {status:200,headers:{'content-type':'text/html'},text:''};}};
 await runSourceDiscovery(options);assert.equal(calls.length,8);
 const first=JSON.parse(await readFile(join(opts.stateDir,'curation-discovery.json')));
 assert.equal(first.results.filter(x=>x.discoveryGroup==='cafe').length,4);
 await runSourceDiscovery({...options,knownUrls:['https://example.org/new-publication']});assert.equal(calls.length,8);
 await runSourceDiscovery({...options,sources:[...sources,{id:'new',url:'https://example.org/new'}]});assert.equal(calls.length,8);
 await runSourceDiscovery({...options,now:now+86400000});assert.equal(calls.length,16);assert.equal(new Set(calls).size,16);
});
