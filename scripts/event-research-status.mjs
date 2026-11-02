import {prepareReviewItem} from './curation-review-contract.mjs';

// Report the stages separately. A fetched link, registration, cached result and
// new API request are different observations; none is a publication approval.
export function eventResearchStatus({discovery,review,catalog={},now=Date.now()}={}){
 const known=Array.isArray(discovery?.reviewQueue)&&Array.isArray(review?.entries);
 const targets=(catalog.discoveryTargets??[]).filter(t=>['event','cafe'].includes(t.kind));
 const entries=review?.entries??[],byKind={event:{},cafe:{}},inputs=[];
 for(const t of targets){
  let inputId=null;try{inputId=prepareReviewItem({...t,text:t.fragments?.join(' ')}).id;}catch{}
  const e=entries.find(e=>e.kind===t.kind&&e.recordId===t.recordId);
  const exact=inputId&&inputId===(e?.decision?.id??e?.id);
  let state=!e?'not-selected':e.status==='already-published'?'published':
   e.disposition==='outside-horizon'&&exact?'outside-horizon':
   e.status==='candidate'&&exact?e.disposition??'needs-review':
   e.status==='candidate'?'new-input-awaiting-review':e.reasons?.[0]??'needs-review';
  byKind[t.kind][state]=(byKind[t.kind][state]??0)+1;
  inputs.push({kind:t.kind,recordId:t.recordId,sourceUrl:t.sourceUrl,inputId,state,
   machineCheckedAt:e?.machineCheckedAt??null,publicationApproved:false});
 }
 const pendingSources=[...new Map((discovery?.reviewQueue??[]).map(x=>[x.url,x])).values()];
 const unregistered=pendingSources.filter(x=>!targets.some(t=>t.sourceUrl===x.url));
 const active=inputs.filter(x=>!['published','outside-horizon'].includes(x.state));
 const ready=active.filter(x=>x.state==='publication-review-required');
 const stale=file=>!Number.isFinite(Date.parse(file?.generatedAt))||Date.parse(file.generatedAt)>now||now-Date.parse(file.generatedAt)>36*3600000;
 return {state:!known?'unknown':stale(discovery)||stale(review)?'stale':'observed',
  scope:'registered-official-sources-not-exhaustive-web-search',
  collection:{checkedAt:discovery?.generatedAt??null,selectedPages:discovery?.results?.length??null,
   fetchedPages:discovery?.results?.filter(x=>x.status==='fetched').length??null,
   unavailablePages:discovery?.results?.filter(x=>x.status==='unavailable').length??null,
   newLinks:discovery?.newCandidates??null,watchedPages:discovery?.watchedPages?.length??0},
  initialSharingReview:{pendingSources:known?unregistered.length:null,
   sourceQueue:unregistered.map(x=>({id:x.id,url:x.url,sourceId:x.sourceId,reason:x.reason})).slice(0,8)},
  extraction:{checkedAt:review?.generatedAt??null,registered:targets.length,active:active.length,
   selected:review?.selected??null,submittedItemsThisRun:review?.submittedThisRun??null,cachedItemsThisRun:review?.cached??null,
   publicationReviewReady:ready.length,byKind,inputs},
  attention:known&&unregistered.length&&!ready.length?'candidate-intake-required':null,
  apiRequests:0,publicationApproved:false};
}
