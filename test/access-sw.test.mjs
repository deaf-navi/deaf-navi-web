import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
for(const [path,scriptUrl] of [['src/assets/sw.js','https://deafnavi.com/sw.js'],['tools/otomado/public/sw.js','https://deafnavi.com/otomado/sw.js']]) {
  const events={},adds=[],fetches=[],puts=[];let hit=null;
  const response=new Response('ok',{headers:{'Content-Type':'text/css'}});
  const cache={add:async r=>adds.push(r),addAll:async rs=>adds.push(...rs),match:async()=>hit,put:async(key,res)=>puts.push(key)};
  const self={location:new URL(scriptUrl),addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const context={self,URL,Request,Response,caches:{open:async()=>cache,match:async()=>hit},fetch:async request=>{fetches.push(request);return response.clone();}};
  vm.runInNewContext(readFileSync(path,'utf8'),context);
  let pending;events.install({waitUntil:p=>pending=p});await pending;
  ok(adds.length>0 && adds.every(r=>r.headers.get('X-DeafNavi-Client')==='automation'),'precache classified '+path);
  ok(adds.every(r=>!new URL(r.url).searchParams.has('dn_client')),'precache retains offline lookup URL '+path);
  const request=new Request(new URL('styles.css',scriptUrl),{mode:'no-cors'});
  hit=response.clone();events.fetch({request,respondWith:p=>pending=p});await pending;await Promise.resolve();
  ok(new URL(fetches.at(-1).url).searchParams.get('dn_client')==='automation' && fetches.at(-1).mode==='no-cors','background update excluded without changing request mode '+path);
  ok(puts.at(-1).url===request.url && request.headers.get('X-DeafNavi-Client')===null,'original cache key and request remain unchanged '+path);
  hit=null;events.fetch({request,respondWith:p=>pending=p});await pending;
  ok(fetches.at(-1)===request,'cache miss keeps actual visitor request '+path);
}
console.log(JSON.stringify({result:'ACCESS_SW_TESTS_OK',checks}));
