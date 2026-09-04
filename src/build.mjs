/**
 * 静的サイトビルド 2.0。
 *
 * docs/articles.json（curate.mjs の出力）からページを生成する。
 * ページの見た目・構造は src/templates/ 配下、サイト定数は config/ 配下を編集する。
 *
 * 使い方:
 *   node src/build.mjs          # 本番
 *   node src/build.mjs --dev    # dev 変種（index-dev.html 等を生成）
 */

import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SITE_KEYWORDS } from '../config/site.mjs';
import { injectCloudflareAnalytics } from './lib/analytics.mjs';
import { renderHomePage } from './templates/home.mjs';
import {
  groupArticlesByMonth,
  renderArchiveIndexPage,
  renderArchiveMonthPage,
} from './templates/archive.mjs';
import { renderAboutPage } from './templates/about.mjs';
import { renderGuidePage } from './templates/guide.mjs';
import { renderConnectPages, renderNotFoundPage } from './templates/connect.mjs';
import {
  renderRobots,
  renderRss,
  renderSitemapHtmlPage,
  renderSitemapXml,
} from './templates/feeds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const ASSETS = join(__dirname, 'assets');

const VARIANT = getVariant();
const IS_DEV = VARIANT === 'dev';
const SUFFIX = IS_DEV ? '-dev' : '';

const FILES = {
  articlesJson: `articles${SUFFIX}.json`,
  oldArticlesJson: `articles-old${SUFFIX}.json`,
  index: `index${SUFFIX}.html`,
  oldIndex: `index-old${SUFFIX}.html`,
  about: `about${SUFFIX}.html`,
  guide: `guide${SUFFIX}.html`,
  styles: `styles${SUFFIX}.css`,
  app: `app${SUFFIX}.js`,
  guideJs: `guide${SUFFIX}.js`,
  feed: `feed${SUFFIX}.xml`,
  sitemap: `sitemap${SUFFIX}.xml`,
  sitemapHtml: `sitemap${SUFFIX}.html`,
  robots: `robots${SUFFIX}.txt`,
  og: `og-image${SUFFIX}.svg`,
};

