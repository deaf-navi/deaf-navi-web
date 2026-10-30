import { cleanArticleTitle, normalizeTitleKey, diceSimilarity } from './text.mjs';
import { sourcePriority } from './curation.mjs';

// Presentation only: preserve every article and its URL in feeds/search.
function titleKey(a) {
  return normalizeTitleKey(cleanArticleTitle(a.title, a.sourceName)
    .replace(/\s*\[写真特集\d+\/\d+\]/gu, '')
    .replace(/^【写真】/u, '')
    .replace(/\s*\((?:[^()]{0,30}(?:新聞|テレビ|通信|ニュース|放送|オンライン)|ABEMA TIMES)\)\s*$/u, ''));
}

function incompatible(a, b) {
  const gap = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  // Exact, specific syndicated headlines may appear days apart. Near matches
  // retain the short window; generic recurring notices never get this extension.
  const exactSyndication = titleKey(a).length >= 24 && titleKey(a) === titleKey(b)
    && a.sourceName !== b.sourceName;
  if (!Number.isFinite(gap) || gap > (exactSyndication ? 14 : 2) * 86400000) return true;
  if (a.prefecture && b.prefecture && a.prefecture !== b.prefecture) return true;
  if (a.newsContext && b.newsContext && a.newsContext !== b.newsContext) return true;
  // Preserve real event dates; remove only publication/gallery wrappers.
  const dates = x => String(x.title).normalize('NFKC').match(/(?:20\d{2}年)?\d{1,2}月\d{1,2}日/gu)?.join('|') || '';
  if (dates(a) && dates(b) && dates(a) !== dates(b)) return true;
  const numbers = x => cleanArticleTitle(x.title, x.sourceName).normalize('NFKC')
    .replace(/(?:20\d{2}|令和\d+)年\d{1,2}月\d{1,2}日掲載/gu, '')
    .replace(/(?:20\d{2}年)?\d{1,2}月\d{1,2}日/gu, '')
    .replace(/\[写真特集\d+\/\d+\]/gu, '').match(/\d+/g)?.join('|') || '';
  const status = x => String(x.title).match(/中止|延期|満席|完売|否決|可決/gu)?.sort().join('|') || '';
  if (status(a) !== status(b)) return true;
  return Boolean(numbers(a) && numbers(b) && numbers(a) !== numbers(b));
}

export function sameNewsTopic(a, b) {
  if (a.id === b.id) return true;
  if (incompatible(a, b)) return false;
  const ak = titleKey(a), bk = titleKey(b);
  // A missing date is not a conflicting date. Only use this relaxation for a
  // specifically named anniversary; recurring generic notices keep strict rules.
  const anniversary = x => String(x.title).normalize('NFKC')
    .replace(/(?:20\d{2}年)?\d{1,2}月\d{1,2}日/gu, '')
    .replace(/(?:大学|協会|市|県)が/gu, m=>m.slice(0,-1))
    .replace(/を(?:に)?開催(?:します|へ)?[。！]?$/u,'').replace(/\s+/gu,'');
  if (/\d+周年記念/u.test(ak) && anniversary(a) === anniversary(b)) return true;
  // Short headlines need the specific subject/event evidence below; generic
  // short labels must not qualify through string similarity alone.
  if (Math.min(ak.length, bk.length) >= 12) {
    if (ak === bk) return true;
    if (Math.min(ak.length, bk.length) >= 20 && (ak.includes(bk) || bk.includes(ak))) return true;
    if (diceSimilarity(ak, bk) >= .82) return true;
  }
  // Coverage of the same named visitor at the hearing-loss convention, not
  // unrelated products/lectures that merely mention that convention.
  const visit = key => {
    const person = key.match(/([\p{Script=Han}]{2,4})さま/u)?.[1];
    return person && /(?:難聴者|中途失聴者).*?(?:大会|集い)/u.test(key)
      && /出席|訪問|懇談|交流|集い/u.test(key) ? person : null;
  };
  return Boolean(visit(ak) && visit(ak) === visit(bk)
    && new Date(a.publishedAt).toISOString().slice(0, 10) === new Date(b.publishedAt).toISOString().slice(0, 10));
}

export function groupNewsTopics(articles) {
  const groups = [];
  for (const article of articles) {
    // Compare to every member: similar A/B and B/C cannot silently merge A/C.
    const group = groups.find(g => g.articles.every(other => sameNewsTopic(article, other)));
    if (group) group.articles.push(article);
    else groups.push({ articles: [article] });
  }
  return groups.map(group => {
    const ranked = [...group.articles].sort((a, b) => sourcePriority(b) - sourcePriority(a)
      || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    return { lead: ranked[0], articles: [ranked[0], ...group.articles.filter(a => a !== ranked[0])] };
  });
}
