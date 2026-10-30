import {createHash} from 'node:crypto';
export const reviewedTextFingerprint = article => createHash('sha256').update(JSON.stringify([article.title,article.summary])).digest('hex');
export const sourceDispositionDigest = record => createHash('sha256').update(JSON.stringify([record.id,record.status,record.reason,record.sourceFingerprint,record.sourcePublication,record.sourceEvidence,record.reviewedAt])).digest('hex');

// An audit checksum, not a signature or a claim of human editorial approval.
export function sourceReviewDigest(review) {
  const fields=['id','status','reviewedBy','reviewedAt','reviewers','sourceFingerprint','sourcePublishedAt','translationFingerprint','reviewedTextFingerprint','region','place','evidence','sourceEvidence','correctionTopic','correctionTopicLabel','sourceContextConfirmed','restorationSnapshot'];
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(fields.map(key=>[key,review[key]??null])))).digest('hex');
}
export function validSourceReview(review, {now=Date.now()}={}) {
  const date=Date.parse(review?.reviewedAt);
  return review?.status==='source-verified' && review.reviewedBy==='codex-opus-source-review'
    && Number.isFinite(date) && date<=now
    && Number.isFinite(Date.parse(review.sourcePublishedAt)) && Date.parse(review.sourcePublishedAt)<=date
    && Array.isArray(review.reviewers) && review.reviewers.includes('Codex') && review.reviewers.includes('claude-opus-5-5')
    && Array.isArray(review.sourceEvidence) && review.sourceEvidence.length>0
    && review.sourceEvidence.every(source=>{
      try {
        const url=new URL(source.url), checked=Date.parse(source.checkedAt);
        return url.protocol==='https:' && !url.username && !url.password && (url.pathname!=='/' || Boolean(url.search))
          && Number.isFinite(checked) && checked<=date
          && ['article-text','search-index','official-location'].includes(source.method)
          && typeof source.excerpt==='string' && source.excerpt.trim().length>=3;
      } catch { return false; }
    }) && review.reviewDigest===sourceReviewDigest(review);
}
