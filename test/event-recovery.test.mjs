import test from 'node:test';
import assert from 'node:assert/strict';
import {collectEvents} from '../src/lib/event-collection.mjs';
import {createEventSourceFetcher} from '../src/lib/event-source-fetch.mjs';
import {activeEventSourceUrls,dueEventSources,updateEventRecovery} from '../src/lib/event-recovery.mjs';
import {eventHash,eventSourceText,eventPeriod,parseOioiSchedule} from '../src/lib/events.mjs';

const now=Date.parse('2026-10-17T00:00:00Z'),minute=60000;
const url='https://example.org/official',html='<main>手話交流会 2026年11月14日 公式会場 無料</main>';
const entry={id:'event-one',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',prefecture:'岩手県',venue:'公式会場',kind:'exchange',sourceName:'主催者',sourceUrl:url,status:'announced',reviewedAt:new Date(now).toISOString(),sourceHash:eventHash(eventSourceText(html)),evidence:['手話交流会','2026年11月14日','公式会場']};
const ok={status:200,headers:{'content-type':'text/html'},text:html};
const collect=(previous,time,fetchResource,extra={})=>collectEvents({previous,reviewed:[entry],sources:[],get:createEventSourceFetcher({fetchResource,sleep:async()=>{}}),now:time,...extra});
const timeout=()=>{throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});};

