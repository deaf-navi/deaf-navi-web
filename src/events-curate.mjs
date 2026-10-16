import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EVENT_SOURCES } from '../config/events.mjs';
import { enrichEventThumbnails } from './lib/event-thumbnails.mjs';
import { createEventSourceFetcher } from './lib/event-source-fetch.mjs';
import { collectEvents } from './lib/event-collection.mjs';
import { activeEventSourceUrls,dueEventSources } from './lib/event-recovery.mjs';

const root=new URL('../',import.meta.url), now=Date.now();
const read=async(path,fallback)=>{try{return JSON.parse(await readFile(new URL(path,root),'utf8'))}catch(error){if(error.code==='ENOENT')return fallback;throw error}};
const previous=await read('.state/events.json',{events:[]});
const reviewed=await read('content/events/reviewed.json',[]);
const recoveryOnly=process.argv.includes('--recover');
const active=activeEventSourceUrls(EVENT_SOURCES,reviewed,now);
const targets=recoveryOnly?(process.env.EVENT_RECOVERY_FORCE==='true'?active:dueEventSources(previous,active,now)):null;
if(recoveryOnly&&!targets.size){
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'updated=false\n');
  console.log('No event sources are due for recovery.');process.exit(0);
}
const {events,checks,held,recovery}=await collectEvents({previous,reviewed,sources:EVENT_SOURCES,get:createEventSourceFetcher(),now,targets});
const thumbnails=await enrichEventThumbnails(events,{now,cacheFile:fileURLToPath(new URL('.state/thumbnails-events.json',root))});
const snapshot={version:1,checkedAt:new Date(now).toISOString(),events,checks,held,thumbnails,recovery};
await mkdir(new URL('.state/',root),{recursive:true});
const temp=new URL('.state/events.json.tmp',root);await writeFile(temp,JSON.stringify(snapshot,null,2)+'\n');await rename(temp,new URL('.state/events.json',root));
if(recoveryOnly&&process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'updated=true\n');
console.log(JSON.stringify({events:events.length,verified:events.filter(e=>e.verification==='verified').length,checks:checks.length,held:held.length,thumbnails:thumbnails.eventsWithImage,retrySources:recovery.pending.length}));
if(checks.some(c=>c.result==='unavailable'||c.result==='needs_review'))console.warn('::warning::Event source checks are incomplete. Temporary errors retain only previously verified entries within the unchanged 48-hour limit.');
