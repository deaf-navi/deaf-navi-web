import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planOverseasCafeReview,runOverseasCafeReview} from '../scripts/overseas-cafe-review.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
import {evidenceHash,prepareReviewItem,validateReviewResult} from '../scripts/curation-review-contract.mjs';
import {discoverLinks,runSourceDiscovery} from '../scripts/source-discovery.mjs';
import {planOverseasRotation,overseasTargetSignature,overseasDailyItemLimit} from '../scripts/overseas-cafe-rotation.mjs';
const now=Date.parse('2026-10-28T03:00:00Z'),text='Our cafe is open Tuesday to Saturday. Visit Bischofstrasse 11.';
const target={kind:'overseas_cafe',recordId:'gutmut-hours',role:'published',facilityId:'gutmut',sourceUrl:'https://example.org/cafe',title:'Cafe opening hours',sourceMode:'html',officialVerified:true,sharingReviewedAt:'2026-10-28T02:00:00Z',approvedDocumentHash:evidenceHash(text),publicationHash:'a'.repeat(64),fragments:[text],baseline:{requiredFields:['businessHours'],facts:{businessHours:'Tuesday to Saturday'}}};
const snapshot={version:1,records:[{id:'gutmut',publicationHash:'a'.repeat(64),sourceUrls:[target.sourceUrl]}]};
const decision=id=>({id,relevance:'yes',contentType:'other',evidence:'Our cafe is open Tuesday to Saturday.',facts:[{field:'businessHours',value:'Tuesday to Saturday',evidence:'Our cafe is open Tuesday to Saturday.'}]});
const prepare=(targets,options)=>prepareCurationReview(targets,{...options,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text})});
async function fixture(t){const stateDir=await mkdtemp(join(tmpdir(),'overseas-review-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));return {stateDir,now,snapshot,catalog:{overseasCafeTargets:[target]},prepare,canSubmit:()=>true,generate:async items=>({model:'fixture',items:items.map(i=>decision(i.id))})};}
test('literal multilingual evidence, no invented dates, levels, translated facts or unsupported field',()=>{
 const item=prepareReviewItem({...target,text});validateReviewResult([item],{items:[decision(item.id)]});
 for(const fact of [{field:'businessHours',value:'火曜から土曜',evidence:'Our cafe is open Tuesday to Saturday.'},{field:'startDate',value:'2026-10-28',evidence:'Our cafe is open Tuesday to Saturday.'}])assert.throws(()=>validateReviewResult([item],{items:[{...decision(item.id),facts:[fact]}]}));
});
test('existing published hash, exact sharing and official MOFA URL are required',()=>{
 assert.equal(planOverseasCafeReview(snapshot,{overseasCafeTargets:[target]},now).selected.length,1);
 for(const patch of [{publicationHash:'b'.repeat(64)},{sharingReviewedAt:null},{role:'travel',sourceUrl:'https://example.org/risk'}])assert.equal(planOverseasCafeReview(snapshot,{overseasCafeTargets:[{...target,...patch}]},now).selected.length,0);
});
test('source-only differences retain the field-name array used by existing consumers',async t=>{
 const opts=await fixture(t);opts.catalog={overseasCafeTargets:[{...target,comparisonScopes:{businessHours:'source-only'},baseline:{requiredFields:['businessHours'],facts:{businessHours:'Monday'}}}]};
 const r=await runOverseasCafeReview(opts),e=r.entries[0];
 assert.deepEqual(e.differences,['businessHours']);assert.deepEqual(e.differenceScopes,{businessHours:'source-only'});
 assert.ok(e.reasons.includes('differs-from-current'));assert.equal(e.publicationApproved,false);
});
test('API response cached across days; no DB changes or confirmation renewal',async t=>{
 const opts=await fixture(t);let calls=0;opts.generate=async items=>{calls++;return {model:'fixture',items:items.map(i=>decision(i.id))};};
 const r=await runOverseasCafeReview(opts);assert.equal(r.corroborated,1);assert.equal(calls,1);assert.equal(r.reviewedAt,null);assert.equal(r.publicationApproved,false);
 assert.equal((await runOverseasCafeReview(opts)).reusedRun,true);
 assert.equal((await runOverseasCafeReview({...opts,now:now+86400000})).cached,1);assert.equal(calls,1);
});
test('changed and unapproved sources never go to the API',async t=>{
 const opts=await fixture(t);let calls=0;opts.generate=async()=>{calls++;throw Error('forbidden');};
 const r=await runOverseasCafeReview({...opts,canSubmit:()=>false});assert.equal(r.submittedThisRun,0);assert.equal(calls,0);
 const changed=await runOverseasCafeReview({...opts,now:now+86400000,prepare:(targets,o)=>prepareCurationReview(targets,{...o,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text:text+' Changed hours.'})})});
 assert.equal(changed.entries[0].reasons[0],'source-document-changed');assert.equal(calls,0);
});
test('twenty-five candidates rotate across days without reopening the daily cap',async t=>{
 const opts=await fixture(t);opts.snapshot={records:[]};opts.catalog={overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4},overseasCafeTargets:Array.from({length:25},(_,i)=>({...target,role:'candidate',recordId:'candidate-'+i,sourceUrl:'https://example.org/'+i}))};
 const r=await runOverseasCafeReview(opts);assert.equal(r.selected,24);assert.equal(r.deferred.length,1);assert.ok(r.entries[0].reasons.includes('identity-review-required'));
 assert.equal((await runOverseasCafeReview({...opts,approvalSignature:'changed'})).selected,0);
 const next=await runOverseasCafeReview({...opts,now:now+86400000});assert.equal(next.entries[0].recordId,'candidate-9');
});
test('unknown API outcome stops second batch and remains unresolved',async t=>{
 const opts=await fixture(t);opts.snapshot={records:[]};opts.catalog={overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4},overseasCafeTargets:Array.from({length:8},(_,i)=>({...target,role:'candidate',recordId:'candidate-'+i,sourceUrl:'https://example.org/'+i}))};
 let calls=0;opts.generate=async()=>{calls++;throw Error('unknown');};const r=await runOverseasCafeReview(opts);assert.equal(calls,1);assert.equal(r.submittedThisRun,null);
 assert.equal(r.entries.filter(e=>e.reasons.includes('batch-stopped-after-api-error')).length,4);
 const again=await runOverseasCafeReview({...opts,approvalSignature:'renewed',now:now+86400000});assert.equal(again.submittedThisRun,null);assert.equal(calls,1);
 assert.ok(again.entries.every(e=>e.machineCheckedAt===null||e.machineCheckedAt===new Date(now).toISOString()));
});

