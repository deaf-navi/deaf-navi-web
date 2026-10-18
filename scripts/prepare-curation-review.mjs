import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fetchThumbnailResource} from '../src/lib/thumbnail-fetch.mjs';
import {cleanHtml} from '../src/lib/text.mjs';
import {prepareReviewItem,evidenceHash} from './curation-review-contract.mjs';
const comparable=text=>String(text).normalize('NFKC').replace(/\s+/g,'');
// Exact, operator-selected public fragments; fetching is not sharing approval.
// Changed pages and visual evidence remain exceptions, not freshness renewals.
export async function prepareCurationReview(targets,{fetchResource=fetchThumbnailResource,now=Date.now()}={}) {
 if(!Array.isArray(targets)||targets.length<1||targets.length>8)throw new Error('Select 1 to 8 source targets');
 const tasks=[],exceptions=[];
 for(const target of targets){
  try{
   if(target.officialVerified!==true||target.sourceMode!=='html'||!Array.isArray(target.fragments)||!target.fragments.length)throw new Error('official-html-fragments-required');
   const item=prepareReviewItem({...target,text:target.fragments.join(' ')});
   const response=await fetchResource(target.sourceUrl,{userAgent:'Codex-DeafNavi-Verification',maxBytes:800000,timeoutMs:15000,allowUrl:url=>url===target.sourceUrl});
   if(response.status!==200||!/text\/html|application\/xhtml\+xml/i.test(response.headers?.['content-type']??''))throw new Error('source-unavailable-or-visual');
   const html=response.text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
   const text=cleanHtml(html.replace(/<[^>]*>/g,' '));
   if(target.fragments.some(fragment=>!comparable(text).includes(comparable(fragment))))throw new Error('source-fragment-changed');
   const sourceDocumentHash=evidenceHash(text);
   if(target.approvedDocumentHash&&target.approvedDocumentHash!==sourceDocumentHash)throw new Error('source-document-changed');
   const excerpt=JSON.parse(item.summary).text;
   tasks.push({kind:target.kind,title:item.title,sourceUrl:target.sourceUrl,recordId:target.recordId??null,
    baseline:target.baseline??{},text:excerpt,sourceTextHash:evidenceHash(excerpt),sourceDocumentHash,
    sourceMode:'html',officialVerified:true,retrievedAt:new Date(now).toISOString()});
  }catch(error){exceptions.push({kind:target.kind,recordId:target.recordId??null,sourceUrl:target.sourceUrl,reason:/^(official-|source-)/.test(error.message)?error.message:'invalid-or-unavailable-source',reviewedAt:null});}
 }
 return {generatedAt:new Date(now).toISOString(),publicDataReviewed:false,tasks,exceptions,items:tasks.map(prepareReviewItem)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const chunks=[];for await(const c of process.stdin)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));process.stdout.write(JSON.stringify(await prepareCurationReview(input.targets))+'\n');}
 catch{process.stderr.write('CURATION_PREPARATION_UNAVAILABLE\n');process.exitCode=1;}
}
