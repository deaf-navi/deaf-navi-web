import { createHash } from 'node:crypto';
import { groupNewsTopics } from './news-topics.mjs';
import { DISASTER_NEWS_REVIEWS } from '../hearing-disaster-news-data.mjs';

// These are presentation edits, not publication approvals or source freshness.
// A changed feed record must not inherit an old summary, URL or topic decision.
export function disasterNewsFingerprint(article) {
  return createHash('sha256').update(JSON.stringify([
    article.id, article.title, article.summary || '', article.sourceName,
    article.sourceUrl, article.publishedAt, article.category,
  ])).digest('hex');
}
export function disasterNewsReview(article, reviews = DISASTER_NEWS_REVIEWS) {
  return reviews.find(r => r.id === article.id && r.inputHash === disasterNewsFingerprint(article));
}

export const normalizeDisasterTitle = text => String(text || '').replace(/[０-９]/gu, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
export function cleanDisasterSummary(summary, title) {
  let text = normalizeDisasterTitle(summary).replace(/\s+/gu, ' ').trim();
  if (/^聴覚・手話に関わる取り組みについてのお知らせです。/u.test(text)) return '';
  const heading = normalizeDisasterTitle(title).trim();
  if (heading && text.startsWith(heading)) text = text.slice(heading.length).trim();
  text = text.replace(/\s*(?:続きを読む|続きを表示|Read more)\s*[›»>]?\s*$/iu, '').trim();
  if (/(?:\[\s*(?:…|\.{3})\s*\]|…|\.{3})\s*$/u.test(text)) {
    // Keep only a complete sentence; never invent the missing end of a name.
    const lastSentence = text.lastIndexOf('。');
    text = lastSentence < 0 ? '' : text.slice(0, lastSentence + 1);
  }
  return text === heading ? '' : text;
}

function politicalBlog(article) {
  return [article.id, article.sourceUrl].some(value => {
    try { return /(^|\.)go2senkyo\.com$/u.test(new URL(value).hostname); } catch { return false; }
  });
}

export function disasterNews(articles, { now = Date.now(), limit = 12, reviews = DISASTER_NEWS_REVIEWS } = {}) {
  const seen = new Set(), matches = new Map();
  const selected = articles.filter(article => {
    const text = `${article.title || ''} ${article.summary || ''}`;
    if (!/防災|減災|災害|被災|避難|震災|地震|津波|豪雨|洪水|台風/u.test(text) || politicalBlog(article)) return false;
    const review = disasterNewsReview(article, reviews);
    // Category/source names alone cannot establish hearing-related relevance.
    const substantive = `${article.title || ''} ${cleanDisasterSummary(article.summary, article.title)}`;
    if (review?.hearingRelevant !== true && !/聴覚|聴力|難聴|失聴|ろう者|盲ろう|聞こえ|きこえ|手話|要約筆記|筆談|情報保障|補聴器|人工内耳/u.test(substantive)) return false;
    const time = Date.parse(article.publishedAt);
    if (!Number.isFinite(time) || time > now || !/^https?:\/\//i.test(article.id || '') || seen.has(article.id)) return false;
    if (review) matches.set(article.id, review);
    seen.add(article.id); return true;
  }).sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  const reviewedGroups = new Map(), unreviewedTopics = [];
  for (const article of selected) {
    const topic = matches.get(article.id)?.topic;
    // An explicit same-incident group must not absorb a similar, unreviewed city.
    if (!topic) { unreviewedTopics.push(article); continue; }
    if (!reviewedGroups.has(topic)) reviewedGroups.set(topic,{articles:[]});
    reviewedGroups.get(topic).articles.push(article);
  }
  const groups = [...reviewedGroups.values(), ...groupNewsTopics(unreviewedTopics)]
    .sort((a,b) => Math.max(...b.articles.map(x=>Date.parse(x.publishedAt))) - Math.max(...a.articles.map(x=>Date.parse(x.publishedAt))));
  return groups.slice(0,limit).map(group => {
    const ranked = [...group.articles].sort((a,b) => (matches.get(b.id)?.priority || 0) - (matches.get(a.id)?.priority || 0));
    return {lead:ranked[0],articles:ranked};
  });
}

// Convert only for rendering; stable IDs, feed/search records and dates are intact.
export function disasterNewsDisplay(article, reviews = DISASTER_NEWS_REVIEWS) {
  const review = disasterNewsReview(article, reviews);
  const url = review?.articleUrl;
  return {...article,
    id: url && /^https:\/\//u.test(url) ? url : article.id,
    title: normalizeDisasterTitle(article.title),
    summary: review?.summary ?? cleanDisasterSummary(article.summary, article.title),
  };
}