test('14 verified occurrences survive shared-source timeout, then recover automatically with exact evidence',async()=>{
 const reviewed=Array.from({length:14},(_,i)=>({...entry,id:'event-'+i,venue:'公式会場'+i}));
 const fresh=await collect({},now,async()=>ok,{reviewed});
 let calls=0;
 const failed=await collect(fresh,now+minute,async()=>{calls++;timeout();},{reviewed});
 assert.equal(calls,2);assert.equal(failed.events.length,14);assert.ok(failed.events.every(e=>eventPeriod(e,now+minute)==='upcoming'));
 assert.ok(failed.events.every(e=>e.verifiedAt===new Date(now).toISOString()));assert.equal(failed.recovery.pending.length,1);
 assert.equal(dueEventSources(failed,new Set([url]),now+30*minute).size,0);
 const due=dueEventSources(failed,new Set([url]),now+31*minute);assert.equal(due.size,1);
 const recovered=await collect(failed,now+31*minute,async()=>ok,{reviewed,targets:due});
 assert.equal(recovered.recovery.pending.length,0);assert.ok(recovered.events.every(e=>e.verification==='verified'&&!e.sourceStatus));
 assert.ok(recovered.events.every(e=>e.verifiedAt===new Date(now+31*minute).toISOString()));
});
test('repeated failures never renew freshness; expired events stay hidden until a matching source returns',async()=>{
 let state=await collect({},now,async()=>ok);
 for(const hours of [1,12,47,48,49]){
  state=await collect(state,now+hours*3600000,timeout);
  assert.equal(state.events[0].verifiedAt,entry.reviewedAt);
  assert.equal(eventPeriod(state.events[0],now+hours*3600000),hours<48?'upcoming':'review');
 }
 state=await collect(state,now+50*3600000,async()=>ok);
 assert.equal(eventPeriod(state.events[0],now+50*3600000),'upcoming');assert.equal(state.recovery.pending.length,0);
});
test('denial, unsafe DNS, changed content and changed review cannot use grace or auto approval',async()=>{
 const fresh=await collect({},now,async()=>ok);
 for(const response of [{...ok,status:403},{...ok,status:429},{...ok,headers:{'content-type':'image/png'}},new Error('Non-public DNS answer'),{...ok,text:html+'<p>開催中止</p>'}]){
  const state=await collect(fresh,now+minute,async()=>{if(response instanceof Error)throw response;return response;});
  assert.equal(state.events[0].verification,'needs_review');assert.equal(state.recovery.pending.length,0);
  const later=await collect(state,now+2*minute,timeout);assert.equal(later.events[0].verification,'needs_review');
 }
 const changed=await collect(fresh,now+minute,timeout,{reviewed:[{...entry,sourceHash:'a'.repeat(64)}]});
 assert.equal(changed.events[0].verification,'needs_review');
});
test('502/503/504 are retried and queued but other HTTP errors remain fail-closed',async()=>{
 const fresh=await collect({},now,async()=>ok);
 for(const status of [502,503,504]){
  let calls=0;const state=await collect(fresh,now+minute,async()=>{calls++;return {...ok,status};});
  assert.equal(calls,2);assert.equal(state.events[0].sourceStatus,'retrying');assert.equal(state.recovery.pending[0].code,'HTTP_'+status);
 }
 const state=await collect(fresh,now+minute,async()=>({...ok,status:404}));assert.equal(state.events[0].verification,'needs_review');assert.equal(state.recovery.pending.length,0);
});
test('recovery contacts only due HTML sources and never refreshes visual reviews or unrelated events',async()=>{
 const second={...entry,id:'event-two',sourceUrl:'https://example.org/second',venue:'別会場'};
 const visual={...entry,id:'visual-event',sourceUrl:'https://example.org/post',verificationMode:'visual',venue:'画像会場'};
 const reviewed=[entry,second,visual];const fresh=await collect({},now,async()=>ok,{reviewed});
 const calls=[];const state=await collect(fresh,now+minute,async u=>{calls.push(u);return ok;},{reviewed,targets:new Set([url])});
 assert.deepEqual(calls,[url]);assert.equal(state.events.find(e=>e.id==='event-two').verifiedAt,entry.reviewedAt);assert.equal(state.events.find(e=>e.id==='visual-event').verifiedAt,entry.reviewedAt);
 const expired=await collect(state,now+48*3600000,async()=>ok,{reviewed,targets:new Set([url])});
 assert.equal(expired.events.find(e=>e.id==='visual-event').verification,'needs_review');assert.equal(expired.events.find(e=>e.id==='event-two').verification,'needs_review');
 const active=activeEventSourceUrls([],reviewed,now);assert.equal(active.has(visual.sourceUrl),false);
 assert.equal(activeEventSourceUrls([],[{...entry,endDate:'2026-10-16'}],now).size,0);
});
test('recovery backoff is persisted per URL, capped at six hours, and removed when source changes or recovers',()=>{
 let state={},time=now;const active=new Set([url]);
 for(const minutes of [30,60,120,240,360,360]){
  state={recovery:updateEventRecovery(state,[{sourceUrl:url,result:'unavailable',retryable:true,code:'ETIMEDOUT'}],active,time)};
  assert.equal(Date.parse(state.recovery.pending[0].nextAttemptAt)-time,minutes*minute);time+=minutes*minute;
 }
 assert.equal(updateEventRecovery(state,[{sourceUrl:url,result:'needs_review'}],active,time).pending.length,0);
 assert.equal(updateEventRecovery(state,[],new Set(),time).pending.length,0);
});
test('a schedule-only recovery cannot overwrite a richer detail or bypass a failed detail review',async()=>{
 const source={id:'schedule',url:'https://example.org/schedule',name:'出演者'};
 const schedule='<h3>2026年</h3><li class="p-postList__item"><a href="'+url+'"><span class="c-postThumb__cat">岩手県</span><h4 class="event-date">11月14日(土)</h4><h5>手話交流会</h5><div class="p-postList__times">公式会場</div></a></li>';
 const id=parseOioiSchedule(schedule,source,now).events[0].id;
 const reviewed=[{...entry,id,status:'closed',target:'受付終了',communication:[{method:'captions',detail:'字幕あり'}]}];
 const fetch=async u=>({...ok,text:u===url?html:schedule});
 const fresh=await collect({},now,fetch,{sources:[source],reviewed});
 const skipped=await collect(fresh,now+minute,fetch,{sources:[source],reviewed,targets:new Set([source.url])});
 assert.equal(skipped.events[0].status,'closed');assert.equal(skipped.events[0].target,'受付終了');assert.equal(skipped.events[0].verifiedAt,entry.reviewedAt);
 const failed=await collect(fresh,now+minute,async u=>u===url?timeout():fetch(u),{sources:[source],reviewed});
 assert.equal(failed.events[0].status,'closed');assert.equal(failed.events[0].sourceStatus,'retrying');assert.equal(failed.events[0].communication[0].method,'captions');
 const changed=await collect(fresh,now+minute,async u=>u===url?timeout():fetch(u),{sources:[source],reviewed:[{...reviewed[0],sourceHash:'b'.repeat(64)}]});
 assert.equal(changed.events[0].verification,'needs_review');
});
