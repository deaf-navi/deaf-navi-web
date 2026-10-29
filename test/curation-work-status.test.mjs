import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkStatus} from '../scripts/curation-work-status.mjs';

test('due items absent from comparison report remain actionable',()=>{
 const now=Date.parse('2026-10-29T02:00:00Z');
 const result=buildWorkStatus({now,attention:{generatedAt:new Date(now).toISOString(),items:[{recordId:'visual-only',reason:'freshness-expired',priority:'within-two-weeks'}]}});
 assert.equal(result.items[0].recordId,'visual-only');assert.equal(result.items[0].due,true);assert.equal(result.items[0].priority,1);
});
const now=Date.parse('2026-10-29T02:00:00Z');
const empty=()=>Object.fromEntries(['daily','candidates','lodging','overseas','tips'].map(k=>[k,{generatedAt:new Date(now).toISOString(),entries:[],deferred:[],unreviewed:0}]));
test('cycle completed is separate from coverage and baseline blockage remains actionable',()=>{
 const reports=empty();reports.lodging.entries=[{recordId:'a',status:'exception',reasons:['publication-baseline-review-required'],firstSeenAt:'2026-10-27T01:00:00Z'}];
 const r=buildWorkStatus({reports,now,executionStatus:'completed'});
 assert.equal(r.executionStatus,'completed');assert.equal(r.coverageStatus,'incomplete');assert.equal(r.categoryCounts.blocked,1);assert.equal(r.items[0].ageDays,2);assert.equal(r.publicationApproved,false);assert.equal(r.reviewedAt,null);
});
test('missing or stale reports are unknown, not zero confirmed',()=>{
 assert.equal(buildWorkStatus({now}).coverageStatus,'unknown');assert.equal(buildWorkStatus({now}).modules.lodging.pending,null);
 const reports=empty();reports.overseas.generatedAt='2026-10-25T01:00:00Z';assert.ok(buildWorkStatus({reports,now}).unknownModules.includes('overseas'));
});
test('successful reviewed differences and already-attempted items are not backlog; untouched queue survives',()=>{
 const reports=empty();reports.overseas.entries=[{recordId:'a',status:'reviewed-unchanged',reasons:['differs-from-current']}];
 reports.overseas.deferred=[{recordId:'a',reason:'daily-source-limit'},{recordId:'b',reason:'already-attempted-today'},{recordId:'c',reason:'daily-source-limit'}];
 const r=buildWorkStatus({reports,now});assert.equal(r.pending,1);assert.equal(r.categoryCounts.queued,1);assert.equal(r.operatorQueue.length,0);
});
test('unchanged unresolved work retains age and remains in operator queue across runs',()=>{
 const reports=empty();reports.lodging.entries=[{recordId:'a',status:'exception',reasons:['sharing-review-required']}];
 const first=buildWorkStatus({reports,now});const next=buildWorkStatus({reports,previous:first,now:now+86400000});
 assert.equal(next.items[0].firstSeenAt,first.items[0].firstSeenAt);assert.equal(next.items[0].ageDays,1);assert.equal(next.operatorQueue.length,1);
});
test('explicit waiting decision expires and source changes revoke it; no blocker waiver',()=>{
 const reports=empty();reports.daily.entries=[{recordId:'a',status:'exception',reasons:['source-unavailable']}];
 const first=buildWorkStatus({reports,now}),decisions=[{key:'daily:a',fingerprint:first.items[0].fingerprint,disposition:'waiting-source',reviewedAt:new Date(now).toISOString(),nextCheckAt:new Date(now+86400000).toISOString()}];
 assert.equal(buildWorkStatus({reports,previous:first,decisions,now}).operatorQueue.length,0);
 assert.equal(buildWorkStatus({reports,previous:first,decisions,now:now+86400000}).operatorQueue.length,1);
 reports.daily.entries[0].reasons=['source-document-changed'];assert.equal(buildWorkStatus({reports,previous:first,decisions,now}).operatorQueue.length,1);
});
test('unreviewed submissions without exported identities do not disappear',()=>{
 const reports=empty();reports.tips.unreviewed=3;reports.tips.deferred=2;
 const r=buildWorkStatus({reports,now});assert.equal(r.pending,5);assert.equal(r.modules.tips.state,'pending-in-admin');assert.notEqual(r.coverageStatus,'complete');
});
