import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {publicationBindingMatches} from './publication-binding.mjs';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {reviewCurationTasks} from './curation-review.mjs';
import {evidenceHash,prepareReviewItem,lodgingFields,validateReviewResult,compareReview} from './curation-review-contract.mjs';

const issue=(t,reason)=>({kind:'lodging',recordId:t.recordId,facilityId:t.facilityId??null,sourceUrl:t.sourceUrl??null,
  status:'exception',reasons:[reason],differences:[],...(t.sourceChange?{sourceChange:t.sourceChange}:{}),publicationApproved:false,reviewedAt:null});
const sha=value=>/^[a-f0-9]{64}$/.test(value??'');

// A one-time human inspection can resolve only a cached, definite evidence
// rejection. It never repairs unknown requests or overrides changed facts.
function reuseEvidenceReview(entry,target,task,now){
 const r=target.evidenceReview;
 if(target.role!=='published'||entry.status!=='exception'||entry.reasons.length!==1||entry.reasons[0]!=='api-evidence-invalid'||!r)return entry;
 try{
  const item=prepareReviewItem(task),checked=Date.parse(r.checkedAt);
  if(r.reason!=='api-evidence-invalid'||r.inputId!==item.id||r.documentHash!==task.sourceDocumentHash||r.publicationHash!==target.publicationHash
    ||!sha(r.documentHash)||!sha(r.publicationHash)||!Number.isFinite(checked)||checked>now)return entry;
  validateReviewResult([item],{items:[r.decision]});
  const compared=compareReview(task,r.decision,{now});
  if(compared.status!=='corroborated')return entry;
  return {...entry,...compared,status:'reviewed-evidence',decision:r.decision,decisionOrigin:'manual-evidence-review',
    evidenceReviewCheckedAt:r.checkedAt,resolvedReason:'api-evidence-invalid'};
 }catch{return entry;}
}

// Publication hashes bind the hand-checked structured baseline to what is served.
// No record here can publish, change operator verification or renew review dates.
export function planLodgingReview(snapshot,catalog,{now=Date.now()}={}){
  const targets=catalog.lodgingTargets??[],candidates=catalog.lodgingCandidates??[];
  if(!Array.isArray(targets)||!Array.isArray(candidates)||targets.length+candidates.length>100)throw new Error('Invalid lodging catalog');
  const records=new Map(),selected=[],entries=[],seen=new Set();
  if(snapshot?.version===1&&Array.isArray(snapshot.records))for(const r of snapshot.records){
    if(!r.id||records.has(r.id)||!sha(r.publicationHash)||!Array.isArray(r.sourceUrls))throw new Error('Invalid publication snapshot');
    records.set(r.id,r);
  }
  for(const [role,list] of [['published',targets],['candidate',candidates]])for(const t of list){
    if(t.kind!=='lodging'||!t.recordId||seen.has(t.recordId))throw new Error('Invalid lodging identity');
    seen.add(t.recordId);
    const withRole={...t,role};
    if(t.officialVerified!==true||t.sourceMode!=='html'||!sha(t.approvedDocumentHash)
      ||!Number.isFinite(Date.parse(t.sharingReviewedAt))||Date.parse(t.sharingReviewedAt)>now){
      entries.push({...issue(t,'review-catalog-required'),role});continue;
    }
    if(role==='published'){
      const record=records.get(t.facilityId);
      if(!publicationBindingMatches(record,t)||!record.sourceUrls.includes(t.sourceUrl)){
        entries.push({...issue(t,'publication-baseline-review-required'),role});continue;
      }
      if(!Array.isArray(t.baseline?.requiredFields)||!t.baseline.requiredFields.length
        ||t.baseline.requiredFields.some(f=>!lodgingFields.includes(f))
        ||!t.baseline.facts||Object.keys(t.baseline.facts).some(f=>!lodgingFields.includes(f))
        ||t.baseline.requiredFields.some(f=>typeof t.baseline.facts[f]!=='string'||!t.baseline.facts[f].trim())){
        entries.push({...issue(t,'structured-baseline-required'),role});continue;
      }
    }else if([...records.values()].some(r=>r.id===t.facilityId||r.sourceUrls.includes(t.sourceUrl))){
      entries.push({...issue(t,'already-published-source'),role});continue;
    }
    prepareReviewItem({...t,text:t.fragments?.join(' ')});
    // Operator identity is checked locally, never included in the API envelope.
    selected.push({...withRole,baseline:role==='candidate'?{requiredFields:['booking','stay']}:t.baseline});
  }
  for(const record of records.values())if(!targets.some(t=>t.facilityId===record.id))
    entries.push(issue({recordId:record.id,facilityId:record.id},'review-catalog-required'));
  return {selected,entries};
}

