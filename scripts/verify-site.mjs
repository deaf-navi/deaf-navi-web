import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');
const allowedSourceTiers = new Set(['official', 'specialist', 'news', 'broad']);
const maxAgeMs = 181 * 86_400_000;
const now = Date.now();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [dataRaw, indexHtml, worldJpHtml, aboutHtml, sitemapXml] = await Promise.all([
  readFile(join(docs, 'articles.json'), 'utf8'),
  readFile(join(docs, 'index.html'), 'utf8'),
  readFile(join(docs, 'deaf-navi-world-jp.html'), 'utf8'),
  readFile(join(docs, 'about.html'), 'utf8'),
  readFile(join(docs, 'sitemap.xml'), 'utf8'),
]);

const data = JSON.parse(dataRaw);
assert(Array.isArray(data.articles) && data.articles.length > 0, 'articles.json に記事がありません。');
assert(data.quality?.version === 'expanded-score-v3', 'キュレーション品質バージョンが v3 ではありません。');

const ids = new Set();
for (const article of data.articles) {
  assert(article.id && article.title && article.sourceName, '必須フィールドがない記事があります。');
  assert(allowedSourceTiers.has(article.sourceTier), `不明な sourceTier: ${article.sourceTier}`);
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

for (const marker of [
  'id="news-search"',
  'id="source-filter"',
  'data-source-tier=',
  'filter--world-link__icon',
  'SearchAction',
  'rel="canonical"',
]) {
  assert(indexHtml.includes(marker), `index.html に ${marker} がありません。`);
}

assert(worldJpHtml.includes('class="world-home-link"'), 'World-JP に国内版への導線がありません。');
assert(worldJpHtml.includes('国内版 Deaf Navi Webへ'), 'World-JP の国内版リンク文言がありません。');

assert(aboutHtml.includes('2026年7月14日'), 'About に更新日がありません。');
assert(aboutHtml.includes('id="about-policy"'), 'About に選定方針がありません。');
assert(sitemapXml.includes('<loc>https://tamas-hub.github.io/deaf-navi-web/about.html</loc>'), 'サイトマップにAboutがありません。');

console.log(`Site verification passed: ${data.articles.length} articles, ${ids.size} unique URLs.`);
