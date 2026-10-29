import test from 'node:test';
import assert from 'node:assert/strict';
import {rebindLodgingPublication} from '../scripts/rebind-curation-publication.mjs';
import {evidenceHash} from '../scripts/curation-review-contract.mjs';
import {publicationBindingMatches,enrollComparisonBindings} from '../scripts/publication-binding.mjs';
import {lodgingSnapshot} from '../src/lib/lodging-snapshot.mjs';
const now=Date.parse('2026-10-29T02:00:00Z'),old='a'.repeat(64),current='b'.repeat(64),doc='c'.repeat(64);
const target={recordId:'lodging-a',facilityId:'a',publicationHash:old,approvedDocumentHash:doc,sourceUrl:'https://example.org/',sharingReviewedAt:'2026-10-20T00:00:00Z',baseline:{facts:{rates:'100'},requiredFields:['rates']},evidenceReview:{publicationHash:old,documentHash:doc,checkedAt:'2026-10-20T00:00:00Z',decision:{value:'100'}}};
const snapshot={records:[{id:'a',publicationHash:current,sourceUrls:[target.sourceUrl]}]};
const item={recordId:target.recordId,previousPublicationHash:old,publicationHash:current,documentHash:doc,baselineHash:evidenceHash(JSON.stringify(target.baseline)),checkedAt:new Date(now).toISOString(),conditionsMatchPublication:true,evidenceConditionsRechecked:true,note:'Current published conditions read against unchanged source.'};

test('only enrolled presentation changes survive; price, sources, freshness and unknown fields fail closed',()=>{
 const record={id:'a',bookingUrl:target.sourceUrl,facts:['100 yen'],reviewedAt:'2026-10-20',media:[]};
 const s=lodgingSnapshot([record]);const t={...target,publicationHash:s.records[0].publicationHash};
 const catalog={lodgingTargets:[t]},r=enrollComparisonBindings(catalog,{lodging:s},now),bound=r.catalog.lodgingTargets[0];
 assert.deepEqual(r.skipped,[]);assert.equal(r.enrolled.length,1);
 const cosmetic=lodgingSnapshot([{...record,media:[{url:'https://example.org/article',title:'Reference'}]}]).records[0];
 assert.ok(publicationBindingMatches(cosmetic,bound));assert.equal(publicationBindingMatches(cosmetic,t),false);
 for(const patch of [{facts:['200 yen']},{bookingUrl:'https://other.example/'},{reviewedAt:'2026-10-29'},{futureCondition:'changed'}])
  assert.equal(publicationBindingMatches(lodgingSnapshot([{...record,...patch}]).records[0],bound),false);
 assert.equal(publicationBindingMatches({...cosmetic,comparisonVersion:2},bound),false);
 assert.equal(publicationBindingMatches(cosmetic,{...bound,comparisonBinding:{...bound.comparisonBinding,publicationHash:'f'.repeat(64)}}),false);
 assert.equal(enrollComparisonBindings(catalog,{lodging:{records:[cosmetic]}},now).enrolled.length,0);
 assert.equal(bound.evidenceReview.checkedAt,target.evidenceReview.checkedAt);assert.equal(bound.sharingReviewedAt,target.sharingReviewedAt);
 assert.equal(enrollComparisonBindings(r.catalog,{lodging:s},now+1000).enrolled.length,0);
});
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
