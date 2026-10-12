import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { renderConnectPages } from '../src/templates/connect.mjs';
import { renderSiteNav } from '../src/templates/partials.mjs';
import { renderSitemapXml, renderSitemapHtmlPage } from '../src/templates/feeds.mjs';
import { GUIDE_LAST_REVIEWED } from '../src/guide-data.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');

test('ニュースの更新日時をカフェ・ツール・過去月へ流用せず、確認済みガイド日付を保つ', () => {
  for (const isDev of [false, true]) {
    const suffix = isDev ? '-dev' : '';
    const files = { oldIndex: `index-old${suffix}.html`, about: `about${suffix}.html`, guide: `guide${suffix}.html`, sitemapHtml: `sitemap${suffix}.html` };
    const readEntries = generatedAt => new Map([...renderSitemapXml({ generatedAt, isDev, files, archiveMonths: ['2026-09', '2026-08'] }).matchAll(/<url>([\s\S]*?)<\/url>/g)]
      .map(([, item]) => [item.match(/<loc>(.*?)<\/loc>/)[1], item.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? null]));
    const before = readEntries('2026-10-12T00:00:00Z');
    const after = readEntries('2026-10-13T00:00:00Z');
    assert.deepEqual([...after.keys()], [...before.keys()], '更新日時だけでは検索対象URLを変更しない');
    for (const path of ['connect/sign-cafe/', 'connect/sign-cafe/map/', 'otomado/', 'about/', files.about, files.oldIndex, `archive/2026-08${suffix}.html`, 'deaf-navi-world-jp.html']) {
      const url = 'https://deafnavi.com/' + path;
      assert.ok(after.has(url), path);
      assert.equal(before.get(url), null, path);
      assert.equal(after.get(url), null, path);
    }
    const home = isDev ? 'https://deafnavi.com/index-dev.html' : 'https://deafnavi.com/';
    assert.equal(after.get(home), '2026-10-13T00:00:00.000Z');
    assert.notEqual(after.get(home), before.get(home));
    assert.equal(after.get('https://deafnavi.com/' + files.guide), GUIDE_LAST_REVIEWED);
    assert.equal(after.get('https://deafnavi.com/' + files.guide), before.get('https://deafnavi.com/' + files.guide));
  }
});

test('検索対象サイトマップからnoindexの情報提供フォームを除き、カフェの公開分類を案内する', async () => {
  const files = { oldIndex: 'index-old.html', about: 'about.html', guide: 'guide.html', sitemapHtml: 'sitemap.html', sitemap: 'sitemap.xml', feed: 'feed.xml', robots: 'robots.txt' };
  const options = { generatedAt: '2026-10-12T00:00:00Z', isDev: false, files, count: 1 };
  for (const xml of [renderSitemapXml(options), await readFile(join(docs, 'sitemap.xml'), 'utf8')]) {
    assert.doesNotMatch(xml, /<loc>https:\/\/deafnavi\.com\/(?:submit|admin)\//);
    assert.match(xml, /<loc>https:\/\/deafnavi\.com\/connect\/sign-cafe\/<\/loc>/);
  }
  for (const html of [renderSitemapHtmlPage(options), await readFile(join(docs, 'sitemap.html'), 'utf8')]) {
    assert.match(html, /href="\.\/connect\/sign-cafe\/overseas\/"/);
    assert.match(html, /href="\.\/connect\/sign-cafe\/events\/"/);
  }
});

test('スターバックス専用ページを生成せず、導線を残さない', async () => {
  const cafe = await readFile(join(docs, 'connect', 'sign-cafe', 'index.html'), 'utf8');
  assert.match(cafe, /全国の手話カフェ一覧/);
  await assert.rejects(readFile(join(docs, 'connect', 'sign-cafe', 'starbucks', 'index.html')), { code: 'ENOENT' });
  for (const file of ['connect/index.html', 'sitemap.html', 'sitemap.xml', '404.html']) {
    assert.doesNotMatch(await readFile(join(docs, file), 'utf8'), /connect\/sign-cafe\/starbucks\//);
  }
});

test('公開HTML・CSS・SVGに明朝系フォント指定を含めない', async () => {
  const forbidden = /Shippori|Mincho|Noto\s+Serif|font-serif|(?<!sans-)serif/iu;
  const targets = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.(?:html|css|svg)$/i.test(entry.name)) targets.push(full);
    }
  }
  await visit(docs);
  for (const file of targets) {
    const content = await readFile(file, 'utf8');
    assert.doesNotMatch(content, forbidden, `明朝系フォント指定: ${file}`);
  }
});