test('a deployment carries forward the eight already attempted sources and uses only sixteen more',()=>{
 const eligible=Array.from({length:40},(_,i)=>({...target,recordId:'p-'+i}));
 const previous={day:'2026-10-28',attempted:eligible.slice(0,8).map(t=>t.recordId)};
 const r=planOverseasRotation({eligible,sharedIds:new Set(eligible.map(t=>t.recordId)),previous,now,dailyItems:24});
 assert.equal(r.selected.length,16);assert.equal(r.attempted.length,8);
 assert.ok(r.selected.every(t=>!previous.attempted.includes(t.recordId)));
});

test('verified no-send capacity exhaustion defers further work and resumes on the next normal day',async t=>{
 const opts=await fixture(t);opts.snapshot={records:[]};
 opts.catalog={overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4},overseasCafeTargets:Array.from({length:12},(_,i)=>({...target,role:'candidate',recordId:'candidate-'+i,sourceUrl:'https://example.org/'+i}))};
 let calls=0,prepared=0;const basePrepare=opts.prepare;
 opts.prepare=(...args)=>{prepared+=args[0].length;return basePrepare(...args);};
 opts.generate=async()=>{calls++;throw Object.assign(Error('no send'),{code:'complimentary_unavailable',submissionState:'not-sent',deferReason:'daily-request-limit'});};
 const r=await runOverseasCafeReview(opts);
 assert.equal(calls,1);assert.equal(prepared,4);assert.equal(r.submittedThisRun,0);
 assert.equal(r.capacity.stoppedBy,'daily-request-limit');assert.equal(r.attempted.length,4);
 assert.equal(r.deferred.filter(x=>x.reason==='daily-request-limit').length,8);
 assert.ok(r.entries.every(e=>e.status==='deferred'&&e.publicationApproved===false));
 const next=await runOverseasCafeReview({...opts,now:now+86400000,generate:async items=>({model:'fixture',items:items.map(i=>decision(i.id))})});
 assert.equal(next.submittedThisRun,12);assert.equal(next.capacity.stoppedBy,null);
});

