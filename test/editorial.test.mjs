import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialSource, extractEditorialArticle, updateEditorial } from '../src/lib/editorial-update.mjs';
import { selectEditorialNotes } from '../src/lib/editorial.mjs';
import { fetchThumbnailResource } from '../src/lib/thumbnail-fetch.mjs';
import { renderHomePage } from '../src/templates/home.mjs';

const now = Date.parse('2026-10-16T00:00:00Z');
const article = { id: 'https://www.sapporo-deaf.jp/information/test/', title: '市民向け手話講座のご案内',
  sourceTier: 'official', publishedAt: '2026-10-13T04:09:12Z' };
const excerpt = '札幌市では、市民を対象とした手話の体験講座を開催いたします。挨拶と自己紹介をしてみましょう！';
const html = '<nav>関係のない案内</nav><article><h1 class="main-content-title">' + article.title
  + '</h1><time class="entry-date" datetime="2026-10-13T13:09:12+09:00"></time>'
  + '<div class="entry-content"><div><p>' + excerpt + '</p></div></div></article>'
  + '<aside><p>記事の本文ではない段落です。</p></aside>';
const response = (text = html, extra = {}) => ({
  status: 200, url: article.id, headers: { 'content-type': 'text/html; charset=UTF-8' }, text, ...extra,
});
const update = (fetchResource, input = [article], at = now) => updateEditorial(input, { now: at, fetchResource });

test('editorial restricts exact sources, paths and redirects before contacting them', async () => {
  for (const url of ['http://www.jfd.or.jp/2026/10/11/pid1', 'https://www.jfd.or.jp.evil.com/2026/10/11/pid1',
    'https://user@www.jfd.or.jp/2026/10/11/pid1', 'https://www.jfd.or.jp/', 'https://127.0.0.1/information/a/',
    article.id + '?redirect=https://example.org']) assert.equal(editorialSource(url), null);
  assert.equal(editorialSource(article.id + '?utm_source=rss&#038;utm_medium=rss').url, article.id);
  await assert.rejects(fetchThumbnailResource(article.id, { allowUrl: () => false }), /Disallowed metadata destination/);
  const result = await update(async (url, options) => {
    assert.equal(url, article.id);
    assert.equal(options.allowUrl(article.id), true);
    assert.equal(options.allowUrl('https://www.sapporo-deaf.jp/information/different/'), false);
    assert.equal(options.allowUrl('https://127.0.0.1/'), false);
    return response();
  });
  assert.equal(result.notes.length, 1);
});

test('verified nested article body becomes one attributed unmodified excerpt', async () => {
  const result = await update(async () => response());
  assert.equal(result.notes[0].text, excerpt);
  assert.equal(result.notes[0].sourceName, '札幌聴覚障害者協会');
  assert.equal(result.notes[0].expiresAt, '2026-10-17T00:00:00.000Z');
  assert.match(result.notes[0].bodySha256, /^[a-f0-9]{64}$/);
  assert.equal(result.checks[0].reason, 'selected');
  assert.equal(selectEditorialNotes(result.notes, now).length, 1);
  assert.equal(selectEditorialNotes(result.notes, now + 86400000).length, 0);
});

test('RSS summaries and unverified metadata never substitute for actual text/date/title', async () => {
  for (const [text, reason] of [
    [html.replace(article.title, '別の記事'), 'title-mismatch'],
    [html.replace('2026-10-13T13:09:12', '2026-10-12T13:09:12'), 'publication-date-mismatch'],
    [html.replace('entry-content', 'unrecognized'), 'article-body-missing'],
    [html.replace(excerpt, '<img src="flyer.jpg">'), 'safe-excerpt-missing'],
    [html.replace(excerpt, '本文が短い。'), 'safe-excerpt-missing'],
    [html.replace(excerpt, 'あ'.repeat(200) + '。'), 'safe-excerpt-missing'],
    [html.replace(excerpt, '<table><tr><td><p>' + excerpt + '</p></td></tr></table>'), 'safe-excerpt-missing'],
    [html.replace(excerpt, '<script>' + excerpt + '</script>'), 'safe-excerpt-missing'],
    [html.replace(excerpt, excerpt + '当センター主催のイベントではありません。'), 'secondary-or-closed-notice'],
    [html.replace(excerpt, '募集終了。' + excerpt), 'secondary-or-closed-notice'],
  ]) {
    const result = await update(async () => response(text));
    assert.deepEqual(result.notes, [], reason);
    assert.equal(result.checks[0].reason, reason);
  }
});

