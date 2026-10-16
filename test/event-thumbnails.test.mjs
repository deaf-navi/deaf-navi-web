import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enrichEventThumbnails, eventPreviewMetadata } from '../src/lib/event-thumbnails.mjs';
import { renderEventsPage } from '../src/templates/events.mjs';
const now=Date.parse('2026-10-16T03:00:00Z');
const entry={id:'event-one',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',prefecture:'岩手県',venue:'公式会場',kind:'exchange',sourceUrl:'https://publisher.example.com/event',sourceName:'主催者',verifiedAt:new Date(now).toISOString(),verification:'verified',evidenceHash:'a'.repeat(64),status:'announced'};
const image='https://publisher.example.com/2026-event.jpg';
const response=(url,text='',status=200,type='text/html')=>({url,text,status,headers:{'content-type':type}});
test('verified occurrences share one announcement preview and keep dates/text intact',async()=>{
 const calls=[],events=[{...entry},{...entry,id:'event-two',startDate:'2026-11-15',endDate:'2026-11-15'}];
 const fetchResource=async(url,options)=>{calls.push([url,options.method]);return options.method==='HEAD'?response(url,'',200,'image/jpeg'):response(url,`<meta property="og:image" content="${image}">`)};
 const report=await enrichEventThumbnails(events,{now,fetchResource});
 assert.equal(report.eventsWithImage,2);assert.equal(calls.length,2);assert.equal(events[0].thumbnail.url,image);assert.equal(events[1].startDate,'2026-11-15');assert.equal(events[0].title,entry.title);
});
test('uncertain, expired, cancelled and past events cannot retain a thumbnail',async()=>{
 const events=[{...entry,verification:'needs_review'},{...entry,verifiedAt:new Date(now-48*3600000).toISOString()},{...entry,status:'cancelled'},{...entry,startDate:'2026-10-15',endDate:'2026-10-15'}].map(e=>({...e,thumbnail:{url:image}}));
 await enrichEventThumbnails(events,{now,fetchResource:()=>{throw Error('must not fetch')}});assert.ok(events.every(e=>!e.thumbnail));
});
test('missing or rejected preview leaves a publishable text-only occurrence',async()=>{
 for(const status of [200,403,429]){const events=[{...entry}];await enrichEventThumbnails(events,{now,fetchResource:async url=>response(url,'<meta property="og:image" content="http://127.0.0.1/secret">',status)});assert.equal(events[0].thumbnail,undefined);assert.equal(events[0].verification,'verified')}
});
test('event image cache is persisted and rechecked after one day',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dn-event-images-'));t.after(()=>rm(dir,{recursive:true,force:true}));const cacheFile=join(dir,'cache.json');let calls=0;
 const fetchResource=async(url,options)=>{calls++;return options.method==='HEAD'?response(url,'',200,'image/jpeg'):response(url,`<meta property="og:image" content="${image}">`)};
 await enrichEventThumbnails([{...entry}],{now,cacheFile,fetchResource});assert.equal(calls,2);assert.ok(JSON.parse(await readFile(cacheFile,'utf8')).entries[entry.sourceUrl]);
 await enrichEventThumbnails([{...entry}],{now:now+1000,cacheFile,fetchResource});assert.equal(calls,2);
 await enrichEventThumbnails([{...entry,verifiedAt:new Date(now+86400000).toISOString()}],{now:now+86400000,cacheFile,fetchResource});assert.ok(calls>2);
});
test('event preview is optional, lazy and uses the existing failed-image fallback',()=>{
 const html=renderEventsPage({events:[{...entry,thumbnail:{url:image}}]});assert.match(html,/class="card__thumbnail"/);assert.match(html,/loading="lazy"/);assert.match(html,/referrerpolicy="no-referrer"/);assert.match(html,/国内の催しを開催日と地域から探せます。/);
 assert.doesNotMatch(renderEventsPage({events:[entry]}),/class="card__thumbnail"/);
});
test('legacy same-host image metadata tries HTTPS but never fetches HTTP or arbitrary body images',async()=>{
 const events=[{...entry}],calls=[];
 await enrichEventThumbnails(events,{now,fetchResource:async(url,options)=>{calls.push(url);return options.method==='HEAD'?response(url,'',200,'image/png'):response(url,'<meta property="og:image" content="http://publisher.example.com/poster.png"><img src="http://other.example.com/unrelated.jpg">')}});
 assert.equal(events[0].thumbnail.url,'https://publisher.example.com/poster.png');assert.ok(calls.every(url=>url.startsWith('https:')));
 const other='<meta property="og:image" content="http://other.example.com/poster.png">';assert.equal(eventPreviewMetadata(other,entry.sourceUrl),other);
});
