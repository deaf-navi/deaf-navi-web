import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {lodgingSnapshot} from '../src/lib/lodging-snapshot.mjs';
import {planLodgingReview,runLodgingReview} from '../scripts/lodging-review.mjs';
import {evidenceHash,prepareReviewItem,validateReviewResult,compareReview,partitionReviewResult} from '../scripts/curation-review-contract.mjs';
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
 assert.deepEqual(Object.keys(snapshot.records[0]),['id','sourceUrls','referenceUrls','publicationHash']);
 assert.equal(JSON.stringify(snapshot).includes('Private'),false);
 assert.notEqual(lodgingSnapshot([{id:'inn',bookingUrl:target.sourceUrl,facts:['Changed']}]).records[0].publicationHash,target.publicationHash);
 const withMedia=lodgingSnapshot([{id:'inn',bookingUrl:target.sourceUrl,media:[{url:'https://example.net/interview'}]}]).records[0];
 assert.deepEqual(withMedia.referenceUrls,['https://example.net/interview']);
 assert.equal(withMedia.sourceUrls.includes('https://example.net/interview'),false);
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

test('approved WordPress page body avoids oversized theme HTML with the same byte and origin limits',async()=>{
 const apiUrl='https://example.org/wp-json/wp/v2/pages/128?_fields=id,link,status,content';
 const wp={...target,wordpressPage:{id:128,apiUrl},approvedDocumentHash:evidenceHash('wordpress-page-v1\n'+apiUrl+'\n'+text)};
 let calls=0;
 const r=await prepareCurationReview([wp],{now,fetchResource:async(url,options)=>{
  calls++;assert.equal(url,apiUrl);assert.equal(options.maxBytes,800000);assert.equal(options.allowUrl('https://other.org/'),false);
  return {status:200,headers:{'content-type':'application/json'},text:JSON.stringify({id:128,status:'publish',link:target.sourceUrl,content:{protected:false,rendered:'<p>'+text+'</p>'}})};
 }});
 assert.equal(calls,1);assert.equal(r.tasks.length,1);assert.equal(r.tasks[0].sourceUrl,target.sourceUrl);assert.equal(r.tasks[0].sourceEvidenceUrl,apiUrl);
 assert.equal(r.tasks[0].sourceDocumentHash,wp.approvedDocumentHash);
});

test('WordPress adapter rejects private, wrong, altered, oversized and cross-origin pages',async()=>{
 const apiUrl='https://example.org/wp-json/wp/v2/pages/128?_fields=id,link,status,content';
 const wp={...target,wordpressPage:{id:128,apiUrl},approvedDocumentHash:evidenceHash('wordpress-page-v1\n'+apiUrl+'\n'+text)};
 for(const patch of [{status:'draft'},{id:129},{link:'https://example.org/other'},{content:{protected:true,rendered:text}},{content:{protected:false,rendered:text+' 改定'}}]){
  const r=await prepareCurationReview([wp],{now,fetchResource:async()=>({status:200,headers:{'content-type':'application/json'},text:JSON.stringify({id:128,status:'publish',link:target.sourceUrl,content:{protected:false,rendered:text},...patch})})});
  assert.equal(r.tasks.length,0);assert.equal(r.exceptions.length,1);
 }
 for(const altered of [{...wp,kind:'event'},{...wp,wordpressPage:{id:128,apiUrl:apiUrl.replace('example.org','other.org')}},{...wp,wordpressPage:{id:128,apiUrl:apiUrl+'&context=edit'}}]){
  let calls=0;const r=await prepareCurationReview([altered],{now,fetchResource:async()=>{calls++;throw Error('must not fetch');}});assert.equal(calls,0);assert.equal(r.tasks.length,0);
 }
 const exceeded=await prepareCurationReview([wp],{now,fetchResource:async()=>{throw Error('Metadata exceeds byte limit');}});assert.equal(exceeded.tasks.length,0);
});

