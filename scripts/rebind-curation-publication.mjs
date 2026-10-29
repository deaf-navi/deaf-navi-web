import {evidenceHash} from './curation-review-contract.mjs';

// Operator-reviewed binding only. This is never called by the scheduled runner.
// A changed public record must not silently bless a stale comparison baseline.
export function rebindLodgingPublication(catalog,snapshot,review,{now=Date.now()}={}){
 if(review?.reviewed!==true||!Array.isArray(review.items)||!review.items.length)throw Error('Publication review required');
 const records=new Map(snapshot.records.map(x=>[x.id,x])),seen=new Set(),next=structuredClone(catalog);
 for(const item of review.items){
  const target=next.lodgingTargets.find(x=>x.recordId===item.recordId),record=records.get(target?.facilityId);
  const checked=Date.parse(item.checkedAt);
  if(!target||!record||seen.has(item.recordId)||!Number.isFinite(checked)||checked>now||now-checked>30*60000
   ||!record.sourceUrls.includes(target.sourceUrl)||item.previousPublicationHash!==target.publicationHash
   ||item.publicationHash!==record.publicationHash||item.documentHash!==target.approvedDocumentHash
   ||item.baselineHash!==evidenceHash(JSON.stringify(target.baseline))||item.conditionsMatchPublication!==true
   ||typeof item.note!=='string'||!item.note.trim()||item.note.length>500)throw Error('Publication binding review does not match');
  seen.add(item.recordId);
  const prior={publicationHash:target.publicationHash,evidenceReview:target.evidenceReview??null,baselineReview:target.baselineReview??null,comparisonBinding:target.comparisonBinding??null};
  if(target.evidenceReview&&item.evidenceConditionsRechecked!==true)throw Error('Evidence review requires explicit recheck');
  target.baselineReviewHistory=[...(target.baselineReviewHistory??[]),prior];
  target.publicationHash=record.publicationHash;
  if(record.comparisonVersion===1&&/^[a-f0-9]{64}$/.test(record.comparisonHash??''))
   target.comparisonBinding={version:1,publicationHash:record.publicationHash,comparisonHash:record.comparisonHash,enrolledAt:new Date(now).toISOString()};
  else delete target.comparisonBinding;
  target.baselineReview={...item};
  if(target.evidenceReview){
   if(target.evidenceReview.documentHash!==item.documentHash||target.evidenceReview.publicationHash!==prior.publicationHash)throw Error('Evidence identity changed');
   // Keep the original source review time and decision. Only its newly inspected
   // publication binding changes, with the previous record retained above.
   target.evidenceReview.publicationHash=record.publicationHash;
  }
 }
 return next;
}
