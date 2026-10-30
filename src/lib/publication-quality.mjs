import {assertPublicCopy} from './public-copy.mjs';
import { isDeepStrictEqual } from 'node:util';
import { DIRECT_FEEDS, EXPANDED_DIRECT_FEEDS, SOCIAL_FEEDS } from '../../config/sources.domestic.mjs';
import { dedupeNearArticles, hydratePreviousArticle, publicationExclusionReason, explicitUnrelatedReason, stripInternal, QUALITY_VERSION } from './curation.mjs';
import { normalizeTitleKey } from './text.mjs';
import { isHardNoiseWorldText } from './world-relevance.mjs';
import { translationReviewReason, polishJapaneseWithSource } from './world-translation.mjs';
import { worldLocation } from './world-location.mjs';
import { heldPublicationReason,applyApprovedWorldTranslation,sourceReviewedDecision } from './publication-ledger.mjs';

const directFeeds = new Map([...DIRECT_FEEDS, ...EXPANDED_DIRECT_FEEDS, ...SOCIAL_FEEDS].map((feed) => [feed.sourceName, feed]));

// Removal details are consumed by the private ledger before public serialization.
export function publicPublicationSnapshot(data) {
  if(!data.publicationReview?.removed?.length)return data;
  return {...data,publicationReview:{...data.publicationReview,removedCount:data.publicationReview.removed.length,removed:[]}};
}

function withReview(data, articles, removed) {
  assertPublicCopy(articles,'news');
  const currentReview = data.quality?.version === QUALITY_VERSION
    || (data.publicationReview?.version === QUALITY_VERSION
      && data.publicationReview?.inputGeneratedAt === data.generatedAt);
  if (currentReview && isDeepStrictEqual(articles, data.articles)) return data;
  return {
    ...data,
    count: articles.length,
    articles,
    publicationReview: { version: QUALITY_VERSION, inputGeneratedAt: data.generatedAt, removed },
  };
}

/** Validate saved snapshots on rebuild too, including workflow conflict recovery. */
export function prepareDomesticPublication(data,{now=Date.now(),ledger}={}) {
  const removed = [];
  const eligible = [];
  for (const saved of data.articles ?? []) {
    const article = hydratePreviousArticle(saved, directFeeds,{now});
    const reason = heldPublicationReason(saved,ledger) || publicationExclusionReason(article);
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    else eligible.push({ ...article, _dedupeKey: normalizeTitleKey(article.title) });
  }
  const { articles, duplicates } = dedupeNearArticles(eligible);
  removed.push(...duplicates.map((item) => ({ id: item.droppedId, title: item.dropped, reason: 'duplicate', keptId: item.keptId })));
  articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return withReview(data, articles.map((article) => stripInternal(article)), removed);
}

export function prepareDomesticArchivePublication(data,{ledger}={}) {
  const removed = [];
  const articles = (data.articles ?? []).filter((article) => {
    const reason = heldPublicationReason(article,ledger) || explicitUnrelatedReason(article);
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    return !reason;
  });
  return withReview(data, articles, removed);
}

export function prepareWorldPublication(data, {ledger} = {}) {
  const removed = [];
  const articles = (data.articles ?? []).map(article=>applyApprovedWorldTranslation(article,ledger)).filter((article) => {
    const noise = isHardNoiseWorldText(`${article.originalTitle ?? ''} ${article.originalSummary ?? ''}`);
    const mistranslated = translationReviewReason(article.originalTitle, article.title)
      || translationReviewReason(article.originalSummary, article.summary);
    const unclearSource = /News Breakdown, Science Latest, Travel Ideas, Mighty Challenge/iu.test(article.originalTitle||'')
      && !sourceReviewedDecision(article,ledger)?.sourceContextConfirmed;
    const reason = heldPublicationReason(article, ledger) || (noise ? 'unrelated' : unclearSource ? 'source-context-review' : mistranslated ? 'translation-review' : null);
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    return !reason;
  });
  const published=articles.map(article => ({ ...article,
    ...(Object.hasOwn(article, 'region') ? worldLocation(article,{ledger}) : {}),
    title: ['human-review','codex-opus-source-review'].includes(article.japanesePostEditEngine)?article.title:polishJapaneseWithSource(article.originalTitle, article.title),
    summary: ['human-review','codex-opus-source-review'].includes(article.japanesePostEditEngine)?article.summary:polishJapaneseWithSource(article.originalSummary, article.summary),
  }));
  const result=withReview(data,published,removed);
  if(!result.quality)return result;
  const countBy=key=>published.reduce((counts,a)=>{counts[a[key]||'unknown']=(counts[a[key]||'unknown']||0)+1;return counts;},{});
  // Preserve collection statistics while making published counts explicit.
  const publishedCounts={selectedCount:published.length,regionCounts:countBy('region'),topicCounts:countBy('topic')};
  if(isDeepStrictEqual(result.quality.publishedCounts,publishedCounts))return result;
  return {...result,quality:{...result.quality,publishedCounts}};
}
