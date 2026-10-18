import {dedupeNearArticles,hasAcceptablePublishedAt,isNearDuplicate,publicationExclusionReason} from './curation.mjs';
import {newsArticleHash} from './news-assistance.mjs';

const recoverableReasons=new Set(['unrelated','source-topic-unconfirmed']);
const priority=article=>article._feedUrl
  ? (['official','specialist'].includes(article._sourceTier)?0:1)
  : (['official','specialist'].includes(article._sourceTier)?2:3);
const domain=article=>{
  try{return new URL(article.sourceUrl||article.id).hostname;}catch{return 'unknown';}
};

// A research queue, never a publication or API-sharing approval. Keep source text private.
export function buildNewsReviewQueue(allArticles,published,{previous={},now=Date.now(),limit=40}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>40)throw new Error('Review queue limit must be 1 to 40');
  const selectedIds=new Set(published.map(a=>a.id));
  const unique=new Map();
  // Freshly collected entries precede fallback copies; do not replace their content hash.
  for(const article of allArticles)if(article.id&&!unique.has(article.id))unique.set(article.id,article);
  const counts={uniqueInputs:unique.size,alreadyPublished:0,outsideWindow:0,hardExcluded:0,duplicateOfPublished:0,candidateDuplicates:0,eligible:0,queued:0,deferred:0};
  const hardExclusionReasons={};const eligible=[];
  for(const article of unique.values()){
    if(selectedIds.has(article.id)){counts.alreadyPublished++;continue;}
    if(!hasAcceptablePublishedAt(article,now)){counts.outsideWindow++;continue;}
    const reason=publicationExclusionReason(article);
    if(reason&&!recoverableReasons.has(reason)){
      counts.hardExcluded++;hardExclusionReasons[reason]=(hardExclusionReasons[reason]??0)+1;continue;
    }
    if(published.some(existing=>isNearDuplicate(article,existing))){counts.duplicateOfPublished++;continue;}
    eligible.push(article);
  }
  const deduped=dedupeNearArticles(eligible);
  counts.candidateDuplicates=deduped.duplicates.length;
  counts.eligible=deduped.articles.length;
  const chosen=[];
  // Within each priority, rotate publishers so one busy source cannot fill all slots.
  for(let rank=0;rank<4&&chosen.length<limit;rank++){
    const buckets=new Map();
    for(const article of deduped.articles.filter(a=>priority(a)===rank).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id))){
      const host=domain(article);if(!buckets.has(host))buckets.set(host,[]);buckets.get(host).push(article);
    }
    while(chosen.length<limit){
      let added=false;
      for(const bucket of buckets.values())if(bucket.length&&chosen.length<limit){chosen.push(bucket.shift());added=true;}
      if(!added)break;
    }
  }
  const old=new Map((previous.candidates??[]).map(a=>[a.sourceUrl,a.articleHash]));
  const candidates=chosen.map(article=>{
    const articleHash=newsArticleHash(article);
    return {sourceUrl:article.id,articleHash,publishedAt:article.publishedAt,sourceTier:article._sourceTier??'unknown',
      sourceDomain:domain(article),priority:priority(article),reason:publicationExclusionReason(article)??'below-score',
      feedChange:old.has(article.id)?(old.get(article.id)===articleHash?'unchanged':'changed'):'new'};
  });
  counts.queued=candidates.length;counts.deferred=counts.eligible-counts.queued;
  const previousIds=new Set(old.keys());
  return {version:2,generatedAt:new Date(now).toISOString(),counts,hardExclusionReasons,
    comparison:{previousGeneratedAt:previous.generatedAt??null,previousQueued:old.size,
      retained:candidates.filter(a=>previousIds.has(a.sourceUrl)).length,
      new:candidates.filter(a=>a.feedChange==='new').length,
      changed:candidates.filter(a=>a.feedChange==='changed').length,
      unchanged:candidates.filter(a=>a.feedChange==='unchanged').length},candidates};
}
