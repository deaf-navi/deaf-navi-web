import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { renderIosAppBanner } from '../src/lib/ios-app-promotion.mjs';
import { renderGuidePage } from '../src/templates/guide.mjs';
import { renderHomePage } from '../src/templates/home.mjs';
import { renderAboutPage } from '../src/templates/about.mjs';

test('native app banner includes public pages, excludes tools/private/redirect documents', () => {
  for (const path of ['/', '/about.html', '/events.html', '/deaf-navi-world-jp.html', '/stories/example/', '/connect/sign-cafe/']) {
    assert.match(renderIosAppBanner(path), /app-id=6761352199/);
  }
  for (const path of ['/otomado/', '/otomado/index.html', '/submit/', '/admin/stories/', '/go/ios/about', '/404.html', '/offline.html']) {
    assert.equal(renderIosAppBanner(path), '');
  }
  assert.equal(renderIosAppBanner('/preview/', 'noindex,nofollow'), '');
  assert.doesNotMatch(renderIosAppBanner('/'), /app-argument|PROVIDER|undefined|null/);
});

const files = {guide:'guide.html', about:'about.html', styles:'styles.css', app:'app.js', feed:'feed.xml', articlesJson:'articles.json', guideJs:'guide.js'};
const opts = {isDev:false, files};
test('App Store placements use fixed redirects and accessible new-tab links', () => {
  const home = renderHomePage({generatedAt:'2026-11-01T00:00:00Z', articles:[]}, opts);
  const about = renderAboutPage(opts);
  for (const [html, path] of [[home, 'top'], [home, 'footer'], [about, 'about']]) {
    assert.match(html, new RegExp(`href="/go/ios/${path}"[^>]+target="_blank"[^>]+rel="noopener noreferrer"[^>]+aria-label="[^\"]+新しいタブ`));
  }
  assert.doesNotMatch(home, /手話ガイド・制度情報をオフライン/);
});
test('emergency app note follows official services and stays within their filtered section', () => {
  const html = renderGuidePage(opts);
  const section = html.match(/<section[^>]+aria-labelledby="guide-emergency">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section);
  assert.ok(section.indexOf('class="guide-app-note"') > section.lastIndexOf('</article>'));
  assert.match(section, /href="\/go\/ios\/guide"/);
  assert.match(section, /ウィジェット/);
  assert.equal((section.match(/class="guide-app-note"/g) || []).length, 1);
});

test('service worker leaves App Store redirects to the network', async () => {
  const handlers = {};
  vm.runInNewContext(await readFile(new URL('../src/assets/sw.js', import.meta.url), 'utf8'), {
    URL, self: {location: {origin:'https://deafnavi.com', href:'https://deafnavi.com/sw.js'}, addEventListener(name, handler) {handlers[name]=handler;}},
  });
  for (const placement of ['top','footer','guide','about']) {
    handlers.fetch({request:{method:'GET',url:`https://deafnavi.com/go/ios/${placement}?dn_client=codex`,mode:'navigate'}, respondWith(){assert.fail('redirect must bypass offline caching');}});
  }
});