export async function runLodgingReview({stateDir,snapshot,catalog,now=Date.now(),prepare=prepareCurationReview,
  generate,canSubmit=()=>false,approvalSignature='none',stopAfterError=false}={}){
  const plan=planLodgingReview(snapshot,catalog,{now}),path=join(stateDir,'lodging-review.json');
  let previous;try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const day=new Date(now+9*3600000).toISOString().slice(0,10);
  const signature=evidenceHash(JSON.stringify({version:2,snapshot,targets:catalog.lodgingTargets??[],candidates:catalog.lodgingCandidates??[],approvalSignature}));
  if(!stopAfterError&&previous?.day===day&&previous.signature===signature&&Date.parse(previous.generatedAt)<=now)
    return {...previous,reusedRun:true,submittedThisRun:0,newOrChanged:[]};
  const old=new Map((previous?.entries??[]).map(e=>[e.recordId,e]));
  // At most two four-item batches, sharing the existing daily token/request budget.
  // Oldest first so new candidates do not permanently starve existing sources.
  // Apply a newly inspected resolution once before rotating older entries. Record
  // attempts too, so an invalid resolution cannot starve the rotation forever.
  const reviewHash=t=>evidenceHash(JSON.stringify(t.evidenceReview??null));
  const pendingResolution=t=>t.evidenceReview&&old.get(t.recordId)?.evidenceReviewHash!==reviewHash(t)?1:0;
  const ordered=plan.selected.sort((a,b)=>pendingResolution(b)-pendingResolution(a)
    ||(Date.parse(old.get(a.recordId)?.machineCheckedAt)||0)-(Date.parse(old.get(b.recordId)?.machineCheckedAt)||0)||a.recordId.localeCompare(b.recordId));
  const selected=ordered.slice(0,8),entries=[...plan.entries],sourceCache=new Map();
  let submitted=0,cached=0,failed=stopAfterError;
  for(let offset=0;offset<selected.length;offset+=4){
    const batch=selected.slice(offset,offset+4);
    if(failed){entries.push(...batch.map(t=>issue(t,'batch-stopped-after-api-error')));continue;}
    const prepared=await prepare(batch,{now,sourceCache});
    entries.push(...prepared.exceptions.map(t=>({...issue({...batch.find(b=>b.recordId===t.recordId),...t},t.reason),role:batch.find(b=>b.recordId===t.recordId)?.role})));
    if(!prepared.tasks.length)continue;
    try{
      const result=await reviewCurationTasks(prepared.tasks,{stateDir,now,generate,canSubmit,runMode:'routine'});
      submitted+=result.submitted;cached+=result.cached;
      for(const entry of result.entries){
        const target=batch.find(t=>t.recordId===entry.recordId);
        const task=prepared.tasks.find(t=>t.recordId===entry.recordId);
        const value={...reuseEvidenceReview(entry,target,task,now),facilityId:target.facilityId??null,role:target.role,
          ...(task.sourceEvidenceUrl?{sourceEvidenceUrl:task.sourceEvidenceUrl,documentScope:task.documentScope}:{})};
        if(target.role==='candidate'){
          value.reasons=value.reasons.filter(r=>r!=='differs-from-current');
          if(target.operatorVerified!==true)value.reasons.push('operator-review-required');
          if(target.receptionVerified!==true)value.reasons.push('current-reception-review-required');
          value.status='candidate';
          value.disposition=!entry.decision?'needs-review':entry.decision.relevance==='no'?'not-lodging-proposed':
            value.reasons.length?'needs-review':'publication-review-required';
        }
        entries.push(value);
      }
    }catch{
      failed=true;submitted=null;entries.push(...prepared.tasks.map(t=>issue(t,'api-or-cache-unavailable')));
    }
  }
  const stamp=new Date(now).toISOString(),newOrChanged=[];
  for(const e of entries){
    const prior=old.get(e.recordId);
    const target=selected.find(t=>t.recordId===e.recordId);if(target)e.evidenceReviewHash=reviewHash(target);
    e.fingerprint=evidenceHash(JSON.stringify([e.status,e.disposition,e.reasons,e.differences,e.sourceUrl,e.decision??null]));
    if(e.fingerprint!==prior?.fingerprint)newOrChanged.push(e.recordId);
    e.firstSeenAt=prior?.firstSeenAt??stamp;e.changedAt=prior?.fingerprint===e.fingerprint?prior.changedAt:stamp;e.machineCheckedAt=stamp;
  }
  const deferred=ordered.slice(8).map(t=>({recordId:t.recordId,reason:'batch-limit'}));
  for(const d of deferred)if(old.has(d.recordId))entries.push({...old.get(d.recordId),deferred:true});
  const result={version:1,day,signature,generatedAt:stamp,reusedRun:false,selected:selected.length,cached,submittedThisRun:submitted,
    corroborated:entries.filter(e=>e.status==='corroborated').length,evidenceReviewed:entries.filter(e=>e.status==='reviewed-evidence').length,exceptions:entries.filter(e=>e.status==='exception').length,
    candidates:entries.filter(e=>e.status==='candidate').length,entries,deferred,newOrChanged,publicationApproved:false,reviewedAt:null};
  const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(result,null,2)+'\n',{mode:0o600});await rename(tmp,path);
  return result;
}
