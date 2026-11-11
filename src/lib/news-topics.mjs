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
  // 11月13日 and 11/13 are the same date; a different day is a conflict.
  const dates = x => [...String(x.title).normalize('NFKC').replace(/\[写真特集\d+\/\d+\]/gu, '')
    .matchAll(/(?<!\d)(?:(20\d{2})[年/])?(\d{1,2})(?:月(\d{1,2})日|\/(\d{1,2})(?![\d/]))/gu)]
    .map(m => `${m[1] ?? ''}-${+m[2]}-${+(m[3] ?? m[4])}`).join('|');
  if (dates(a) && dates(b) && dates(a) !== dates(b)) return true;
  const status = x => String(x.title).match(/中止|延期|満席|完売|否決|可決/gu)?.sort().join('|') || '';
  return status(a) !== status(b);
}

// Publication/gallery wrappers and event dates (compared above) are removed;
// digit grouping is joined so 2,970 and 2970 are the same figure.
const figureText = x => cleanArticleTitle(x.title, x.sourceName).normalize('NFKC')
  .replace(/(?:20\d{2}|令和\d+)年\d{1,2}月\d{1,2}日掲載/gu, '')
  .replace(/(?:20\d{2}年)?\d{1,2}月\d{1,2}日/gu, '')
  .replace(/\[写真特集\d+\/\d+\]/gu, '')
  .replace(/(?<!\d)\d{1,3}(?:,\d{3})+(?!\d)/gu, m => m.replace(/,/gu, ''));
const numbers = x => figureText(x).match(/\d+/g)?.join('|') || '';
const numbersDiffer = (a, b) => Boolean(numbers(a) && numbers(b) && numbers(a) !== numbers(b));

// Figures labelled by what they count, for the named topics below, where
// differently worded headlines state different subsets (2,970人 / 2,970名,
// から1年 / 1周年, 東京2025 present or absent).
function figures(x) {
  return new Set([...figureText(x).matchAll(/(から|第)?(\d+)(周年|人|名|回|年)?/gu)].map(([, pre, n, unit]) => {
    if (unit === '人' || unit === '名') return `${+n}人`;
    if (unit === '周年' || (pre === 'から' && unit === '年')) return `${+n}周年`;
    if (unit === '回') return `${+n}回`;
    if (/^20\d{2}$/u.test(n) && (!unit || unit === '年')) return `${n}年`;
    return `${+n}`;
  }));
}

// The headline with fewer figures must be fully confirmed by the other one:
// another count, year, round or unit is a conflict, never a missing value.
function figuresConflict(a, b) {
  const [few, many] = [figures(a), figures(b)].sort((x, y) => x.size - y.size);
  return [...few].some(f => !many.has(f));
}