test('unshared registered leads and published pages are locally watched, not submitted',async t=>{
 const opts=await fixture(t);let calls=0,fetches=0;
 const unapproved={...target,role:'candidate',recordId:'lead',officialVerified:false};
 const o={...opts,catalog:{overseasCafeTargets:[unapproved]},generate:async()=>{calls++;},fetchResource:async()=>{fetches++;return {status:200,headers:{'content-type':'text/html'},text:'<p>Unshared public source</p>'};}};
 const r=await runOverseasCafeReview(o);assert.equal(calls,0);assert.equal(fetches,1);assert.equal(r.selected,2);assert.equal(r.entries.length,2);
 assert.ok(r.entries.every(e=>e.fetchStatus==='fetched-unshared'&&e.reviewedAt===null));
 assert.deepEqual((await runOverseasCafeReview({...o,now:now+86400000})).newOrChanged,[]);
 const changed=await runOverseasCafeReview({...o,now:now+7*86400000,fetchResource:async()=>{throw Error('unavailable');}});
 assert.equal(changed.newOrChanged.length,2);assert.ok(changed.entries.every(e=>e.machineCheckedAt===new Date(now).toISOString()));
 assert.equal(calls,0);
});

test('a baseline cannot silently omit its required published comparison value',()=>{
 const r=planOverseasCafeReview(snapshot,{overseasCafeTargets:[{...target,baseline:{requiredFields:['businessHours'],facts:{}}}]},now);
 assert.equal(r.selected.length,0);assert.ok(r.entries.some(e=>e.reasons.includes('structured-baseline-required')));
});

test('rotation gives published comparisons precedence, keeps candidate fairness and strict daily caps',()=>{
 const eligible=[...Array.from({length:4},(_,i)=>({...target,role:'travel',recordId:'travel-'+i})),...Array.from({length:25},(_,i)=>({...target,recordId:'published-'+i})),...Array.from({length:15},(_,i)=>({...target,role:'candidate',recordId:'probe-'+i}))];
 const sharedIds=new Set(eligible.filter(t=>t.role!=='candidate').map(t=>t.recordId));
 const first=planOverseasRotation({eligible,sharedIds,now,dailyItems:24});assert.equal(first.selected.length,24);
 assert.equal(first.selected.filter(t=>t.role==='travel').length,3);assert.equal(first.selected.filter(t=>t.role==='published').length,20);assert.equal(first.selected.filter(t=>t.role==='candidate').length,1);
 assert.ok(first.deferred.some(d=>d.reason==='daily-travel-limit'));
 const previous={day:'2026-10-28',attempted:first.selected.map(t=>t.recordId),entries:first.selected.map(t=>({recordId:t.recordId,lastAttemptedAt:new Date(now).toISOString(),targetSignature:overseasTargetSignature(t),decision:{}}))};
 assert.equal(planOverseasRotation({eligible,sharedIds,previous,now:now+1000,dailyItems:24}).selected.length,0);
 const next=planOverseasRotation({eligible,sharedIds,previous,now:now+86400000,dailyItems:24});assert.ok(next.selected.some(t=>t.recordId==='published-5'));assert.ok(next.selected.some(t=>t.recordId==='probe-1'));
});

