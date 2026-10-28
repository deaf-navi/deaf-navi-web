import {join} from 'node:path';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {cleanHtml,decodeEntities} from '../src/lib/text.mjs';
import {evidenceHash} from './curation-review-contract.mjs';
const nonVenueLink=(url,title)=>/\/(?:donat(?:e|ion)|fundrais|checkout|cart|gift-?card|privacy|terms|careers|jobs|newsletter|login|register)(?:[/.\-_]|$)/i.test(new URL(url).pathname)
  ||/^(?:donate|support (?:us|the caf[eé])|buy (?:a )?gift card|subscribe)\b/i.test(title);

// Bounded candidate discovery only. Link text is not evidence for publication or sharing.
export function discoverLinks(html,source,knownUrls=[]){
  const base=new URL(source.url),known=new Set(knownUrls),out=new Map();
  const clean=html.replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  for(const match of clean.matchAll(/<a\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>([\s\S]*?)<\/a>/gi)){
    try{
      const url=new URL(decodeEntities(match[1]??match[2]??match[3]),base);url.hash='';
      if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||url.href===base.href||known.has(url.href)
        ||url.href.length>1000||/\/admin\b|\/login\b|\/search\b|\.(?:jpg|png|webp|gif|zip)$/i.test(url.pathname)
        ||[...url.searchParams.keys()].some(k=>!/^(?:id|p|page|year|month|n)$/.test(k)))continue;
      const title=cleanHtml(match[4].replace(/<[^>]*>/g,' ')).trim();
      if(source.topicScope==='overseas-cafe'&&nonVenueLink(url.href,title))continue;
      const relevant=/(?:手話|筆談|ろう|難聴|盲ろう|聴覚|中途失聴|要約筆記|文字通訳|字幕|情報保障|ヒアリングループ)/.test(title);
      const activity=/(?:開催|公演|交流|カフェ|講座|講演|上映|募集|イベント|喫茶|観劇|舞台|例会|集い|研修|説明会|企画|支援|サポート|手話べり|おしゃべり|読書会)/.test(title);
      // A previously read named cafe series may omit "sign" in its headline.
      // Exact configured names and paths only; this does not verify a new date.
      const namedCafe=source.discoveryGroup==='cafe'&&Array.isArray(source.cafeTitleTerms)
        &&Array.isArray(source.candidatePathPrefixes)&&source.candidatePathPrefixes.some(p=>p.startsWith('/')&&url.pathname.startsWith(p))
        &&source.cafeTitleTerms.some(term=>typeof term==='string'&&term.length>=4&&title.includes(term));
      // A deliberately configured specialist section may contain generic titles.
      // This only discovers a link: the official body still decides relevance.
      const specialist=source.topicScope==='hearing-specialist'&&Array.isArray(source.candidatePathPrefixes)
        &&source.candidatePathPrefixes.some(prefix=>prefix.startsWith('/')&&url.pathname.startsWith(prefix))&&activity;
      const lodging=source.topicScope==='lodging'&&/(?:ゲストハウス|民泊|民宿|宿泊|旅館|ホステル|ペンション)/.test(title)
        &&(relevant||source.specialistVerified===true);
      const overseas=source.topicScope==='overseas-cafe'&&(/(?:deaf|signing|sign language|gebaerden|gebärden|sourd|sord|手語|手话|手話|수어)/iu.test(title)&&/(?:caf[eé]|coffee|tea|store|restaurant|bar|カフェ|咖啡|카페)/iu.test(title)||source.operatorVerified===true&&/(?:caf[eé]|coffee|tea ?house|store|location|branch)/iu.test(title));
      if(title.length<8||title.length>180||!(source.topicScope==='overseas-cafe'?overseas:source.topicScope==='lodging'?lodging:relevant&&activity||specialist||namedCafe))continue;
      out.set(url.href,{id:'discovery-'+evidenceHash(url.href).slice(0,24),sourceId:source.id,sourceUrl:source.url,url:url.href,title,
        status:'unverified-candidate',publicationApproved:false,reviewedAt:null});
      if(out.size>=24)break;
    }catch{/* Malformed links never become candidates. */}
  }
  return [...out.values()];
}
export function selectDiscoverySources(sources,checks={},attempted=[],limit=8){
  const used=new Set(attempted.map(x=>x.sourceId)),remaining=Math.max(0,limit-attempted.length);
  const ordered=sources.filter(x=>!used.has(x.id)).map((source,index)=>({source,index}))
    .sort((a,b)=>(checks[a.source.id]?.url===a.source.url?checks[a.source.id].attemptedAt:'').localeCompare(
      checks[b.source.id]?.url===b.source.url?checks[b.source.id].attemptedAt:'')||a.index-b.index).map(x=>x.source);
  const cafe=ordered.filter(x=>x.discoveryGroup==='cafe'),other=ordered.filter(x=>x.discoveryGroup!=='cafe'),out=[];
  // Reserve up to four slots for each group, then fill unused slots fairly.
  const add=(list,count)=>{for(const source of list.slice(0,count))if(out.length<remaining)out.push(source);};
  add(cafe,Math.max(0,4-attempted.filter(x=>x.discoveryGroup==='cafe').length));
  add(other,Math.max(0,4-attempted.filter(x=>x.discoveryGroup!=='cafe').length));
  for(const source of ordered)if(out.length<remaining&&!out.includes(source))out.push(source);
  return out;
}
export async function runSourceDiscovery({stateDir,sources,knownUrls=[],now=Date.now(),fetchResource=fetchThumbnailResource,weeklyLodging=false,weeklyOverseas=false}){
  if(!Array.isArray(sources)||sources.length>100||new Set(sources.map(x=>x.id)).size!==sources.length
    ||sources.some(x=>!x.id||new URL(x.url).protocol!=='https:'))throw new Error('Invalid discovery sources');
  const jst=new Date(now+9*3600000),day=jst.toISOString().slice(0,10);
  // Saturday week start; a missed Saturday is caught up once on the next run.
  const week=new Date(Date.UTC(jst.getUTCFullYear(),jst.getUTCMonth(),jst.getUTCDate()-((jst.getUTCDay()+1)%7))).toISOString().slice(0,10);
  const path=join(stateDir,weeklyOverseas?'overseas-cafe-discovery.json':weeklyLodging?'lodging-discovery.json':'curation-discovery.json');let old;
  try{old=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const signature=evidenceHash(JSON.stringify({version:weeklyOverseas?4:3,sources,knownUrls:[...new Set(knownUrls)].sort()}));
  const samePeriod=(weeklyLodging||weeklyOverseas)?old?.week===week:old?.day===day;
  if(samePeriod&&old.signature===signature)return {reused:true,scanned:old.results.length,attemptedThisRun:0,candidates:old.candidates.length,newCandidates:0};
  // Keep the bound even if today's publication URLs or source config change.
  const candidates=new Map((old?.candidates??[]).map(x=>[x.url,x])),results=samePeriod?[...old.results]:[];
  const excludedCandidates=[...(old?.excludedCandidates??[])];
  if(weeklyOverseas)for(const [url,candidate] of candidates)if(nonVenueLink(url,candidate.title)){
    excludedCandidates.push({...candidate,excludedAt:new Date(now).toISOString(),reason:'non-venue-operation-link'});candidates.delete(url);
  }
  const sourceChecks={...(old?.sourceChecks??{})};
  for(const result of old?.results??[]){const source=sources.find(x=>x.id===result.sourceId);
    if(source&&!sourceChecks[source.id])sourceChecks[source.id]={url:source.url,attemptedAt:old.generatedAt};}
  let newCandidates=0;
  const selected=selectDiscoverySources(sources,sourceChecks,results);
  for(const source of selected){
    try{
      const response=await fetchResource(source.url,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:url=>url===source.url});
      if(response.status!==200||!/text\/html|application\/xhtml\+xml/i.test(response.headers?.['content-type']??''))throw new Error('unavailable');
      const found=discoverLinks(response.text,source,knownUrls);
      for(const candidate of found){const prior=candidates.get(candidate.url);if(!prior)newCandidates++;
        candidates.set(candidate.url,{...prior,...candidate,firstSeenAt:prior?.firstSeenAt??new Date(now).toISOString(),lastSeenAt:new Date(now).toISOString()});}
      results.push({sourceId:source.id,discoveryGroup:source.discoveryGroup??'other',status:'fetched',candidates:found.length});
    }catch{results.push({sourceId:source.id,discoveryGroup:source.discoveryGroup??'other',status:'unavailable',candidates:null});}
    sourceChecks[source.id]={url:source.url,attemptedAt:new Date(now).toISOString()};
  }
  const pending=[...candidates.values()].filter(x=>!knownUrls.includes(x.url));
  const reviewQueue=pending.sort((a,b)=>b.firstSeenAt.localeCompare(a.firstSeenAt)||a.id.localeCompare(b.id)).map(x=>({id:x.id,url:x.url,sourceId:x.sourceId,
    reason:'official-body-and-sharing-review-required',publicationApproved:false}));
  const report={version:1,day,...((weeklyLodging||weeklyOverseas)?{week}:{}),signature,generatedAt:new Date(now).toISOString(),results,sourceChecks,candidates:[...candidates.values()],newCandidates,reviewQueue,
    ...(weeklyOverseas?{excludedCandidates}:{}),scope:'registered-source-links-only',publicationApproved:false};
  const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(report,null,2)+'\n',{mode:0o600});await rename(tmp,path);
  return {reused:false,scanned:results.length,attemptedThisRun:selected.length,candidates:candidates.size,newCandidates,
    unavailable:results.filter(x=>x.status==='unavailable').length};
}
