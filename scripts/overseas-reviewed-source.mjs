import {evidenceHash,prepareReviewItem} from './curation-review-contract.mjs';

// A receipt contains hashes and times, never the changed document. Only a fresh,
// explicit human approval of that exact document may unlock its reviewed text.
const DAY=now=>new Date(now+9*3600000).toISOString().slice(0,10);
export function sourceReceiptBinding(target){
 const {approvedDocumentHash,sharingReviewedAt,evidenceReview,...bound}=target;
 return evidenceHash(JSON.stringify(bound));
}
export function makeSourceReceipt(target,sourceDocumentHash,now){
 if(target.kind!=='overseas_cafe'||target.role!=='published')return undefined;
 return {version:1,recordId:target.recordId,sourceUrl:target.sourceUrl,
  documentHash:sourceDocumentHash,targetBinding:sourceReceiptBinding(target),
  inputId:prepareReviewItem({...target,text:target.fragments.join(' ')}).id,
  fetchedAt:new Date(now).toISOString(),sharingReviewedAt:target.sharingReviewedAt};
}
export function reviewedSourceTask(target,receipt,now){
 const fetched=Date.parse(receipt?.fetchedAt),reviewed=Date.parse(target.sharingReviewedAt);
 if(receipt?.version!==1||target.kind!=='overseas_cafe'||target.role!=='published'
  ||target.officialVerified!==true||target.sourceMode!=='html'
  ||receipt.recordId!==target.recordId||receipt.sourceUrl!==target.sourceUrl
  ||receipt.documentHash!==target.approvedDocumentHash||receipt.targetBinding!==sourceReceiptBinding(target)
  ||!Number.isFinite(fetched)||!Number.isFinite(reviewed)||fetched>now||now-fetched>5*60000
  ||DAY(fetched)!==DAY(now)||reviewed<fetched||reviewed>now
  ||reviewed<=Date.parse(receipt.sharingReviewedAt))return null;
 const item=prepareReviewItem({...target,text:target.fragments.join(' ')});
 if(item.id!==receipt.inputId)return null;
 const text=JSON.parse(item.summary).text;
 return {kind:target.kind,title:item.title,sourceUrl:target.sourceUrl,recordId:target.recordId,
  baseline:target.baseline,comparisonBaselineHash:target.comparisonBaselineHash,comparisonReview:target.comparisonReview,
  text,sourceTextHash:evidenceHash(text),sourceDocumentHash:receipt.documentHash,
  sourceMode:'html',officialVerified:true,retrievedAt:receipt.fetchedAt};
}