test('retry and explicit waiting have deadlines; changed reviewed conditions and travel bypass them',()=>{
 const eligible=[target,{...target,recordId:'travel',role:'travel'}],sharedIds=new Set(eligible.map(t=>t.recordId));
 const prior={recordId:target.recordId,lastAttemptedAt:new Date(now-3600000).toISOString(),fingerprint:'fp',targetSignature:overseasTargetSignature(target),consecutiveSourceFailures:2};
 const previous={entries:[prior,{...prior,recordId:'travel',targetSignature:overseasTargetSignature(eligible[1])}]};
 const args={eligible,sharedIds,previous,now};const r=planOverseasRotation(args);
 assert.deepEqual(r.selected.map(t=>t.recordId),['travel']);assert.ok(r.deferred[0].nextCheckAt);
 assert.equal(planOverseasRotation({...args,now:now+4*86400000}).selected.length,2);
 assert.equal(planOverseasRotation({...args,eligible:[{...target,approvedDocumentHash:'b'.repeat(64)}]}).selected.length,1);
 previous.entries[0].consecutiveSourceFailures=0;
 const decisions=[{key:'overseas:'+target.recordId,fingerprint:'fp',disposition:'waiting-source',reviewedAt:new Date(now-1000).toISOString(),nextCheckAt:new Date(now+86400000).toISOString()}];
 assert.equal(planOverseasRotation({...args,decisions}).deferred[0].reason,'waiting-source-until');
 decisions[0].fingerprint='obsolete';assert.equal(planOverseasRotation({...args,decisions}).selected.length,2);
});
test('English discovery is private, rejects external operations and is weekly',async t=>{
 const opts=await fixture(t),source={id:'press',url:'https://example.org/',topicScope:'overseas-cafe'},html='<a href="/store">New Deaf Signing Coffee Store</a><a href="/travel">Safe holiday packages</a><a href="https://other.org/cafe">Deaf signing cafe</a><a href="/donate.html">Support the café</a>';
 assert.equal(discoverLinks(html,source).length,1);let calls=0;
 assert.equal(discoverLinks(html,{...source,operatorVerified:true}).length,1);
 const o={...opts,sources:[source],weeklyOverseas:true,fetchResource:async()=>{calls++;return {status:200,headers:{'content-type':'text/html'},text:html};}};
 assert.equal((await runSourceDiscovery(o)).newCandidates,1);assert.equal((await runSourceDiscovery({...o,now:now+86400000})).reused,true);assert.equal(calls,1);
});

test('existing donation candidates retain history outside the review queue, without re-fetching',async t=>{
 const opts=await fixture(t),path=join(opts.stateDir,'overseas-cafe-discovery.json'),source={id:'operator',url:'https://example.org/',topicScope:'overseas-cafe',operatorVerified:true};
 await writeFile(path,JSON.stringify({day:'2026-10-28',week:'2026-10-24',signature:'old-rule',generatedAt:new Date(now).toISOString(),results:Array.from({length:8},(_,i)=>({sourceId:'already-'+i,status:'fetched'})),candidates:[{id:'donation',url:'https://example.org/donate.html',title:'Support the café',sourceId:'operator',firstSeenAt:new Date(now).toISOString()}]}));
 const r=await runSourceDiscovery({...opts,sources:[source],weeklyOverseas:true,fetchResource:async()=>{throw Error('must not refetch');}});
 assert.equal(r.attemptedThisRun,0);assert.equal(r.candidates,0);
 const saved=JSON.parse(await readFile(path));assert.equal(saved.reviewQueue.length,0);assert.equal(saved.excludedCandidates[0].id,'donation');
});