test('fetch failures, non-HTML and redirected pages do not retain any previous note', async () => {
  for (const fetcher of [
    async () => { throw new Error('timeout'); },
    async () => response('', { status: 404 }),
    async () => response(html, { headers: { 'content-type': 'application/json' } }),
    async () => response(html, { url: 'https://example.org/' }),
  ]) assert.deepEqual((await update(fetcher)).notes, []);
});

test('blocked hosts are not retried and fresh supported candidates are bounded', async () => {
  let calls = 0;
  const articles = Array.from({ length: 10 }, (_, i) => ({ ...article, id: article.id.replace('test', 'test' + i) }));
  const blocked = await update(async () => { calls++; return response('', { status: 429 }); }, articles);
  assert.equal(calls, 1);
  assert.deepEqual(blocked.notes, []);
  calls = 0;
  await update(async () => { calls++; throw new Error('network'); }, articles);
  assert.equal(calls, 6);
});

test('unknown, future and old entries do not cause network requests; repeated checks cannot extend past seven days', async () => {
  const noFetch = async () => { throw new Error('must not fetch'); };
  for (const patch of [{ publishedAt: 'invalid' }, { publishedAt: '2026-11-01' },
    { publishedAt: '2026-10-01' }, { sourceTier: 'news' }, { id: 'https://example.org/' }]) {
    assert.equal((await update(noFetch, [{ ...article, ...patch }])).checks.length, 0);
  }
  const result = await update(async () => response(), [article], Date.parse('2026-10-19T12:00:00Z'));
  assert.equal(result.notes[0].expiresAt, '2026-10-19T15:00:00.000Z');
  assert.equal((await update(async () => response(), [article], Date.parse('2026-10-19T16:00:00Z'))).notes.length, 0);
  const tampered = { ...result.notes[0], expiresAt: '2026-10-20T12:00:00Z' };
  assert.equal(selectEditorialNotes([tampered], Date.parse('2026-10-19T12:00:00Z')).length, 0);
  assert.deepEqual(selectEditorialNotes(null), []);
  assert.deepEqual(selectEditorialNotes([null]), []);
});

test('JFD publication day and source body are required, not its header navigation', () => {
  const a = { ...article, id: 'https://www.jfd.or.jp/2026/10/13/pid123', title: '要望書を提出' };
  const source = editorialSource(a.id);
  const page = '<div id="content">案内<div id="post_123"><h3 class="title">' + a.title
    + '</h3><li>掲載日：2026/10/13</li><div class="content"><p>' + excerpt + '</p></div></div></div>';
  assert.equal(extractEditorialArticle(page, source, a).text, excerpt);
  assert.equal(extractEditorialArticle(page.replace('post_123', 'post_124'), source, a).reason, 'article-body-missing');
});

test('retained editorial snapshots are never rendered after feature removal', async () => {
  const { notes } = await update(async () => response());
  const data = { generatedAt: '2026-10-16', articles: [] };
  const options = { now, files: {}, editorialNotes: notes };
  const rendered = renderHomePage(data, options);
  assert.ok(!rendered.includes('id="editorial-note"'));
  assert.ok(!rendered.includes('一次情報から抜粋・自動更新'));
  assert.ok(!rendered.includes('「' + excerpt + '」'));
  assert.ok(!renderHomePage(data, { files: {}, now }).includes('id="editorial-note"'));
  assert.ok(!rendered.includes('Take it easy.'));
});
