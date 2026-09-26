import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationCache, assertJapaneseTranslations } from '../src/lib/world-translation.mjs';
import { retryCandidates, settleTranslations } from '../src/lib/world-pending.mjs';
import { applyTranslations } from '../src/world-curate.mjs';

const now = Date.parse('2026-09-09T00:00:00Z');
const source = (id) => ({ id, originalTitle: `Title ${id}`, originalSummary: `Summary ${id}`, publishedAt: new Date(now).toISOString() });
const translated = (id) => ({ ...source(id), title: `記事${id}`, summary: `要約です${id}` });
const options = { cache: createTranslationCache([], 'test'), postEdit: async () => ({ enabled: false }), pause: async () => {}, allowPartial: true };

async function configuredTranslator(t, enabled) {
  const config = { WORLD_JP_CODEX_POST_EDIT: enabled, CODEX_APP_SERVER_URL: 'https://codex.invalid', CODEX_APP_SERVER_READINESS_PATH: '/health' };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return (await import(`../src/world-curate.mjs?mode=${enabled}`)).applyTranslations;
}

test('default curation never calls Codex even when an endpoint exists', async (t) => {
  const apply = await configuredTranslator(t, undefined);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    if (String(url).startsWith('https://codex.invalid')) return new Response('', { status: 503 });
    return new Response(JSON.stringify([[['ろう学生の手話教育']]]));
  });
  const articles = [source('new')];
  const report = await apply(articles, { cache: createTranslationCache([], 'test'), pause: async () => {} });
  assert.equal(requests.filter((url) => url.startsWith('https://codex.invalid')).length, 0);
  assert.equal(report.enabled, false);
  assert.equal(report.fallback.requested, 2);
  assert.doesNotThrow(() => assertJapaneseTranslations(articles));
});

test('successful Google translation does not call even an enabled Codex endpoint', async (t) => {
  const apply = await configuredTranslator(t, '1');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    if (String(url) === 'https://codex.invalid/health') return new Response('', { status: 503 });
    assert.ok(String(url).startsWith('https://translate.googleapis.com/'));
    return new Response(JSON.stringify([[['ろう学生の手話教育']]]));
  });
  const articles = [source('new')];
  const report = await apply(articles, { cache: createTranslationCache([], 'test'), pause: async () => {}, allowPartial: true });
  const result = settleTranslations(articles, [translated('old')], [], { now, limit: 1 });
  assert.equal(requests.length, 2);
  assert.ok(requests.every((url) => url.startsWith('https://translate.googleapis.com/')));
  assert.equal(report.enabled, false);
  assert.equal(report.fallback.failures, 0);
  assert.equal(result.articles[0].id, 'new');
  assert.equal(result.pending.length, 0);
  assert.equal(result.retained, 0);
});

test('Google quota exhaustion invokes Codex only for missing translations', async (t) => {
  const apply = await configuredTranslator(t, '1');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    if (String(url).startsWith('https://translate.googleapis.com/')) return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ ok: true, provider: 'codex_app_server' }));
    assert.equal(String(url), 'https://codex.invalid/generate');
    return new Response(JSON.stringify({ success: true, items: [{ id: '0', title: '新しい手話教育', summary: 'ろう学生の手話教育を支援します' }] }));
  });
  const articles = [source('old'), source('new')];
  const report = await apply(articles, { cache: createTranslationCache([translated('old')], 'test'), pause: async () => {}, allowPartial: true });
  assert.equal(requests.length, 3);
  assert.ok(requests[0].startsWith('https://translate.googleapis.com/'));
  assert.equal(report.updated, 1);
  assert.equal(report.checked, 1);
  assert.equal(report.fallback.failures, 1);
  assert.equal(articles[0].title, '記事old');
  assert.equal(articles[1].title, '新しい手話教育');
  assert.doesNotThrow(() => assertJapaneseTranslations(articles));
});

test('actual Google and optional Codex outage retains prior publication and queues new articles', async (t) => {
  const apply = await configuredTranslator(t, '1');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    if (String(url).startsWith('https://translate.googleapis.com/')) return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
    assert.equal(String(url), 'https://codex.invalid/health');
    return new Response('', { status: 503 });
  });
  const articles = [source('new')];
  const report = await apply(articles, { cache: createTranslationCache([], 'test'), pause: async () => {}, allowPartial: true });
  const result = settleTranslations(articles, [translated('old')], [], { now, limit: 1 });
  assert.equal(requests.length, 2);
  assert.equal(report.enabled, false);
  assert.equal(result.articles[0].id, 'old');
  assert.equal(result.pending.length, 1);
  assert.equal(result.retained, 1);
});

test('a bad field does not discard a successful sibling article or partial translation', async () => {
  const items = [source('a'), source('b')];
  await applyTranslations(items, { ...options, translate: async ([text]) => {
    if (text === 'Summary b') throw new Error('malformed result');
    return [`日本語${text}`];
  } });
  const result = settleTranslations(items, [translated('old')], [], { now, limit: 2 });
  assert.deepEqual(result.articles.map((a) => a.id), ['a', 'old']);
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].article.title, '日本語Title b');
  assert.equal(result.pending[0].article.originalSummary, 'Summary b');
  assert.doesNotThrow(() => assertJapaneseTranslations(result.articles));

  const next = retryCandidates([source('a')], result.pending, now + 6 * 3600000);
  const requests = [];
  await applyTranslations(next.candidates, { ...options,
    cache: createTranslationCache([...result.pending.map((e) => e.article), ...result.articles], 'test'),
    translate: async ([text]) => { requests.push(text); return ['再試行で訳せた要約です']; },
  });
  assert.deepEqual(requests, ['Summary b']);
  assert.equal(settleTranslations(next.candidates, result.articles, next.active, { now }).pending.length, 0);
});

test('provider outage opens a circuit and retains every prior validated article', async () => {
  const previous = [translated('old1'), translated('old2')];
  const items = [source('a'), source('b')];
  let calls = 0;
  await applyTranslations(items, { ...options, translate: async () => { calls++; throw Object.assign(new Error('translate HTTP 429'), { status: 429 }); } });
  const result = settleTranslations(items, previous, [], { now, limit: 2 });
  assert.equal(calls, 1);
  assert.deepEqual(result.articles, previous);
  assert.equal(result.pending.length, 2);
  assert.equal(result.retained, 2);
});

test('direct Codex translation avoids Google requests and preserves originals', async () => {
  const items = [source('a')];
  const original = { ...items[0] };
  await applyTranslations(items, { ...options,
    fallbackOnly: false,
    postEdit: async (articles) => { articles[0].title = '新しい記事'; articles[0].summary = '日本語に翻訳した要約です'; return { enabled: true }; },
    translate: async () => { throw new Error('Google must not be called'); },
  });
  assert.equal(items[0].originalTitle, original.originalTitle);
  assert.equal(items[0].originalSummary, original.originalSummary);
  assert.doesNotThrow(() => assertJapaneseTranslations(items));
});

test('retry queue expires unselected old entries and does not duplicate freshly selected sources', () => {
  const entries = [
    { article: source('a'), firstSeenAt: new Date(now - 3600000).toISOString() },
    { article: source('expired'), firstSeenAt: new Date(now - 15 * 86400000).toISOString() },
  ];
  const result = retryCandidates([source('a')], entries, now);
  assert.deepEqual(result.candidates.map((a) => a.id), ['a']);
  assert.equal(result.active.length, 1);
});
