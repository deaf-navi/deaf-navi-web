import {evidenceHash} from './curation-review-contract.mjs';
const day=t=>new Date(t+9*3600000).toISOString().slice(0,10);
// Count observed eligible JST days, not elapsed wall time. Account stops,
// missing reports and source-review waits do not turn into scheduler failures.
export function buildCurationProgress({report,previous={},executionStatus,now=Date.now()}){
 const stamp=new Date(now).toISOString(),generated=Date.parse(report?.generatedAt);
 if(!Array.isArray(report?.rotationWork)||!Number.isFinite(generated)||generated>now||now-generated>36*3600000)
  return {...previous,version:1,generatedAt:stamp,state:'unknown',newAlerts:[],resolved:[],reason:'missing-or-stale-rotation-evidence'};
 const observed=executionStatus==='completed'&&day(generated)===day(now),old=new Map((previous.items??[]).map(x=>[x.recordId,x]));
 const pending=report.rotationWork.filter(x=>x.pending),grace=Math.max(3,Math.ceil(pending.length/4)+2);
 const items=pending.map(x=>{
  const p=old.get(x.recordId),reset=!p||p.targetSignature!==x.targetSignature||p.lastAttemptedAt!==x.lastAttemptedAt;
  const opportunityDays=reset?[]:[...(p.opportunityDays??[])];
  if(observed&&x.actionable&&!opportunityDays.includes(day(now)))opportunityDays.push(day(now));
  const graceDays=reset?grace:p.graceDays;
  return {...x,firstReadyAt:reset?stamp:p.firstReadyAt,opportunityDays:opportunityDays.slice(-128),graceDays,
   stalled:x.actionable&&opportunityDays.length>graceDays};
 });
 const alerts=items.filter(x=>x.stalled).map(x=>({recordId:x.recordId,reason:'actionable-rotation-not-progressing',
  eligibleDays:x.opportunityDays.length,graceDays:x.graceDays,fingerprint:evidenceHash(x.recordId+'\n'+x.targetSignature+'\n'+x.firstReadyAt)}));
 // Keep an existing alert while evidence is unavailable/held. Lack of evidence
// is not recovery; an actual attempt, completed comparison or changed input is.
 const currentIds=new Set(items.map(x=>x.recordId));
 const held=(previous.alerts??[]).filter(a=>items.some(x=>x.recordId===a.recordId&&!x.actionable&&old.get(x.recordId)?.targetSignature===x.targetSignature&&old.get(x.recordId)?.lastAttemptedAt===x.lastAttemptedAt));
 const active=[...alerts,...held.filter(a=>!alerts.some(b=>b.recordId===a.recordId))];
 const resolved=(previous.alerts??[]).filter(a=>!active.some(b=>b.fingerprint===a.fingerprint)&&(!currentIds.has(a.recordId)||observed)).map(a=>a.recordId);
 return {version:1,generatedAt:stamp,state:observed?'observed':'paused',items,alerts:active,
  newAlerts:observed?active.filter(a=>!(previous.alerts??[]).some(p=>p.fingerprint===a.fingerprint)):[],resolved,
  scope:'approved-published-overseas-rotation',apiRequests:0};
}