test('404ページはnoindexで生成される', async () => {
  const html = await readFile(join(docs, '404.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /404 NOT FOUND/);
});

test('つながるの場所・コミュニティ導線を非表示にする', async () => {
  for (const name of ['connect/index.html', 'sitemap.html']) {
    const html = await readFile(join(docs, name), 'utf8');
    assert.doesNotMatch(html, /href="(?:\.?\/)?connect\/(?:places|communities)\//);
  }
});

test('手話カフェへ直接案内し、つながるページは閲覧用に残す', async () => {
  const nav = renderSiteNav();
  assert.match(nav, /href="\.\/connect\/sign-cafe\/"[^>]*><span>手話カフェ<\/span>/);
  assert.match(renderSiteNav({locale: 'en'}), />Sign Cafes<\/span>/);
  const generated = renderConnectPages({places: {}, signCafes: {signCafes: []}});
  const hub = generated.find(page => page.file === 'connect/index.html').html;
  assert.match(hub, /<title>つながる/);
  assert.match(hub, /rel="canonical" href="https:\/\/deafnavi.com\/connect\/"/);
  assert.doesNotMatch(hub, /http-equiv="refresh"|location\.(?:replace|href)|href="\/connect\/events\/"/);
  for (const file of ['index.html', 'deaf-navi-world-jp.html', 'deaf-navi-world-original.html', 'guide.html', 'about.html', 'connect/index.html', 'connect/sign-cafe/index.html']) {
    const html = await readFile(join(docs, file), 'utf8');
    assert.match(html, /class="site-nav__link[^"]*" href="\.?\/connect\/sign-cafe\/"[^>]*><span>(?:手話カフェ|Sign Cafes)<\/span>/, file);
    assert.doesNotMatch(html, /<a[^>]*href="\.?\/connect\/"[^>]*>/, file);
  }
});

test('イベントページをnoindexの公開休止案内にし、一覧への導線を残す', async () => {
  const generated = renderConnectPages({places: {}, signCafes: {signCafes: []}});
  const eventPage = generated.find(page => page.file === 'connect/events/index.html').html;
  for (const html of [eventPage, await readFile(join(docs, 'connect/events/index.html'), 'utf8')]) {
    assert.match(html, /<meta name="robots" content="noindex,follow">/);
    assert.match(html, /イベントページは公開休止中です/);
    assert.match(html, /href="\/connect\/sign-cafe\/">手話カフェ一覧を見る<\/a>/);
  }
  for (const file of ['connect/index.html', 'sitemap.html', 'sitemap.xml']) {
    assert.doesNotMatch(await readFile(join(docs, file), 'utf8'), /connect\/events\//, file);
  }
});

test('深いURLでも共通スクリプト位置からルートのService Workerを登録する', async () => {
  const source = await readFile(join(root, 'src/ui-controls.js'), 'utf8');
  let registered;
  runInNewContext(source, {
    URL,
    document: { documentElement: {}, addEventListener() {}, querySelectorAll: () => [],
      querySelector: selector => selector.startsWith('script') ? { src: 'https://deafnavi.com/ui-controls.js' } : null },
    location: { protocol: 'https:', hostname: 'deafnavi.com', href: 'https://deafnavi.com/connect/' },
    navigator: { serviceWorker: { register: url => { registered = url; return Promise.resolve(); } } },
    window: { addEventListener: (_event, fn) => fn() },
  });
  assert.equal(registered, 'https://deafnavi.com/sw.js');
});
