import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {reviewCurationTasks} from './curation-review.mjs';
import {evidenceHash,prepareReviewItem,overseasFields} from './curation-review-contract.mjs';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {cleanHtml} from '../src/lib/text.mjs';
import {publicationBindingMatches} from './publication-binding.mjs';
import {planOverseasRotation,overseasTargetSignature} from './overseas-cafe-rotation.mjs';
import {overseasFieldCoverage} from './curation-review-intake.mjs';

const sha=x=>/^[a-f0-9]{64}$/.test(x??'');
const issue=(t,reason)=>({kind:'overseas_cafe',recordId:t.recordId,role:t.role,sourceUrl:t.sourceUrl??null,status:'exception',reasons:[reason],differences:[],...(t.sourceChange?{sourceChange:t.sourceChange}:{}),publicationApproved:false,reviewedAt:null});
export function planOverseasCafeReview(snapshot,catalog,now=Date.now()){
 const records=new Map((snapshot?.records??[]).map(r=>[r.id,r]));
 const targets=catalog.overseasCafeTargets??[],seen=new Set(),selected=[],entries=[];
 if(!Array.isArray(targets)||targets.length>300)throw Error('Invalid overseas catalog');
 for(const t of targets){
  if(t.kind!=='overseas_cafe'||!t.recordId||seen.has(t.recordId)||!['published','candidate','travel'].includes(t.role))throw Error('Invalid overseas identity');
  seen.add(t.recordId);
  if(t.role==='published'){
   const r=records.get(t.facilityId);
   if(!publicationBindingMatches(r,t)||!r.sourceUrls.includes(t.sourceUrl)){entries.push(issue(t,'publication-baseline-review-required'));continue;}
  }
  if(t.role==='travel'){
   const u=new URL(t.sourceUrl);
   if(u.origin!=='https://www.anzen.mofa.go.jp'||!/^\/info\/pcinfectionspothazardinfo_\d+\.html$/.test(u.pathname)||u.search||u.hash){entries.push(issue(t,'official-travel-source-required'));continue;}
  }
  if(t.officialVerified!==true||t.sourceMode!=='html'||!sha(t.approvedDocumentHash)||!Number.isFinite(Date.parse(t.sharingReviewedAt))||Date.parse(t.sharingReviewedAt)>now){entries.push(issue(t,'sharing-review-required'));continue;}
  if(!Array.isArray(t.baseline?.requiredFields)||!t.baseline.requiredFields.length||t.baseline.requiredFields.some(f=>!overseasFields.includes(f)||typeof t.baseline.facts?.[f]!=='string'||!t.baseline.facts[f].trim())){entries.push(issue(t,'structured-baseline-required'));continue;}
  prepareReviewItem({...t,text:t.fragments?.join(' ')});
  selected.push(t);
 }
 for(const r of records.values())if(!targets.some(t=>t.role==='published'&&t.facilityId===r.id))entries.push(issue({recordId:r.id,role:'published',sourceUrl:r.sourceUrls[0]},'sharing-review-required'));
 return {selected,entries};
}

