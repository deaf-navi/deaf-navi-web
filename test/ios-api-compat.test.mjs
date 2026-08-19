/**
 * iOSアプリ互換 regression テスト。
 *
 * docs/app/v1/ の生成物が、出荷済みiOSアプリが依存する契約
 * （URL・キー・型・日付形式・カテゴリenum）を満たすことを検証する。
 * 契約の詳細は docs/architecture.md「iOS API 互換契約」を参照。
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const appDir = join(root, 'docs', 'app', 'v1');

const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const IOS_ARTICLE_KEYS = ['id', 'title', 'summary', 'url', 'publishedAt', 'sourceName', 'sourceURL', 'category'];
const LEGACY_CATEGORIES = new Set(['all', 'policy', 'medical', 'education', 'culture', 'sports', 'local', 'general']);
const V2_DOMESTIC_CATEGORIES = new Set(['policy', 'accessibility', 'relay', 'medical', 'education', 'technology', 'culture', 'sports', 'safety', 'event', 'local', 'general']);
const V2_WORLD_CATEGORIES = new Set(['accessibility', 'policy', 'medical', 'education', 'technology', 'culture', 'sports', 'safety', 'general']);

function readJson(file) {
  return JSON.parse(readFileSync(join(appDir, file), 'utf8'));
}

before(() => {
  // コミット済みの docs/articles*.json から再生成して検証する（ネットワーク不要）
  execFileSync(process.execPath, [join(root, 'src', 'app-api-build.mjs')], { stdio: 'pipe' });
});

function assertIosArray(file, categories) {
  const items = readJson(file);
  assert.ok(Array.isArray(items) && items.length > 0, `${file} が空です`);
  for (const item of items) {
    assert.deepEqual(Object.keys(item).filter((k) => item[k] !== undefined), Object.keys(item), `${file}: undefined値`);
    for (const key of IOS_ARTICLE_KEYS) {
      if (key === 'summary') continue; // summary は空文字許容（キー省略は不可 → compactObjectは空文字を保持）
      assert.ok(item[key] !== undefined && item[key] !== null, `${file}: ${key} 欠落 (${item.title})`);
    }
    assert.equal(Object.keys(item).length, IOS_ARTICLE_KEYS.length, `${file}: キー数が8ではありません`);
    assert.deepEqual(Object.keys(item), IOS_ARTICLE_KEYS, `${file}: キー順序が変わっています`);
    assert.match(item.publishedAt, ISO_SECONDS, `${file}: 日付形式（iso8601秒精度Z）違反: ${item.publishedAt}`);
    assert.ok(categories.has(item.category), `${file}: 不正カテゴリ ${item.category}`);
    assert.equal(item.id, item.url, `${file}: id と url は同一URLであるべき`);
  }
  return items;
}

test('ios-news-v1.json: 旧アプリ互換（8キー・legacyカテゴリ・relay除外）', () => {
  const items = assertIosArray('ios-news-v1.json', LEGACY_CATEGORIES);
  assert.ok(items.every((i) => i.category !== 'relay'));
});

test('ios-news-v2.json: 現行アプリ互換（12カテゴリ）', () => {
  assertIosArray('ios-news-v2.json', V2_DOMESTIC_CATEGORIES);
});

test('ios-world-jp-v1/v2, ios-world-original-v1/v2: World互換配列', () => {
  assertIosArray('ios-world-jp-v1.json', LEGACY_CATEGORIES);
  assertIosArray('ios-world-original-v1.json', LEGACY_CATEGORIES);
  assertIosArray('ios-world-jp-v2.json', V2_WORLD_CATEGORIES);
  assertIosArray('ios-world-original-v2.json', V2_WORLD_CATEGORIES);
});

test('domestic.json: richペイロードの互換フィールド', () => {
  const dom = readJson('domestic.json');
  assert.equal(dom.schemaVersion, 'deaf-navi-app-sync.v1');
  assert.equal(dom.feedId, 'deaf-navi-domestic');
  assert.match(dom.generatedAt, ISO_SECONDS);
  assert.equal(dom.display.excludedFromAll[0], 'relay');
  assert.equal(dom.display.categories.length, 13);
  const tiers = new Set(['official', 'specialist', 'news', 'broad']);
  for (const a of dom.articles) {
    assert.ok(a.stableId.startsWith('domestic_') && a.stableId.length === 'domestic_'.length + 20, `stableId形式: ${a.stableId}`);
    assert.ok(a.sourceURL !== undefined && a.sourceUrl !== undefined, 'sourceURL/sourceUrl 両方が必要');
    // 2.0追加のrichペイロード限定フィールド（アプリの選定区分バッジ・地域フィルタ用）
    assert.ok(tiers.has(a.sourceTier), `domestic.json に sourceTier が必要: ${a.sourceTier}`);
    assert.ok(['direct-feed', 'google-news'].includes(a.discoveryMethod), `discoveryMethod 不正: ${a.discoveryMethod}`);
    if (a.region !== undefined) assert.equal(typeof a.region, 'string');
  }
  assert.ok(dom.articles.some((a) => a.region), 'domestic.json に region 付き記事が1件もありません');
});

test('manifest.json と index.json は同一内容', () => {
  const manifest = readFileSync(join(appDir, 'manifest.json'), 'utf8');
  const index = readFileSync(join(appDir, 'index.json'), 'utf8');
  assert.equal(manifest, index);
});

test('manifest.json: 移転後のエンドポイントURLが固定されている', () => {
  const man = readJson('manifest.json');
  const base = 'https://deaf-navi.github.io/deaf-navi-web/app/v1/';
  assert.equal(man.endpoints.domestic.url, `${base}domestic.json`);
  assert.equal(man.endpoints.domestic.iosCompatibleUrl, `${base}ios-news-v2.json`);
  assert.equal(man.endpoints.domestic.legacyIosCompatibleUrl, `${base}ios-news-v1.json`);
  assert.equal(man.endpoints.worldJp.url, `${base}world-jp.json`);
  assert.equal(man.endpoints.worldOriginal.url, `${base}world-original.json`);
  assert.equal(man.endpoints.worldMultilingual.url, `${base}world-multilingual.json`);
});

test('world-jp.json: モード別スキーマ（original/translation構造）', () => {
  const jp = readJson('world-jp.json');
  const original = readJson('world-original.json');
  const multi = readJson('world-multilingual.json');
  assert.equal(jp.language, 'ja-JP');
  assert.equal(original.language, 'und');
  assert.equal(multi.language, 'ja-JP');
  assert.equal(multi.articles[0].defaultLocale, 'ja-JP');
  const jpArticle = jp.articles[0];
  assert.ok(jpArticle.original && jpArticle.translation, 'world-jp は original + translation を持つ');
  const origArticle = original.articles[0];
  assert.ok(origArticle.translated, 'world-original は translated を持つ');
  const multiArticle = multi.articles[0];
  assert.ok(multiArticle.localized?.ja && multiArticle.localized?.original, 'multilingual は localized.{ja,original} を持つ');
});
