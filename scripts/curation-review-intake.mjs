import {evidenceHash,prepareReviewItem,overseasFields} from './curation-review-contract.mjs';
import {publicationBindingMatches,enrollComparisonBindings} from './publication-binding.mjs';
export const cafeCoverageFields=['address','businessHours','operation','ordering','booking'];
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ');
export function overseasFieldCoverage(snapshot,catalog,entries){
 return snapshot.records.map(r=>{
  const targets=(catalog.overseasCafeTargets??[]).filter(t=>t.role==='published'&&t.facilityId===r.id);
  const fields=Object.fromEntries(cafeCoverageFields.map(field=>{
   const configured=targets.filter(t=>t.baseline?.requiredFields?.includes(field)&&publicationBindingMatches(r,t)&&r.sourceUrls.includes(t.sourceUrl));
   const matched=configured.find(t=>{let id;try{id=prepareReviewItem({...t,text:t.fragments.join(' ')}).id;}catch{return false;}
    return entries.some(e=>e.recordId===t.recordId&&e.status==='corroborated'&&e.decision?.id===id);});
   return [field,{state:matched?'api-corroborated':configured.length?'registered-awaiting-comparison':'not-configured',
    scope:(matched??configured[0])?.comparisonScopes?.[field]??(configured.length?'publication':null)}];
  }));
  return {facilityId:r.id,publicationHash:r.publicationHash,sourceUrls:r.sourceUrls,fields,publicationApproved:false};
 });
}
export function buildIntakeQueue(work,catalog,{now=Date.now()}={}){
 const targets=[...catalog.targets??[],...catalog.discoveryTargets??[],...catalog.lodgingTargets??[],...catalog.overseasCafeTargets??[]];
 const items=work.items.filter(x=>x.category==='initial-review'||x.sourceChange).map(x=>{
  const t=targets.find(t=>t.recordId===x.recordId&&(!x.sourceUrl||x.sourceUrl===t.sourceUrl));
  const packet={key:x.key,sourceUrl:x.sourceUrl,recordId:x.recordId,category:x.category,reasons:x.reasons,nextCheckAt:x.nextCheckAt,
   sourceChange:x.sourceChange??null,registeredEvidence:t?{approvedDocumentHash:t.approvedDocumentHash??null,sharingReviewedAt:t.sharingReviewedAt??null,
    baseline:t.baseline??null,fragments:t.fragments??[],facilityId:t.facilityId??null,publicationHash:t.publicationHash??null}:null,
   requiredChecks:['official-source-and-facility-identity','visible-exact-evidence','publication-or-source-only-scope','sharing-suitability','no-conflicting-conditions'],
   automaticApproval:false};
  return {...packet,packetHash:evidenceHash(JSON.stringify(packet))};
 });
 return {version:1,generatedAt:new Date(now).toISOString(),items,count:items.length,apiRequests:0,publicationApproved:false};
}
// An operator submits an inspected packet, never a generic approval checkbox.
// Exact source text, current public identity and each fact are bound together.
export function applyReviewedOverseasIntake(catalog,snapshot,review,{now=Date.now()}={}){
 const next=structuredClone(catalog),r=snapshot.records.find(r=>r.id===review.facilityId),s=review.source;
 if(review.reviewed!==true||!r||r.publicationHash!==review.publicationHash||!r.sourceUrls.includes(s?.sourceUrl)
  ||!/^https:\/\//.test(s.sourceUrl)||!s.visibleText||!s.documentText||evidenceHash(s.documentText)!==s.documentHash
  ||!Number.isFinite(Date.parse(review.checkedAt))||now-Date.parse(review.checkedAt)>30*60000||Date.parse(review.checkedAt)>now
  ||!Number.isFinite(Date.parse(s.fetchedAt))||now-Date.parse(s.fetchedAt)>48*3600000||Date.parse(s.fetchedAt)>now
  ||!['identity','officialBodyRead','sharingSuitable','scopesChecked','conditionsChecked'].every(k=>review.checks?.[k]===true))throw Error('Exact initial review required');
 const fields=Object.keys(review.facts??{});
 if(!fields.length||fields.some(f=>!overseasFields.includes(f)||!['publication','source-only'].includes(review.scopes?.[f])
  ||typeof review.facts[f]!=='string'||!review.facts[f].trim()||review.facts[f].length>240
  ||!norm(s.visibleText).includes(norm(review.facts[f]))||/@|https?:\/\/|\+\d[\d ()-]{7,}/.test(review.facts[f])))throw Error('Literal shareable facts required');
 const id=review.recordId??'published-'+r.id,old=(next.overseasCafeTargets??[]).find(t=>t.recordId===id);
 if(old&&(old.role!=='published'||old.facilityId!==r.id||old.sourceUrl!==s.sourceUrl))throw Error('Existing source identity differs');
 const target={...old,kind:'overseas_cafe',recordId:id,facilityId:r.id,countryCode:r.countryCode,role:'published',title:review.title,
  sourceUrl:s.sourceUrl,sourceMode:'html',officialVerified:true,publicationHash:r.publicationHash,approvedDocumentHash:s.documentHash,
  fragments:[...new Set(Object.values(review.facts))],baseline:{requiredFields:fields,facts:review.facts},comparisonScopes:review.scopes,
  sharingReviewedAt:review.checkedAt,initialReview:{checkedAt:review.checkedAt,sourceFetchedAt:s.fetchedAt,scope:fields,checks:review.checks}};
 prepareReviewItem({...target,text:target.fragments.join(' ')});
 if(old&&old.approvedDocumentHash===target.approvedDocumentHash&&JSON.stringify(old.baseline)===JSON.stringify(target.baseline)&&JSON.stringify(old.fragments)===JSON.stringify(target.fragments)&&JSON.stringify(old.comparisonScopes)===JSON.stringify(target.comparisonScopes)&&old.publicationHash===target.publicationHash)return next;
 if(old)target.intakeHistory=[...(old.intakeHistory??[]),{publicationHash:old.publicationHash,comparisonBinding:old.comparisonBinding??null,approvedDocumentHash:old.approvedDocumentHash,sharingReviewedAt:old.sharingReviewedAt,fragments:old.fragments,baseline:old.baseline,comparisonScopes:old.comparisonScopes??null,initialReview:old.initialReview??null}];
 next.overseasCafeTargets??=[];
 if(old)next.overseasCafeTargets[next.overseasCafeTargets.indexOf(old)]=target;else next.overseasCafeTargets.push(target);
 return enrollComparisonBindings(next,{overseas:snapshot},now).catalog;
}
