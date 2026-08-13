import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTitleKey } from '../src/lib/text.mjs';
import {
  buildArticle,
  classifyCategory,
  curateArticles,
  dedupeNearArticles,
  detectRegion,
  hasAcceptablePublishedAt,
  inferDiscoverySourceTier,
  isNearDuplicate,
  scoreArticle,
  splitVisibleArticles,
  stripInternal,
  QUALITY_VERSION,
} from '../src/lib/curation.mjs';

/* ---------- カテゴリ分類（判定順が仕様） ---------- */

test('classifyCategory: relay が最優先', () => {
  assert.equal(classifyCategory('電話リレーサービスの防災訓練', ''), 'relay');
});

test('classifyCategory: culture は sports より先（デフリンピック文化プログラム）', () => {
  assert.equal(classifyCategory('デフリンピック文化プログラムの公演情報', ''), 'culture');
  assert.equal(classifyCategory('デフリンピック陸上で金メダル', ''), 'sports');
});

test('classifyCategory: 各カテゴリの代表例', () => {
  assert.equal(classifyCategory('ろう映画の上映が決定', ''), 'culture');
  assert.equal(classifyCategory('AI字幕サービスが登場', ''), 'technology');
  assert.equal(classifyCategory('台風接近に伴う避難情報', ''), 'safety');
  assert.equal(classifyCategory('手話通訳者を配置', ''), 'accessibility');
  assert.equal(classifyCategory('手話講座の受講者募集', ''), 'event');
  assert.equal(classifyCategory('障害者雇用の助成制度', ''), 'policy');
  assert.equal(classifyCategory('人工内耳の手術', ''), 'medical');
  assert.equal(classifyCategory('ろう学校の入試日程', ''), 'education');
  assert.equal(classifyCategory('全く関係ない話題', ''), 'general');
});

/* ---------- 地域検出（2.0新機能） ---------- */

test('detectRegion: 都道府県名と主要都市名を検出する', () => {
  assert.deepEqual(detectRegion('札幌で手話講座', ''), { region: 'hokkaido_tohoku', prefecture: '北海道' });
  assert.deepEqual(detectRegion('東京都の情報保障', ''), { region: 'kanto', prefecture: '東京都' });
  assert.deepEqual(detectRegion('大阪市の相談会', ''), { region: 'kinki', prefecture: '大阪府' });
  assert.equal(detectRegion('全国的な制度改正', ''), null);
});

/* ---------- スコアリング・情報源 ---------- */

test('scoreArticle: 関連語と情報源区分で加点される', () => {
  const official = scoreArticle({ title: '手話通訳の情報保障', summary: '', sourceUrl: 'https://x.go.jp/', _sourceTier: 'official' });
  const unknown = scoreArticle({ title: '手話通訳の情報保障', summary: '', sourceUrl: 'https://x.example/', _sourceTier: 'google' });
  assert.ok(official.score > unknown.score);
  assert.ok(official.signals.includes('手話通訳'));
});

test('inferDiscoverySourceTier: go.jp は official、PR系は broad', () => {
  assert.equal(inferDiscoverySourceTier('厚労省', 'https://www.mhlw.go.jp/'), 'official');
  assert.equal(inferDiscoverySourceTier('PR TIMES', 'https://prtimes.jp/'), 'broad');
  assert.equal(inferDiscoverySourceTier('一般ニュース', 'https://news.example.com/'), 'google');
});

/* ---------- 重複除去 ---------- */

test('isNearDuplicate: 数字が違う記事は重複としない', () => {
  const a = { id: 'u1', title: '第3回手話講座のお知らせ', _dedupeKey: '第3回手話講座のお知らせ' };
  const b = { id: 'u2', title: '第4回手話講座のお知らせ', _dedupeKey: '第4回手話講座のお知らせ' };
  assert.equal(isNearDuplicate(a, b), false);
});

test('dedupeNearArticles: 同一タイトル（媒体名サフィックス違い）は優先度の高い情報源が残る', () => {
  const base = { summary: '', publishedAt: '2026-08-10T00:00:00Z', sourceType: 'rss', curationScore: 10 };
  const titleA = 'デフリンピック日本代表選手団が決定 - まとめサイト';
  const titleB = 'デフリンピック日本代表選手団が決定 - NHK';
  const items = [
    { ...base, id: 'u1', title: titleA, _dedupeKey: normalizeTitleKey(titleA), sourceName: 'まとめサイト', sourceUrl: 'https://a.example/', _sourceTier: 'google' },
    { ...base, id: 'u2', title: titleB, _dedupeKey: normalizeTitleKey(titleB), sourceName: 'NHKニュース', sourceUrl: 'https://nhk.example/', _sourceTier: 'google' },
  ];
  const { articles, duplicates } = dedupeNearArticles(items);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].sourceName, 'NHKニュース');
  assert.equal(duplicates.length, 1);
});