test('capacity opt-in is explicit and cannot exceed the fixed hard limit',()=>{
 assert.equal(overseasDailyItemLimit({}),8);
 assert.equal(overseasDailyItemLimit({overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4}}),24);
 assert.equal(overseasDailyItemLimit({overseasRotationPolicy:{version:1,dailyItems:36,batchItems:4}}),36);
 for(const policy of [{version:1,dailyItems:35,batchItems:4},{version:1,dailyItems:37,batchItems:4},{version:1,dailyItems:100,batchItems:4},{version:1,dailyItems:24,batchItems:20},null])assert.throws(()=>overseasDailyItemLimit({overseasRotationPolicy:policy}));
});

// Review orchestration integration: expanding a live day must retain its prior IDs.
test('36-item policy processes only twelve more after 24, in batches of four',async t=>{
 const opts=await fixture(t);opts.snapshot={records:[]};const targets=Array.from({length:40},(_,i)=>({...target,role:'candidate',recordId:'candidate-'+i,sourceUrl:'https://example.org/'+i}));
 opts.catalog={overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4},overseasCafeTargets:targets};
 const acquisitions=[],batches=[];opts.prepare=(ts,o)=>{acquisitions.push(...ts.map(t=>t.recordId));return prepare(ts,o);};opts.generate=async items=>{batches.push(items.map(i=>i.id));return {model:'fixture',items:items.map(i=>decision(i.id))};};
 const first=await runOverseasCafeReview(opts);assert.equal(first.attempted.length,24);assert.equal(batches.length,6);
 opts.catalog.overseasRotationPolicy.dailyItems=36;
 const expanded=await runOverseasCafeReview({...opts,now:now+1000});
 assert.equal(expanded.selected,12);assert.equal(expanded.submittedThisRun,12);assert.equal(expanded.capacity.attemptedToday,36);assert.equal(expanded.capacity.actuallyAttemptedThisRun,12);assert.equal(expanded.capacity.maxBatches,9);assert.equal(expanded.capacity.remainingToday,0);
 assert.equal(new Set(acquisitions).size,36);assert.equal(acquisitions.length,36);assert.ok(first.attempted.every(id=>expanded.attempted.includes(id)));assert.equal(batches.length,9);assert.ok(batches.every(x=>x.length===4));
 const again=await runOverseasCafeReview({...opts,approvalSignature:'changed',now:now+2000});assert.equal(again.selected,0);assert.equal(again.submittedThisRun,0);assert.equal(acquisitions.length,36);assert.equal(batches.length,9);
});

test('36-item rotation preserves three travel slots and candidate fairness',()=>{
 const eligible=[...Array.from({length:4},(_,i)=>({...target,role:'travel',recordId:'travel-'+i})),...Array.from({length:40},(_,i)=>({...target,recordId:'published-'+i})),{...target,role:'candidate',recordId:'candidate'}];
 const r=planOverseasRotation({eligible,sharedIds:new Set(eligible.map(t=>t.recordId)),now,dailyItems:36});assert.equal(r.selected.length,36);assert.equal(r.selected.filter(t=>t.role==='travel').length,3);assert.equal(r.selected.filter(t=>t.role==='published').length,32);assert.equal(r.selected.filter(t=>t.role==='candidate').length,1);
});


