import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jsonLdScript, renderArticleCard } from '../src/templates/partials.mjs';
import { renderHomePage } from '../src/templates/home.mjs';

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
