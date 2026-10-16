import {parseOioiSchedule,verifyReviewedEvent,reviewedVisualEvent,mergeEventSnapshot,validEvent,eventDay} from './events.mjs';
import {activeEventSourceUrls,updateEventRecovery} from './event-recovery.mjs';

// targets=null is the normal full update; a Set limits recovery to due URLs.
export async function collectEvents({previous,reviewed,sources,get,now=Date.now(),targets=null}) {
  const checks=[],incoming=[],held=targets?(previous.held||[]).filter(h=>!targets.has(h.sourceUrl)):[];
  const failure=(sourceUrl,error,id,allowRetain=true)=>checks.push({sourceUrl,...(id?{id}:{}),result:'unavailable',reason:error.message,code:error.code||null,retryable:error.retryable===true,allowRetain});
  for(const source of sources){
    if(targets&&!targets.has(source.url)){checks.push({sourceUrl:source.url,result:'not_checked'});continue;}
    try{
      const result=parseOioiSchedule(await get(source.url),source,now);
      incoming.push(...result.events);held.push(...result.held);checks.push({sourceUrl:source.url,result:'verified',count:result.events.length});
    }catch(error){failure(source.url,error);}
  }
  for(const entry of reviewed){
    try{
      if((entry.endDate||entry.startDate)<eventDay(now)){const event=reviewedVisualEvent(entry,now);if(validEvent(event))incoming.push(event);continue;}
      if(entry.verificationMode==='visual'){
        const event=reviewedVisualEvent(entry,now);if(!validEvent(event))throw new Error('Visual review schema is invalid');
        incoming.push(event);checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:event.verification,mode:'visual-review'});continue;
      }
      if(targets&&!targets.has(entry.sourceUrl)){
        // A changed review must not inherit an older approval during an unrelated recovery.
        const prior=(previous.events||[]).find(e=>e.id===entry.id);
        if(prior?.sourceUrl===entry.sourceUrl&&prior.evidenceHash===entry.sourceHash)checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:'not_checked'});
        else {incoming.push({...reviewedVisualEvent(entry,now),verification:'needs_review'});checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:'needs_review'});}
        continue;
      }
      const event=verifyReviewedEvent(entry,await get(entry.sourceUrl),now);
      if(!validEvent(event))throw new Error('Reviewed event schema is invalid');
      incoming.push(event);checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:event.verification});
      if(event.verification!=='verified')held.push({sourceUrl:entry.sourceUrl,id:entry.id,reason:'source-content-changed'});
    }catch(error){
      const prior=(previous.events||[]).find(e=>e.id===entry.id);
      // Changed source/evidence never qualifies for the communication-error grace period.
      failure(entry.sourceUrl,error,entry.id,prior?.sourceUrl===entry.sourceUrl&&prior.evidenceHash===entry.sourceHash);
    }
  }
  const events=mergeEventSnapshot(previous.events,incoming,checks,now);
  const recovery=updateEventRecovery(previous,checks,activeEventSourceUrls(sources,reviewed,now),now);
  return {events,checks,held,recovery};
}
