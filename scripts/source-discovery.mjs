import {join} from 'node:path';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {cleanHtml,decodeEntities} from '../src/lib/text.mjs';
import {evidenceHash} from './curation-review-contract.mjs';

// Bounded candidate discovery only. Link text is not evidence for publication or sharing.
export function discoverLinks(html,source,knownUrls=[]){
  const base=new URL(source.url),known=new Set(knownUrls),out=new Map();
  const clean=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  for(const match of clean.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try{
      const url=new URL(decodeEntities(match[1]),base);url.hash='';
      if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||url.href===base.href||known.has(url.href)
        ||url.href.length>1000||/\/admin\b|\/login\b|\/search\b|\.(?:jpg|png|webp|gif|zip)$/i.test(url.pathname)
        ||[...url.searchParams.keys()].some(k=>!/^(?:id|p|page|year|month|n)$/.test(k)))continue;
      const title=cleanHtml(match[2].replace(/<[^>]*>/g,' ')).trim();
      const relevant=/(?:手話|筆談|ろう|難聴|盲ろう|聴覚|中途失聴|要約筆記|文字通訳|字幕|情報保障|ヒアリングループ)/.test(title);
      const activity=/(?:開催|公演|交流|カフェ|講座|講演|上映|募集|イベント|喫茶|観劇|舞台|例会|集い|研修|説明会|企画|支援|サポート)/.test(title);
      // A deliberately configured specialist section may contain generic titles.
      // This only discovers a link: the official body still decides relevance.
      const specialist=source.topicScope==='hearing-specialist'&&Array.isArray(source.candidatePathPrefixes)
        &&source.candidatePathPrefixes.some(prefix=>prefix.startsWith('/')&&url.pathname.startsWith(prefix))&&activity;
      if(title.length<8||title.length>180||!(relevant&&activity||specialist))continue;
      out.set(url.href,{id:'discovery-'+evidenceHash(url.href).slice(0,24),sourceId:source.id,sourceUrl:source.url,url:url.href,title,
        status:'unverified-candidate',publicationApproved:false,reviewedAt:null});
      if(out.size>=24)break;
    }catch{/* Malformed links never become candidates. */}
  }
  return [...out.values()];
}
export async function runSourceDiscovery({stateDir,sources,knownUrls=[],now=Date.now(),fetchResource=fetchThumbnailResource}){
  if(!Array.isArray(sources)||sources.length>100||sources.some(x=>!x.id||new URL(x.url).protocol!=='https:'))throw new Error('Invalid discovery sources');
  const day=new Date(now+9*3600000).toISOString().slice(0,10),path=join(stateDir,'curation-discovery.json');let old;
  try{old=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const signature=evidenceHash(JSON.stringify({version:2,sources,knownUrls:[...new Set(knownUrls)].sort()}));
  if(old?.day===day&&old.signature===signature)return {reused:true,scanned:old.results.length,candidates:old.candidates.length,newCandidates:0};
  const candidates=new Map((old?.candidates??[]).map(x=>[x.url,x])),results=[];let newCandidates=0;
  const offset=sources.length?Math.floor(now/86400000)*8%sources.length:0;
  const selected=[...sources.slice(offset),...sources.slice(0,offset)].slice(0,8);
  for(const source of selected){
    try{
      const response=await fetchResource(source.url,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:url=>url===source.url});
      if(response.status!==200||!/text\/html|application\/xhtml\+xml/i.test(response.headers?.['content-type']??''))throw new Error('unavailable');
      const found=discoverLinks(response.text,source,knownUrls);
      for(const candidate of found){const prior=candidates.get(candidate.url);if(!prior)newCandidates++;
        candidates.set(candidate.url,{...prior,...candidate,firstSeenAt:prior?.firstSeenAt??new Date(now).toISOString(),lastSeenAt:new Date(now).toISOString()});}
      results.push({sourceId:source.id,status:'fetched',candidates:found.length});
    }catch{results.push({sourceId:source.id,status:'unavailable',candidates:null});}
  }
  const pending=[...candidates.values()].filter(x=>!knownUrls.includes(x.url));
  const reviewQueue=pending.sort((a,b)=>b.firstSeenAt.localeCompare(a.firstSeenAt)||a.id.localeCompare(b.id)).map(x=>({id:x.id,url:x.url,sourceId:x.sourceId,
    reason:'official-body-and-sharing-review-required',publicationApproved:false}));
  const report={version:1,day,signature,generatedAt:new Date(now).toISOString(),results,candidates:[...candidates.values()],newCandidates,reviewQueue,
    scope:'registered-source-links-only',publicationApproved:false};
  const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(report,null,2)+'\n',{mode:0o600});await rename(tmp,path);
  return {reused:false,scanned:results.length,candidates:candidates.size,newCandidates,unavailable:results.filter(x=>x.status==='unavailable').length};
}