test('explicit fresh full-document reapproval resumes API without HTTP or resetting attempted IDs',async t=>{
 const opts=await fixture(t);let fetches=0,calls=0;
 const changed=text+' New public navigation.';
 opts.prepare=(targets,options)=>prepareCurationReview(targets,{...options,fetchResource:async()=>{fetches++;return {status:200,headers:{'content-type':'text/html'},text:changed};}});
 opts.generate=async items=>{calls++;return {model:'fixture',items:items.map(i=>decision(i.id))};};
 const first=await runOverseasCafeReview(opts);
 assert.equal(first.entries[0].reasons[0],'source-document-changed');assert.ok(first.entries[0].sourceReceipt);
 assert.equal(calls,0);assert.equal(fetches,1);
 const reapproved={...target,approvedDocumentHash:evidenceHash(changed),sharingReviewedAt:new Date(now+60000).toISOString()};
 const again=await runOverseasCafeReview({...opts,now:now+90000,catalog:{overseasCafeTargets:[reapproved]}});
 assert.equal(fetches,1);assert.equal(calls,1);assert.equal(again.corroborated,1);
 assert.equal(again.resumedWithoutFetch,1);assert.equal(again.selected,0);assert.equal(again.capacity.actuallyAttemptedThisRun,0);
 assert.equal(again.capacity.apiBatchesToday,1);assert.deepEqual(again.attempted,first.attempted);
 assert.equal(again.entries[0].machineCheckedAt,new Date(now).toISOString());assert.equal(again.entries[0].lastAttemptedAt,new Date(now).toISOString());
 assert.equal(again.entries[0].reviewedAt,null);
 await runOverseasCafeReview({...opts,now:now+120000,catalog:{overseasCafeTargets:[reapproved]},approvalSignature:'another-path'});
 assert.equal(calls,1);assert.equal(fetches,1);
});

test('receipt never substitutes for approval, unchanged bindings, visibility or five-minute freshness',async t=>{
 const {makeSourceReceipt,reviewedSourceTask}=await import('../scripts/overseas-reviewed-source.mjs');
 const changed=text+' Changed footer.',receipt=makeSourceReceipt(target,evidenceHash(changed),now);
 const approved={...target,approvedDocumentHash:evidenceHash(changed),sharingReviewedAt:new Date(now+1000).toISOString()};
 assert.ok(reviewedSourceTask(approved,receipt,now+2000));
 for(const patch of [{sharingReviewedAt:target.sharingReviewedAt},{sourceUrl:'https://example.org/other'},{fragments:['Other text']},{title:'Other title'},
  {comparisonScopes:{businessHours:'source-only'}},{baseline:{...target.baseline,facts:{businessHours:'Monday'}}},{publicationHash:'b'.repeat(64)}])
  assert.equal(reviewedSourceTask({...approved,...patch},receipt,now+2000),null);
 assert.equal(reviewedSourceTask(approved,receipt,now+300001),null);
 const hidden=await prepareCurationReview([target],{now,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text:'<!--'+text+'--><p>New</p>'})});
 assert.equal(hidden.exceptions[0].sourceReceipt,undefined);
});

test('resumption obeys account approval, known daily batch count and the existing batch limit',async t=>{
 const opts=await fixture(t),changed=text+' New footer.';let calls=0;
 opts.prepare=(targets,options)=>prepareCurationReview(targets,{...options,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text:changed})});
 opts.generate=async items=>{calls++;return {model:'fixture',items:items.map(i=>decision(i.id))};};
 const initial=await runOverseasCafeReview(opts),catalog={overseasCafeTargets:[{...target,approvedDocumentHash:evidenceHash(changed),sharingReviewedAt:new Date(now+1000).toISOString()}]};
 let r=await runOverseasCafeReview({...opts,catalog,now:now+2000,canSubmit:()=>false});assert.equal(calls,0);assert.equal(r.submittedThisRun,0);
 r=await runOverseasCafeReview({...opts,catalog,now:now+3000,approvalSignature:'verified'});assert.equal(calls,1);assert.equal(r.corroborated,1);
 for(const count of [undefined,2]){
  const previous=structuredClone(initial);previous.capacity.apiBatchesToday=count;
  await writeFile(join(opts.stateDir,'overseas-cafe-review.json'),JSON.stringify(previous));
  // Remove the fixture success cache only in this isolated test to measure admission.
  await writeFile(join(opts.stateDir,'curation-review-cache.json'),JSON.stringify({version:'curation-review-v1',entries:{}}));
  const result=await runOverseasCafeReview({...opts,catalog,now:now+4000});
  assert.equal(calls,1);if(count===undefined)assert.equal(result.resumedWithoutFetch,0);else assert.equal(result.capacity.stoppedBy,'overseas-batch-limit');
 }
});
