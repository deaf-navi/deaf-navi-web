import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { publicUrl, imageUrl, pageThumbnails, tagAttributes } from './thumbnail-metadata.mjs';
import { fetchThumbnailResource } from './thumbnail-fetch.mjs';

const DAY = 86_400_000;
const GOOGLE_RPC = 'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je';

export function googleArticleId(value) {
  const url = publicUrl(value);
  if (!url || new URL(url).hostname !== 'news.google.com') return null;
  return new URL(url).pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([\w-]+)$/)?.[1] || null;
}

export function parseGoogleNavigation(text) {
  for (const line of text.split('\n')) {
    if (!line.startsWith('[[')) continue;
    try {
      const rows = JSON.parse(line);
      for (const row of rows) {
        if (row[0] !== 'wrb.fr' || row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue;
        const payload = JSON.parse(row[2]);
        if (payload[0] === 'garturlres') return publicUrl(payload[1]);
      }
    } catch { /* A changed navigation response is a normal missing thumbnail. */ }
  }
  return null;
}

export function samePublisher(url, sourceUrl) {
  if (!publicUrl(url) || !publicUrl(sourceUrl)) return false;
  const host = new URL(url).hostname.replace(/^www\./, '');
  const source = new URL(sourceUrl).hostname.replace(/^www\./, '');
  return host === source || host.endsWith('.' + source);
}

// Best effort, unauthenticated navigation lookup. This is not a supported Google API.
// Public response format reference: SSujitX/google-news-url-decoder, new_decoderv1.py.
// No proxy, cookie, login or CAPTCHA workaround. 403/429 stops Google lookups for the run.
async function resolveGoogle(article, request) {
  const id = googleArticleId(article.id);
  if (!id) return null;
  const page = await request('https://news.google.com/rss/articles/' + id);
  if (page.status !== 200) throw new Error('Google navigation unavailable');
  if (new URL(page.url).hostname !== 'news.google.com') return samePublisher(page.url, article.sourceUrl) ? page.url : null;
  let attrs;
  for (const match of page.text.matchAll(/<[^>]+data-n-a-id[^>]*>/g)) {
    const candidate = tagAttributes(match[0]);
    if (candidate['data-n-a-id'] === id) { attrs = candidate; break; }
  }
  if (!attrs?.['data-n-a-sg'] || !/^\d+$/.test(attrs['data-n-a-ts'] || '')) return null;
  const context = [
    ['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 180,
      null, null, null, null, null, 0, null, null, [1608992183, 723341000]],
    'en-US', 'US', 1, [2, 3, 4, 8], 1, 0, '655000234', 0, 0, null, 0,
  ];
  const params = ['garturlreq', context, id, Number(attrs['data-n-a-ts']), attrs['data-n-a-sg']];
  const body = new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', JSON.stringify(params), null, 'generic']]]) }).toString();
  const result = await request(GOOGLE_RPC, { method: 'POST', body });
  if (result.status !== 200) throw new Error('Google navigation unavailable');
  const url = parseGoogleNavigation(result.text);
  return samePublisher(url, article.sourceUrl) ? url : null;
}

/** Adds optional thumbnail metadata without changing article identities, ordering or text. */
export async function enrichNewsThumbnails(articles, {
  cacheFile, maxArticles = 60, budgetMs = 90_000, googleIntervalMs = 1100,
  fetchResource = fetchThumbnailResource, now = Date.now(), userAgent,
} = {}) {
  const report = { articles: articles.length, attempted: 0, cached: 0, acquired: 0, missing: 0,
    failed: 0, deferred: 0, withImage: 0, googleStopped: false };
  let saved = {};
  if (cacheFile) {
    try { saved = JSON.parse(await readFile(cacheFile, 'utf8')).entries || {}; }
    catch { /* The cache is optional; broken state must not stop news updates. */ }
  }
  const entries = {};
  const signal = AbortSignal.timeout(budgetMs);
  let nextGoogleAt = 0;
  const blockedOrigins = new Set();
  const request = async (url, options = {}) => {
    const origin = new URL(url).origin;
    const google = new URL(url).hostname === 'news.google.com';
    if (blockedOrigins.has(origin)) throw new Error('Origin stopped for this run');
    if (google) {
      if (report.googleStopped) throw new Error('Google navigation unavailable');
      await delay(Math.max(0, nextGoogleAt - Date.now()), undefined, { signal });
      nextGoogleAt = Date.now() + googleIntervalMs;
    }
    const response = await fetchResource(url, { ...options, signal, userAgent });
    if ([401, 403, 429].includes(response.status)) {
      blockedOrigins.add(origin);
      if (google) report.googleStopped = true;
    }
    return response;
  };
  const validThumbnail = (value) => value && imageUrl(value.url) && publicUrl(value.pageUrl)
    && ['rss', 'og:image', 'twitter:image'].includes(value.source);
  const pending = [];
  for (const article of articles) {
    const cached = saved[article.id];
    const age = now - Date.parse(cached?.checkedAt);
    if (cached && (!cached.thumbnail || validThumbnail(cached.thumbnail))
      && age >= 0 && age < (cached.thumbnail ? 30 : 7) * DAY
      && (!cached.retryAt || now < Date.parse(cached.retryAt))
      && !(validThumbnail(article._thumbnailCandidate) && !cached.thumbnail)) {
      if (validThumbnail(cached.thumbnail)) article.thumbnail = cached.thumbnail;
      else delete article.thumbnail;
      entries[article.id] = cached;
      report.cached++;
    } else {
      if (validThumbnail(cached?.thumbnail)) article.thumbnail = cached.thumbnail;
      pending.push(article);
      if (cached) entries[article.id] = cached;
    }
  }
  // Unchecked articles before retries; cap and elapsed budget keep curation bounded.
  pending.sort((a, b) => Number(Boolean(saved[a.id])) - Number(Boolean(saved[b.id])));
  for (const article of pending) {
    if (report.attempted >= maxArticles || signal.aborted
      || (report.googleStopped && googleArticleId(article.id) && !validThumbnail(article.thumbnail)
        && !validThumbnail(article._thumbnailCandidate))) {
      report.deferred++;
      continue;
    }
    report.attempted++;
    const previous = validThumbnail(saved[article.id]?.thumbnail) ? saved[article.id].thumbnail : null;
    try {
      const verifyCandidates = async (candidates) => {
        for (const candidate of candidates.slice(0, 2)) {
          const response = await request(candidate.url, { method: 'HEAD' });
          if ([401, 403, 429].includes(response.status) || response.status >= 500) throw new Error('Image temporarily unavailable');
          const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
          if (response.status === 200 && /^image\/(?:jpeg|png|webp|avif|gif)$/.test(type)
            && imageUrl(response.url) && (!response.headers['content-length'] || Number(response.headers['content-length']) >= 512)) {
            return { ...candidate, url: response.url };
          }
        }
        return null;
      };
      let thumbnail = await verifyCandidates(validThumbnail(article._thumbnailCandidate) ? [article._thumbnailCandidate]
        : validThumbnail(article.thumbnail) ? [article.thumbnail] : []);
      if (!thumbnail) {
        const pageUrl = googleArticleId(article.id) ? await resolveGoogle(article, request) : publicUrl(article.id);
        if (pageUrl) {
          const page = await request(pageUrl);
          if (page.status !== 200) throw new Error('Publisher unavailable');
          thumbnail = await verifyCandidates(pageThumbnails(page.text, page.url));
        }
      }
      if (thumbnail) { article.thumbnail = thumbnail; report.acquired++; }
      else { delete article.thumbnail; report.missing++; }
      entries[article.id] = { checkedAt: new Date(now).toISOString(), thumbnail };
    } catch {
      report.failed++;
      if (previous) article.thumbnail = previous;
      else delete article.thumbnail;
      // Retry transient failures after one day; never discard a last verified image.
      entries[article.id] = { checkedAt: new Date(now).toISOString(), thumbnail: previous,
        retryAt: new Date(now + DAY).toISOString() };
    }
  }
  // Unprocessed feed URLs have not yet passed the HTTP check.
  for (const article of articles) {
    if (!validThumbnail(entries[article.id]?.thumbnail)) delete article.thumbnail;
  }
  report.withImage = articles.filter((article) => Boolean(article.thumbnail)).length;
  if (cacheFile) {
    try {
      await mkdir(dirname(cacheFile), { recursive: true });
      const temp = `${cacheFile}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify({ version: 1, entries }, null, 2) + '\n', 'utf8');
      await rename(temp, cacheFile);
    } catch { report.cacheWriteFailed = true; }
  }
  return report;
}
