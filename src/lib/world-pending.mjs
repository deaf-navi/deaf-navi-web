import { articleCacheKey, isWeakJapaneseTranslation, assertJapaneseTranslations } from './world-translation.mjs';

export const isTranslatedArticle = (article) =>
  !isWeakJapaneseTranslation(article.originalTitle, article.title)
  && !isWeakJapaneseTranslation(article.originalSummary, article.summary);

// Store only public feed material. Pending items are committed outside the served docs directory.
export function retryCandidates(selected, entries, now = Date.now()) {
  const bySource = new Map(selected.map((article) => [articleCacheKey(article), { ...article }]));
  const active = entries.filter((entry) => now - Date.parse(entry.firstSeenAt) < 14 * 86400000).slice(0, 600);
  for (const entry of active) {
    if (!bySource.has(articleCacheKey(entry.article))) bySource.set(articleCacheKey(entry.article), { ...entry.article });
  }
  return { candidates: [...bySource.values()], active };
}

export function settleTranslations(attempted, previous, entries, { now = Date.now(), limit = 600 } = {}) {
  const old = new Map(entries.map((entry) => [articleCacheKey(entry.article), entry]));
  const pending = attempted.filter((article) => !isTranslatedArticle(article)).map((article) => {
    const prior = old.get(articleCacheKey(article));
    const { _dedupeKey, _googleNewsClusterId, ...clean } = article;
    return {
      article: clean,
      firstSeenAt: prior?.firstSeenAt ?? new Date(now).toISOString(),
      lastAttemptAt: new Date(now).toISOString(),
      attempts: (prior?.attempts ?? 0) + 1,
    };
  }).slice(0, 600);
  const articles = [], ids = new Set(), sources = new Set();
  let retained = 0;
  for (const [items, fallback] of [[attempted, false], [previous, true]]) {
    for (const article of items) {
      const key = articleCacheKey(article);
      if (!isTranslatedArticle(article) || ids.has(article.id) || sources.has(key)) continue;
      if (articles.length >= limit) break;
      articles.push(article);
      ids.add(article.id); sources.add(key);
      if (fallback) retained++;
    }
  }
  assertJapaneseTranslations(articles);
  return { articles, pending, retained };
}
