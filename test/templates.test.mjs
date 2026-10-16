import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jsonLdScript, renderArticleCard } from '../src/templates/partials.mjs';
import { renderHomePage } from '../src/templates/home.mjs';
import { renderGuidePage } from '../src/templates/guide.mjs';
import { renderAboutPage } from '../src/templates/about.mjs';

const FILES = {
  articlesJson: 'articles.json',
  oldIndex: 'index-old.html',
  about: 'about.html',
  guide: 'guide.html',
  styles: 'styles.css',
  app: 'app.js',
  guideJs: 'guide.js',
  feed: 'feed.xml',
  sitemap: 'sitemap.xml',
  sitemapHtml: 'sitemap.html',
  robots: 'robots.txt',
  og: 'og-image.svg',
};

test('home prioritizes sourced editorial and news; expired notes disappear and filters remain native', () => {
  const note = { id: 'test', title: '<script>bad</script>', text: '短い編集文', sourceName: '公式', sourceUrl: 'https://example.org/news', reviewedAt: '2026-10-16', expiresAt: '2026-10-23' };
  const render = now => renderHomePage({ generatedAt: '2026-10-16', articles: [] }, { isDev: false, files: FILES, now: Date.parse(now), editorialNotes: [note] });
  const html = render('2026-10-17');
  assert.ok(html.indexOf('id="editorial-note"') < html.indexOf('id="news-toolbar"'));
  assert.ok(html.indexOf('id="articles"') < html.indexOf('class="quick-access"'));
  assert.match(html, /<details class="news-filters" id="news-filters">/);
  assert.match(html, /href="\.\/guide\.html#guide-emergency">緊急時の連絡方法<\/a>/);
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!render('2026-10-23').includes('id="editorial-note"'));
});

test('Aboutの構造化データへニュースの生成日時や別ページの確認日を転用しない', () => {
  for (const isDev of [false, true]) {
    const read = generatedAt => {
      const html = renderAboutPage({ generatedAt, isDev, files: FILES });
      const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
      assert.match(main, /href="\.\/connect\/sign-cafe\/">全国の手話カフェ一覧<\/a>/);
      return JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    };
    const before = read('2026-10-13T00:00:00Z');
    const after = read('2026-10-14T00:00:00Z');
    assert.deepEqual(after, before, 'ニュースだけの更新でAboutの意味を変えない');
    assert.equal(after['@type'], 'AboutPage');
    assert.equal(after.url, 'https://deafnavi.com/about.html');
    assert.equal(Object.hasOwn(after, 'dateModified'), false);
    assert.equal(Object.hasOwn(after, 'lastReviewed'), false);
    assert.equal(after.mainEntity['@type'], 'MobileApplication');
    assert.equal(after.mainEntity.operatingSystem, 'iOS');
    assert.ok(after.mainEntity.url.startsWith('https://apps.apple.com/'));
  }
});

function article(overrides) {
  return {
    id: 'https://example.com/a',
    title: 'テスト記事',
    summary: '要約',
    sourceName: 'テスト新聞',
    sourceUrl: 'https://example.com/',
    publishedAt: new Date().toISOString(),
    sourceType: 'rss',
    category: 'general',
    sourceTier: 'news',
    discoveryMethod: 'google-news',
    ...overrides,
  };
}

test('jsonLdScript: "<" を \\u003c にエスケープし script 脱出を防ぐ', () => {
  const html = jsonLdScript({ url: 'https://x.example/</script><script>alert(1)</script>' });
  assert.ok(!html.includes('</script><script>'), 'script脱出文字列が生のまま埋め込まれています');
  assert.ok(html.includes('\\u003c/script'), '\\u003c エスケープがありません');
});

test('renderHomePage: 悪意あるURLがJSON-LDでscript脱出しない', () => {
  const evil = article({
    id: 'https://evil.example/</script><script>alert(1)//',
    title: '悪意のある記事タイトルテスト',
  });
  const html = renderHomePage(
    { generatedAt: new Date().toISOString(), count: 1, articles: [evil] },
    { isDev: false, files: FILES, keywords: 'k' },
  );
  // JSON-LD内: エスケープ済み
  assert.ok(!html.includes('</script><script>alert(1)'), 'JSON-LDからscript脱出できてしまいます');
  // href属性内: escapeHtml済み（&lt;等に変換される）
  assert.ok(html.includes('https://evil.example/&lt;/script&gt;'), 'href属性のエスケープがありません');
});

