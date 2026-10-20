import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function runClient(file, fail = false) {
  const requests = [], handlers = {};
  let consumed = 0;
  const context = {
    URL, URLSearchParams, Set,
    location: {hostname:'localhost', origin:'http://localhost', pathname:'/', search:'', href:'http://localhost/'},
    navigator: {webdriver:false}, window: {},
    document: {referrer:'', querySelector:()=>null, querySelectorAll:()=>[],
      addEventListener:(name,fn)=>{handlers[name]=fn;}},
    fetch: async (url, options) => {
      requests.push({url, options});
      if (fail) throw new Error('network unavailable');
      return {status:204, text:async()=>{consumed++;return '';}};
    },
  };
  vm.runInNewContext(readFileSync(new URL('../src/'+file, import.meta.url),'utf8'), context);
  return {requests, handlers, consumed:()=>consumed,
    settle:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
test('visit beacon consumes its 204 response without another request or identity changes', async()=>{
  const c=runClient('access-visit.js');await c.settle();
  assert.equal(c.consumed(),1);
  assert.equal(c.requests.length,1);
  const {options}=c.requests[0];
  assert.equal(options.keepalive,true);assert.equal(options.credentials,'omit');
  assert.equal(options.referrerPolicy,'no-referrer');
  assert.deepEqual(JSON.parse(options.body),{path:'/',automated:false});
});
test('click beacon consumes its response and retains per-link deduplication', async()=>{
  const c=runClient('access-engagement.js');
  const event={type:'click',button:0,target:{closest:()=>({href:'https://example.org/news',matches:()=>true})}};
  c.handlers.click(event);c.handlers.click(event);await c.settle();
  assert.equal(c.consumed(),1);assert.equal(c.requests.length,1);
  assert.deepEqual(JSON.parse(c.requests[0].options.body),{source:'news',event:'article_click'});
  assert.equal(c.requests[0].options.keepalive,true);
});
test('failed beacon is not resent or substituted with extra tracking', async()=>{
  const c=runClient('access-visit.js',true);await c.settle();
  assert.equal(c.requests.length,1);assert.equal(c.consumed(),0);
});
