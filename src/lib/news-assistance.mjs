import {createHash} from 'node:crypto';
// Content-bound reviewed assistance; source changes invalidate prior decisions.
// Negative API decisions never remove articles, and explicit exclusions still win.
export const newsArticleHash=article=>createHash('sha256').update(JSON.stringify({id:article.id,title:article.title,summary:article.summary,publishedAt:article.publishedAt,sourceContentHash:article._sourceContentHash??null})).digest('hex');
export function applyNewsAssistance(articles,records,{now=Date.now()}={}) {
 const byId=new Map((Array.isArray(records)?records:[]).map(r=>[r.id,r]));let applied=0;
 const result=articles.map(article=>{
  const review=byId.get(article.id),checked=Date.parse(review?.reviewedAt);
  if(!review||review.approved!==true||review.relevance!=='yes'||review.articleHash!==newsArticleHash(article)||!Number.isFinite(checked)||checked>now||now-checked>=7*86400000||!/^https:\/\//.test(review.sourceUrl??'')||!review.evidence||!['gpt-6.1-sol','gpt-5.6-terra'].includes(review.model))return article;
  applied++;
  const summary=typeof review.publicSummary==='string'?review.publicSummary.trim():'';
  return {...article,...(summary&&summary.length<=180?{summary}:{}),_assistedRelevance:true,...(['announcement','report'].includes(review.contentType)?{_assistedContext:review.contentType}:{})};
 });
 return {articles:result,applied};
}
