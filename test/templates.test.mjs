import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jsonLdScript, renderArticleCard, renderSiteNav } from '../src/templates/partials.mjs';
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

test('stories navigation resolves at root and nested pages', () => {
  for (const root of ['./', '../', '../../']) {
    const html=renderSiteNav({newsHref:root});
    assert.ok(html.includes(`href="${root}stories/"`));
    assert.ok(!html.includes('href="undefined"'));
  }
});

test('home omits removed editorial notes even when old snapshots are supplied; filters remain native', () => {
  const note = { id: 'test', title: '<script>bad</script>', text: '短い編集文', sourceName: '公式', sourceUrl: 'https://example.org/news', reviewedAt: '2026-10-16', expiresAt: '2026-10-23' };
  const render = now => renderHomePage({ generatedAt: '2026-10-16', articles: [] }, { isDev: false, files: FILES, now: Date.parse(now), editorialNotes: [note] });
  const html = render('2026-10-17');
  assert.ok(!html.includes('id="editorial-note"'));
  assert.ok(html.indexOf('id="articles"') < html.indexOf('class="quick-access"'));
  assert.match(html, /<details class="news-filters" id="news-filters">/);
  assert.match(html, /href="\.\/guide\.html#guide-emergency">緊急時の連絡方法<\/a>/);
  assert.ok(!html.includes('&lt;script&gt;bad&lt;/script&gt;'));
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
  assert.match(html, /id="offline-note"[^>]+hidden><\/p>/, '通信警告は実際の状態に応じて生成する');
  assert.ok(!html.includes('オフライン表示中です。'), '静的HTMLが未確認の通信状態を断定しない');
});

test('renderHomePage: 初期表示は20話題に絞り、残りは全件データと入口から読める', () => {
  const articles = Array.from({ length: 25 }, (_, i) => article({
    id: `https://example.com/topic-${i}`,
    title: `第${i + 1}回の個別の話題`,
    sourceName: `テスト新聞${i}`,
    publishedAt: new Date(Date.parse('2026-11-01T00:00:00Z') - i * 3_600_000).toISOString(),
  }));
  const html = renderHomePage(
    { generatedAt: '2026-11-01T00:00:00Z', count: articles.length, articles },
    { isDev: false, files: FILES, keywords: 'k', now: Date.parse('2026-11-01T00:00:00Z') },
  );
  const list = html.slice(html.indexOf('<div id="articles"'), html.indexOf('id="empty-msg"'));

  assert.equal((list.match(/class="news-topic"/g) ?? []).length, 20, 'SSRの初期表示が20話題ではありません');
  assert.match(html, /id="visible-count">20<\/strong> \/ 全 <strong id="total-count">25<\/strong>/);
  assert.match(html, /<div id="articles"[^>]*data-total="25"[^>]*data-initial="20"[^>]*data-src="\.\/articles\.json"/, '追加表示用の全件データへの参照がありません');
  assert.match(html, /<button type="button" id="load-more-btn" class="load-more-btn">/, '追加表示のボタンが隠れています');
  assert.ok(html.includes('（あと 5 話題）'));
  assert.ok(html.includes('id="news-search"') && html.includes('id="news-filters"'), '検索・絞り込みがありません');
  assert.ok(html.includes('href="./feed.xml"') && html.includes('href="./index-old.html"'), 'RSS・過去アーカイブの入口がありません');
});

test('renderGuidePage: サイト内の読みものは同じタブ、外部の関連リンクは別タブで開く', () => {
  const html = renderGuidePage({ isDev: false, files: FILES });
  const related = [...html.matchAll(/<a class="guide-card__link guide-card__related"[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
  const internal = related.filter(link => link.includes('href="/stories/relay-yometel-net119/"'));
  const external = related.filter(link => link.includes('href="https://'));

  assert.equal(internal.length, 4, '読みものへの関連リンクが4項目にありません');
  assert.equal(internal.length + external.length, related.length);
  for (const link of internal) {
    assert.ok(link.includes('Deaf Naviの読みもの'), 'Deaf Naviの記事だと分かりません');
    assert.ok(!/target=|aria-label=|↗|新しいタブ/.test(link), `サイト内リンクを別タブ扱いにしています: ${link}`);
  }
  assert.ok(external.length >= 4, '既存の外部関連リンクが減っています');
  for (const link of external) {
    assert.ok(link.includes('target="_blank" rel="noopener noreferrer"') && link.includes('（新しいタブで開く）') && link.includes('↗'), `外部リンクの別タブ表示が失われています: ${link}`);
  }
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
test('guesthouse guide keeps year-scoped closure and unknown accessibility facts explicit', async () => {
  const {GUESTHOUSES} = await import('../src/guesthouses-data.mjs');
  const {renderGuesthousesPage} = await import('../src/templates/guesthouses.mjs');
  const haru = GUESTHOUSES.find(h => h.id === 'haru-no-sora');
  const rate = haru.facts.find(([label]) => label === '料金の目安')[1];
  assert.doesNotMatch(rate, /毎年.*休館|2026年5月10日〜6月6日は休館/);
  assert.match(rate, /5\/10〜6\/6の今後の営業・料金は宿へ確認/);
  assert.doesNotMatch(rate, /春秋（4\/26〜6\/6/);
  for (const id of ['tarakoyu', 'haru-no-sora']) assert.match(GUESTHOUSES.find(h => h.id === id).comparison.emergency, /未確認/);
  const html = renderGuesthousesPage().html;
  assert.match(html, /未確認.*設備がないという意味ではありません/);
  assert.doesNotMatch(html, /（\s+<time/);
  assert.match(html, /［個室／相部屋／指定なし］/);
  assert.match(html, /［手話／筆談／口話／音声認識アプリ／どれでも可］/);
});
