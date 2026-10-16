import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventSourceFetcher} from '../src/lib/event-source-fetch.mjs';
const url='https://example.org/events';
const ok={status:200,headers:{'content-type':'text/html; charset=utf-8'},text:'<h1>Event announcement</h1>'};
test('transient timeout is retried once and concurrent occurrences share the same request',async()=>{
  let attempts=0;
  const get=createEventSourceFetcher({sleep:async()=>{},fetchResource:async(input,options)=>{
    attempts++;assert.equal(input,url);assert.equal(options.allowUrl(url+'/elsewhere'),false);
    if(attempts===1)throw Object.assign(new Error('The operation was aborted'),{code:'ABORT_ERR'});
    return ok;
  }});
  assert.deepEqual(await Promise.all([get(url),get(url)]),[ok.text,ok.text]);assert.equal(attempts,2);
});
test('repeated timeout remains unavailable after two attempts',async()=>{
  let attempts=0;const get=createEventSourceFetcher({sleep:async()=>{},fetchResource:async()=>{attempts++;throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});}});
  await assert.rejects(get(url),/timeout/);assert.equal(attempts,2);
});
test('access denial, rate limit, invalid HTML and unsafe destinations are never retried',async()=>{
  for(const response of [{...ok,status:403},{...ok,status:429},{...ok,headers:{'content-type':'image/png'}},new Error('Non-public DNS answer')]){
    let attempts=0;const get=createEventSourceFetcher({sleep:async()=>{},fetchResource:async()=>{attempts++;if(response instanceof Error)throw response;return response;}});
    await assert.rejects(get(url));assert.equal(attempts,1);
  }
});
