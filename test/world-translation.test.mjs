import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTranslationCache, isWeakJapaneseTranslation, assertJapaneseTranslations, translateBatch } from '../src/lib/world-translation.mjs';
import { applyTranslations } from '../src/world-curate.mjs';

const source = { originalTitle: 'Deaf students', originalSummary: 'Sign language in schools' };
const noPostEdit = async () => ({ enabled: false });
const noPause = async () => {};
const response = (text) => new Response(JSON.stringify([[[text]]]), { status: 200 });

test('Japanese cache rejects fallback prefixes and unchanged foreign scripts', () => {
  for (const original of ['Deaf students', '天安手語通譯', '수어통역사', 'لغة الإشارة']) {
    assert.equal(isWeakJapaneseTranslation(original, original), true);
    assert.equal(isWeakJapaneseTranslation(original, `海外メディアの記事: ${original}`), true);
  }
  assert.equal(isWeakJapaneseTranslation('手話を学ぶ', '手話を学ぶ'), false);
  const cache = createTranslationCache([{ ...source, title: '海外メディアの記事: Deaf students', summary: '学校での手話', japanesePostEditProvider: 'test' }], 'test');
  assert.equal(cache.text.has(source.originalTitle), false);
  assert.equal(cache.text.get(source.originalSummary), '学校での手話');
  assert.equal(cache.articles.size, 0, 'invalid post-edited entries must also be retried');
});

test('429 honors Retry-After and retries to a validated translation', async () => {
  let calls = 0;
  const delays = [];
  const result = await translateBatch(['Deaf students'], {
    fetchImpl: async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '3' } }) : response('ろう学生'),
    sleep: async (ms) => delays.push(ms),
  });
  assert.deepEqual(result, ['ろう学生']);
  assert.deepEqual(delays, [3000]);
  assert.equal(calls, 2);
});

test('persistent 429 is bounded and never fans out into more requests', async () => {
  let calls = 0;
  await assert.rejects(translateBatch(['First', 'Second'], {
    fetchImpl: async () => { calls++; return new Response('', { status: 429 }); }, sleep: noPause,
  }), /HTTP 429/);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(translateBatch(['First'], {
    fetchImpl: async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); }, sleep: noPause,
  }), /HTTP 429/);
  assert.equal(calls, 1, 'defer a long cooldown to the next scheduled run');
});

test('transient network/5xx failures retry; permanent HTTP failures stop', async () => {
  let calls = 0;
  assert.deepEqual(await translateBatch(['Deaf students'], {
    fetchImpl: async () => {
      calls++;
      if (calls === 1) throw new TypeError('network error');
      return calls === 2 ? new Response('', { status: 503 }) : response('ろう学生');
    }, sleep: noPause,
  }), ['ろう学生']);
  calls = 0;
  await assert.rejects(translateBatch(['Deaf students'], {
    fetchImpl: async () => { calls++; return new Response('', { status: 403 }); }, sleep: noPause,
  }), /HTTP 403/);
  assert.equal(calls, 1);
});

test('damaged batch separators fall back to smaller batches in source order', async () => {
  const input = [];
  const translated = await translateBatch(['Deaf students', 'Sign language'], {
    fetchImpl: async (url) => {
      const q = new URL(url).searchParams.get('q');
      input.push(q);
      return response(q.includes('<<<') ? 'ろう学生 手話' : q === 'Deaf students' ? 'ろう学生' : '手話');
    }, sleep: noPause,
  });
  assert.deepEqual(translated, ['ろう学生', '手話']);
  assert.equal(input.length, 3);
});

test('unchanged text returned with HTTP 200 is not treated as successful translation', async () => {
  await assert.rejects(translateBatch(['Deaf students'], { fetchImpl: async () => response('Deaf students'), sleep: noPause }), /untranslated/);
});

test('cached Japanese is reused while the failed field is translated again', async () => {
  const articles = [{ ...source }];
  const cache = createTranslationCache([{ ...source, title: '海外メディアの記事: Deaf students', summary: '学校での手話' }], 'test');
  let requested;
  await applyTranslations(articles, { cache, translate: async (texts) => { requested = texts; return ['ろう学生']; }, postEdit: noPostEdit, pause: noPause });
  assert.deepEqual(requested, ['Deaf students']);
  assert.equal(articles[0].title, 'ろう学生');
  assert.equal(articles[0].summary, '学校での手話');
  assert.deepEqual(Object.fromEntries(Object.entries(articles[0]).filter(([k]) => k.startsWith('original'))), source);
});

test('translation plus post-edit outage blocks writing a new snapshot', async () => {
  const file = new URL('../docs/articles-world.json', import.meta.url);
  const before = await readFile(file);
  await assert.rejects(applyTranslations([{ ...source }], {
    cache: createTranslationCache([], 'test'), translate: async () => { throw new Error('translate HTTP 429'); }, postEdit: noPostEdit, pause: noPause,
  }), /keep the previous published snapshot/);
  assert.deepEqual(await readFile(file), before);
});

test('optional post-edit may repair a failed translation before publication', async () => {
  const articles = [{ ...source }];
  await applyTranslations(articles, {
    cache: createTranslationCache([], 'test'), translate: async () => { throw new Error('translate HTTP 429'); }, pause: noPause,
    postEdit: async (items) => { items[0].title = 'ろう学生'; items[0].summary = '学校での手話'; return { enabled: true }; },
  });
  assert.doesNotThrow(() => assertJapaneseTranslations(articles));
});

test('publication validation covers every article including after item 50', () => {
  const articles = Array.from({ length: 60 }, () => ({ ...source, title: 'ろう学生', summary: '学校での手話' }));
  articles[59].summary = '海外メディアの記事: Sign language in schools';
  assert.throws(() => assertJapaneseTranslations(articles), /1\/60 untranslated/);
});