test('renderArticleCard: HTML特殊文字を含むフィールドが全てエスケープされる', () => {
  const html = renderArticleCard(article({
    title: '<img src=x onerror=alert(1)>',
    summary: '"><script>x</script>',
    sourceName: "O'Reilly & <Co>",
  }));
  assert.ok(!html.includes('<img src=x'), 'title未エスケープ');
  assert.ok(!html.includes('<script>x</script>'), 'summary未エスケープ');
  assert.ok(html.includes('O&#39;Reilly &amp; &lt;Co&gt;'), 'sourceName未エスケープ');
});

test('renderHomePage: おとまどへのサイト内導線を表示する', () => {
  const html = renderHomePage(
    { generatedAt: new Date().toISOString(), count: 1, articles: [article({})] },
    { isDev: false, files: FILES, keywords: 'k' },
  );
  assert.ok(html.includes('quick-access__item--tool'), 'おとまどのクイックアクセスカードがありません');
  assert.ok(html.includes('href="./otomado/"'), 'おとまどの相対リンクがありません');
  assert.ok(!html.includes('class="tool-extension"'), '旧おとまど導線が残っています');
  assert.equal((html.match(/class="quick-access__item/g) ?? []).length, 5, 'クイックアクセスが5枚ではありません');
  assert.ok(html.indexOf('href="./deaf-navi-world-jp.html"') < html.indexOf('href="./guide.html"'), '暮らしのガイドがWorldの右側にありません');
  assert.ok(html.includes('site-nav__link--world'), 'World導線の専用表示がありません');
  assert.ok(html.includes('aria-current="page"><span>ニュース</span>'), 'ニュースの現在地表示がありません');
  assert.ok(html.indexOf('class="site-footer__update"') > html.indexOf('</main>'), '更新時刻が最下部へ移動していません');
  assert.equal((html.match(/class="site-footer__update"/g) ?? []).length, 1, '更新時刻が重複しています');
});

test('renderHomePage: WebMCP内部要素を非表示で保持し既存クライアントの後に読み込む', () => {
  const html = renderHomePage(
    { generatedAt: new Date().toISOString(), count: 1, articles: [article({})] },
    { isDev: false, files: FILES, keywords: 'k', clientAssetVersion: 'abc123' },
  );

  assert.ok(html.includes('id="agent-activity" aria-labelledby="agent-activity-heading" hidden aria-hidden="true"'), 'Agent Activity内部要素が非表示で保持されていません');
  assert.ok(html.includes('id="agent-activity-log"'), 'Agent Activityログがありません');
  assert.ok(html.includes('id="agent-activity-undo"'), 'Undoボタンがありません');
  assert.ok(!html.includes('<option value="official"'), '通常フロントにWebMCP専用の一次情報filterが残っています');
  assert.ok(!html.includes('<option value="specialist"'), '通常フロントにWebMCP専用の専門情報filterが残っています');
  assert.ok(html.includes('href="./styles.css?v=abc123"'), 'stylesheetに共有世代hashがありません');
  assert.ok(html.includes('src="./ui-controls.js?v=abc123"'), '表示設定JSに共有世代hashがありません');
  assert.ok(html.includes('src="./app.js?v=abc123"'), 'アプリJSに共有世代hashがありません');
  assert.ok(html.includes('src="./webmcp.js?v=abc123"'), 'WebMCP JSに共有世代hashがありません');
  assert.ok(html.indexOf('src="./app.js?v=abc123"') < html.indexOf('src="./webmcp.js?v=abc123"'), 'WebMCPが既存アプリより先に読み込まれています');
});

test('renderGuidePage: CUP ORDERを非公式ツールとして案内する', () => {
  const html = renderGuidePage({ isDev: false, files: FILES });
  const linkIndex = html.indexOf('href="https://cup-order.github.io/index.html"');
  const cardStart = html.lastIndexOf('<article class="guide-card"', linkIndex);
  const cardEnd = html.indexOf('</article>', linkIndex);
  const card = html.slice(cardStart, cardEnd);

  assert.ok(linkIndex >= 0 && cardStart >= 0, 'CUP ORDERの案内がありません');
  assert.ok(card.includes('https://cup-order.github.io/index.html'), 'CUP ORDERへのリンクがありません');
  assert.ok(card.includes('非公式の試作ツール'), '非公式ツールである説明がありません');
  assert.ok(card.includes('ツールを開く'), 'CUP ORDERのリンク表示が適切ではありません');
  assert.ok(!card.includes('公式情報を見る'), 'CUP ORDERを公式情報として案内しています');
});
