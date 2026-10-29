import {evidenceHash} from './curation-review-contract.mjs';
const comparable=s=>String(s).normalize('NFKC').replace(/\s+/g,'');
// Only previously approved short excerpts appear in the diagnostic. New page
// text, contacts or personal stories are neither retained here nor sent to AI.
export function describeSourceChange(target,visibleText,observedDocumentHash){
 const fragments=(target.fragments??[]).map((text,index)=>({index,expectedExcerpt:text.slice(0,240),
  excerptTruncated:text.length>240,present:comparable(visibleText).includes(comparable(text)),
  fields:Object.entries(target.baseline?.facts??{}).filter(([,v])=>typeof v==='string'&&comparable(text).includes(comparable(v))).map(([k])=>k)}));
 return {version:1,expectedDocumentHash:target.approvedDocumentHash??null,observedDocumentHash,
  scope:fragments.every(f=>f.present)?'reviewed-fragments-unchanged-body-changed':'reviewed-fragments-missing',fragments,
  potentiallyAffectedFields:[...new Set(fragments.filter(f=>!f.present).flatMap(f=>f.fields))],
  otherChangesUnknown:true,currentTextStored:false,sharingApproved:false,publicationApproved:false,
  fingerprint:evidenceHash(JSON.stringify([target.approvedDocumentHash,observedDocumentHash,fragments.map(f=>f.present)]))};
}
