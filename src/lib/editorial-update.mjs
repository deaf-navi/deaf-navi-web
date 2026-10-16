import { createHash } from 'node:crypto';
import { EDITORIAL_POLICY as policy, EDITORIAL_SOURCES } from '../../config/editorial.mjs';
import { decodeEntities, cleanHtml, normalizeTitleKey } from './text.mjs';
import { tagAttributes } from './thumbnail-metadata.mjs';
import { fetchThumbnailResource } from './thumbnail-fetch.mjs';

export function editorialSource(input) {
  try {
    const url = new URL(decodeEntities(String(input)));
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const source = EDITORIAL_SOURCES.find(s => s.host === url.hostname && s.path.test(url.pathname));
    if (!source) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_')) url.searchParams.delete(key);
    }
    if (url.search) return null;
    return { ...source, url: url.href };
  } catch { return null; }
}

function plain(html) {
  return cleanHtml(html.replace(/<br\b[^>]*>/gi, ' '));
}

function hasClass(attrs, name) {
  return (attrs.class || '').split(/\s+/).includes(name);
}

// Balance same-name containers rather than stopping at a nested closing div.
// An unknown publisher layout is skipped.
function container(html, tag, predicate) {
  const tokens = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  let start = -1, depth = 0;
  for (const match of html.matchAll(tokens)) {
    if (start < 0) {
      if (!match[1] && predicate(tagAttributes(match[0]))) {
        start = match.index + match[0].length;
        depth = 1;
      }
    } else {
      depth += match[1] ? -1 : 1;
      if (depth === 0) return html.slice(start, match.index);
    }
  }
  return '';
}

function localDate(iso) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time + 9 * 3600000).toISOString().slice(0, 10) : '';
}

export function extractEditorialArticle(html, source, article) {
  const safe = html.replace(/<!--[\s\S]*?-->|<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const post = source.layout === 'jfd'
    ? container(safe, 'div', a => a.id === 'post_' + new URL(source.url).pathname.match(/pid(\d+)/)?.[1])
    : container(safe, 'article', () => true);
  if (!post) return { reason: 'article-body-missing' };
  const heading = source.layout === 'jfd' ? container(post, 'h3', a => hasClass(a, 'title'))
    : source.layout === 'swell' ? container(post, 'h1', a => hasClass(a, 'c-postTitle__ttl'))
      : container(post, source.host === 'shigajou.or.jp' ? 'h2' : 'h1',
        a => hasClass(a, source.host === 'shigajou.or.jp' ? 'entry-title' : 'main-content-title'));
  const title = plain(heading);
  if (!title || normalizeTitleKey(title) !== normalizeTitleKey(article.title)) return { reason: 'title-mismatch' };
  const dateText = source.layout === 'jfd' ? post.match(/掲載日：\s*(\d{4}\/\d{1,2}\/\d{1,2})/)?.[1] : null;
  const timeTag = [...post.matchAll(/<time\b[^>]*>/gi)].map(m => tagAttributes(m[0])).find(a =>
    source.layout === 'swell' ? hasClass(a, 'c-postTimes__posted')
      : hasClass(a, source.host === 'shigajou.or.jp' ? 'updated' : 'entry-date'));
  const date = dateText ? dateText.split('/').map((s, i) => i ? s.padStart(2, '0') : s).join('-')
    : timeTag?.datetime?.slice(0, 10);
  if (!date || date !== localDate(article.publishedAt)) return { reason: 'publication-date-mismatch' };
  const publishedAt = new Date(date + 'T00:00:00+09:00').toISOString();
  const body = container(post, 'div', a => hasClass(a,
    source.layout === 'jfd' ? 'content' : source.layout === 'swell' ? 'post_content' : 'entry-content'));
  if (!body) return { reason: 'article-body-missing' };
  const bodyText = plain(body);
  // A repost is not proof from an organizer. Do not infer an invitation from
  // a flyer, screening table or cancellation.
  if (/主催の?(?:イベント)?ではありません|公式ページはこちら|上映館名|開催中止|募集終了|受付終了|受付を終了|開催終了/.test(bodyText + title)) {
    return { reason: 'secondary-or-closed-notice' };
  }
  const paragraphs = [...body.replace(/<(table|figure|nav|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .map(m => plain(m[1]));
  // Quote a complete short paragraph; do not manufacture dates or finish a
  // truncated sentence. Skip image-only/link-only notices and long documents.
  const excerpt = paragraphs.find(p => p.length >= 35 && p.length <= 160
    && /[。！？!?]$/.test(p) && normalizeTitleKey(p) !== normalizeTitleKey(title)
    && !/お問い合わせ|こちら|クリック|転載|転載元|続きを読む/.test(p));
  if (!excerpt) return { reason: 'safe-excerpt-missing' };
  return { title, text: excerpt, publishedAt,
    bodySha256: createHash('sha256').update(bodyText).digest('hex') };
}

export async function updateEditorial(articles, {
  now = Date.now(), fetchResource = fetchThumbnailResource,
} = {}) {
  const checkedAt = new Date(now).toISOString();
  const result = { version: 1, checkedAt, notes: [], checks: [] };
  const candidates = articles.map(article => ({ article, source: editorialSource(article.id) }))
    .filter(({ article, source }) => source && article.sourceTier === 'official'
      && Date.parse(article.publishedAt) <= now && now - Date.parse(article.publishedAt) < policy.maxAgeMs)
    .sort((a, b) => Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt))
    .slice(0, policy.maxCandidates);
  const blockedHosts = new Set();
  const signal = AbortSignal.timeout(policy.budgetMs);
  const seen = new Set();
  for (const { article, source } of candidates) {
    if (signal.aborted || result.notes.length) break;
    if (blockedHosts.has(source.host) || seen.has(source.url)) continue;
    seen.add(source.url);
    const check = { sourceUrl: source.url, checkedAt };
    result.checks.push(check);
    try {
      const response = await fetchResource(source.url, {
        signal, timeoutMs: 8000, maxBytes: 1_250_000,
        userAgent: 'DeafNaviWeb-Editorial/1.0 (+https://deafnavi.com/)',
        // Checked BEFORE every redirect; the fetcher also validates DNS.
        allowUrl: url => editorialSource(url)?.url === source.url,
      });
      check.status = response.status;
      if ([401, 403, 429].includes(response.status)) blockedHosts.add(source.host);
      if (response.status !== 200) { check.reason = 'http-status'; continue; }
      if (editorialSource(response.url)?.url !== source.url) { check.reason = 'redirect-mismatch'; continue; }
      if (!/^(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers?.['content-type'] || '')) {
        check.reason = 'content-type'; continue;
      }
      const extracted = extractEditorialArticle(response.text, source, article);
      if (extracted.reason) { check.reason = extracted.reason; continue; }
      const expires = Math.min(Date.parse(extracted.publishedAt) + policy.maxAgeMs, now + policy.recheckWithinMs);
      if (expires <= now) { check.reason = 'expired'; continue; }
      result.notes.push({
        id: source.url, mode: 'primary-excerpt', ...extracted,
        sourceUrl: source.url, sourceName: source.name, reviewedAt: checkedAt,
        expiresAt: new Date(expires).toISOString(),
      });
      check.reason = 'selected';
      check.bodySha256 = extracted.bodySha256;
    } catch {
      // Failed verification never reuses or extends yesterday's note.
      check.reason = 'fetch-failed';
    }
  }
  return result;
}