function getVariant() {
  if (process.env.CURATION_VARIANT === 'dev') return 'dev';
  if (process.argv.includes('--dev')) return 'dev';
  const variantArg = process.argv.find((arg) => arg.startsWith('--variant='));
  return variantArg?.split('=')[1] === 'dev' ? 'dev' : 'prod';
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeDoc(file, content) {
  await mkdir(dirname(join(DOCS, file)), { recursive: true });
  const output = file.toLowerCase().endsWith('.html')
    ? injectCloudflareAnalytics(content)
    : content;
  await writeFile(join(DOCS, file), output, 'utf8');
  console.log(`書き出し: ${file}`);
}

async function copyAsset(src, destFile) {
  if (!(await fileExists(src))) return false;
  await mkdir(dirname(join(DOCS, destFile)), { recursive: true });
  await copyFile(src, join(DOCS, destFile));
  console.log(`コピー: ${destFile}`);
  return true;
}

async function getClientAssetVersion() {
  const clientFiles = ['styles.css', 'ui-controls.js', 'app.js', 'webmcp.js'];
  const contents = await Promise.all(
    clientFiles.map((file) => readFile(join(__dirname, file))),
  );
  const hash = createHash('sha256');
  for (const content of contents) hash.update(content);
  return hash.digest('hex').slice(0, 12);
}

async function main() {
  console.log(`Build variant: ${VARIANT}`);
  const data = JSON.parse(await readFile(join(DOCS, FILES.articlesJson), 'utf8'));
  let oldData;
  try {
    oldData = JSON.parse(await readFile(join(DOCS, FILES.oldArticlesJson), 'utf8'));
  } catch {
    oldData = { generatedAt: data.generatedAt, count: 0, articles: [] };
  }

  await mkdir(DOCS, { recursive: true });
  await mkdir(join(DOCS, 'archive'), { recursive: true });
  await mkdir(join(DOCS, 'icons'), { recursive: true });

  // 同一世代のCSS/JSを必ず取得できるよう、内容hashを共有URLへ付ける。
  // 旧Service Workerが制御中でも未キャッシュURLとなり、新旧JSの混在を防ぐ。
  const clientAssetVersion = await getClientAssetVersion();
  const opts = { isDev: IS_DEV, files: FILES, keywords: SITE_KEYWORDS, clientAssetVersion };

  // ---- ページ生成 ----
  await writeDoc(FILES.index, renderHomePage(data, opts));

  const groups = groupArticlesByMonth(oldData.articles ?? []);

  // 前回ビルドの月別ページのうち、今回存在しない月を削除（世代管理）
  const expectedPages = new Set(groups.map(([key]) => `${key}${SUFFIX}.html`));
  const monthPattern = IS_DEV ? /^(\d{4}-\d{2}|legacy)-dev\.html$/ : /^(\d{4}-\d{2}|legacy)\.html$/;
  for (const existing of await readdir(join(DOCS, 'archive'))) {
    if (monthPattern.test(existing) && !expectedPages.has(existing)) {
      await rm(join(DOCS, 'archive', existing));
      console.log(`削除: archive/${existing}`);
    }
  }
  await writeDoc(FILES.oldIndex, renderArchiveIndexPage({
    generatedAt: oldData.generatedAt ?? data.generatedAt,
    count: oldData.count ?? (oldData.articles ?? []).length,
    groups,
    ...opts,
  }));
  for (const [key, items] of groups) {
    await writeDoc(join('archive', `${key}${SUFFIX}.html`), renderArchiveMonthPage({
      key,
      items,
      generatedAt: oldData.generatedAt ?? data.generatedAt,
      ...opts,
    }));
  }

  await writeDoc(FILES.about, renderAboutPage({ generatedAt: data.generatedAt, ...opts }));
  await writeDoc(FILES.guide, renderGuidePage(opts));
  const [places, signCafes, starbucksEntries] = await Promise.all([
    readFile(join(ROOT, 'content', 'connect', 'places.json'), 'utf8').then(JSON.parse),
    readFile(join(ROOT, 'content', 'connect', 'sign-cafes.json'), 'utf8').then(JSON.parse),
    readFile(join(ROOT, 'content', 'connect', 'starbucks-entries.json'), 'utf8').then(JSON.parse),
  ]);
  for (const page of renderConnectPages({ places, signCafes, starbucksEntries })) {
    await writeDoc(page.file, page.html);
  }
  await writeDoc('404.html', renderNotFoundPage());
  await writeDoc(FILES.sitemapHtml, renderSitemapHtmlPage({
    generatedAt: data.generatedAt,
    count: data.count ?? data.articles.length,
    ...opts,
  }));
  await writeDoc(FILES.sitemap, renderSitemapXml({
    generatedAt: data.generatedAt,
    archiveMonths: groups.map(([key]) => key),
    ...opts,
  }));
  await writeDoc(FILES.robots, renderRobots(opts));
  await writeDoc(FILES.feed, renderRss({
    generatedAt: data.generatedAt,
    articles: data.articles,
    ...opts,
  }));

  // ---- アセットコピー ----
  await copyAsset(join(__dirname, 'styles.css'), FILES.styles);
  await copyAsset(join(ASSETS, 'directory.css'), 'directory.css');
  await copyAsset(join(ASSETS, 'directory-safety.js'), 'directory-safety.js');
  await copyAsset(join(__dirname, 'app.js'), FILES.app);
  await copyAsset(join(__dirname, 'webmcp.js'), 'webmcp.js');
  await copyAsset(join(__dirname, 'guide.js'), FILES.guideJs);
  await copyAsset(join(__dirname, 'ui-controls.js'), 'ui-controls.js');
  await copyAsset(join(__dirname, 'og-image.svg'), FILES.og);
  await copyAsset(join(ROOT, 'content', 'connect', 'places.json'), join('data', 'connect', 'places.json'));
  await copyAsset(join(ROOT, 'content', 'connect', 'sign-cafes.json'), join('data', 'connect', 'sign-cafes.json'));
  await copyAsset(join(ROOT, 'content', 'connect', 'starbucks-entries.json'), join('data', 'connect', 'starbucks-entries.json'));

  // PWA・アイコン類（本番/devで共通名）
  await copyAsset(join(ASSETS, 'favicon.svg'), 'favicon.svg');
  await copyAsset(join(ASSETS, 'manifest.webmanifest'), 'manifest.webmanifest');
  const offlineHtml = join(ASSETS, 'offline.html');
  if (await fileExists(offlineHtml)) {
    await writeDoc('offline.html', await readFile(offlineHtml, 'utf8'));
  }
  await copyAsset(join(ASSETS, 'og-image.png'), 'og-image.png');
  await copyAsset(join(ASSETS, 'deaf-navi-ios-app-icon.png'), 'deaf-navi-ios-app-icon.png');
  if (await fileExists(join(ASSETS, 'icons'))) {
    for (const icon of await readdir(join(ASSETS, 'icons'))) {
      await copyAsset(join(ASSETS, 'icons', icon), join('icons', icon));
    }
  }

  // Service Worker はビルドIDを埋め込んでキャッシュを世代管理する
  const swSrc = join(ASSETS, 'sw.js');
  if (await fileExists(swSrc)) {
    const generatedAt = data.generatedAt ?? new Date().toISOString();
    const sw = (await readFile(swSrc, 'utf8'))
      .replaceAll('__BUILD_ID__', `${generatedAt}-${clientAssetVersion}`)
      .replaceAll('__ASSET_VERSION__', clientAssetVersion);
    await writeDoc('sw.js', sw);
  }
}

main().catch((err) => {
  console.error('ビルド失敗:', err);
  process.exit(1);
});
