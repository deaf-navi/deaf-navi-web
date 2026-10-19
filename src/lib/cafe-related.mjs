import { groupNewsTopics } from './news-topics.mjs';
// Only an already-approved domestic publication snapshot is an input.
export function cafeRelated(articles, now = Date.now()) {
  const candidates = articles.filter(a => {
    const date = Date.parse(a.publishedAt);
    return Number.isFinite(date) && date <= now && now-date <= 14*86400000
      && /手話|筆談|ろう文化|デフアート/u.test(a.title || '')
      && /交流|カフェ|喫茶|文化|演劇|手話劇|落語|映画|アート|キャスター|コミュニケーション/u.test(a.title || '')
      && /^https:\/\//.test(a.id || '');
  }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  return groupNewsTopics(candidates).map(g=>g.lead).slice(0,2).map(a=>({title:a.title,publishedAt:a.publishedAt,sourceName:a.sourceName,context:a.newsContext || null}));
}
