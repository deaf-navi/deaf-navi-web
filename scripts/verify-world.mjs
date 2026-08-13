/**
 * World版の軽量検証（generate:world の最終段）。
 *
 * World は外部翻訳・Codex App Server に依存するため、検証は
 * 「公開を止めるべき壊れ方」だけに絞る（fail-soft方針）。
 * 文言・件数のような変わりやすい内容には依存しない。
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`✗ ${message}`);
  }
}

const raw = await readFile(join(docs, 'articles-world.json'), 'utf8');
const data = JSON.parse(raw);

assert(Array.isArray(data.articles) && data.articles.length > 0, 'articles-world.json に記事がありません。');
assert(typeof data.generatedAt === 'string', 'articles-world.json に generatedAt がありません。');
assert(data.regions && data.topics, 'articles-world.json に regions/topics がありません。');

const REQUIRED = ['id', 'title', 'summary', 'originalTitle', 'originalSummary', 'sourceName', 'sourceUrl', 'publishedAt', 'region', 'topic'];
for (const article of data.articles.slice(0, 50)) {
  for (const key of REQUIRED) {
    assert(article[key] !== undefined && article[key] !== null && article[key] !== '',
      `World記事に ${key} がありません: ${article.originalTitle ?? article.id}`);
  }
}

for (const file of ['deaf-navi-world-jp.html', 'deaf-navi-world-original.html', 'feed-world.xml', 'feed-world-original.xml', 'sitemap-world.xml', 'styles-world.css', 'app-world.js']) {
  try {
    await stat(join(docs, file));
  } catch {
    assert(false, `World生成物がありません: ${file}`);
  }
}

const worldJp = await readFile(join(docs, 'deaf-navi-world-jp.html'), 'utf8');
assert(worldJp.includes('class="world-home-link"'), 'World-JP に国内版への導線がありません。');
assert(worldJp.includes('data-region'), 'World-JP に地域フィルタ属性がありません。');

if (failures > 0) {
  console.error(`World verification failed: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`World verification passed: ${data.articles.length} articles.`);
