import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {lodgingSnapshot} from '../src/lib/lodging-snapshot.mjs';
import {planLodgingReview,runLodgingReview} from '../scripts/lodging-review.mjs';
import {evidenceHash,prepareReviewItem,validateReviewResult,compareReview} from '../scripts/curation-review-contract.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
import {discoverLinks,runSourceDiscovery} from '../scripts/source-discovery.mjs';
import {runServerCuration} from '../scripts/server-curation.mjs';
const now=Date.parse('2026-10-24T01:00:00Z');
const text='素泊まりの宿です。予約フォームで予約。1泊1人6,750円（税込）、宿泊税別。チェックイン15時。';
const snapshot=lodgingSnapshot([{id:'inn',bookingUrl:'https://example.org/stay',sources:[],reviewedAt:'2026-10-01',facts:['Private editorial baseline']}]);
const target={kind:'lodging',recordId:'inn-rates',facilityId:'inn',sourceUrl:'https://example.org/stay',title:'宿泊条件の確認',sourceMode:'html',officialVerified:true,
  fragments:[text],approvedDocumentHash:evidenceHash(text),sharingReviewedAt:'2026-10-23T01:00:00Z',publicationHash:snapshot.records[0].publicationHash,
  baseline:{requiredFields:['booking','rates','stay'],facts:{booking:'予約フォームで予約。',rates:'1泊1人6,750円（税込）、宿泊税別。',stay:'チェックイン15時。'}}};
