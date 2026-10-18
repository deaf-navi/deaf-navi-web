import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareReviewItem,validateReviewResult,partitionReviewResult,explicitDates,evidenceHash,compareReview} from '../scripts/curation-review-contract.mjs';
import {reviewCurationTasks} from '../scripts/curation-review.mjs';
const now=Date.parse('2026-10-18T04:00:00Z');
const task={kind:'event',title:'手話交流会',sourceUrl:'https://example.org/event',text:'手話交流会を開催します。開催日 2026年11月14日。会場 市民会館。申込締切 2026年11月1日。',sourceMode:'html',officialVerified:true,retrievedAt:new Date(now-1000).toISOString(),baseline:{startDate:'2026-11-14',venue:'市民会館'}};
task.sourceTextHash=evidenceHash(task.text);
const input=prepareReviewItem(task);
const decision={id:input.id,relevance:'yes',contentType:'announcement',evidence:'手話交流会を開催します。',facts:[{field:'startDate',value:'2026-11-14',evidence:'開催日 2026年11月14日。'},{field:'venue',value:'市民会館',evidence:'会場 市民会館。'}]};
test('invalid evidence is isolated and cached as an exception without retrying good or bad items',async t=>{
 const second={...task,sourceUrl:'https://example.org/second'},secondItem=prepareReviewItem(second);
 const malformed={...decision,id:secondItem.id,evidence:'not in the source'};
 const split=partitionReviewResult([input,secondItem],{items:[decision,malformed]});
 assert.deepEqual(split.items,[decision]);assert.deepEqual(split.rejectedItems,[{id:secondItem.id,reason:'api-evidence-invalid'}]);
 assert.throws(()=>partitionReviewResult([input,secondItem],{items:[decision,decision]}));
 const stateDir=await mkdtemp(join(tmpdir(),'dn-review-partition-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));let calls=0;
 const generate=async()=>{calls++;return {model:'gpt-6.1-sol',...split};};
 const first=await reviewCurationTasks([task,second],{generate,stateDir,now});assert.equal(first.corroborated,1);assert.equal(first.exceptions,1);assert.equal(first.submitted,2);
 const again=await reviewCurationTasks([task,second],{generate,stateDir,now});assert.equal(again.cached,2);assert.equal(again.submitted,0);assert.equal(calls,1);
 assert.deepEqual(again.entries[1].reasons,['api-evidence-invalid']);assert.equal(again.entries[1].publicationApproved,false);
});
test('quotes, source years, duplicate fields and item IDs are verified independently of model schema',()=>{
 assert.deepEqual(explicitDates('2026 11/03、2026 12月5日、11/03、2026 999 11/03'),['2026-11-03','2026-12-05']);
 assert.deepEqual(explicitDates('2026年10月24日(土)・10月25日(日) 開催。公開2026年9月1日。次回11月3日'),['2026-10-24','2026-10-25','2026-09-01']);
 assert.deepEqual(explicitDates('2026年10月31日・11月1日・2日。2026年12月31日〜1月1日'),['2026-10-31','2026-11-01','2026-11-02','2026-12-31']);
 assert.deepEqual(explicitDates('令和８年11月14日、令和8年(2026年)10月18日、11月9日、2026年2月30日'),['2026-11-14','2026-10-18']);
 assert.equal(validateReviewResult([input],{items:[decision]}).length,1);
 for(const facts of [[{field:'startDate',value:'2027-11-14',evidence:'開催日 2026年11月14日。'}],[...decision.facts,decision.facts[0]],[{field:'venue',value:'別会場',evidence:'会場 市民会館。'}]])assert.throws(()=>validateReviewResult([input],{items:[{...decision,facts}]}));
 assert.throws(()=>validateReviewResult([input],{items:[{...decision,evidence:'資料にない引用です'}]}));
 assert.throws(()=>validateReviewResult([input],{items:[{...decision,id:'unknown'}]}));
});
test('acknowledged differences are reusable only for exact verified evidence and current publication',()=>{
 const changed={...task,baseline:{...task.baseline,venue:'市民会館（1階）'},comparisonBaselineHash:'b'.repeat(64),sourceDocumentHash:'c'.repeat(64)};
 changed.comparisonReview={baselineHash:changed.comparisonBaselineHash,documentHash:changed.sourceDocumentHash,decisionHash:evidenceHash(JSON.stringify(decision)),checkedAt:new Date(now-1000).toISOString(),note:'公式本文と公開文面で会場を確認。階の付記のみ。'};
 const accepted=compareReview(changed,decision,{now});assert.equal(accepted.status,'reviewed-unchanged');assert.equal(accepted.reviewedAt,null);assert.equal(accepted.publicationApproved,false);assert.deepEqual(accepted.differences,['venue']);
 for(const patch of [{comparisonBaselineHash:'d'.repeat(64)},{sourceDocumentHash:'d'.repeat(64)},{sourceMode:'visual'},{sourceTextHash:'bad'},{retrievedAt:new Date(now-48*3600000).toISOString()},{comparisonReview:{...changed.comparisonReview,checkedAt:new Date(now+1000).toISOString()}}])assert.equal(compareReview({...changed,...patch},decision,{now}).status,'exception');
 assert.equal(compareReview(changed,{...decision,relevance:'uncertain'},{now}).status,'exception');
 assert.equal(compareReview(changed,{...decision,facts:[decision.facts[0]]},{now}).status,'exception');
 assert.equal(compareReview(changed,{...decision,evidence:'手話交流会を開催します'},{now}).status,'exception');
 for(const field of ['startDate','endDate','status']){
   const dangerous={...changed,baseline:{...changed.baseline,[field]:field==='status'?'cancelled':'2026-11-15'}};
   const extracted=field==='endDate'?{...decision,facts:[...decision.facts,{field,value:'2026-11-14',evidence:'2026年11月14日。'}]}:field==='status'?{...decision,facts:[...decision.facts,{field,value:'scheduled',evidence:'手話交流会を開催します。'}]}:decision;
   dangerous.comparisonReview={...changed.comparisonReview,decisionHash:evidenceHash(JSON.stringify(extracted))};
   assert.equal(compareReview(dangerous,extracted,{now}).status,'exception');
 }
});
test('comparison catches wrong date including deadline, changes, missing data and visual sources without renewing approval',()=>{
 const ok=compareReview(task,decision,{now});assert.equal(ok.status,'corroborated');assert.equal(ok.reviewedAt,null);assert.equal(ok.publicationApproved,false);
 for(const altered of [{...task,sourceTextHash:'different'},{...task,sourceMode:'visual'},{...task,retrievedAt:new Date(now-49*3600000).toISOString()},{...task,baseline:{}}])assert.equal(compareReview(altered,decision,{now}).status,'exception');
 const deadline={...decision,facts:[{field:'startDate',value:'2026-11-01',evidence:'申込締切 2026年11月1日。'},decision.facts[1]]};
 assert.equal(compareReview(task,deadline,{now}).status,'exception');
});
test('unchanged reviewed text is cached; every reuse rechecks baseline and freshness',async t=>{
 const stateDir=await mkdtemp(join(tmpdir(),'dn-review-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));let calls=0;
 const generate=async()=>{calls++;return {model:'gpt-6.1-sol',items:[decision]};};
 assert.equal((await reviewCurationTasks([task],{generate,stateDir,now})).corroborated,1);
 const reused=await reviewCurationTasks([{...task,baseline:{startDate:'2026-11-15'}}],{generate,stateDir,now});
 assert.equal(reused.cached,1);assert.equal(reused.exceptions,1);assert.equal(calls,1);
 assert.equal((await reviewCurationTasks([task],{generate,stateDir,now:now+49*3600000})).exceptions,1);
});
test('Japanese venue layout spaces do not create false changes, but room numbers and Latin words remain distinct',()=>{
 const venueDecision={...decision,facts:[decision.facts[0],{field:'venue',value:'市民会館2階 音楽室',evidence:'会場 市民会館2階 音楽室。'}]};
 assert.equal(compareReview({...task,baseline:{...task.baseline,venue:'市民会館 2階　音楽室'}},venueDecision,{now}).status,'corroborated');
 for(const venue of ['市民会館3階 音楽室','市民会館2階 会議室'])assert.equal(compareReview({...task,baseline:{...task.baseline,venue}},venueDecision,{now}).status,'exception');
 const latin={...decision,facts:[decision.facts[0],{field:'venue',value:'Cafe AB',evidence:'会場 Cafe AB。'}]};
 assert.equal(compareReview({...task,baseline:{...task.baseline,venue:'Cafe A B'}},latin,{now}).status,'exception');
});
