import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {publicUrl,pageThumbnails,imageUrl} from '../src/lib/thumbnail-metadata.mjs';

const DAY=86400000;
const safePage=url=>publicUrl(url)?.startsWith('https:')&&!/(^|\.)(facebook|instagram|tiktok|youtube|x|twitter)\.com$/i.test(new URL(url).hostname);
const stamp=n=>new Date(n).toISOString();
// Metadata only, no image bytes/API/DB mutation. New imagery remains a private
// candidate until its page/store identity and visual suitability are reviewed.
export async function collectOverseasCafeThumbnails({snapshot,stateDir,now=Date.now(),fetchResource=fetchThumbnailResource,maxPages=8,budgetMs=90000}={}){
 const path=join(stateDir,'overseas-cafe-thumbnails.json');
 let old={entries:{}};
 try{old=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const day=stamp(now+9*3600000).slice(0,10),attempted=old.day===day?[...(old.attempted??[])]:[];
 const entries={},newOrChanged=[],signal=AbortSignal.timeout(budgetMs),blocked=new Set(),pages=new Map();
 let selected=0,fetched=0,cached=0,deferred=0;
 const request=async(url,options={})=>{
  if(blocked.has(new URL(url).origin))throw Error('origin-paused');
  const r=await fetchResource(url,{...options,signal,maxBytes:800000,timeoutMs:10000,allowUrl:u=>u.startsWith('https:')&&!blocked.has(new URL(u).origin)});
  if([401,403,429].includes(r.status)){blocked.add(new URL(url).origin);blocked.add(new URL(r.url).origin);}
  return r;
 };
 const records=[...(snapshot?.records??[])].filter(r=>r.countryCode!=='JP'&&r.slug&&r.officialUrl);
 records.sort((a,b)=>(Date.parse(old.entries[a.id]?.checkedAt)||0)-(Date.parse(old.entries[b.id]?.checkedAt)||0)||a.id.localeCompare(b.id));
 for(const r of records){
  const previous=old.entries[r.id],same=previous?.pageUrl===r.officialUrl,age=now-Date.parse(previous?.checkedAt);
  if(same&&(attempted.includes(r.id)||(age>=0&&age<(previous.thumbnail?30:7)*DAY))){entries[r.id]=previous;cached++;continue;}
  if(attempted.length>=maxPages||signal.aborted){if(same)entries[r.id]=previous;deferred++;continue;}
  attempted.push(r.id);selected++;
  const entry={recordId:r.id,slug:r.slug,pageUrl:r.officialUrl,checkedAt:stamp(now),status:'unavailable',thumbnail:null};
  try{
   if(!safePage(r.officialUrl)){entry.status='unsupported-source';}
   else{
    if(!pages.has(r.officialUrl)){
     if(blocked.has(new URL(r.officialUrl).origin))throw Error('origin-paused');
     fetched++;pages.set(r.officialUrl,request(r.officialUrl));
    }
    const page=await pages.get(r.officialUrl);
    if(page.status===200&&/text\/html|application\/xhtml\+xml/i.test(page.headers['content-type']??'')&&safePage(page.url)){
     entry.status='no-preview';entry.resolvedPageUrl=page.url;
     // Cross-origin redirects can indicate a sold domain or unrelated service.
     const host=u=>new URL(u).hostname.replace(/^www\./,'');
     if(host(page.url)!==host(r.officialUrl)){entry.status='redirect-review-required';}
     else for(const t of pageThumbnails(page.text,page.url).slice(0,2)){
      const image=await request(t.url,{method:'HEAD'}),length=Number(image.headers['content-length']??0);
      if(image.status===200&&/^image\/(jpeg|png|webp|avif|gif)(?:;|$)/i.test(image.headers['content-type']??'')&&imageUrl(image.url)&&image.url.length<=1536&&(!length||(length>=512&&length<=5000000))){
       entry.thumbnail={url:image.url,pageUrl:r.officialUrl,source:t.source};entry.status='review-candidate';break;
      }
     }
    }else entry.httpStatus=page.status;
   }
  }catch{entry.status='fetch-unavailable';}
  const changed=JSON.stringify([previous?.status,previous?.pageUrl,previous?.thumbnail?.url])!==JSON.stringify([entry.status,entry.pageUrl,entry.thumbnail?.url]);
  if(same&&previous?.thumbnail?.url===entry.thumbnail?.url&&previous?.review)entry.review=previous.review;
  entry.firstSeenAt=previous?.firstSeenAt??stamp(now);entry.changedAt=changed?stamp(now):previous.changedAt;
  if(changed)newOrChanged.push(r.id);
  entries[r.id]=entry;
 }
 const pendingReview=Object.values(entries).filter(e=>e.thumbnail&&!e.review).map(e=>e.recordId);
 const result={version:1,day,generatedAt:stamp(now),attempted,entries,newOrChanged,pendingReview,selected,fetched,cached,deferred,candidates:Object.values(entries).filter(e=>e.thumbnail).length,publicationApproved:false,apiRequests:0};
 const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(result,null,2)+'\n',{mode:0o600});await rename(tmp,path);
 return result;
}
