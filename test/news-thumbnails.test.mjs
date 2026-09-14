import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicUrl, imageUrl, feedThumbnail, pageThumbnails } from '../src/lib/thumbnail-metadata.mjs';
import { isPublicAddress, fetchThumbnailResource } from '../src/lib/thumbnail-fetch.mjs';
import { enrichNewsThumbnails, googleArticleId, parseGoogleNavigation, samePublisher } from '../src/lib/news-thumbnails.mjs';
import { parseFeedEntries } from '../src/lib/feed-parser.mjs';
import { stripInternal } from '../src/lib/curation.mjs';
import { renderArticleCard } from '../src/templates/partials.mjs';

const picture = { url: 'https://images.publisher.example.com/photo.jpg', source: 'og:image', pageUrl: 'https://publisher.example.com/story' };
const article = (id = picture.pageUrl) => ({ id, title: '手話ニュース', summary: '要約', category: 'general',
  sourceUrl: 'https://publisher.example.com/', sourceName: 'Publisher', publishedAt: '2026-09-14T00:00:00Z' });
const response = (url, text = '', status = 200, type = 'text/html') => ({ url, text, status, headers: { 'content-type': type } });

test('public URLs reject credentials, private literals, special schemes and local names', async () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AA', 'file:///secret', 'https://127.0.0.1/a',
    'http://2130706433/a', 'http://0x7f000001/a', 'http://[::1]/', 'http://localhost/', 'https://db.internal/a',
    'https://x.local/a', 'https://user:secret@publisher.com/a', 'https://publisher.com:8000/a']) {
    assert.equal(publicUrl(url), null, url);
    await assert.rejects(fetchThumbnailResource(url));
  }
  assert.equal(imageUrl('http://publisher.com/image.jpg'), null);
  assert.equal(imageUrl('/images/news.jpg?x=1&y=2', 'https://publisher.com/a'), 'https://publisher.com/images/news.jpg?x=1&y=2');
  assert.equal(imageUrl('https://publisher.com/assets/logo.png'), null);
  assert.equal(imageUrl('https://publisher.com/punchlogo.png'), null);
  assert.equal(imageUrl('https://publisher.com/common/google/GoogleDiscoverThumbnail_2026.jpg'), null);
  assert.equal(imageUrl('https://publisher.com/placeholder.jpg'), null);
  assert.equal(imageUrl('https://publisher.com/a.svg'), null);
  await assert.rejects(fetchThumbnailResource('https://publisher.com/', { method: 'POST', body: 'x' }));
});

test('socket DNS filter refuses loopback, private, link-local and IPv4-mapped IPv6 answers', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254',
    '100.64.0.1', '198.18.0.1', '192.0.2.2', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('OGP/Twitter extraction handles relative URLs, attribute order and entities without accepting script strings', () => {
  const html = `<head><script>const x='<meta property="og:image" content="https://bad.com/wrong.jpg">'</script>
    <meta content='/news.jpg?a=1&amp;b=2' property='og:image'>
    <meta name="twitter:image" content="https://cdn.publisher.com/news.webp"></head>`;
  assert.deepEqual(pageThumbnails(html, picture.pageUrl).map((a) => a.url),
    ['https://publisher.example.com/news.jpg?a=1&b=2', 'https://cdn.publisher.com/news.webp']);
  assert.deepEqual(pageThumbnails(html, 'https://news.google.com/rss/articles/abc'), []);
  assert.deepEqual(pageThumbnails('<meta property="og:image" content="/x.jpg"><meta property="og:image:width" content="1">', picture.pageUrl), []);
});

test('RSS/Atom thumbnails remain internal until verified, while video enclosures are rejected', () => {
  assert.equal(feedThumbnail('<enclosure url="https://cdn.publisher.com/a.mp4" type="video/mp4"/>', picture.pageUrl), null);
  const block = '<media:thumbnail url="https://cdn.publisher.com/a.jpg" width="640" height="480"/>';
  const rss = `<rss><channel><item><title>手話ニュース</title><link>${picture.pageUrl}</link>${block}</item></channel></rss>`;
  const atom = `<feed><entry><title>手話ニュース</title><link href="${picture.pageUrl}" rel="alternate"/>${block}</entry></feed>`;
  for (const xml of [rss, atom]) {
    const item = parseFeedEntries(xml, { sourceName: 'Publisher', sourceUrl: picture.pageUrl })[0];
    assert.equal(item._thumbnailCandidate.source, 'rss');
    assert.equal(stripInternal(item)._thumbnailCandidate, undefined);
    assert.equal(stripInternal(item).thumbnail, undefined);
  }
});

test('Google navigation requires the exact host, response tag and same publisher', () => {
  assert.equal(googleArticleId('https://news.google.com/rss/articles/ABC-_1?oc=5'), 'ABC-_1');
  assert.equal(googleArticleId('https://news.google.com.evil.com/rss/articles/ABC'), null);
  assert.equal(googleArticleId('https://news.google.com/search?q=ABC'), null);
  assert.equal(parseGoogleNavigation('bad data'), null);
  const rpc = JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', picture.pageUrl])]]);
  assert.equal(parseGoogleNavigation(")]}'\n\n" + rpc), picture.pageUrl);
  assert.equal(samePublisher('https://publisher.example.com.evil.com/a', picture.pageUrl), false);
  assert.equal(samePublisher('https://www.publisher.example.com/a', picture.pageUrl), true);
});

test('enrichment keeps article identity/text/order and caches both images and misses', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'deafnavi-thumbnails-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cacheFile = join(dir, 'cache.json');
  const articles = [article(), article('https://publisher.example.com/without-image')];
  const before = structuredClone(articles);
  const calls = [];
  const fetchResource = async (url, options) => {
    calls.push([url, options.method]);
    if (options.method === 'HEAD') return response(url, '', 200, 'image/jpeg');
    return response(url, url.endsWith('/story') ? `<meta property="og:image" content="${picture.url}">` : '<title>No photo</title>');
  };
  const result = await enrichNewsThumbnails(articles, { cacheFile, fetchResource });
  assert.equal(result.acquired, 1);
  assert.equal(result.missing, 1);
  assert.deepEqual(articles[0].thumbnail, picture);
  assert.equal(articles[1].thumbnail, undefined);
  assert.deepEqual(articles.map(({ thumbnail, ...item }) => item), before);
  const second = structuredClone(before);
  const cached = await enrichNewsThumbnails(second, { cacheFile, fetchResource: () => { throw new Error('Must not fetch'); } });
  assert.equal(cached.cached, 2);
  assert.equal(cached.attempted, 0);
  assert.equal(calls.length, 3);
  assert.deepEqual(second, articles);
});

