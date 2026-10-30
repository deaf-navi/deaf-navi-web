import {evidenceHash,prepareReviewItem,validateReviewResult,compareReview,overseasFields} from './curation-review-contract.mjs';
import {overseasTargetSignature} from './overseas-cafe-rotation.mjs';

// An inspected extraction error is not an API corroboration. Bind the resolution
// to the entire input, page, publication, baseline AND original API decision.
// Never waive fetch/account/unknown-result failures or mutate the API cache.
export function reuseOverseasEvidenceReview(entry,target,task,now){
 const r=target.evidenceReview;
 if(target.role!=='published'||!r||entry.status!=='exception'||!entry.decision
  ||!entry.reasons?.length||entry.reasons.some(x=>!['differs-from-current','overseas-guidance-not-confirmed','uncertain-relevance',...overseasFields.map(f=>'missing-'+f)].includes(x)))return entry;
 try{
  const item=prepareReviewItem(task),checked=Date.parse(r.checkedAt);
  if(r.version!==1||r.reason!=='extraction-only'||r.inputId!==item.id
   ||r.documentHash!==task.sourceDocumentHash||r.publicationHash!==target.publicationHash
   ||r.baselineHash!==evidenceHash(JSON.stringify(target.baseline))||r.apiDecisionHash!==evidenceHash(JSON.stringify(entry.decision))
   ||!/^[a-f0-9]{64}$/.test(r.documentHash)||!/^[a-f0-9]{64}$/.test(r.publicationHash)
   ||!Number.isFinite(checked)||checked>now||!r.note?.trim()
   ||!['officialEvidenceRead','allConditionsChecked','noMaterialDifference'].every(k=>r.checks?.[k]===true))return entry;
  validateReviewResult([item],{items:[entry.decision]});
  validateReviewResult([item],{items:[r.decision]});
  const compared=compareReview(task,r.decision,{now});
  if(compared.status!=='corroborated')return entry;
  return {...entry,status:'reviewed-evidence',reasons:[],differences:[],reviewedDecision:r.decision,
   evidenceReviewCheckedAt:r.checkedAt,resolvedReasons:entry.reasons,resolvedDifferences:entry.differences,
   decisionOrigin:'api-with-inspected-extraction-resolution',publicationApproved:false,reviewedAt:null};
 }catch{return entry;}
}

// Apply a newly inspected resolution to the same saved acquisition, even after
// today's source slots are used. No fetching, generation or timestamp renewal.
export function reconcileSavedOverseasEvidence(entry,target,now){
 if(entry.status==='reviewed-evidence'){
  const {reviewedDecision,evidenceReviewCheckedAt,resolvedReasons,resolvedDifferences,decisionOrigin,...original}=entry;
  entry={...original,status:'exception',reasons:resolvedReasons,differences:resolvedDifferences};
 }
 if(entry.targetSignature!==overseasTargetSignature(target)||entry.sourceUrl!==target.sourceUrl
  ||!Number.isFinite(Date.parse(entry.machineCheckedAt)))return entry;
 const task={...target,text:target.fragments.join(' '),sourceDocumentHash:target.approvedDocumentHash,
  sourceTextHash:evidenceHash(target.fragments.join(' ')),retrievedAt:entry.machineCheckedAt};
 return reuseOverseasEvidenceReview(entry,target,task,now);
}