// API comparisons never impersonate source/publication review or change the DB.
export async function runOverseasCafeReview({stateDir,snapshot={records:[]},catalog={},now=Date.now(),prepare=prepareCurationReview,fetchResource=fetchThumbnailResource,generate,canSubmit=()=>false,approvalSignature='none',stopAfterError=false}){
 const path=join(stateDir,'overseas-cafe-review.json'),plan=planOverseasCafeReview(snapshot,catalog,now);
 let previous;try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous?.submittedThisRun===null)stopAfterError=true;
 let decisions=[];try{decisions=JSON.parse(await readFile(join(stateDir,'curation-work-decisions.json'),'utf8')).items??[];}catch(e){if(e.code!=='ENOENT')throw e;}
 const day=new Date(now+9*3600000).toISOString().slice(0,10),signature=evidenceHash(JSON.stringify([3,snapshot,catalog.overseasCafeTargets??[],approvalSignature,decisions]));
 if(!stopAfterError&&previous?.day===day&&previous.signature===signature)return {...previous,reusedRun:true,submittedThisRun:previous.submittedThisRun===null?null:0,newOrChanged:[]};
 const old=new Map((previous?.entries??[]).map(e=>[e.recordId,e]));
 // A changing allowance cannot reopen the same day's acquisition budget.
 // Unapproved, explicitly registered leads receive a bounded hash/availability
 // check locally. No unreviewed text is ever sent to the shared API.
 const probes=(catalog.overseasCafeTargets??[]).filter(t=>!plan.selected.includes(t)&&t.role==='candidate'&&t.sourceMode==='html');
 for(const e of plan.entries.filter(e=>e.role==='published'&&e.reasons.includes('sharing-review-required')&&e.sourceUrl))probes.push({...e,sourceMode:'html'});
 const eligible=[...plan.selected,...probes];
 const rotation=planOverseasRotation({eligible,sharedIds:new Set(plan.selected.map(t=>t.recordId)),previous,decisions,now});
 const {selected,attempted,deferred}=rotation;
 const entries=plan.entries.filter(e=>!selected.some(t=>probes.includes(t)&&t.recordId===e.recordId)).map(e=>{
  const prior=old.get(e.recordId);
  return !selected.some(t=>t.recordId===e.recordId)&&prior?.sourceUrl===e.sourceUrl&&JSON.stringify(prior.reasons)===JSON.stringify(e.reasons)?{...prior,deferred:true}:e;
 }),sourceCache=new Map(),fetched=new Set(),actuallyAttempted=new Set();
 let submitted=stopAfterError?null:0,cached=0,failed=stopAfterError;
 for(let offset=0;offset<selected.length;offset+=4){
  const batch=selected.slice(offset,offset+4);attempted.push(...batch.map(t=>t.recordId));
  if(failed){entries.push(...batch.map(t=>issue(t,'batch-stopped-after-api-error')));continue;}
  const sharedBatch=batch.filter(t=>plan.selected.includes(t));
  for(const t of batch.filter(t=>probes.includes(t))){
   const e=issue(t,plan.entries.find(x=>x.recordId===t.recordId)?.reasons[0]??'sharing-review-required');actuallyAttempted.add(t.recordId);
   try{
    if(!sourceCache.has(t.sourceUrl))sourceCache.set(t.sourceUrl,fetchResource(t.sourceUrl,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:u=>u===t.sourceUrl}));
    const r=await sourceCache.get(t.sourceUrl);
    if(r.status!==200||!/text\/html|application\/xhtml\+xml/i.test(r.headers?.['content-type']??''))throw Error('unavailable');
    e.observedDocumentHash=evidenceHash(cleanHtml(r.text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')));
    e.fetchStatus='fetched-unshared';fetched.add(t.recordId);
   }catch{e.fetchStatus='unavailable';}
   entries.push(e);
  }
  if(!sharedBatch.length)continue;
  sharedBatch.forEach(t=>actuallyAttempted.add(t.recordId));
  const prepared=await prepare(sharedBatch,{now,sourceCache});
  prepared.tasks.forEach(t=>fetched.add(t.recordId));
  entries.push(...prepared.exceptions.map(e=>issue({...batch.find(t=>t.recordId===e.recordId),...e},e.reason)));
  if(!prepared.tasks.length)continue;
  try{
   const result=await reviewCurationTasks(prepared.tasks,{stateDir,now,generate,canSubmit,runMode:'routine'});
   submitted+=result.submitted;cached+=result.cached;
   for(const e of result.entries){
    const t=batch.find(t=>t.recordId===e.recordId),value={...e,role:t.role,facilityId:t.facilityId??null,countryCode:t.countryCode??null,
     comparisonScopes:t.comparisonScopes??{},differences:(e.differences??[]).map(d=>({...d,scope:t.comparisonScopes?.[d.field]??'publication'}))};
    if(t.role==='candidate'){
     // A candidate baseline is reviewed evidence too. Do not hide a changed
     // extracted condition merely because the facility is not published yet.
     value.reasons=[...value.reasons,...(t.pendingReasons??[])];
     if(t.identityVerified!==true)value.reasons.push('identity-review-required');
     if(t.currentOperationVerified!==true)value.reasons.push('current-operation-review-required');
     if(t.relevanceVerified!==true)value.reasons.push('signing-relevance-review-required');
     if(t.travelReviewed!==true)value.reasons.push('travel-review-required');
     value.status='candidate';value.disposition=value.reasons.length?'needs-review':'publication-review-required';
    }
    entries.push(value);
   }
  }catch{failed=true;submitted=null;entries.push(...prepared.tasks.map(t=>issue({...sharedBatch.find(x=>x.recordId===t.recordId),...t},'api-or-cache-unavailable')));}
 }
 const stamp=new Date(now).toISOString(),newOrChanged=[];
 for(const e of entries){
  const prior=old.get(e.recordId);e.fingerprint=evidenceHash(JSON.stringify([e.status,e.disposition,e.reasons,e.differences,e.decision??null,e.sourceUrl,e.fetchStatus,e.observedDocumentHash,...(e.sourceChange?[e.sourceChange.fingerprint]:[])]));
  e.firstSeenAt=prior?.firstSeenAt??stamp;e.changedAt=prior?.fingerprint===e.fingerprint?prior.changedAt:stamp;
  // Pending/unselected source records are not claimed as machine-fetched.
  e.lastAttemptedAt=actuallyAttempted.has(e.recordId)?stamp:prior?.lastAttemptedAt??null;
  const t=eligible.find(t=>t.recordId===e.recordId);
  e.targetSignature=actuallyAttempted.has(e.recordId)&&t?overseasTargetSignature(t):prior?.targetSignature??null;
  const unavailable=e.fetchStatus==='unavailable'||e.reasons.some(r=>/source-unavailable|invalid-or-unavailable-source|fetch-failed|fetch-unavailable|timeout/.test(r));
  e.consecutiveSourceFailures=actuallyAttempted.has(e.recordId)?unavailable?(prior?.consecutiveSourceFailures??0)+1:0:prior?.consecutiveSourceFailures??0;
  e.machineCheckedAt=fetched.has(e.recordId)?stamp:prior?.machineCheckedAt??null;
  if(prior?.fingerprint!==e.fingerprint)newOrChanged.push(e.recordId);
 }
 for(const d of deferred)if(old.has(d.recordId)&&!entries.some(e=>e.recordId===d.recordId))entries.push({...old.get(d.recordId),deferred:true});
 const nextRotation=planOverseasRotation({eligible,sharedIds:new Set(plan.selected.map(t=>t.recordId)),previous:{day,attempted,entries},decisions,now:now+86400000});
 const result={version:1,day,signature,generatedAt:stamp,reusedRun:false,selected:selected.length,selection:rotation.selection,attempted,cached,submittedThisRun:submitted,entries,deferred,newOrChanged,
  fieldCoverage:overseasFieldCoverage(snapshot,catalog,entries),
  rotationWork:plan.selected.filter(t=>t.role==='published').map(t=>{
   const e=entries.find(e=>e.recordId===t.recordId),d=deferred.find(d=>d.recordId===t.recordId),targetSignature=overseasTargetSignature(t);
   const current=e?.targetSignature===targetSignature,fetchedAt=Date.parse(e?.machineCheckedAt);
   const pending=!(current&&e?.status==='corroborated'&&Number.isFinite(fetchedAt)&&now-fetchedAt<7*86400000);
   const held=d&&['waiting-source-until','source-retry-after'].includes(d.reason);
   return {recordId:t.recordId,targetSignature,pending,actionable:pending&&!held&&(!current||!e?.reasons?.length),
    lastAttemptedAt:e?.lastAttemptedAt??null,holdReason:held?d.reason:current&&e?.reasons?.length?'exception-review-required':null};
  }),
  nextRotationPreview:{simulation:true,at:new Date(now+86400000).toISOString(),selection:nextRotation.selection,deferred:nextRotation.deferred.length},
  corroborated:entries.filter(e=>e.status==='corroborated').length,exceptions:entries.filter(e=>e.status==='exception').length,candidates:entries.filter(e=>e.status==='candidate').length,
  coverage:{published:snapshot.records.length,configured:catalog.overseasCafeTargets?.length??0,sharedEligible:plan.selected.length,localOnly:probes.length,
    configuredPublished:(catalog.overseasCafeTargets??[]).filter(t=>t.role==='published').length,
    sharedEligiblePublished:plan.selected.filter(t=>t.role==='published').length,
    unregisteredPublished:snapshot.records.filter(r=>!(catalog.overseasCafeTargets??[]).some(t=>t.role==='published'&&t.facilityId===r.id)).length,
    monitoredFields:plan.selected.filter(t=>t.role==='published').reduce((counts,t)=>{for(const f of t.baseline.requiredFields)counts[f]=(counts[f]??0)+1;return counts;},{})},publicationApproved:false,reviewedAt:null};
 const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(result,null,2)+'\n',{mode:0o600});await rename(tmp,path);return result;
}
