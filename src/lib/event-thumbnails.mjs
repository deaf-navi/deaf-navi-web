import { enrichNewsThumbnails } from './news-thumbnails.mjs';
import { eventPeriod } from './events.mjs';
import { tagAttributes, publicUrl } from './thumbnail-metadata.mjs';
import { fetchThumbnailResource } from './thumbnail-fetch.mjs';

// Some official HTTPS pages still advertise same-host WordPress images as HTTP.
// Try the HTTPS equivalent only; the shared collector must still validate HEAD.
export function eventPreviewMetadata(html,pageUrl){
  if(!publicUrl(pageUrl)?.startsWith('https:'))return html;
  return html.replace(/<meta\b[^>]*>/gi,tag=>{
    const attrs=tagAttributes(tag),key=(attrs.property||attrs.name||'').toLowerCase();
    if(!['og:image','og:image:secure_url','twitter:image','twitter:image:src'].includes(key))return tag;
    const candidate=publicUrl(attrs.content,pageUrl);if(!candidate)return tag;
    const image=new URL(candidate);
    if(image.protocol!=='http:'||image.hostname!==new URL(pageUrl).hostname||image.port)return tag;
    image.protocol='https:';
    return `<meta property="${key}" content="${image.href.replaceAll('&','&amp;').replaceAll('"','&quot;')}">`;
  });
}

// Only the verified occurrence's own announcement page can supply its preview.
// Shared announcement pages (e.g. three dates on one notice) are fetched once.
export async function enrichEventThumbnails(events, options={}) {
  const now=options.now??Date.now(), pages=new Map();
  const fetchResource=options.fetchResource||fetchThumbnailResource;
  const eventFetch=async(url,settings)=>{
    const result=await fetchResource(url,settings);
    return settings.method==='HEAD'?result:{...result,text:eventPreviewMetadata(result.text,result.url)};
  };
  for(const event of events){
    delete event.thumbnail;
    if(eventPeriod(event,now)!=='upcoming')continue;
    const url=event.detailUrl||event.sourceUrl;
    if(!pages.has(url))pages.set(url,{id:url,sourceUrl:event.sourceUrl});
  }
  const report=await enrichNewsThumbnails([...pages.values()],{
    maxArticles:30,budgetMs:45000,imageCacheMs:86400000,missingCacheMs:86400000,
    userAgent:'DeafNaviWeb-Events/1.0 (+https://deafnavi.com/)',...options,fetchResource:eventFetch,now,
  });
  for(const event of events){
    if(eventPeriod(event,now)!=='upcoming')continue;
    const thumbnail=pages.get(event.detailUrl||event.sourceUrl)?.thumbnail;
    if(thumbnail)event.thumbnail={...thumbnail};
  }
  return {...report,eventsWithImage:events.filter(e=>e.thumbnail).length};
}
