import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDomesticPublication, prepareWorldPublication } from '../src/lib/publication-quality.mjs';
import { publicationExclusionReason, detectRegion, isNearDuplicate } from '../src/lib/curation.mjs';
import { cleanArticleTitle, cleanSummaryText, normalizeTitleKey } from '../src/lib/text.mjs';
import { selectEditorialNotes } from '../src/lib/editorial.mjs';
import { hasMistranslatedLibras, createTranslationCache } from '../src/lib/world-translation.mjs';
import { isHardNoiseWorldText } from '../src/lib/world-relevance.mjs';

test('regional matching prefers complete city names and leaves ambiguous locations unset', () => {
  assert.deepEqual(detectRegion('大津市の手話イベント', ''), { region: 'kinki', prefecture: '滋賀県' });
  assert.deepEqual(detectRegion('津市の手話教室', ''), { region: 'kinki', prefecture: '三重県' });
  assert.equal(detectRegion('草津市の講座', ''), null);
  assert.deepEqual(detectRegion('滋賀県大津市で開催', '東京都の団体も参加'), { region: 'kinki', prefecture: '滋賀県' });
  assert.equal(detectRegion('東京都と大阪府で開催', ''), null);
});

test('publication gate rejects placeholders even from trusted feeds, but retains community notices and useful technology', () => {
  assert.equal(publicationExclusionReason({ title: '工事中', _passThrough: true }), 'placeholder');
  assert.equal(publicationExclusionReason({ title: '消防職員の水泳指導', summary: '', _sourceTier: 'official' }), 'unrelated');
  assert.equal(publicationExclusionReason({ title: 'デフレ対策の講演会', summary: '' }), 'unrelated');
  assert.equal(publicationExclusionReason({ title: '定例会報告', _passThrough: true }), null);
  assert.equal(publicationExclusionReason({ title: '社会生活教室', _sourceTier: 'official', _feedUrl: 'https://example.org/feed' }), null);
  for (const title of ['サインエールの受賞', 'みみカレッジ2026', '音声認識でライブ字幕を表示', '日本語字幕付き上映', 'UDCast対応']) {
    assert.equal(publicationExclusionReason({ title, summary: '' }), null, title);
  }
  assert.equal(publicationExclusionReason({ title: '補聴器の世界市場規模・予測レポート' }), 'market-report');
});

test('syndicated titles are cleaned without deleting meaningful parenthetical text; distinct events remain', () => {
  assert.equal(cleanSummaryText('NPRの番組が聴力の課題を扱う', 'NPRの番組が聴力の課題を扱う', 'NPR'), '');
  assert.equal(cleanArticleTitle('手話の集い（共同通信） - Yahoo!ニュース', 'Yahoo!ニュース'), '手話の集い');
  assert.equal(cleanArticleTitle('手話の集い（大阪会場）'), '手話の集い（大阪会場）');
  const a = { id: 'a', title: '手話の集い', _dedupeKey: normalizeTitleKey('手話の集い'), publishedAt: '2026-10-01' };
  assert.equal(isNearDuplicate(a, { ...a, id: 'b', publishedAt: '2026-10-10' }), false);
  assert.equal(isNearDuplicate({ ...a, prefecture: '大阪府' }, { ...a, id: 'b', prefecture: '京都府' }), false);
});

test('saved domestic snapshots are rechecked idempotently with retained IDs and dates', () => {
  const articles = [
    { id: 'https://example.org/a', title: '工事中', sourceName: '全日本ろうあ連盟', sourceTier: 'official', publishedAt: '2026-10-15T00:00:00Z' },
    { id: 'https://example.org/b', title: '大津市の手話講座', summary: '', sourceName: '地域新聞', sourceTier: 'news', region: 'chubu', prefecture: '三重県', publishedAt: '2026-10-15T00:00:00Z' },
  ];
  const before = { generatedAt: '2026-10-16T00:00:00Z', count: 2, articles };
  const after = prepareDomesticPublication(before);
  assert.equal(before.articles.length, 2);
  assert.equal(after.count, 1);
  assert.equal(after.generatedAt, before.generatedAt);
  assert.equal(after.articles[0].id, articles[1].id);
  assert.equal(after.articles[0].prefecture, '滋賀県');
  assert.equal(after.publicationReview.removed[0].reason, 'placeholder');
  assert.equal(prepareDomesticPublication(after), after);
});

test('World distinguishes entertainment headphones from Bluetooth hearing aids', () => {
  assert.equal(isHardNoiseWorldText('Audífonos para gaming con cancelación de ruido'), true);
  assert.equal(isHardNoiseWorldText('Audífonos Bluetooth para personas con pérdida auditiva'), false);
  assert.equal(isHardNoiseWorldText('Audífonos Bluetooth'), false);
});

test('Libras mistranslations are not reused in translation caches or published snapshots', () => {
  const article = { id: 'a', originalTitle: 'Homem surdo ensina Libras', originalSummary: 'Homem surdo ensina Libras', title: 'ろう者が天秤座を教える', summary: 'ろう者が天秤座を教える', curationScore: 12 };
  assert.equal(hasMistranslatedLibras(article.originalTitle, article.title), true);
  assert.equal(hasMistranslatedLibras('Libras esterlinas na educação', '教育分野の英ポンド'), false);
  assert.equal(createTranslationCache([article]).articles.size, 0);
  const result = prepareWorldPublication({ articles: [article], count: 1 });
  assert.equal(result.count, 0);
  assert.equal(result.publicationReview.removed[0].reason, 'translation-review');
  assert.equal(prepareWorldPublication(result), result);
});

test('editorial requires a valid source and finite review window; expired/future notes do not publish', () => {
  const note = { id: 'a', title: '見出し', text: '本文', sourceName: '公式', sourceUrl: 'https://example.org/news', reviewedAt: '2026-10-16T00:00:00Z', expiresAt: '2026-10-23T00:00:00Z' };
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-16')).length, 1);
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-23')).length, 0);
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-15')).length, 0);
  assert.equal(selectEditorialNotes([{ ...note, sourceUrl: 'javascript:alert(1)' }], Date.parse('2026-10-17')).length, 0);
  assert.equal(selectEditorialNotes([{ ...note, expiresAt: '2027-10-23' }], Date.parse('2026-10-17')).length, 0);
});
