import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareReviewItem,validateReviewResult,explicitDates,evidenceHash,compareReview} from '../scripts/curation-review-contract.mjs';
import {reviewCurationTasks} from '../scripts/curation-review.mjs';
const now=Date.parse('2026-10-18T04:00:00Z');
const task={kind:'event',title:'手話交流会',sourceUrl:'https://example.org/event',text:'手話交流会を開催します。開催日 2026年11月14日。会場 市民会館。申込締切 2026年11月1日。',sourceMode:'html',officialVerified:true,retrievedAt:new Date(now-1000).toISOString(),baseline:{startDate:'2026-11-14',venue:'市民会館'}};
task.sourceTextHash=evidenceHash(task.text);
const input=prepareReviewItem(task);
const decision={id:input.id,relevance:'yes',contentType:'announcement',evidence:'手話交流会を開催します。',facts:[{field:'startDate',value:'2026-11-14',evidence:'開催日 2026年11月14日。'},{field:'venue',value:'市民会館',evidence:'会場 市民会館。'}]};
test('quotes, source years, duplicate fields and item IDs are verified independently of model schema',()=>{
 assert.deepEqual(explicitDates('令和８年11月14日、令和8年(2026年)10月18日、11月9日、2026年2月30日'),['2026-11-14','2026-10-18']);
 assert.equal(validateReviewResult([input],{items:[decision]}).length,1);
 for(const facts of [[{field:'startDate',value:'2027-11-14',evidence:'開催日 2026年11月14日。'}],[...decision.facts,decision.facts[0]],[{field:'venue',value:'別会場',evidence:'会場 市民会館。'}]])assert.throws(()=>validateReviewResult([input],{items:[{...decision,facts}]}));
 assert.throws(()=>validateReviewResult([input],{items:[{...decision,evidence:'資料にない引用です'}]}));
 assert.throws(()=>validateReviewResult([input],{items:[{...decision,id:'unknown'}]}));
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
