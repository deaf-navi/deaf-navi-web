import {evidenceHash} from './curation-review-contract.mjs';
const day=now=>new Date(now+9*3600000).toISOString().slice(0,10);
const time=value=>Date.parse(value)||0;
const DAY=86400000;
// Source work is bounded separately from the shared API request/token budget.
export const OVERSEAS_DAILY_ITEMS=36;
export const OVERSEAS_BATCH_SIZE=4;
export const OVERSEAS_TRAVEL_ITEMS=3;
export function overseasDailyItemLimit(catalog){
 const policy=catalog?.overseasRotationPolicy;
 if(policy===undefined)return 8; // Existing deployments require explicit rollout.
 if(policy?.version!==1||![8,24,OVERSEAS_DAILY_ITEMS].includes(policy.dailyItems)||policy.batchItems!==OVERSEAS_BATCH_SIZE)throw Error('Invalid overseas capacity policy');
 return policy.dailyItems;
}
export const overseasTargetSignature=t=>evidenceHash(JSON.stringify([t.sourceUrl,t.approvedDocumentHash,t.fragments,t.baseline,t.comparisonBinding?.comparisonHash??t.publicationHash]));
export function planOverseasRotation({eligible,sharedIds,previous={},decisions=[],now=Date.now(),dailyItems=OVERSEAS_DAILY_ITEMS}){
 if(![8,24,OVERSEAS_DAILY_ITEMS].includes(dailyItems))throw Error('Invalid overseas daily limit');
 const old=new Map((previous.entries??[]).map(e=>[e.recordId,e]));
 const attempted=previous.day===day(now)?[...new Set(previous.attempted??[])]:[];
 const deferred=[],ready=[];
 for(const t of eligible){
  const prior=old.get(t.recordId),shared=sharedIds.has(t.recordId);
  const changed=!!prior?.targetSignature&&prior.targetSignature!==overseasTargetSignature(t);
  let reason=null,nextCheckAt=null;
  if(attempted.includes(t.recordId))reason='already-attempted-today';
  else if(t.role!=='travel'&&!changed){
   const wait=decisions.find(d=>d.key==='overseas:'+t.recordId&&d.fingerprint===prior?.fingerprint&&d.disposition==='waiting-source'
    &&time(d.reviewedAt)>0&&time(d.reviewedAt)<=now&&time(d.nextCheckAt)>now&&time(d.nextCheckAt)-time(d.reviewedAt)<=7*DAY);
   const delay=!shared?7*DAY:prior?.consecutiveSourceFailures?Math.min(7,prior.consecutiveSourceFailures===1?1:prior.consecutiveSourceFailures===2?3:7)*DAY:0;
   const retryAt=time(prior?.lastAttemptedAt)+delay;
   if(wait){reason='waiting-source-until';nextCheckAt=wait.nextCheckAt;}
   else if(delay&&time(prior?.lastAttemptedAt)&&retryAt>now){reason='source-retry-after';nextCheckAt=new Date(retryAt).toISOString();}
  }
  if(reason){deferred.push({recordId:t.recordId,sourceUrl:t.sourceUrl,reason,nextCheckAt});continue;}
  const age=now-time(prior?.lastAttemptedAt);
  ready.push({target:t,shared,age,priority:changed?0:shared&&t.role==='published'&&age>=7*DAY&&prior?.decision?0:!prior?.decision?1:2,
   selectionReason:t.role==='travel'?'travel-priority':changed?'reviewed-conditions-changed':!shared?'unshared-source-probe':!prior?.decision?'initial-api-comparison':age>=7*DAY?'rotation-overdue':'routine-comparison'});
 }
 const order=(a,b)=>a.priority-b.priority||b.age-a.age||a.target.recordId.localeCompare(b.target.recordId);
 const travelSlots=Math.max(0,OVERSEAS_TRAVEL_ITEMS-attempted.filter(id=>eligible.some(t=>t.recordId===id&&t.role==='travel')).length);
 const travel=ready.filter(x=>x.target.role==='travel').sort(order).slice(0,travelSlots);
 const published=ready.filter(x=>x.shared&&x.target.role==='published').sort(order);
 // Reserve one remaining slot for the oldest candidate/probe when publication
 // work exists, avoiding permanent starvation without letting probes dominate.
 const secondary=ready.filter(x=>x.target.role!=='travel'&&!(x.shared&&x.target.role==='published')).sort((a,b)=>b.age-a.age||Number(b.shared)-Number(a.shared)||order(a,b));
 const slots=Math.max(0,dailyItems-attempted.length),picked=travel.slice(0,slots);
 const left=slots-picked.length;
 if(left>0){
  const alreadySecondary=attempted.some(id=>eligible.some(t=>t.recordId===id&&t.role!=='travel'&&!(sharedIds.has(id)&&t.role==='published')));
  const reserve=published.length&&secondary.length&&!alreadySecondary&&left>1?1:0;
  picked.push(...published.slice(0,left-reserve));
  picked.push(...secondary.slice(0,Math.max(0,slots-picked.length)));
  picked.push(...published.slice(left-reserve,left-reserve+Math.max(0,slots-picked.length)));
 }
 const selected=picked.map(x=>x.target),selection=picked.map(x=>({recordId:x.target.recordId,role:x.target.role,shared:x.shared,reason:x.selectionReason}));
 for(const x of ready)if(!selected.includes(x.target))deferred.push({recordId:x.target.recordId,sourceUrl:x.target.sourceUrl,reason:x.target.role==='travel'?'daily-travel-limit':'daily-source-limit'});
 return {selected,selection,attempted,deferred};
}
