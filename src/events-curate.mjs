import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EVENT_SOURCES } from '../config/events.mjs';
import { enrichEventThumbnails } from './lib/event-thumbnails.mjs';
import { fetchThumbnailResource } from './lib/thumbnail-fetch.mjs';
import { parseOioiSchedule, verifyReviewedEvent, reviewedVisualEvent, mergeEventSnapshot, validEvent, eventDay } from './lib/events.mjs';

const root=new URL('../',import.meta.url), now=Date.now(), checks=[], incoming=[], held=[];
const read=async(path,fallback)=>{try{return JSON.parse(await readFile(new URL(path,root),'utf8'))}catch(error){if(error.code==='ENOENT')return fallback;throw error}};
const previous=await read('.state/events.json',{events:[]});
const reviewed=await read('content/events/reviewed.json',[]);
const cache=new Map();
async function get(url){
  if(cache.has(url))return cache.get(url);
  const request=(async()=>{
    const response=await fetchThumbnailResource(url,{timeoutMs:10000,maxBytes:1800000,userAgent:'DeafNaviWeb-Events/1.0 (+https://deafnavi.com/)',allowUrl:target=>target===url});
    if(response.status!==200||!/^text\/html|^application\/xhtml\+xml/i.test(response.headers?.['content-type']||''))throw new Error('Source unavailable or not HTML');
    return response.text;
  })();cache.set(url,request);return request;
}
for(const source of EVENT_SOURCES){
  try{
    const result=parseOioiSchedule(await get(source.url),source,now);
    incoming.push(...result.events);held.push(...result.held);checks.push({sourceUrl:source.url,result:'verified',count:result.events.length});
  }catch(error){checks.push({sourceUrl:source.url,result:'unavailable',reason:error.message});}
}
for(const entry of reviewed){
  try{
    if((entry.endDate||entry.startDate)<eventDay(now)) { const event=reviewedVisualEvent(entry,now);if(validEvent(event))incoming.push(event);continue; }
    if(entry.verificationMode==='visual') { const event=reviewedVisualEvent(entry,now);if(!validEvent(event))throw new Error('Visual review schema is invalid');incoming.push(event);checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:event.verification,mode:'visual-review'});continue; }
    const event=verifyReviewedEvent(entry,await get(entry.sourceUrl),now);
    if(!validEvent(event))throw new Error('Reviewed event schema is invalid');
    incoming.push(event);checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:event.verification});
    if(event.verification!=='verified')held.push({sourceUrl:entry.sourceUrl,id:entry.id,reason:'source-content-changed'});
  }catch(error){checks.push({sourceUrl:entry.sourceUrl,id:entry.id,result:'unavailable',reason:error.message});}
}
const events=mergeEventSnapshot(previous.events,incoming,checks,now);
const thumbnails=await enrichEventThumbnails(events,{now,cacheFile:fileURLToPath(new URL('.state/thumbnails-events.json',root))});
const snapshot={version:1,checkedAt:new Date(now).toISOString(),events,checks,held,thumbnails};
await mkdir(new URL('.state/',root),{recursive:true});
const temp=new URL('.state/events.json.tmp',root);await writeFile(temp,JSON.stringify(snapshot,null,2)+'\n');await rename(temp,new URL('.state/events.json',root));
console.log(JSON.stringify({events:events.length,verified:events.filter(e=>e.verification==='verified').length,checks:checks.length,held:held.length,thumbnails:thumbnails.eventsWithImage}));
if(checks.some(c=>c.result==='unavailable'||c.result==='needs_review'))console.warn('::warning::Event sources need review; uncertain entries are excluded from upcoming results.');
