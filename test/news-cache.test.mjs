import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/assets/sw.js', import.meta.url), 'utf8');
test('SW marks cache fallback without hiding server errors or poisoning the saved response', async () => {
  const events = {}, cached = new Response('{"articles":[]}', {headers:{'Content-Type':'application/json'}});
  let failure = true, pending;
  vm.runInNewContext(source, {
    self: {location:new URL('https://deafnavi.com/sw.js'),addEventListener:(n,fn)=>events[n]=fn},
    URL, Request, Response, Headers,
    caches:{open:async()=>({match:async()=>cached.clone(),put:async()=>{}})},
    fetch:async()=>{if(failure)throw Error('network');return new Response('unavailable',{status:503})},
  });
  const run = async () => {events.fetch({request:new Request('https://deafnavi.com/articles.json'),respondWith:p=>pending=p});return pending};
  const fallback = await run();
  assert.equal(fallback.headers.get('X-DeafNavi-Cache'),'fallback');
  assert.equal(await fallback.text(),'{"articles":[]}');
  assert.equal(cached.headers.get('X-DeafNavi-Cache'),null);
  failure=false;
  assert.equal((await run()).status,503);
});
