import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');

const DATA_FILE = join(DOCS, 'articles-world.json');
const HTML_OUT = join(DOCS, 'deaf-navi-world.html');
const FEED_OUT = join(DOCS, 'feed-world.xml');
const SITEMAP_OUT = join(DOCS, 'sitemap-world.xml');
const STYLES_SRC = join(__dirname, 'styles.css');
const STYLES_OUT = join(DOCS, 'styles-world.css');
const APP_SRC = join(__dirname, 'world-app.js');
const APP_OUT = join(DOCS, 'app-world.js');
const OG_SRC = join(__dirname, 'og-image.svg');
const OG_OUT = join(DOCS, 'og-image-world.svg');

const SITE_URL = 'https://tamas-hub.github.io/deaf-navi-web/';
const PAGE_FILE = 'deaf-navi-world.html';
const PAGE_URL = `${SITE_URL}${PAGE_FILE}`;
const FEED_URL = `${SITE_URL}feed-world.xml`;
const SITEMAP_URL = `${SITE_URL}sitemap-world.xml`;
const SITE_NAME = 'Deaf Navi World';
const SITE_DESC = '世界中の主要メディアが報じる聴覚障害・ろう者・難聴・手話・情報保障関連ニュースを、日本語に翻訳して地域別・カテゴリ別にキュレーションするDeaf Naviの世界版ページ。';
const INITIAL_VISIBLE = 150;

const REGION_ORDER = ['all', 'asia_oceania', 'americas', 'europe_cis', 'middle_east_africa'];
const TOPIC_ORDER = ['all', 'accessibility', 'rights', 'health', 'education', 'technology', 'culture', 'sports', 'safety', 'general'];
const REGION_UI = {
  all: 'すべての地域',
  asia_oceania: 'アジア・オセアニア',
  americas: '北米・中南米',
  europe_cis: 'ヨーロッパ・CIS',
  middle_east_africa: '中東・アフリカ',
};
const TOPIC_UI = {
  all: 'すべてのカテゴリ',
  accessibility: 'アクセシビリティ・情報保障',
  rights: '権利・制度',
  health: '医療・補聴',
  education: '教育',
  technology: '技術・AI',
  culture: '文化・社会',
  sports: 'デフスポーツ',
  safety: '災害・安全',
  general: '一般',
};

const CF_ANALYTICS_TOKEN = '6473e8a5f9904585a0f0f17c8a3edfe0';
const CF_ANALYTICS_SNIPPET = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_ANALYTICS_TOKEN}"}'></script>`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function formatDateJST(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(d).slice(0, 16)} JST`;
}

function relativeTime(iso) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月前`;
  return `${Math.floor(months / 12)}年前`;
}

function renderButtons(items, ui, attr, allLabel) {
  return items.map((key) => {
    const active = key === 'all';
    return `<button type="button" class="filter${active ? ' is-active' : ''}" ${attr}="${escapeHtml(key)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(ui[key] ?? allLabel)}</button>`;
  }).join('\n          ');
}

function renderArticle(article, index) {
  const hidden = index >= INITIAL_VISIBLE ? ' hidden' : '';
  const regionLabel = REGION_UI[article.region] ?? article.regionLabel ?? '地域未分類';
  const topicLabel = TOPIC_UI[article.topic] ?? article.topicLabel ?? '一般';
  return `
      <article class="card world-card" data-region="${escapeHtml(article.region)}" data-topic="${escapeHtml(article.topic)}" data-index="${index}"${hidden}>
        <header class="card__head world-card__head">
          <span class="chip chip--world-region chip--region-${escapeHtml(article.region)}">${escapeHtml(regionLabel)}</span>
          <span class="chip chip--world-topic chip--topic-${escapeHtml(article.topic)}">${escapeHtml(topicLabel)}</span>
        </header>
        <time class="card__time" datetime="${escapeHtml(article.publishedAt)}" title="${escapeHtml(formatDateJST(article.publishedAt))}">${escapeHtml(relativeTime(article.publishedAt))}</time>
        <h3 class="card__title">
          <a href="${escapeHtml(article.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a>
        </h3>
        <p class="card__summary">${escapeHtml(article.summary)}</p>
        <p class="card__original" lang="en">${escapeHtml(article.originalTitle)}</p>
        <footer class="card__foot">
          <a class="card__source" href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.sourceName)}</a>
          <span class="world-card__score" title="curation score">score ${escapeHtml(article.curationScore ?? '')}</span>
        </footer>
      </article>`;
}

