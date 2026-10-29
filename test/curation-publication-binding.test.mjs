import test from 'node:test';
import assert from 'node:assert/strict';
import {rebindLodgingPublication} from '../scripts/rebind-curation-publication.mjs';
import {evidenceHash} from '../scripts/curation-review-contract.mjs';
const now=Date.parse('2026-10-29T02:00:00Z'),old='a'.repeat(64),current='b'.repeat(64),doc='c'.repeat(64);
const target={recordId:'lodging-a',facilityId:'a',publicationHash:old,approvedDocumentHash:doc,sourceUrl:'https://example.org/',sharingReviewedAt:'2026-10-20T00:00:00Z',baseline:{facts:{rates:'100'},requiredFields:['rates']},evidenceReview:{publicationHash:old,documentHash:doc,checkedAt:'2026-10-20T00:00:00Z',decision:{value:'100'}}};
const snapshot={records:[{id:'a',publicationHash:current,sourceUrls:[target.sourceUrl]}]};
const item={recordId:target.recordId,previousPublicationHash:old,publicationHash:current,documentHash:doc,baselineHash:evidenceHash(JSON.stringify(target.baseline)),checkedAt:new Date(now).toISOString(),conditionsMatchPublication:true,evidenceConditionsRechecked:true,note:'Current published conditions read against unchanged source.'};
test('rebind retains original sharing/source evidence timestamps, decision and old binding',()=>{
 const c={lodgingTargets:[target],targets:[{unchanged:true}]},n=rebindLodgingPublication(c,snapshot,{reviewed:true,items:[item]},{now});
 assert.equal(n.lodgingTargets[0].publicationHash,current);assert.equal(c.lodgingTargets[0].publicationHash,old);
 assert.equal(n.lodgingTargets[0].evidenceReview.checkedAt,target.evidenceReview.checkedAt);assert.equal(n.lodgingTargets[0].sharingReviewedAt,target.sharingReviewedAt);
 assert.equal(n.lodgingTargets[0].baselineReviewHistory[0].publicationHash,old);assert.deepEqual(n.targets,c.targets);
});
test('no scheduler or stale/hash-only reapproval can rebind published content',()=>{
 for(const patch of [{conditionsMatchPublication:false},{documentHash:'d'.repeat(64)},{baselineHash:'e'.repeat(64)},{previousPublicationHash:current},{publicationHash:old},{evidenceConditionsRechecked:false},{checkedAt:'2026-10-28T00:00:00Z'}])assert.throws(()=>rebindLodgingPublication({lodgingTargets:[target]},snapshot,{reviewed:true,items:[{...item,...patch}]},{now}));
 assert.throws(()=>rebindLodgingPublication({lodgingTargets:[target]},snapshot,{reviewed:false,items:[item]},{now}));
});
