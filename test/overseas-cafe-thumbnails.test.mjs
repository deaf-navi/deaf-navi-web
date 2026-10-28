import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectOverseasCafeThumbnails} from '../scripts/overseas-cafe-thumbnails.mjs';
const now=Date.parse('2026-10-28T02:00:00Z');
const record=(id='one')=>({id,slug:id,countryCode:'AT',officialUrl:'https://cafe.example.org/'+id,revision:1,publicationHash:'original'});
const page=url=>({url,status:200,headers:{'content-type':'text/html'},text:'<meta property="og:image" content="https://cdn.example.org/photo.jpg">'});
const image=url=>({url,status:200,headers:{'content-type':'image/jpeg','content-length':'20000'}});
test('overseas previews are private candidates, cached without mutating publication fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dn-cafe-image-'));try{
  const snapshot={records:[record()]},before=JSON.stringify(snapshot);let calls=0;
  const fetchResource=async(url,o)=>{calls++;return o.method==='HEAD'?image(url):page(url);};
  const first=await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now,fetchResource});
  assert.equal(first.candidates,1);assert.equal(calls,2);assert.equal(first.publicationApproved,false);assert.equal(first.apiRequests,0);assert.equal(JSON.stringify(snapshot),before);
  const second=await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now:now+DAY,fetchResource});
  assert.equal(calls,2);assert.equal(second.cached,1);assert.deepEqual(second.newOrChanged,[]);
  assert.deepEqual(second.pendingReview,['one']);
  second.entries.one.review={outcome:'not-selected',checkedAt:new Date(now).toISOString()};
  await writeFile(join(dir,'overseas-cafe-thumbnails.json'),JSON.stringify(second));
  assert.deepEqual((await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now:now+DAY+1000,fetchResource})).pendingReview,[]);
  snapshot.records[0].officialUrl='https://cafe.example.org/new';
  const third=await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now:now+2*DAY,fetchResource});
  assert.equal(calls,4);assert.equal(third.entries.one.pageUrl,snapshot.records[0].officialUrl);
  assert.deepEqual(third.pendingReview,['one']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
const DAY=86400000;
test('daily source cap survives repeated path triggers; auth refusal pauses the origin',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dn-cafe-image-'));try{
  let calls=0;const fetchResource=async url=>{calls++;return {url,status:403,headers:{}};};
  const snapshot={records:[record('a'),record('b'),record('c')]};
  const first=await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now,fetchResource,maxPages:2});
  assert.equal(first.selected,2);assert.equal(first.fetched,1);assert.equal(calls,1);assert.equal(first.deferred,1);
  const next=await collectOverseasCafeThumbnails({snapshot,stateDir:dir,now:now+1000,fetchResource,maxPages:2});
  assert.equal(next.fetched,0);assert.equal(calls,1);assert.equal(next.deferred,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unrelated redirects, SVG, oversized images and private image URL metadata are not previews',async()=>{
 for(const mode of ['redirect','svg','oversize','private']){
  const dir=await mkdtemp(join(tmpdir(),'dn-cafe-image-'));try{
   const fetchResource=async(url,o)=>o.method==='HEAD'?{...image(url),headers:{'content-type':mode==='svg'?'image/svg+xml':'image/png','content-length':mode==='oversize'?'9000000':'10000'}}:mode==='redirect'?page('https://unrelated.example.org/'):mode==='private'?{...page(url),text:'<meta property="og:image" content="https://127.0.0.1/private.jpg">'}:page(url);
   const out=await collectOverseasCafeThumbnails({snapshot:{records:[record()]},stateDir:dir,now,fetchResource});assert.equal(out.candidates,0,mode);
  }finally{await rm(dir,{recursive:true,force:true});}
 }
});
