import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import SITE_NAVIGATION from '../config/site-navigation.json' with { type: 'json' };
import { GUIDE_TOPICS } from '../src/guide-topics.mjs';
import { GUESTHOUSE_GUIDE } from '../src/guesthouses-data.mjs';
import { renderHomePage } from '../src/templates/home.mjs';
import { renderEventsPage } from '../src/templates/events.mjs';

const FILES = {
  articlesJson: 'articles.json',
  oldIndex: 'index-old.html',
  about: 'about.html',
  guide: 'guide.html',
  styles: 'styles.css',
  app: 'app.js',
  feed: 'feed.xml',
  sitemapHtml: 'sitemap.html',
};
// 読みものはDBで管理されるため、公開済みと確認されたURLだけを個別に許可する。
const PUBLISHED_STORIES = ['./stories/relay-yometel-net119/'];
const OTOMADO_ROUTES = ['#/board', '#/captions', '#/sound'];

const renderHome = () => renderHomePage(
  { generatedAt: '2026-10-29T00:00:00Z', articles: [] },
  { isDev: false, files: FILES, keywords: 'k', now: Date.parse('2026-10-29T00:00:00Z') },
);
const purposeNav = html => html.match(/<nav class="purpose-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';

function mediaBlock(css, width) {
  const start = css.indexOf(`@media (max-width: ${width})`);
  assert.ok(start >= 0, `${width} のメディアクエリがありません`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`${width} のメディアクエリが閉じていません`);
}

test('トップ: 目的別の4入口をニュースより前に置き、ニュース一覧への移動も残す', () => {
  const html = renderHome();
  const nav = purposeNav(html);
  assert.ok(nav, '目的別の入口がありません');
  const start = html.indexOf('class="purpose-nav"');
  assert.ok(start < html.indexOf('id="news-toolbar"'), '入口がニュース検索より後ろにあります');
  assert.ok(start < html.indexOf('id="articles"'), '入口がニュース一覧より後ろにあります');

  const groups = Object.fromEntries(nav.split('<div class="purpose-nav__group">').slice(1)
    .map(group => [group.match(/class="purpose-nav__title">([^<]+)</)[1], group]));
  assert.deepEqual(Object.keys(groups), ['出かける', '暮らしで困ったとき', 'その場で使う', 'iPhoneアプリ（無料）']);
  for (const href of ['./events.html', './connect/sign-cafe/', './guide/guesthouses/']) {
    assert.ok(groups['出かける'].includes(`href="${href}"`), `「出かける」から ${href} へ進めません`);
  }
  assert.match(groups['暮らしで困ったとき'], /href="\.\/guide\.html#guide-emergency">緊急時の連絡方法<\/a>/);
  assert.match(groups['その場で使う'], /href="\.\/otomado\/#\/board"/);
  assert.match(groups['その場で使う'], /筆談/, 'おとまどを用途の説明なしで置いています');
  assert.match(nav, /<a href="#articles-heading">最新ニュースへ<\/a>/);
  assert.ok(html.includes('id="articles-heading"'));
});

test('トップ: 目的別の入口は既存ページだけへつなぎ、中間ページを増やさない', () => {
  const html = renderHome();
  const known = new Set([
    ...SITE_NAVIGATION.map(item => `./${item.path}`),
    ...GUIDE_TOPICS.map(topic => `./guide/${topic.slug}/`),
    `.${GUESTHOUSE_GUIDE.path}`,
    ...PUBLISHED_STORIES,
    '/go/ios/top',
  ]);
  const hrefs = [...purposeNav(html).matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(hrefs.length >= 8);
  for (const href of hrefs) {
    const [path, hash] = href.split(/(?=#)/);
    if (href.startsWith('#')) {
      assert.ok(html.includes(`id="${href.slice(1)}"`), `ページ内の移動先がありません: ${href}`);
      continue;
    }
    assert.ok(known.has(path), `既存ページではないURLがあります: ${href}`);
    if (path === './otomado/' && hash) assert.ok(OTOMADO_ROUTES.includes(hash), `おとまどにない画面です: ${href}`);
  }
});

test('トップ: 下部の近道カード5枚とニュース一覧の順序を保つ', () => {
  const html = renderHome();
  assert.equal((html.match(/class="quick-access__item/g) ?? []).length, 5);
  assert.ok(html.indexOf('id="articles"') < html.indexOf('class="quick-access"'));
  assert.ok(!purposeNav(html).includes('quick-access'), '目的別の入口がカード部品を流用しています');
});

test('共通ナビ: スマホでは8項目を2行に収め、文字とタップ領域を縮めず、隠さない', async () => {
  const css = await readFile(new URL('../src/assets/site-shell.css', import.meta.url), 'utf8');
  const phone = mediaBlock(css, '800px');
  assert.match(phone, /\.dn-site-shell \.site-nav \{[^}]*flex-wrap:\s*wrap/, '収まらない項目が折り返されません');
  assert.match(phone, /\.dn-site-shell \.site-nav::before \{[^}]*flex-basis:\s*100%[^}]*order:\s*1/, '4項目ごとの改行がありません');
  assert.match(phone, /\.dn-site-shell \.site-nav__link:nth-child\(n\+5\) \{\s*order:\s*2;?\s*\}/);
  assert.doesNotMatch(css, /nth-child\(n\+5\)\s*\{[^}]*span 6/, '5〜8番目を半幅にすると3行になります');

  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selector.includes('.site-nav__link')) {
      for (const [, px] of body.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(px) >= 12, `ナビの文字が小さすぎます: ${selector.trim()}`);
      for (const [, px] of body.matchAll(/min-height:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(px) >= 44, `ナビのタップ領域が小さすぎます: ${selector.trim()}`);
    }
    if (/\.site-nav(?![\w-])/.test(selector)) {
      assert.doesNotMatch(body, /display:\s*none/, 'ナビを非表示にしています');
      assert.doesNotMatch(body, /overflow-x:\s*(?:auto|scroll)/, 'ナビの一部が画面外に隠れます');
    }
  }
});

test('イベント: 見出しと、受付範囲を明示した情報提供・訂正の入口を件数の近くに置く', async () => {
  const html = renderEventsPage({ events: [] });
  assert.match(html, /<h1 class="dn-page-title">きこえ・手話のイベント<\/h1>/);
  const entry = html.match(/<p class="event-contribute">[\s\S]*?<\/p>/)?.[0];
  assert.ok(entry, '情報提供・訂正の入口がありません');
  assert.ok(html.indexOf('id="event-count"') < html.indexOf('class="event-contribute"'));
  assert.ok(html.indexOf('class="event-contribute"') < html.indexOf('class="event-list"'), '入口が一覧より後ろにあります');

  // 投稿フォームはカフェ扱いで保存されるため、その受付範囲と同じ言葉で案内する。
  const tipForm = await readFile(new URL('../server/event-tips.php', import.meta.url), 'utf8');
  const scope = tipForm.match(/<h2>イベント情報を送る<\/h2><p>(.+?)の情報をお寄せください/)?.[1];
  assert.ok(scope, 'イベント投稿フォームの受付範囲を読み取れません');
  const tipLink = entry.match(/<a href="\/submit\/\?form=event">([^<]+)<\/a>/)?.[1];
  assert.ok(tipLink?.includes(scope), `投稿フォームへの案内が受付範囲（${scope}）と一致しません`);
  assert.doesNotMatch(tipLink, /講演|公演|講座/, '公演・講座をカフェ扱いの投稿フォームへ誘導しています');
  assert.match(entry, /<a href="\/submit\/\?form=contact&amp;scope=site#contact">[^<]*訂正[^<]*<\/a>/);

  assert.ok(html.includes('href="mailto:info@flamenut.com?subject=Deaf%20Navi%20イベント情報"'), '既存のメール連絡がありません');
  assert.match(html, /国内の催しを開催日と地域から探せます。/);
  assert.match(html, /rel="canonical" href="https:\/\/deafnavi\.com\/events\.html"/);
});
