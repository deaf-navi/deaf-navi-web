import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
import {evidenceHash,prepareReviewItem} from '../scripts/curation-review-contract.mjs';
import {applyReviewedOverseasIntake,overseasFieldCoverage,buildIntakeQueue} from '../scripts/curation-review-intake.mjs';
import {buildCurationProgress} from '../scripts/curation-progress.mjs';
const now=Date.parse('2026-10-29T04:00:00Z'),stamp=new Date(now).toISOString();
const target={kind:'overseas_cafe',recordId:'published-shop',facilityId:'shop',role:'published',sourceUrl:'https://example.org/shop',title:'Cafe',officialVerified:true,sourceMode:'html',approvedDocumentHash:evidenceHash('Open Monday 10-18'),fragments:['Open Monday 10-18'],baseline:{requiredFields:['businessHours'],facts:{businessHours:'Open Monday 10-18'}}};
test('source deltas retain only approved fragments, and never unblock changed or hidden text',async()=>{
 for(const html of ['<p>Open Monday 10-18</p><p>New private@example.org text</p>','<!--Open Monday 10-18--><p>Closed</p>']){
  const r=await prepareCurationReview([target],{now,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text:html})});
  assert.equal(r.tasks.length,0);assert.equal(r.exceptions.length,1);
  const d=r.exceptions[0].sourceChange;assert.equal(d.sharingApproved,false);assert.equal(JSON.stringify(d).includes('private@example.org'),false);
  assert.equal(d.fragments[0].present,!html.startsWith('<!--'));
  assert.deepEqual(d.potentiallyAffectedFields,html.startsWith('<!--')?['businessHours']:[]);
 }
});
const snapshot={records:[{id:'shop',countryCode:'US',sourceUrls:[target.sourceUrl],publicationHash:'a'.repeat(64),comparisonVersion:1,comparisonHash:'b'.repeat(64)}]};
const receipt=()=>({reviewed:true,facilityId:'shop',publicationHash:'a'.repeat(64),title:'Cafe',checkedAt:stamp,
 source:{sourceUrl:target.sourceUrl,documentText:'Open Monday 10-18',visibleText:'Open Monday 10-18',documentHash:evidenceHash('Open Monday 10-18'),fetchedAt:stamp},
 facts:{businessHours:'Open Monday 10-18'},scopes:{businessHours:'publication'},checks:{identity:true,officialBodyRead:true,sharingSuitable:true,scopesChecked:true,conditionsChecked:true}});
test('initial intake binds exact public identity, literal visible facts, and explicit review',()=>{
 const r=receipt(),c=applyReviewedOverseasIntake({},snapshot,r,{now});assert.equal(c.overseasCafeTargets.length,1);
 assert.equal(c.overseasCafeTargets[0].comparisonBinding.comparisonHash,'b'.repeat(64));
 for(const change of [x=>x.reviewed=false,x=>x.publicationHash='c'.repeat(64),x=>x.source.visibleText='hidden',x=>x.facts.businessHours='No evidence',x=>x.source.documentHash='d'.repeat(64),x=>x.checks.sharingSuitable=false,x=>x.checkedAt=new Date(now-1800001).toISOString(),x=>x.source.fetchedAt=new Date(now+1).toISOString()]){
  const bad=receipt();change(bad);assert.throws(()=>applyReviewedOverseasIntake({},snapshot,bad,{now}));
 }
 const newer={...r,checkedAt:new Date(now+1000).toISOString()};assert.deepEqual(applyReviewedOverseasIntake(c,snapshot,newer,{now:now+1000}),c);
});
test('coverage distinguishes registered, compared, missing and source-only fields',()=>{
 const r=receipt();r.scopes.businessHours='source-only';const c=applyReviewedOverseasIntake({},snapshot,r,{now}),t=c.overseasCafeTargets[0];
 let v=overseasFieldCoverage(snapshot,c,[])[0];assert.equal(v.fields.businessHours.state,'registered-awaiting-comparison');assert.equal(v.fields.ordering.state,'not-configured');
 v=overseasFieldCoverage(snapshot,c,[{recordId:t.recordId,status:'corroborated',decision:prepareReviewItem({...t,text:t.fragments.join(' ')})}])[0];assert.equal(v.fields.businessHours.state,'api-corroborated');assert.equal(v.fields.businessHours.scope,'source-only');
 const changed=structuredClone(snapshot);changed.records[0].comparisonHash='e'.repeat(64);changed.records[0].publicationHash='c'.repeat(64);
 assert.equal(overseasFieldCoverage(changed,c,[])[0].fields.businessHours.state,'not-configured');
});
test('intake queue is private review evidence, not automatic sharing approval',()=>{
 const q=buildIntakeQueue({items:[{key:'overseas:shop',recordId:'shop',category:'initial-review',reasons:['sharing-review-required']} ]},{},{now});
 assert.equal(q.count,1);assert.equal(q.items[0].registeredEvidence,null);assert.equal(q.items[0].automaticApproval,false);assert.match(q.items[0].packetHash,/^[a-f0-9]{64}$/);
});
test('progress counts eligible days once, excludes account holds, and alerts only on unchanged actionable work',()=>{
 let previous={};const row={recordId:'shop',targetSignature:'same',pending:true,actionable:true,lastAttemptedAt:null};
 const run=(offset,executionStatus='completed',r=row)=>{const time=now+offset*86400000;return buildCurationProgress({previous,now:time,executionStatus,report:{generatedAt:new Date(time).toISOString(),rotationWork:[r]}});};
 previous=run(0);previous=run(0);assert.equal(previous.items[0].opportunityDays.length,1);
 previous=run(1,'account-check-required');assert.equal(previous.items[0].opportunityDays.length,1);
 previous=run(2,'completed',{...row,actionable:false});assert.equal(previous.alerts.length,0);assert.equal(previous.items[0].opportunityDays.length,1);
 previous=run(3);previous=run(4);previous=run(5);assert.equal(previous.newAlerts.length,1);
 previous=run(5);assert.equal(previous.newAlerts.length,0);
 const unknown=buildCurationProgress({previous,now:now+6*86400000,executionStatus:'completed'});assert.equal(unknown.state,'unknown');assert.equal(unknown.alerts.length,1);assert.equal(unknown.resolved.length,0);
 previous=run(6,'completed',{...row,lastAttemptedAt:new Date(now+6*86400000).toISOString()});assert.equal(previous.alerts.length,0);assert.deepEqual(previous.resolved,['shop']);
});