test('unavailable images and collection limits leave readable articles without unchecked image URLs', async () => {
  const articles = [article(), { ...article('https://publisher.example.com/next'), _thumbnailCandidate: { ...picture, source: 'rss' } }];
  const report = await enrichNewsThumbnails(articles, { maxArticles: 1,
    fetchResource: async (url, opts) => opts.method === 'HEAD' ? response(url, '', 404)
      : response(url, `<meta property="og:image" content="${picture.url}">`) });
  assert.equal(report.missing, 1);
  assert.equal(report.deferred, 1);
  assert.ok(articles.every((a) => !a.thumbnail));
  assert.ok(articles.every((a) => a.title === '手話ニュース'));
});

test('Google 429 stops further navigation lookups but still enriches direct publisher articles', async () => {
  const articles = [article('https://news.google.com/rss/articles/ABC'), article('https://news.google.com/rss/articles/DEF'), article()];
  const calls = [];
  const report = await enrichNewsThumbnails(articles, { googleIntervalMs: 0, fetchResource: async (url, opts) => {
    calls.push(url);
    if (url.includes('news.google.com')) return response(url, '', 429);
    if (opts.method === 'HEAD') return response(url, '', 200, 'image/jpeg');
    return response(url, `<meta property="og:image" content="${picture.url}">`);
  } });
  assert.equal(report.googleStopped, true);
  assert.equal(report.acquired, 1);
  assert.equal(report.deferred, 1);
  assert.equal(calls.filter((url) => url.includes('news.google.com')).length, 1);
});

test('transient failures retain verified pictures and retry after one day', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'deafnavi-thumbnails-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cacheFile = join(dir, 'cache.json');
  const now = Date.now();
  await writeFile(cacheFile, JSON.stringify({ entries: { [picture.pageUrl]: { checkedAt: new Date(now - 31 * 86400000).toISOString(), thumbnail: picture } } }));
  const articles = [article()];
  const report = await enrichNewsThumbnails(articles, { cacheFile, now, fetchResource: async () => { throw new Error('Timeout'); } });
  assert.equal(report.failed, 1);
  assert.deepEqual(articles[0].thumbnail, picture);
  const saved = JSON.parse(await readFile(cacheFile, 'utf8')).entries[picture.pageUrl];
  assert.equal(Date.parse(saved.retryAt), now + 86400000);
});

test('SSR renders optional, escaped, lazy pictures with dimensions and no referral information', () => {
  const html = renderArticleCard({ ...article(), thumbnail: { ...picture, url: picture.url + '?a=1&b="quoted"' } });
  assert.match(html, /class="card__thumbnail"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /width="112" height="84"/);
  assert.match(html, /&amp;b=/);
  assert.doesNotMatch(renderArticleCard(article()), /card__thumbnail/);
  assert.doesNotMatch(renderArticleCard({ ...article(), thumbnail: { url: 'javascript:alert(1)' } }), /card__thumbnail/);
});

test('browser helper removes failed SSR/client images and keeps the article container', async () => {
  const code = await readFile(new URL('../src/ui-controls.js', import.meta.url), 'utf8');
  const handlers = {};
  const broken = { complete: true, naturalWidth: 0, removed: false, remove() { this.removed = true; } };
  const document = { documentElement: {}, querySelector: () => null, querySelectorAll: () => [broken],
    addEventListener(name, fn) { handlers[name] = fn; },
    createElement() { return { classList: { contains: () => true }, removed: false, addEventListener() {}, remove() { this.removed = true; } }; },
  };
  const window = {};
  runInNewContext(code, { document, window, navigator: {}, URL });
  assert.equal(broken.removed, true);
  const container = { textContent: '記事の見出しと要約', insertBefore(img) { this.img = img; } };
  window.DeafNaviThumbnails.append(container, picture.url);
  assert.equal(container.img.loading, 'lazy');
  assert.equal(container.img.referrerPolicy, 'no-referrer');
  handlers.error({ target: container.img });
  assert.equal(container.img.removed, true);
  assert.equal(container.textContent, '記事の見出しと要約');
  const empty = { insertBefore() { throw new Error('Invalid image inserted'); } };
  window.DeafNaviThumbnails.append(empty, 'javascript:alert(1)');
});