function renderJsonLd({ generatedAt, articles }) {
  const itemList = articles.slice(0, 40).map((article, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: article.id,
    item: {
      '@type': 'NewsArticle',
      '@id': article.id,
      headline: article.title,
      url: article.id,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: 'ja-JP',
      description: article.summary,
      translationOfWork: {
        '@type': 'NewsArticle',
        headline: article.originalTitle,
        inLanguage: 'und',
      },
      publisher: {
        '@type': 'Organization',
        name: article.sourceName,
        url: article.sourceUrl,
      },
      articleSection: article.topicLabel ?? TOPIC_UI[article.topic] ?? '一般',
      spatialCoverage: article.regionLabel ?? REGION_UI[article.region] ?? '',
    },
  }));

  return `<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#website`,
        url: SITE_URL,
        name: 'Deaf Navi',
        inLanguage: 'ja-JP',
      },
      {
        '@type': 'CollectionPage',
        '@id': `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: SITE_NAME,
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        isPartOf: { '@id': `${SITE_URL}#website` },
        dateModified: generatedAt,
      },
      {
        '@type': 'ItemList',
        '@id': `${PAGE_URL}#itemlist`,
        name: 'Deaf Navi World 海外ニュース',
        numberOfItems: itemList.length,
        itemListElement: itemList,
      },
    ],
  }, null, 2)}