const catalog={version:1,targets:[],lodgingTargets:[target]};
const task={...target,text,sourceTextHash:evidenceHash(text),sourceDocumentHash:evidenceHash(text),retrievedAt:new Date(now).toISOString()};
const decision=id=>({id,relevance:'yes',contentType:'other',evidence:'素泊まりの宿です。',facts:Object.entries(target.baseline.facts).map(([field,value])=>({field,value,evidence:value}))});
const generate=async items=>({model:'gpt-6.1-sol',items:items.map(item=>decision(item.id))});
const fetchResource=async()=>({status:200,headers:{'content-type':'text/html'},text:'<main>'+text+'</main>'});
const prepare=(targets,options)=>prepareCurationReview(targets,{...options,fetchResource});
async function fixture(t){const stateDir=await mkdtemp(join(tmpdir(),'dn-lodging-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));return {stateDir,snapshot,catalog,now,prepare,generate,canSubmit:()=>true};}

test('public snapshot contains only identity, source URLs and digest, not editorial/private facts',()=>{
 assert.deepEqual(Object.keys(snapshot.records[0]),['id','sourceUrls','publicationHash']);
 assert.equal(JSON.stringify(snapshot).includes('Private'),false);
 assert.notEqual(lodgingSnapshot([{id:'inn',bookingUrl:target.sourceUrl,facts:['Changed']}]).records[0].publicationHash,target.publicationHash);
});
test('lodging retains literal price, unit and taxes; fabricated values and cross-kind fields fail',()=>{
 const item=prepareReviewItem(task),d=decision(item.id);assert.equal(validateReviewResult([item],{items:[d]}).length,1);
 assert.throws(()=>validateReviewResult([item],{items:[{...d,facts:[{field:'rates',value:'税別6,000円',evidence:d.facts[1].evidence}]}]}));
 assert.throws(()=>validateReviewResult([item],{items:[{...d,facts:[{field:'startDate',value:'2026-11-01',evidence:'素泊まりの宿です。'}]}]}));
 const event=prepareReviewItem({...task,kind:'event'});assert.throws(()=>validateReviewResult([event],{items:[{...d,id:event.id}]}));
});
test('permanent lodging needs no event date and never renews publication review',()=>{
 const r=compareReview(task,decision(prepareReviewItem(task).id),{now});
 assert.equal(r.status,'corroborated');assert.equal(r.reviewedAt,null);assert.equal(r.publicationApproved,false);
 const changed=compareReview({...task,baseline:{...target.baseline,facts:{...target.baseline.facts,rates:'7,500円'}}},decision('id'),{now});
 assert.deepEqual(changed.differences,['rates']);assert.equal(changed.status,'exception');
 assert.ok(compareReview({...task,retrievedAt:'2026-10-01T00:00:00Z'},decision('id'),{now}).reasons.includes('source-not-fresh'));
});
test('latest published content and official URL bind the baseline; missing snapshot is fail-closed',()=>{
 assert.equal(planLodgingReview(snapshot,catalog,{now}).selected.length,1);
 for(const s of [{version:1,records:[]},{version:1,records:[{...snapshot.records[0],publicationHash:'b'.repeat(64)}]}]){
  const p=planLodgingReview(s,catalog,{now});assert.equal(p.selected.length,0);assert.ok(p.entries[0].reasons.includes('publication-baseline-review-required'));
 }
});
test('actual extraction is cached, same-day work reused, next day fetches without a new generation',async t=>{
 const opts=await fixture(t);let calls=0;opts.generate=async items=>{calls++;return generate(items);};
 const first=await runLodgingReview(opts);assert.equal(first.corroborated,1);assert.equal(calls,1);
 const second=await runLodgingReview({...opts,now:now+1000});assert.equal(second.reusedRun,true);assert.equal(calls,1);
 const third=await runLodgingReview({...opts,now:now+86400000});assert.equal(third.cached,1);assert.equal(third.submittedThisRun,0);assert.equal(calls,1);
 assert.equal(third.entries[0].firstSeenAt,first.entries[0].firstSeenAt);assert.equal(third.entries[0].changedAt,first.entries[0].changedAt);
});
test('new document, unavailable source and unapproved excerpt never send API requests',async t=>{
 for(const kind of ['changed','unavailable','unapproved']){
  const opts=await fixture(t);let calls=0;
  opts.generate=async()=>{calls++;throw Error('must not run');};
  opts.canSubmit=()=>kind!=='unapproved';
  opts.prepare=(targets,options)=>prepareCurationReview(targets,{...options,fetchResource:async()=>kind==='unavailable'?{status:503}:({...(await fetchResource()),text:text+(kind==='changed'?' 料金改定':'')})});
  const r=await runLodgingReview(opts);assert.equal(calls,0);assert.equal(r.exceptions,1);assert.equal(r.submittedThisRun,0);
 }
});
test('candidate facts do not establish operator identity, current reception or publication approval',async t=>{
 const opts=await fixture(t);opts.snapshot={version:1,records:[]};opts.catalog={version:1,lodgingCandidates:[{...target,operatorVerified:false,receptionVerified:false}]};
 const r=await runLodgingReview(opts),e=r.entries[0];assert.equal(e.status,'candidate');assert.equal(e.disposition,'needs-review');
 assert.ok(e.reasons.includes('operator-review-required'));assert.ok(e.reasons.includes('current-reception-review-required'));assert.equal(e.publicationApproved,false);
 const envelope=prepareReviewItem(task).summary;assert.equal(envelope.includes('operatorVerified'),false);assert.equal(envelope.includes('publicationHash'),false);
});
test('eight source cap and unknown responses stop later batches without retrying or dropping records',async t=>{
 const opts=await fixture(t);opts.snapshot={version:1,records:[]};opts.catalog={version:1,lodgingCandidates:Array.from({length:10},(_,i)=>({...target,recordId:'candidate-'+i,sourceUrl:'https://example.org/stay/'+i}))};
 let calls=0;opts.generate=async()=>{calls++;throw Error('unknown result');};
 const r=await runLodgingReview(opts);assert.equal(calls,1);assert.equal(r.submittedThisRun,null);assert.equal(r.deferred.length,2);
 assert.equal(r.entries.filter(e=>e.reasons.includes('batch-stopped-after-api-error')).length,4);
});
test('lodging remains blocked under unknown account or in-flight use; existing lease is not renewed',async t=>{
 const opts=await fixture(t);let calls=0;
 const r=await runServerCuration({...opts,records:[],key:'test',project:'test',generate:async()=>{calls++;},lodgingSnapshot:snapshot,discover:async()=>({candidates:0})});
 assert.equal(calls,0);assert.equal(r.account.ready,false);assert.equal(r.lodging.exceptions,1);assert.equal(r.submittedThisRun,0);
 await writeFile(join(opts.stateDir,'inflight.json'),'{}');
 await runServerCuration({...opts,records:[],key:'test',project:'test',lodgingSnapshot:snapshot,generate:async()=>{calls++;},discover:async()=>({candidates:0})});
 assert.equal(calls,0);assert.equal(await readFile(join(opts.stateDir,'inflight.json'),'utf8'),'{}');
});
test('weekly source discovery is bounded, private and distinct from daily event discovery',async t=>{
 const opts=await fixture(t),source={id:'specialist',url:'https://example.org/',topicScope:'lodging',specialistVerified:true};
 const html='<a href="/inn">山のゲストハウスの宿泊案内</a><a href="/cafe">手話カフェの交流会</a><a href="https://other.org/inn">ろう者のゲストハウス宿泊</a>';
 const found=discoverLinks(html,source);assert.equal(found.length,1);assert.equal(found[0].publicationApproved,false);
 let calls=0;const o={...opts,weeklyLodging:true,sources:[source],fetchResource:async()=>{calls++;return {status:200,headers:{'content-type':'text/html'},text:html};}};
 assert.equal((await runSourceDiscovery(o)).newCandidates,1);
 assert.equal((await runSourceDiscovery({...o,now:now+86400000})).reused,true);assert.equal(calls,1);
 assert.equal((await runSourceDiscovery({...o,now:now+7*86400000})).reused,false);assert.equal(calls,2);
 assert.equal(JSON.parse(await readFile(join(opts.stateDir,'lodging-discovery.json'))).scope,'registered-source-links-only');
});
