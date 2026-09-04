import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const docs = join(root, 'docs');

test('手話カフェとスターバックスを別URL・別掲載基準で公開する', async () => {
  const cafe = await readFile(join(docs, 'connect', 'sign-cafe', 'index.html'), 'utf8');
  const starbucks = await readFile(join(docs, 'connect', 'sign-cafe', 'starbucks', 'index.html'), 'utf8');
  assert.match(cafe, /<title>全国の手話カフェ一覧 \| Deaf Navi<\/title>/);
  assert.match(cafe, /単発イベントは含みません/);
  assert.match(starbucks, /<title>スターバックスの手話カフェ・手話イベント情報 \| Deaf Navi<\/title>/);
  assert.match(starbucks, /Deaf Naviによる非公式の情報ページ/);
  assert.match(starbucks, /現在確認できている開催予定はありません/);
  assert.doesNotMatch(starbucks, /参加予定(?:数|登録|ボタン)/);
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
