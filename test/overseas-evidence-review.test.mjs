import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runOverseasCafeReview} from '../scripts/overseas-cafe-review.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
import {evidenceHash,prepareReviewItem} from '../scripts/curation-review-contract.mjs';
import {COMPLIMENTARY_MODEL} from '../scripts/complimentary-text-client.mjs';

const now=Date.parse('2026-10-30T02:00:00Z');
const text='Cedar Cafe, 42 Oak Street. Open Monday to Friday 09:00–17:00.';
async function fixture(t){
 const stateDir=await mkdtemp(join(tmpdir(),'overseas-evidence-'));
 t.after(()=>rm(stateDir,{recursive:true,force:true}));
 const target={kind:'overseas_cafe',recordId:'published-cedar',facilityId:'cedar',role:'published',title:'Cedar Cafe',sourceUrl:'https://example.org/cafe',sourceMode:'html',officialVerified:true,sharingReviewedAt:'2026-10-29T01:00:00Z',approvedDocumentHash:evidenceHash(text),publicationHash:'a'.repeat(64),fragments:[text],baseline:{requiredFields:['address','businessHours'],facts:{address:'Cedar Cafe, 42 Oak Street',businessHours:'Monday to Friday 09:00–17:00'}}};
 const id=prepareReviewItem({...target,text}).id;
 const decision={id,relevance:'yes',contentType:'other',evidence:text,facts:[{field:'address',value:'42 Oak Street',evidence:'Cedar Cafe, 42 Oak Street.'}]};
 const review={version:1,reason:'extraction-only',inputId:id,documentHash:target.approvedDocumentHash,publicationHash:target.publicationHash,baselineHash:evidenceHash(JSON.stringify(target.baseline)),apiDecisionHash:evidenceHash(JSON.stringify(decision)),checkedAt:new Date(now-60000).toISOString(),note:'Verified original excerpt: omitted cafe label and hours; no changed conditions.',checks:{officialEvidenceRead:true,allConditionsChecked:true,noMaterialDifference:true},decision:{id,relevance:'yes',contentType:'other',evidence:text,facts:[{field:'address',value:target.baseline.facts.address,evidence:'Cedar Cafe, 42 Oak Street.'},{field:'businessHours',value:target.baseline.facts.businessHours,evidence:'Open Monday to Friday 09:00–17:00.'}]}};
 target.evidenceReview=review;
 const cache={version:'curation-review-v1',entries:{[COMPLIMENTARY_MODEL+':'+id]:{model:COMPLIMENTARY_MODEL,decision,checkedAt:'2026-10-30T00:09:00Z'}}};
 await writeFile(join(stateDir,'curation-review-cache.json'),JSON.stringify(cache));
 const snapshot={records:[{id:'cedar',publicationHash:target.publicationHash,sourceUrls:[target.sourceUrl]}]};
 const options={stateDir,snapshot,catalog:{overseasRotationPolicy:{version:1,dailyItems:24,batchItems:4},overseasCafeTargets:[target]},now,
 prepare:(targets,opts)=>prepareCurationReview(targets,{...opts,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text})}),
 generate:async()=>{throw Error('Saved successful response must never be resubmitted');},canSubmit:()=>false};
 return {options,target,decision,review,cache};
}
test('cached label differences and omitted fields resolve only through exact inspected evidence',async t=>{
 const {options,decision,cache,review}=await fixture(t);
 const r=await runOverseasCafeReview(options);
 assert.equal(r.entries[0].status,'reviewed-evidence');
 assert.equal(r.entries[0].evidenceReviewCheckedAt,review.checkedAt);
 assert.deepEqual(r.entries[0].decision,decision);
 assert.equal(r.entries[0].publicationApproved,false);assert.equal(r.entries[0].reviewedAt,null);
 assert.equal(r.submittedThisRun,0);assert.equal(r.evidenceReviewed,1);assert.equal(r.corroborated,0);
 assert.deepEqual(JSON.parse(await readFile(join(options.stateDir,'curation-review-cache.json'),'utf8')),cache);
 assert.equal(r.fieldCoverage[0].fields.businessHours.state,'reviewed-evidence');
 assert.equal(r.rotationWork[0].pending,false);
});
for(const key of ['inputId','documentHash','publicationHash','baselineHash','apiDecisionHash'])test('rejects changed '+key,async t=>{
 const f=await fixture(t);f.review[key]='b'.repeat(64);
 assert.equal((await runOverseasCafeReview(f.options)).entries[0].status,'exception');
});
test('rejects invented resolution and missing inspection',async t=>{
 const f=await fixture(t);f.review.decision.facts[0].value='Unknown address';
 assert.equal((await runOverseasCafeReview(f.options)).entries[0].status,'exception');
 delete f.review.checks.allConditionsChecked;
 assert.equal((await runOverseasCafeReview({...f.options,now:now+86400000})).entries[0].status,'exception');
});
test('offline resolution preserves acquisition count, cache and original timestamps; removal revokes it',async t=>{
 const f=await fixture(t),review=structuredClone(f.review);delete f.target.evidenceReview;
 const original=await runOverseasCafeReview(f.options),path=join(f.options.stateDir,'overseas-cafe-review.json');
 assert.equal(original.entries[0].status,'exception');
 original.attempted=['published-cedar',...Array.from({length:23},(_,i)=>'used-'+i)];
 await writeFile(path,JSON.stringify(original));
 f.target.evidenceReview=review;
 const run=()=>runOverseasCafeReview({...f.options,now:now+60000,prepare:async()=>{throw Error('Must not refetch');}});
 const resolved=await run();
 assert.equal(resolved.entries[0].status,'reviewed-evidence');assert.equal(resolved.selected,0);
 assert.equal(resolved.capacity.attemptedToday,24);assert.equal(resolved.capacity.actuallyAttemptedThisRun,0);
 assert.equal(resolved.submittedThisRun,0);assert.equal(resolved.entries[0].machineCheckedAt,original.entries[0].machineCheckedAt);
 assert.equal(resolved.entries[0].lastAttemptedAt,original.entries[0].lastAttemptedAt);
 delete f.target.evidenceReview;
 assert.equal((await run()).entries[0].status,'exception');
});
test('offline resolution refuses expired acquisition and unknown API outcome',async t=>{
 const f=await fixture(t);delete f.target.evidenceReview;
 const original=await runOverseasCafeReview(f.options);f.target.evidenceReview=f.review;
 const path=join(f.options.stateDir,'overseas-cafe-review.json');
 original.entries[0].machineCheckedAt=new Date(now-48*3600000).toISOString();
 await writeFile(path,JSON.stringify(original));
 assert.equal((await runOverseasCafeReview(f.options)).entries[0].status,'exception');
 original.entries[0].machineCheckedAt=new Date(now).toISOString();original.submittedThisRun=null;
 await writeFile(path,JSON.stringify(original));
 assert.equal((await runOverseasCafeReview(f.options)).entries[0].status,'exception');
});
