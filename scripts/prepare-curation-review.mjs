import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {cleanHtml} from '../src/lib/text.mjs';
import {prepareReviewItem,evidenceHash} from './curation-review-contract.mjs';
import {describeSourceChange} from './curation-source-change.mjs';
const comparable=text=>String(text).normalize('NFKC').replace(/\s+/g,'');
// Explicitly reviewed public WordPress pages only; never discover an alternate
// endpoint automatically or accept private/edit contexts as a size-limit escape.
function sourceTransport(target){
 if(target.wordpressPage===undefined)return {url:target.sourceUrl};
 const {id,apiUrl}=target.wordpressPage??{},source=new URL(target.sourceUrl),api=new URL(apiUrl);
 const suffix='/wp-json/wp/v2/pages/'+id;
 if(target.kind!=='lodging'||!Number.isSafeInteger(id)||id<=0||api.protocol!=='https:'||api.username||api.password||api.hash
  ||api.origin!==source.origin||!api.pathname.endsWith(suffix)||api.search!=='?_fields=id,link,status,content'
  ||!source.pathname.startsWith(api.pathname.slice(0,-suffix.length)+'/'))throw Error('source-wordpress-config-invalid');
 return {url:api.href,id};
}
// Exact, operator-selected public fragments; fetching is not sharing approval.
// Changed pages and visual evidence remain exceptions, not freshness renewals.
export async function prepareCurationReview(targets,{fetchResource=fetchThumbnailResource,now=Date.now(),sourceCache=new Map()}={}) {
 if(!Array.isArray(targets)||targets.length<1||targets.length>8)throw new Error('Select 1 to 8 source targets');
 const tasks=[],exceptions=[];
 for(const target of targets){
  let sourceChange;
  try{
   if(target.officialVerified!==true||target.sourceMode!=='html'||!Array.isArray(target.fragments)||!target.fragments.length)throw new Error('official-html-fragments-required');
   const item=prepareReviewItem({...target,text:target.fragments.join(' ')});
   const transport=sourceTransport(target);
   if(!sourceCache.has(transport.url))sourceCache.set(transport.url,fetchResource(transport.url,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:url=>url===transport.url}));
   const response=await sourceCache.get(transport.url);
   if(response.status!==200||!(transport.id?/application\/json/i:/text\/html|application\/xhtml\+xml/i).test(response.headers?.['content-type']??''))throw new Error('source-unavailable-or-visual');
   let rendered=response.text;
   if(transport.id){
    const page=JSON.parse(response.text);
    if(page.id!==transport.id||page.link!==target.sourceUrl||page.status!=='publish'||page.content?.protected!==false||typeof page.content.rendered!=='string')throw Error('source-wordpress-page-mismatch');
    rendered=page.content.rendered;
   }
   const html=rendered.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
   const text=cleanHtml(html.replace(/<[^>]*>/g,' '));
   // Comments can contain obsolete notices such as "registration closed".
   // Retain the existing full document hash contract, but never accept excerpts
   // from hidden HTML comments as evidence for model input.
   const visibleText=cleanHtml(html.replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<[^>]*>/g,' '));
   const sourceDocumentHash=evidenceHash(transport.id?'wordpress-page-v1\n'+transport.url+'\n'+text:text);
   if(target.fragments.some(fragment=>!comparable(visibleText).includes(comparable(fragment)))||target.approvedDocumentHash&&target.approvedDocumentHash!==sourceDocumentHash)
    sourceChange=describeSourceChange(target,visibleText,sourceDocumentHash);
   if(target.fragments.some(fragment=>!comparable(visibleText).includes(comparable(fragment))))throw new Error('source-fragment-changed');
   if(target.approvedDocumentHash&&target.approvedDocumentHash!==sourceDocumentHash)throw new Error('source-document-changed');
   const excerpt=JSON.parse(item.summary).text;
   tasks.push({kind:target.kind,title:item.title,sourceUrl:target.sourceUrl,recordId:target.recordId??null,
    baseline:target.baseline??{},comparisonBaselineHash:target.comparisonBaselineHash,comparisonReview:target.comparisonReview,
    text:excerpt,sourceTextHash:evidenceHash(excerpt),sourceDocumentHash,
    ...(transport.id?{sourceEvidenceUrl:transport.url,documentScope:'wordpress-page-content'}:{}),
    sourceMode:'html',officialVerified:true,retrievedAt:new Date(now).toISOString()});
  }catch(error){exceptions.push({kind:target.kind,recordId:target.recordId??null,sourceUrl:target.sourceUrl,reason:/^(official-|source-)/.test(error.message)?error.message:'invalid-or-unavailable-source',...(sourceChange?{sourceChange}:{}),reviewedAt:null});}
 }
 return {generatedAt:new Date(now).toISOString(),publicDataReviewed:false,tasks,exceptions,items:tasks.map(prepareReviewItem)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const chunks=[];for await(const c of process.stdin)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));process.stdout.write(JSON.stringify(await prepareCurationReview(input.targets))+'\n');}
 catch{process.stderr.write('CURATION_PREPARATION_UNAVAILABLE\n');process.exitCode=1;}
}
