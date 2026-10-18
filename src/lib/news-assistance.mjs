import {createHash} from 'node:crypto';
// Content-bound reviewed assistance; source changes invalidate prior decisions.
// Negative API decisions never remove articles, and explicit exclusions still win.
export const newsArticleHash=article=>createHash('sha256').update(JSON.stringify({id:article.id,title:article.title,summary:article.summary,publishedAt:article.publishedAt,sourceContentHash:article._sourceContentHash??null})).digest('hex');
const snapshotHash=article=>createHash('sha256').update(JSON.stringify({id:article.id,title:article.title,summary:article.summary,publishedAt:article.publishedAt,newsContext:article.newsContext??null})).digest('hex');
const reviewIsCurrent=(review,now)=>{
 const checked=Date.parse(review?.reviewedAt);
 return review?.approved===true&&review.relevance==='yes'&&Number.isFinite(checked)&&checked<=now&&now-checked<7*86400000
  &&/^https:\/\//.test(review.sourceUrl??'')&&Boolean(review.evidence)&&['gpt-6.1-sol','gpt-5.6-terra'].includes(review.model);
};
export function savedNewsAssistanceIsCurrent(article,now=Date.now()) {
 const proof=article.newsAssistance,checked=Date.parse(proof?.reviewedAt);
 return Boolean(proof&&/^[a-f0-9]{64}$/.test(proof.articleHash??'')&&Number.isFinite(checked)&&checked<=now&&now-checked<7*86400000
  &&proof.expiresAt===new Date(checked+7*86400000).toISOString()&&proof.snapshotHash===snapshotHash(article));
}
export function stampNewsAssistance(article,review) {
 return {articleHash:review.articleHash,reviewedAt:review.reviewedAt,expiresAt:new Date(Date.parse(review.reviewedAt)+7*86400000).toISOString(),snapshotHash:snapshotHash(article)};
}
// Freshly fetched content replaces saved copies even when its relevance changed.
export const missingNewsFallbacks=(fresh,saved)=>{
 const fetchedIds=new Set(fresh.map(a=>a.id));return saved.filter(a=>!fetchedIds.has(a.id));
};
export function applyNewsAssistance(articles,records,{now=Date.now()}={}) {
 const byId=new Map((Array.isArray(records)?records:[]).map(r=>[r.id,r]));let applied=0;
 const result=articles.map(article=>{
  const review=byId.get(article.id),saved=article.newsAssistance;
  const matches=saved?savedNewsAssistanceIsCurrent(article,now)&&saved.articleHash===review?.articleHash&&saved.reviewedAt===review?.reviewedAt:review?.articleHash===newsArticleHash(article);
  if(!reviewIsCurrent(review,now)||!matches)return saved||(review?.publicSummary&&article.summary===review.publicSummary)?{...article,_assistanceInvalid:true}:article;
  applied++;
  const summary=typeof review.publicSummary==='string'?review.publicSummary.trim():'';
  return {...article,...(summary&&summary.length<=180?{summary}:{}),_assistedRelevance:true,_assistedReview:{articleHash:review.articleHash,reviewedAt:review.reviewedAt},...(['announcement','report'].includes(review.contentType)?{_assistedContext:review.contentType}:{})};
 });
 return {articles:result,applied};
}
