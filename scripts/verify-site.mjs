/**
 * サイト静的検証（publish 前の品質ゲート）。
 *
 * `npm run generate`（curate → build → verify）の最終段で実行され、
 * ここで失敗すると Actions はコミットせずに停止する。
 *
 * 方針:
 * - データ（articles.json）は iOS 連携の入力になるためスキーマを厳格に検証する
 * - HTML は「存在すべき主要UI・SEO要素」をマーカーで検証する
 * - 掲載内容そのもの（ガイドの件数・文言）は guide-data.mjs から導出し、
 *   データ更新のたびに verify を書き換えなくて済むようにする（fail-soft設計）
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { GUIDE_SECTIONS } from '../src/guide-data.mjs';
import { QUALITY_VERSION } from '../src/lib/curation.mjs';
import { REGION_ORDER } from '../config/regions.mjs';
import { CATEGORY_UI } from '../config/categories.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');
const allowedSourceTiers = new Set(['official', 'specialist', 'news', 'broad']);
const allowedCategories = new Set(Object.keys(CATEGORY_UI));
const allowedRegions = new Set(REGION_ORDER);
const maxAgeMs = 181 * 86_400_000;

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`✗ ${message}`);
  }
}

async function fileExists(file) {
  try {
    await stat(join(docs, file));
    return true;
  } catch {
    return false;
  }
}

const [dataRaw, indexHtml, worldJpHtml, worldOriginalHtml, guideHtml, aboutHtml, sitemapXml, oldIndexHtml, uiControlsJs] = await Promise.all([
  readFile(join(docs, 'articles.json'), 'utf8'),
  readFile(join(docs, 'index.html'), 'utf8'),
  readFile(join(docs, 'deaf-navi-world-jp.html'), 'utf8'),
  readFile(join(docs, 'deaf-navi-world-original.html'), 'utf8'),
  readFile(join(docs, 'guide.html'), 'utf8'),
  readFile(join(docs, 'about.html'), 'utf8'),
  readFile(join(docs, 'sitemap.xml'), 'utf8'),
  readFile(join(docs, 'index-old.html'), 'utf8'),
  readFile(join(docs, 'ui-controls.js'), 'utf8'),
]);

/* ---------- articles.json（iOS連携の入力スキーマ） ---------- */

const data = JSON.parse(dataRaw);
assert(Array.isArray(data.articles) && data.articles.length > 0, 'articles.json に記事がありません。');
assert(data.quality?.version === QUALITY_VERSION, `キュレーション品質バージョンが ${QUALITY_VERSION} ではありません: ${data.quality?.version}`);
assert(typeof data.generatedAt === 'string' && Number.isFinite(new Date(data.generatedAt).getTime()), 'generatedAt が不正です。');

// 鮮度は「生成時点」を基準に検証する（CIで過去データを検証しても壊れないように）
const now = Number.isFinite(new Date(data.generatedAt).getTime()) ? new Date(data.generatedAt).getTime() : Date.now();

