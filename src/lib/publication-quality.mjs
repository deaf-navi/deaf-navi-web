import { isDeepStrictEqual } from 'node:util';
import { DIRECT_FEEDS, EXPANDED_DIRECT_FEEDS, SOCIAL_FEEDS } from '../../config/sources.domestic.mjs';
import { dedupeNearArticles, hydratePreviousArticle, publicationExclusionReason, explicitUnrelatedReason, stripInternal, QUALITY_VERSION } from './curation.mjs';
import { normalizeTitleKey } from './text.mjs';
import { isHardNoiseWorldText } from './world-relevance.mjs';
import { hasMistranslatedLibras } from './world-translation.mjs';

const directFeeds = new Map([...DIRECT_FEEDS, ...EXPANDED_DIRECT_FEEDS, ...SOCIAL_FEEDS].map((feed) => [feed.sourceName, feed]));

function withReview(data, articles, removed) {
  if (isDeepStrictEqual(articles, data.articles)) return data;
  return {
    ...data,
    count: articles.length,
    articles,
    publicationReview: { version: QUALITY_VERSION, inputGeneratedAt: data.generatedAt, removed },
  };
}

/** Validate saved snapshots on rebuild too, including workflow conflict recovery. */
export function prepareDomesticPublication(data,{now=Date.now()}={}) {
  const removed = [];
  const eligible = [];
  for (const saved of data.articles ?? []) {
    const article = hydratePreviousArticle(saved, directFeeds,{now});
    const reason = publicationExclusionReason(article);
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    else eligible.push({ ...article, _dedupeKey: normalizeTitleKey(article.title) });
  }
  const { articles, duplicates } = dedupeNearArticles(eligible);
  removed.push(...duplicates.map((item) => ({ id: item.droppedId, title: item.dropped, reason: 'duplicate', keptId: item.keptId })));
  articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return withReview(data, articles.map((article) => stripInternal(article)), removed);
}

export function prepareDomesticArchivePublication(data) {
  const removed = [];
  const articles = (data.articles ?? []).filter((article) => {
    const reason = explicitUnrelatedReason(article);
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    return !reason;
  });
  return withReview(data, articles, removed);
}

export function prepareWorldPublication(data) {
  const removed = [];
  const articles = (data.articles ?? []).filter((article) => {
    const noise = isHardNoiseWorldText(`${article.originalTitle ?? ''} ${article.originalSummary ?? ''}`);
    const mistranslated = hasMistranslatedLibras(article.originalTitle, article.title)
      || hasMistranslatedLibras(article.originalSummary, article.summary);
    const reason = noise ? 'unrelated' : mistranslated ? 'translation-review' : null;
    if (reason) removed.push({ id: article.id, title: article.title, reason });
    return !reason;
  });
  return withReview(data, articles, removed);
}
