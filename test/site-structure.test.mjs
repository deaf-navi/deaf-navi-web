import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { renderConnectPages } from '../src/templates/connect.mjs';
import { renderSiteNav } from '../src/templates/partials.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');

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
    document: { documentElement: {}, querySelector: selector => selector.startsWith('script') ? { src: 'https://deafnavi.com/ui-controls.js' } : null },
    location: { protocol: 'https:', hostname: 'deafnavi.com', href: 'https://deafnavi.com/connect/' },
    navigator: { serviceWorker: { register: url => { registered = url; return Promise.resolve(); } } },
    window: { addEventListener: (_event, fn) => fn() },
  });
  assert.equal(registered, 'https://deafnavi.com/sw.js');
});