</script>`;
}

function renderPage(data) {
  const articles = data.articles ?? [];
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  const initialVisible = Math.min(INITIAL_VISIBLE, articles.length);
  const generatedLocal = formatDateJST(generatedAt);
  const articlesHtml = articles.map(renderArticle).join('\n');
  const regionButtons = renderButtons(REGION_ORDER, REGION_UI, 'data-filter-region', 'すべての地域');
  const topicButtons = renderButtons(TOPIC_ORDER, TOPIC_UI, 'data-filter-topic', 'すべてのカテゴリ');
  const ogImage = `${SITE_URL}og-image-world.svg`;
  const jsonLd = renderJsonLd({ generatedAt, articles });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} | 世界の聴覚障害ニュース</title>
  <meta name="description" content="${escapeHtml(SITE_DESC)}">
  <meta name="keywords" content="Deaf Navi World,聴覚障害,ろう者,難聴,手話,情報保障,海外ニュース,世界ニュース,deaf,hard of hearing,sign language">
  <meta name="author" content="TAMA">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <meta name="googlebot" content="index,follow">
  <meta name="theme-color" content="#5a7a48">
  <link rel="canonical" href="${PAGE_URL}">
  <link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="${FEED_URL}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Deaf Navi">
  <meta property="og:title" content="${SITE_NAME} | 世界の聴覚障害ニュース">
  <meta property="og:description" content="${escapeHtml(SITE_DESC)}">
  <meta property="og:url" content="${PAGE_URL}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Deaf Navi World - 世界の聴覚障害ニュース">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${SITE_NAME} | 世界の聴覚障害ニュース">
  <meta name="twitter:description" content="${escapeHtml(SITE_DESC)}">
  <meta name="twitter:image" content="${ogImage}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Shippori+Mincho+B1:wght@500;600;700&display=swap">
  <link rel="stylesheet" href="./styles-world.css">

  ${jsonLd}
  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--world" role="banner">
    <div class="container">
      <p class="site-breadcrumb"><a href="./">Deaf Navi</a> <span aria-hidden="true">›</span> <span>World</span></p>
      <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">World</span></h1>
      <p class="site-lead">世界中の主要メディアが報じる聴覚障害・ろう者・難聴・手話・情報保障のニュースを、日本語に翻訳して地域別にキュレーションします。</p>
      <div class="world-summary" aria-label="Deaf Navi World summary">
        <span><strong>${articles.length}</strong> 件</span>
        <span>4地域</span>
        <span>${Object.keys(TOPIC_UI).length - 1}カテゴリ</span>
        <span>最終更新 ${escapeHtml(generatedLocal)}</span>
      </div>
    </div>
  </header>

  <nav class="filters filters--world" role="navigation" aria-label="Deaf Navi World フィルタ">
    <div class="container">
      <div class="world-filter-group" aria-label="地域で絞り込み">
        <span class="filters__label">地域</span>
        <div class="filters__row" role="group" aria-label="地域で絞り込み">
          ${regionButtons}
        </div>
      </div>
      <div class="world-filter-group" aria-label="カテゴリで絞り込み">
        <span class="filters__label">カテゴリ</span>
        <div class="filters__row" role="group" aria-label="カテゴリで絞り込み">
          ${topicButtons}
        </div>
      </div>
    </div>
  </nav>

  <main id="main" class="container" role="main">
    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading">World News</h2>
        <p class="meta">
          表示中: <strong id="visible-count">${initialVisible}</strong> / 全 <strong id="total-count">${articles.length}</strong> 件
          <span class="meta__sep" aria-hidden="true">/</span>
          最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
        </p>
      </div>
      <p class="world-note">タイトルと要約は日本語翻訳済みです。カード下部に原題を併記しています。</p>
      <div id="articles" class="articles">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" hidden>該当する記事がありません。</p>
      <div class="load-more-wrap">
        <button type="button" id="load-more-btn" class="load-more-btn"${articles.length <= INITIAL_VISIBLE ? ' hidden' : ''}>
          もっと読む<span class="load-more-btn__remain" id="load-more-remain">（あと ${articles.length - initialVisible} 件）</span>
        </button>
      </div>
      <p class="about__back"><a href="./">← Deaf Navi に戻る</a></p>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p>Deaf Navi World は Google News RSS を入口に、世界各地域の主要メディア発信記事を関連性スコアで絞り込み、Codex app server の自動キュレーションで日本語翻訳して掲載しています。</p>
      <p>記事の著作権は各発信元に帰属します。リンク先は外部サイトです。翻訳は概要把握のための自動翻訳です。</p>
      <p><a href="${FEED_URL}">RSSフィード</a> ・ <a href="${SITEMAP_URL}">サイトマップ</a></p>
      <hr class="site-footer__divider" aria-hidden="true">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Deaf Navi World.</span>
      </p>
    </div>
  </footer>

  <script src="./app-world.js" defer></script>
</body>
</html>`;
}

function renderRss(data) {
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  const items = (data.articles ?? []).slice(0, 80).map((article) => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.id)}</link>
      <guid isPermaLink="true">${escapeXml(article.id)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(article.summary)}</description>
      <source url="${escapeXml(article.sourceUrl)}">${escapeXml(article.sourceName)}</source>
      <category>${escapeXml(article.regionLabel ?? REGION_UI[article.region] ?? '')}</category>
      <category>${escapeXml(article.topicLabel ?? TOPIC_UI[article.topic] ?? '')}</category>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${PAGE_URL}</link>
    <description>${SITE_DESC}</description>
    <language>ja</language>
    <lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function renderSitemap(data) {
  const lastmod = new Date(data.generatedAt ?? Date.now()).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PAGE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;
}

async function main() {
  const raw = await readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  await mkdir(DOCS, { recursive: true });
  await writeFile(HTML_OUT, renderPage(data), 'utf8');
  await writeFile(FEED_OUT, renderRss(data), 'utf8');
  await writeFile(SITEMAP_OUT, renderSitemap(data), 'utf8');
  await copyFile(STYLES_SRC, STYLES_OUT);
  await copyFile(APP_SRC, APP_OUT);
  await copyFile(OG_SRC, OG_OUT);
  console.log(`Deaf Navi World: built ${HTML_OUT}`);
}

main().catch((err) => {
  console.error('Deaf Navi World build failed:', err);
  process.exit(1);
});