const plain = x => cleanArticleTitle(x.title, x.sourceName).normalize('NFKC').toLowerCase();
const quotedNames = t => [...t.matchAll(/[「『“"]([^「」『』“”"]{2,40})[」』”"]/gu)]
  .map(m => m[1].replace(/[^\p{L}\p{N}+]/gu, ''));

// Services whose own name identifies the announcement; spelling variants only.
const ROLLOUT_SERVICES = [/(?:apple|アップル)\s*tv\+?/u];

// The same listed service starts offering sign language interpretation.
// Sharing the service name, 手話 or a person is not enough: both headlines
// need the rollout wording, and no other work, sign language or outcome.
const OUTCOME = /終了|廃止|撤回|見送|停止|中断|不具合/gu;
const PRODUCT = /4k|新型|新モデル|発売|第\d+世代/gu;
const marks = (t, re) => [...new Set(t.match(re))].sort().join('|');
const rolloutService = (ta, tb) => ROLLOUT_SERVICES.find(re => re.test(ta) && re.test(tb));
// A named work or other quoted subject, apart from the service itself.
const subjects = (t, service) => quotedNames(t).filter(n => !/手話/u.test(n) && n.replace(service, ''))
  .sort().join('|');
const languages = t => [['asl', /asl|アメリカ手話|米国手話/u], ['bsl', /bsl|イギリス手話|英国手話/u],
  ['jsl', /jsl|日本手話/u], ['is', /国際手話/u]].filter(([, re]) => re.test(t)).map(([k]) => k);

function sameInterpretingRollout(a, b) {
  const ta = plain(a), tb = plain(b);
  const service = rolloutService(ta, tb);
  if (!service) return false;
  const rollout = t => /手話通訳(?![者士]).*(?:対応|導入|追加|利用可能)/u.test(t)
    && !marks(t, OUTCOME) && !marks(t, PRODUCT);
  if (!rollout(ta) || !rollout(tb)) return false;
  // A named work must be stated identically by both.
  if (subjects(ta, service) !== subjects(tb, service)) return false;
  const la = languages(ta).join('|'), lb = languages(tb).join('|');
  return !(la && lb && la !== lb);
}

// Only the event whose two reports were confirmed to be the same one. Spelling
// variants (width, spacing, colon, quotes) are accepted; a trailing number is
// another edition.
const RUNS_INTO_KK = /runs[^\p{L}\p{N}]*into[^\p{L}\p{N}]*kk(?:\s*(?:vol\.?\s*)?(\d+))?/u;
const announced = t => /開催(?:へ|し?ます|決定|の(?:お知らせ|ご案内))|予定|募集|申込|受付|エントリー|予告|告知/u.test(t);

// Reports that RUNS:INTO KK was held, with the same stated attendance.
// Announcements, recruitment and headlines lacking the name or the attendance
// stay separate: a missing value is not a match.
function sameHeldEvent(a, b) {
  const ta = plain(a), tb = plain(b);
  if (!RUNS_INTO_KK.test(ta) || !RUNS_INTO_KK.test(tb)) return false;
  const held = t => /開催/u.test(t) && !announced(t);
  if (!held(ta) || !held(tb)) return false;
  const people = x => [...figures(x)].filter(f => f.endsWith('人')).sort().join('|');
  return Boolean(people(a)) && people(a) === people(b);
}

// Stated contradictions within the two named topics above. These are final:
// the similarity fallback below must not rejoin near-identical headlines that
// differ in the one word that makes them different news.
function explicitConflict(a, b) {
  const ta = plain(a), tb = plain(b);
  const service = rolloutService(ta, tb);
  if (service && /手話/u.test(ta) && /手話/u.test(tb)) {
    if (marks(ta, OUTCOME) !== marks(tb, OUTCOME) || marks(ta, PRODUCT) !== marks(tb, PRODUCT)) return true;
    const sa = subjects(ta, service), sb = subjects(tb, service);
    if (sa && sb && sa !== sb) return true;
    // One headline listing fewer languages is not a conflict; each naming a
    // language the other does not is.
    const la = languages(ta), lb = languages(tb);
    if (la.some(k => !lb.includes(k)) && lb.some(k => !la.includes(k))) return true;
  }
  const ea = ta.match(RUNS_INTO_KK), eb = tb.match(RUNS_INTO_KK);
  if (ea && eb) {
    if ((ea[1] ?? '') !== (eb[1] ?? '') || announced(ta) !== announced(tb)) return true;
    const rounds = x => [...figures(x)].filter(f => f.endsWith('回')).sort().join('|');
    if (rounds(a) !== rounds(b) || figuresConflict(a, b)) return true;
  }
  return false;
}

export function sameNewsTopic(a, b) {
  // Two missing IDs are two unknowns, not the same article.
  if (a.id !== undefined && a.id !== null && a.id !== '' && a.id === b.id) return true;
  if (incompatible(a, b) || explicitConflict(a, b)) return false;
  if (!figuresConflict(a, b) && (sameInterpretingRollout(a, b) || sameHeldEvent(a, b))) return true;
  if (numbersDiffer(a, b)) return false;
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
