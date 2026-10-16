import {eventDay} from './events.mjs';

const MINUTE=60000;
export function activeEventSourceUrls(sources,reviewed,now=Date.now()) {
  return new Set([...sources.map(s=>s.url),...reviewed.filter(e=>e.verificationMode!=='visual'&&(e.endDate||e.startDate)>=eventDay(now)).map(e=>e.sourceUrl)]);
}
export function dueEventSources(previous,active,now=Date.now()) {
  return new Set((previous.recovery?.pending||[]).filter(p=>active.has(p.sourceUrl)&&Date.parse(p.nextAttemptAt)<=now).map(p=>p.sourceUrl));
}
export function updateEventRecovery(previous,checks,active,now=Date.now()) {
  const pending=new Map((previous.recovery?.pending||[]).filter(p=>active.has(p.sourceUrl)).map(p=>[p.sourceUrl,p]));
  const attempted=new Set(checks.filter(c=>c.result!=='not_checked'&&active.has(c.sourceUrl)).map(c=>c.sourceUrl));
  for(const sourceUrl of attempted){
    const failure=checks.find(c=>c.sourceUrl===sourceUrl&&c.result==='unavailable'&&c.retryable===true);
    if(!failure){pending.delete(sourceUrl);continue;}
    const old=pending.get(sourceUrl), failures=Math.min(32,(old?.failures||0)+1);
    pending.set(sourceUrl,{sourceUrl,failures,firstFailureAt:old?.firstFailureAt||new Date(now).toISOString(),lastAttemptAt:new Date(now).toISOString(),nextAttemptAt:new Date(now+Math.min(30*2**(failures-1),360)*MINUTE).toISOString(),code:failure.code||'UNKNOWN'});
  }
  return {pending:[...pending.values()].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl))};
}
