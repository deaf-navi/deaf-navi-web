import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationCache, assertJapaneseTranslations } from '../src/lib/world-translation.mjs';
import { retryCandidates, settleTranslations } from '../src/lib/world-pending.mjs';
import { applyTranslations } from '../src/world-curate.mjs';

const now = Date.parse('2026-09-09T00:00:00Z');
const source = (id) => ({ id, originalTitle: `Title ${id}`, originalSummary: `Summary ${id}`, publishedAt: new Date(now).toISOString() });
const translated = (id) => ({ ...source(id), title: `記事${id}`, summary: `要約です${id}` });
const options = { cache: createTranslationCache([], 'test'), postEdit: async () => ({ enabled: false }), pause: async () => {}, allowPartial: true };

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