test('one-time literal evidence review resolves a cached rejection without impersonating API or publication review',async t=>{
 const opts=await fixture(t),item=prepareReviewItem(task),d=decision(item.id);
 const cache={version:'curation-review-v1',entries:{['gpt-6.1-sol:'+item.id]:{rejected:'api-evidence-invalid',model:'gpt-6.1-sol',checkedAt:'2026-10-23T01:00:00Z'}}};
 const raw=JSON.stringify(cache);await writeFile(join(opts.stateDir,'curation-review-cache.json'),raw);
 const reviewed={...target,evidenceReview:{reason:'api-evidence-invalid',inputId:item.id,documentHash:task.sourceDocumentHash,publicationHash:target.publicationHash,checkedAt:'2026-10-23T02:00:00Z',decision:d}};
 opts.catalog={...catalog,lodgingTargets:[reviewed]};opts.generate=async()=>{throw Error('must not generate');};
 const first=await runLodgingReview(opts);assert.equal(first.evidenceReviewed,1);assert.equal(first.entries[0].status,'reviewed-evidence');assert.equal(first.entries[0].reviewedAt,null);assert.equal(first.entries[0].publicationApproved,false);
 assert.equal(first.entries[0].evidenceReviewCheckedAt,reviewed.evidenceReview.checkedAt);assert.equal(first.submittedThisRun,0);assert.equal(first.corroborated,0);
 const again=await runLodgingReview({...opts,now:now+86400000});assert.equal(again.evidenceReviewed,1);assert.deepEqual(again.newOrChanged,[]);assert.equal(again.entries[0].evidenceReviewCheckedAt,reviewed.evidenceReview.checkedAt);
 assert.equal(await readFile(join(opts.stateDir,'curation-review-cache.json'),'utf8'),raw);
 for(const patch of [{inputId:'wrong'},{documentHash:'f'.repeat(64)},{publicationHash:'f'.repeat(64)},{checkedAt:new Date(now+1000).toISOString()},{decision:{...d,facts:[{field:'rates',value:'無料',evidence:'予約フォームで予約。'}]}}]){
  const r=await runLodgingReview({...opts,catalog:{...catalog,lodgingTargets:[{...reviewed,evidenceReview:{...reviewed.evidenceReview,...patch}}]}});assert.equal(r.entries[0].status,'exception');
 }
 const changed=await runLodgingReview({...opts,now:now+2*86400000,prepare:(ts,os)=>prepareCurationReview(ts,{...os,fetchResource:async()=>({...await fetchResource(),text:text+' 変更'})})});
 assert.ok(changed.entries[0].reasons.includes('source-document-changed'));
});

test('rejected extraction records safe diagnostic codes but no rejected response text',()=>{
 const item=prepareReviewItem(task),bad={...decision(item.id),facts:[{field:'rates',value:'無料',evidence:'予約フォームで予約。'}]};
 const split=partitionReviewResult([item],{items:[bad]});
 assert.equal(split.rejectedItems[0].validationCode,'lodging-value-not-literal');assert.equal(JSON.stringify(split.rejectedItems).includes('無料'),false);
});

test('new inspected evidence is applied within the eight-target cap without starving the next rotation',async t=>{
 const opts=await fixture(t),item=prepareReviewItem(task);
 const reviewed={...target,evidenceReview:{reason:'api-evidence-invalid',inputId:item.id,documentHash:task.sourceDocumentHash,publicationHash:target.publicationHash,checkedAt:new Date(now-500).toISOString(),decision:decision(item.id)}};
 opts.catalog={...catalog,lodgingTargets:[reviewed],lodgingCandidates:Array.from({length:8},(_,i)=>({...target,recordId:'candidate-'+i,sourceUrl:'https://example.org/candidate/'+i}))};
 await writeFile(join(opts.stateDir,'curation-review-cache.json'),JSON.stringify({version:'curation-review-v1',entries:{['gpt-6.1-sol:'+item.id]:{rejected:'api-evidence-invalid',model:'gpt-6.1-sol'}}}));
 await writeFile(join(opts.stateDir,'lodging-review.json'),JSON.stringify({entries:[...opts.catalog.lodgingCandidates.map(x=>({recordId:x.recordId,machineCheckedAt:new Date(now-10000).toISOString()})),{recordId:target.recordId,machineCheckedAt:new Date(now-100).toISOString()}]}));
 opts.canSubmit=()=>false;opts.generate=async()=>{throw Error('must not send');};
 const first=await runLodgingReview(opts);assert.equal(first.selected,8);assert.equal(first.evidenceReviewed,1);assert.equal(first.deferred.length,1);assert.notEqual(first.deferred[0].recordId,target.recordId);
 const second=await runLodgingReview({...opts,now:now+86400000});assert.equal(second.entries.find(e=>e.recordId===first.deferred[0].recordId).deferred,undefined);
});