const ids = new Set();
for (const article of data.articles) {
  assert(article.id && article.title && article.sourceName, `必須フィールドがない記事があります: ${article.title ?? article.id ?? '(不明)'}`);
  assert(/^https?:\/\//.test(article.id), `記事URLが不正です: ${article.id}`);
  assert(/^https?:\/\//.test(article.sourceUrl ?? ''), `情報源URLが不正です: ${article.sourceName}`);
  assert(allowedSourceTiers.has(article.sourceTier), `不明な sourceTier: ${article.sourceTier}（${article.title}）`);
  assert(allowedCategories.has(article.category), `不明なカテゴリ: ${article.category}（${article.title}）`);
  assert(['direct-feed', 'google-news'].includes(article.discoveryMethod), `不明な discoveryMethod: ${article.discoveryMethod}`);
  if (article.region !== undefined) {
    assert(allowedRegions.has(article.region), `不明な地域: ${article.region}（${article.title}）`);
  }
  assert(!ids.has(article.id), `重複URLがあります: ${article.id}`);
  ids.add(article.id);

  const publishedAt = new Date(article.publishedAt).getTime();
  assert(Number.isFinite(publishedAt), `公開日時が不正です: ${article.title}`);
  assert(now - publishedAt <= maxAgeMs, `最新一覧に古すぎる記事があります: ${article.title}`);
  assert(
    !/(?:\d+\s*枚目の)?(?:写真・画像|写真一覧|画像一覧)|フォトギャラリー/iu.test(article.title),
    `写真一覧ページが混入しています: ${article.title}`,
  );
}

assert(
  data.articles.some((article) => article.sourceTier === 'official' && article.discoveryMethod === 'google-news'),
  'Google News経由の一次情報が正しく分類されていません。',
);

/* ---------- index.html（主要UI・SEO） ---------- */

for (const marker of [
  'id="news-search"',
  'id="source-filter"',
  'id="period-filter"',
  'id="region-filter"',
  'id="card-template"',
  'id="filter-reset"',
  'data-source-tier=',
  'class="quick-access"',
  'SearchAction',
  'rel="canonical"',
  'rel="manifest"',
  'class="skip-link"',
  'id="theme-toggle"',
  'id="font-toggle"',
  'apple-touch-icon',
  'og-image.png',
]) {
  assert(indexHtml.includes(marker), `index.html に ${marker} がありません。`);
}

/* ---------- World ページ（互換導線） ---------- */

assert(worldJpHtml.includes('class="world-home-link"'), 'World-JP に国内版への導線がありません。');
assert(worldJpHtml.includes('href="./guide.html"'), 'World-JP に暮らしのガイドへの導線がありません。');
assert(worldOriginalHtml.includes('href="./guide.html"'), 'World-Original にGuideへの導線がありません。');

/* ---------- About / ガイド（データから導出して検証） ---------- */

assert(aboutHtml.includes('id="about-policy"'), 'About に選定方針がありません。');
assert(aboutHtml.includes('Deaf Navi Web 2.0'), 'About に 2.0 の更新履歴がありません。');
assert(guideHtml.includes('id="guide-search"'), '暮らしのガイドに検索欄がありません。');

const expectedGuideItems = GUIDE_SECTIONS.reduce((total, section) => total + section.items.length, 0);
const actualGuideItems = (guideHtml.match(/data-guide-item/g) ?? []).length;
assert(actualGuideItems === expectedGuideItems, `暮らしのガイドが ${expectedGuideItems} 項目ではありません（実際: ${actualGuideItems}）。`);
for (const section of GUIDE_SECTIONS) {
  assert(guideHtml.includes(`id="guide-${section.id}"`), `暮らしのガイドにセクション ${section.id} がありません。`);
  for (const item of section.items) {
    assert(guideHtml.includes(item.url), `暮らしのガイドに ${item.title} のリンクがありません。`);
  }
}

/* ---------- サイトマップ・アーカイブ ---------- */

assert(sitemapXml.includes(`<loc>https://tamas-hub.github.io/deaf-navi-web/about.html</loc>`), 'サイトマップにAboutがありません。');
assert(sitemapXml.includes(`<loc>https://tamas-hub.github.io/deaf-navi-web/guide.html</loc>`), 'サイトマップに暮らしのガイドがありません。');
assert(oldIndexHtml.includes('archive-index') || oldIndexHtml.includes('アーカイブ対象の記事はまだありません'), 'アーカイブ目次が生成されていません。');

// 目次に載せた月別ページが実在するか
const monthLinks = [...oldIndexHtml.matchAll(/href="\.\/(archive\/[0-9]{4}-[0-9]{2}\.html)"/g)].map((m) => m[1]);
for (const link of monthLinks) {
  assert(await fileExists(link), `アーカイブ月別ページがありません: ${link}`);
}

/* ---------- PWA ---------- */

for (const file of ['manifest.webmanifest', 'sw.js', 'offline.html', 'favicon.svg', 'og-image.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']) {
  assert(await fileExists(file), `PWAアセットがありません: ${file}`);
}
const swJs = await readFile(join(docs, 'sw.js'), 'utf8');
assert(!swJs.includes('__BUILD_ID__'), 'sw.js のビルドIDが未置換です。');
assert(uiControlsJs.includes('serviceWorker'), 'ui-controls.js にService Worker登録がありません。');

/* ---------- 結果 ---------- */

if (failures > 0) {
  console.error(`Site verification failed: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`Site verification passed: ${data.articles.length} articles, ${ids.size} unique URLs, guide ${actualGuideItems} items, ${monthLinks.length} archive month pages.`);
