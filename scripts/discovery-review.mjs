import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {reviewCurationTasks} from './curation-review.mjs';
import {evidenceHash,prepareReviewItem} from './curation-review-contract.mjs';
import {curationHorizonEnd} from './curation-horizon.mjs';

const LIMIT=8;
const issue=(target,reason)=>({kind:target.kind,recordId:target.recordId,sourceUrl:target.sourceUrl,
  status:'exception',reasons:[reason],publicationApproved:false,reviewedAt:null});
const urlKey=value=>{try{const u=new URL(value);u.hash='';return u.href;}catch{return null;}};

// Candidate extraction has no publication baseline. A valid extraction is a draft,
// never a match against an invented baseline or permission to publish.
export function candidateDisposition(entry,{now=Date.now(),eventKind}={}){
  if(!entry.decision)return {...entry,disposition:'needs-review'};
  const {decision}=entry;
  const reasons=entry.reasons.filter(x=>x!=='differs-from-current');
  const facts=Object.fromEntries(decision.facts.filter(x=>x.field!=='communication').map(x=>[x.field,x.value]));
  const today=new Date(now+9*3600000).toISOString().slice(0,10);
  const end=curationHorizonEnd({kind:entry.kind,eventKind,now});
  let disposition='needs-review';
  if(decision.relevance==='no')disposition='not-relevant-proposed';
  else if(decision.relevance==='yes'&&entry.kind==='news'&&!reasons.length)disposition='publication-review-required';
  else if(decision.relevance==='yes'&&!reasons.length){
    disposition=(facts.endDate??facts.startDate)<today||facts.startDate>end?'outside-horizon':'publication-review-required';
  }
  return {...entry,status:'candidate',reasons,disposition,publicationApproved:false,reviewedAt:null};
}

export async function runDiscoveryReview({stateDir,catalog,knownUrls=[],now=Date.now(),prepare=prepareCurationReview,
  generate,canSubmit=()=>false,approvalSignature='none',stopAfterError=false}={}){
  const targets=catalog.discoveryTargets??[];
  if(!Array.isArray(targets)||targets.length>200)throw new Error('Invalid discovery review catalog');
  const seen=new Set(),known=new Set(knownUrls.map(urlKey).filter(Boolean));
  const path=join(stateDir,'discovery-review.json');let previous;
  try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const old=new Map((previous?.entries??[]).map(x=>[x.kind+':'+x.recordId,x]));
  const valid=[],entries=[];
  for(const target of targets){
    const id=target.kind+':'+target.recordId;
    if(seen.has(id)||!target.recordId)throw new Error('Duplicate candidate review identity');seen.add(id);
    if(known.has(urlKey(target.sourceUrl))){entries.push({...issue(target,'already-published-source'),disposition:'published-source'});continue;}
    if(!['news','event','cafe'].includes(target.kind)||target.officialVerified!==true||target.sourceMode!=='html'
      ||!Number.isFinite(Date.parse(target.sharingReviewedAt))||Date.parse(target.sharingReviewedAt)>now
      ||!/^[a-f0-9]{64}$/.test(target.approvedDocumentHash??'')){
      entries.push(issue(target,'review-catalog-required'));continue;
    }
    prepareReviewItem({...target,text:target.fragments?.join(' ')});
    valid.push({...target,baseline:{}});
  }
  // Least recently checked first, then interleave domains. Never let one source
  // consume the entire bounded review queue indefinitely.
  valid.sort((a,b)=>(Date.parse(old.get(a.kind+':'+a.recordId)?.machineCheckedAt)||0)-(Date.parse(old.get(b.kind+':'+b.recordId)?.machineCheckedAt)||0)||a.recordId.localeCompare(b.recordId));
  const groups=new Map();for(const t of valid){const d=new URL(t.sourceUrl).hostname;if(!groups.has(d))groups.set(d,[]);groups.get(d).push(t);}
  const ordered=[];while([...groups.values()].some(x=>x.length))for(const g of groups.values())if(g.length)ordered.push(g.shift());
  const selected=ordered.slice(0,LIMIT),day=new Date(now+9*3600000).toISOString().slice(0,10);
  const signature=evidenceHash(JSON.stringify({version:2,targets,known:[...known].sort(),approvalSignature}));
  if(!stopAfterError&&previous?.day===day&&previous.signature===signature&&Date.parse(previous.generatedAt)<=now
    &&now-Date.parse(previous.generatedAt)<48*3600000)return {...previous,reusedRun:true,submittedThisRun:0,newOrChanged:[]};
  let submitted=0,cached=0,failed=stopAfterError;const sourceCache=new Map();
  for(let offset=0;offset<selected.length;offset+=4){
    const batch=selected.slice(offset,offset+4);
    if(failed){entries.push(...batch.map(x=>issue(x,'batch-stopped-after-api-error')));continue;}
    const prepared=await prepare(batch,{now,sourceCache});
    entries.push(...prepared.exceptions.map(x=>issue(x,x.reason)));
    if(!prepared.tasks.length)continue;
    try{
      const r=await reviewCurationTasks(prepared.tasks,{stateDir,now,generate,canSubmit,runMode:'routine'});
      submitted+=r.submitted;cached+=r.cached;
      for(const e of r.entries)entries.push(candidateDisposition(e,{now,eventKind:batch.find(x=>x.kind===e.kind&&x.recordId===e.recordId)?.eventKind}));
    }catch{failed=true;submitted=null;entries.push(...prepared.tasks.map(x=>issue(x,'api-or-cache-unavailable')));}
  }
  const stamp=new Date(now).toISOString(),newOrChanged=[];
  for(const e of entries){const prior=old.get(e.kind+':'+e.recordId);
    e.fingerprint=evidenceHash(JSON.stringify([e.status,e.disposition,e.reasons,e.decision??null,e.sourceUrl]));
    if(prior?.fingerprint!==e.fingerprint)newOrChanged.push(e.kind+':'+e.recordId);
    e.firstSeenAt=prior?.firstSeenAt??stamp;e.changedAt=prior?.fingerprint===e.fingerprint?prior.changedAt:stamp;
    e.machineCheckedAt=stamp;
  }
  const deferred=ordered.slice(LIMIT).map(x=>({kind:x.kind,recordId:x.recordId,reason:'batch-limit'}));
  // Keep deferred history instead of falsely marking it resolved or re-sending it.
  for(const d of deferred){const prior=old.get(d.kind+':'+d.recordId);if(prior)entries.push({...prior,deferred:true});}
  const result={version:1,day,signature,generatedAt:stamp,reusedRun:false,selected:selected.length,cached,submittedThisRun:submitted,
    entries,deferred,newOrChanged,
    publicationApproved:false,reviewedAt:null};
  const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(result,null,2)+'\n',{mode:0o600});await rename(tmp,path);
  return result;
}
