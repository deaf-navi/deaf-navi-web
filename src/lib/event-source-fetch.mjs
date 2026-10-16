import { fetchThumbnailResource } from './thumbnail-fetch.mjs';
import { setTimeout } from 'node:timers/promises';

const transientCodes=new Set(['ABORT_ERR','ETIMEDOUT','ECONNRESET','EAI_AGAIN']);
export function createEventSourceFetcher({fetchResource=fetchThumbnailResource,sleep=setTimeout}={}) {
  const cache=new Map();
  return function get(url) {
    if(cache.has(url))return cache.get(url);
    const request=(async()=>{
      let response;
      for(let attempt=0;attempt<2;attempt++){
        try{
          response=await fetchResource(url,{timeoutMs:30000,maxBytes:1800000,userAgent:'DeafNaviWeb-Events/1.0 (+https://deafnavi.com/)',allowUrl:target=>target===url});
          break;
        }catch(error){
          // Retry transport failures only. HTTP denial and content checks stay fail-closed.
          if(attempt===1||!transientCodes.has(error.code))throw error;
          await sleep(1000);
        }
      }
      if(response.status!==200||!/^text\/html|^application\/xhtml\+xml/i.test(response.headers?.['content-type']||''))throw new Error('Source unavailable or not HTML');
      return response.text;
    })();
    cache.set(url,request);return request;
  };
}