test('dedupeNearArticles: 類似度がしきい値(0.94)未満なら別記事として残す', () => {
  const base = { summary: '', publishedAt: '2026-08-10T00:00:00Z', sourceType: 'rss', curationScore: 10 };
  const items = [
    { ...base, id: 'u1', title: 'デフリンピック代表選手が決定した', _dedupeKey: normalizeTitleKey('デフリンピック代表選手が決定した'), sourceName: 'A', sourceUrl: 'https://a.example/', _sourceTier: 'google' },
    { ...base, id: 'u2', title: 'デフリンピック代表選手が決定', _dedupeKey: normalizeTitleKey('デフリンピック代表選手が決定'), sourceName: 'B', sourceUrl: 'https://b.example/', _sourceTier: 'google' },
  ];
  const { articles } = dedupeNearArticles(items);
  assert.equal(articles.length, 2);
});

/* ---------- 鮮度・選定 ---------- */

test('hasAcceptablePublishedAt: 181日前・日付なしは不可、未来24時間は許容', () => {
  const now = Date.parse('2026-08-12T00:00:00Z');
  assert.equal(hasAcceptablePublishedAt({ publishedAt: '2026-08-01T00:00:00Z' }, now), true);
  assert.equal(hasAcceptablePublishedAt({ publishedAt: '2025-08-01T00:00:00Z' }, now), false);
  assert.equal(hasAcceptablePublishedAt({ publishedAt: null }, now), false);
  assert.equal(hasAcceptablePublishedAt({ publishedAt: '2026-08-12T12:00:00Z' }, now), true);
});

test('splitVisibleArticles: relay は400件制限の対象外', () => {
  const articles = [];
  for (let i = 0; i < 405; i++) {
    articles.push({ id: `p${i}`, category: 'general', publishedAt: '2026-08-10T00:00:00Z' });
  }
  articles.push({ id: 'r1', category: 'relay', publishedAt: '2026-08-10T00:00:00Z' });
  const { primaryArticles, extraArticles, overflowArticles } = splitVisibleArticles(articles);
  assert.equal(primaryArticles.length, 400);
  assert.equal(extraArticles.length, 1);
  assert.equal(overflowArticles.length, 5);
});

/* ---------- パイプライン統合 ---------- */

function entry(overrides) {
  return {
    id: 'https://example.com/' + Math.random().toString(36).slice(2),
    title: '手話通訳と情報保障の取り組み',
    summary: '聴覚障害者向けの手話通訳配置について',
    sourceName: 'テスト新聞',
    sourceUrl: 'https://test.example/',
    publishedAt: '2026-08-10T00:00:00.000Z',
    sourceType: 'rss',
    ...overrides,
  };
}

test('curateArticles: 日付なし記事は除外され件数がレポートされる', () => {
  const now = Date.parse('2026-08-12T00:00:00Z');
  const articles = [
    buildArticle(entry({ title: '手話通訳の情報保障ニュース1' })),
    buildArticle(entry({ title: '補聴器の医療費控除が拡大', publishedAt: null })),
  ];
  const { articles: visible, report } = curateArticles(articles, {}, now);
  assert.equal(report.version, QUALITY_VERSION);
  assert.equal(report.missingDateRemoved, 1);
  assert.equal(visible.length, 1);
});

test('curateArticles: passThrough は低スコアでも通過する', () => {
  const now = Date.parse('2026-08-12T00:00:00Z');
  const feedDef = { sourceTier: 'specialist', passThrough: true, url: 'https://feed.example/' };
  const lowScore = buildArticle(entry({ title: '定例会報告', summary: '' }), feedDef);
  const { articles: visible } = curateArticles([lowScore], {}, now);
  assert.equal(visible.length, 1);
});

test('stripInternal: 内部フィールドを除去し公開スキーマへ整形する', () => {
  const article = buildArticle(entry({ title: '東京都で手話講座' }), { sourceTier: 'official', url: 'https://feed.example/' });
  article.curationScore = 12;
  article.curationSignals = ['手話'];
  article._dedupeKey = 'x';
  const clean = stripInternal(article);
  assert.equal(clean._sourceTier, undefined);
  assert.equal(clean._dedupeKey, undefined);
  assert.equal(clean.curationScore, undefined);
  assert.equal(clean.sourceTier, 'official');
  assert.equal(clean.discoveryMethod, 'direct-feed');
  assert.equal(clean.prefecture, '東京都');
});
