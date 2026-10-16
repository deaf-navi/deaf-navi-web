import { NEWS_CONTEXT_REVIEWS } from '../../config/news-context.mjs';

export const NEWS_CONTEXT_LABELS = { announcement: '開催案内', report: '開催報告' };

// Conservative article-type labels. A past date or the word 報告 in a seminar
// topic does not establish a report. Mixed retrospective/prospective text stays unset.
export function newsContext(article) {
  let key;
  try { const url = new URL(article.id); key = url.hostname + url.pathname; } catch {}
  if (Object.hasOwn(NEWS_CONTEXT_REVIEWS, key ?? '')) return NEWS_CONTEXT_REVIEWS[key].type;
  const title = String(article.title ?? '').normalize('NFKC');
  const text = title + ' ' + String(article.summary ?? '').normalize('NFKC');
  const report = /(?:^|[【\[])(?:開催|実施)(?:報告|レポート)(?:[】\]]|$)/.test(title)
    || /(?:を|が)(?:開催|実施)(?:しました|されました)/.test(text);
  const announcement = /開催(?:案内|のお知らせ)|参加者(?:を)?募集/.test(title)
    || /(?:を|が)開催(?:します|されます)/.test(text);
  if (/中止|延期|募集終了|受付終了/.test(text) || report === announcement) return null;
  return report ? 'report' : 'announcement';
}

export function newsContextLabel(article) {
  return NEWS_CONTEXT_LABELS[article.newsContext ?? newsContext(article)] ?? '';
}
