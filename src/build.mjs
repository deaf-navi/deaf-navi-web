import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');

const VARIANT = getVariant();
const IS_DEV = VARIANT === 'dev';
const HAS_ARCHIVE = true;
const SUFFIX = IS_DEV ? '-dev' : '';

const DATA_FILE = join(DOCS, `articles${SUFFIX}.json`);
const OLD_DATA_FILE = join(DOCS, `articles-old${SUFFIX}.json`);
const HTML_OUT = join(DOCS, `index${SUFFIX}.html`);
const OLD_HTML_OUT = join(DOCS, `index-old${SUFFIX}.html`);
const STYLES_SRC = join(__dirname, 'styles.css');
const STYLES_OUT = join(DOCS, `styles${SUFFIX}.css`);
const APP_SRC = join(__dirname, 'app.js');
const APP_OUT = join(DOCS, `app${SUFFIX}.js`);
const OG_SRC = join(__dirname, 'og-image.svg');
const OG_OUT = join(DOCS, `og-image${SUFFIX}.svg`);

const SITE_URL = 'https://tamas-hub.github.io/deaf-navi-web/';
const PAGE_URL = IS_DEV ? `${SITE_URL}index-dev.html` : SITE_URL;
const ABOUT_FILE = `about${SUFFIX}.html`;
const OLD_INDEX_FILE = `index-old${SUFFIX}.html`;
const FEED_FILE = `feed${SUFFIX}.xml`;
const SITEMAP_FILE = `sitemap${SUFFIX}.xml`;
const SITEMAP_HTML_FILE = `sitemap${SUFFIX}.html`;
const ROBOTS_FILE = `robots${SUFFIX}.txt`;
const STYLES_FILE = `styles${SUFFIX}.css`;
const APP_FILE = `app${SUFFIX}.js`;
const OG_FILE = `og-image${SUFFIX}.svg`;
const ABOUT_URL = `${SITE_URL}${ABOUT_FILE}`;
const OLD_PAGE_URL = `${SITE_URL}${OLD_INDEX_FILE}`;
const FEED_URL = `${SITE_URL}${FEED_FILE}`;
const SITEMAP_URL = `${SITE_URL}${SITEMAP_FILE}`;
const SITEMAP_HTML_URL = `${SITE_URL}${SITEMAP_HTML_FILE}`;
const SITE_NAME = 'Deaf Navi Web';
const SITE_TAGLINE = '聴覚障害・難聴・手話に関するニュースと一次情報';
const SITE_DESC = '聴覚障害・難聴・ろう者・手話に関する一次情報と報道を、出典と選定区分を明示して届ける無料ニュースキュレーション。制度・情報保障・医療・教育・技術・防災・文化・デフスポーツを1日3回更新します。';
const SITE_KEYWORDS = '聴覚障害,難聴,ろう者,ろうあ者,中途失聴,手話,情報保障,アクセシビリティ,防災,技術,AI,イベント,講座,補聴器,人工内耳,手話言語条例,聴覚障害ニュース,手話ニュース,難聴者,デフ,deaf,字幕,電話リレー,要約筆記,ろう学校,聴覚特別支援';
const LATEST_UPDATE_DATE = '2026-07-14';

const CATEGORY_ORDER = ['all', 'policy', 'accessibility', 'medical', 'education', 'technology', 'culture', 'sports', 'safety', 'event', 'relay', 'local', 'general'];
const CATEGORY_UI = {
  all: 'すべて',
  policy: '制度・政策',
  accessibility: '情報保障・アクセシビリティ',
  relay: '電話リレー・ヨメテル',
  medical: '医療',
  education: '教育',
  technology: '技術・AI',
  culture: '文化・芸能',
  sports: 'デフスポーツ',
  safety: '防災・安全',
  event: 'イベント・講座',
  local: '地域',
  general: '一般',
};

const INITIAL_VISIBLE = 60;
const EXCLUDED_FROM_ALL = new Set(['relay']);
const SOURCE_TIER_UI = {
  official: { label: '一次情報', description: '公式団体・公的機関が発信した情報' },
  specialist: { label: '専門情報', description: '専門団体・専門媒体が発信した情報' },
  news: { label: '報道・発見', description: 'Google News等から発見した報道・公開情報' },
  broad: { label: '関連媒体', description: '関連分野を扱う媒体が発信した情報' },
};

// Cloudflare Web Analytics — cookieless / privacy-friendly
const CF_ANALYTICS_TOKEN = '6473e8a5f9904585a0f0f17c8a3edfe0';
const CF_ANALYTICS_SNIPPET = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_ANALYTICS_TOKEN}"}'></script>`;

function getVariant() {
  if (process.env.CURATION_VARIANT === 'dev') return 'dev';
  if (process.argv.includes('--dev')) return 'dev';
  const variantArg = process.argv.find((arg) => arg.startsWith('--variant='));
  return variantArg?.split('=')[1] === 'dev' ? 'dev' : 'prod';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ISO → "YYYY-MM-DD HH:mm JST"（日本標準時固定） */
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
  return `${months}ヶ月前`;
}

function isDefaultVisibleCategory(category) {
  return !EXCLUDED_FROM_ALL.has(category);
}

function getSourceTier(article) {
  return SOURCE_TIER_UI[article.sourceTier] ? article.sourceTier : 'news';
}

function renderArticle(a, index, defaultIndex = index) {
  const catLabel = CATEGORY_UI[a.category] ?? '一般';
  const sourceTier = getSourceTier(a);
  const sourceMeta = SOURCE_TIER_UI[sourceTier];
  const hidden = defaultIndex < 0 || defaultIndex >= INITIAL_VISIBLE ? ' hidden' : '';
  return `
      <article class="card" data-category="${escapeHtml(a.category)}" data-source-tier="${escapeHtml(sourceTier)}" data-index="${index}" data-default-index="${defaultIndex}"${hidden}>
        <header class="card__head">
          <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(catLabel)}</span>
          <time class="card__time" datetime="${escapeHtml(a.publishedAt)}" title="${escapeHtml(formatDateJST(a.publishedAt))}">${escapeHtml(relativeTime(a.publishedAt))}</time>
        </header>
        <h3 class="card__title">
          <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
        </h3>
        <p class="card__summary">${escapeHtml(a.summary)}</p>
        <footer class="card__foot">
          <div class="card__source-group">
            <span class="source-tier source-tier--${escapeHtml(sourceTier)}" title="${escapeHtml(sourceMeta.description)}">${escapeHtml(sourceMeta.label)}</span>
            <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
          </div>
          <a class="card__read" href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(a.title)}の記事を読む">記事を読む <span aria-hidden="true">↗</span></a>
        </footer>
      </article>`;
}

function renderArchiveArticle(a) {
  const catLabel = CATEGORY_UI[a.category] ?? '一般';
  return `
          <article class="card archive-card" data-category="${escapeHtml(a.category)}">
            <header class="card__head">
              <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(catLabel)}</span>
              <time class="card__time" datetime="${escapeHtml(a.publishedAt)}" title="${escapeHtml(formatDateJST(a.publishedAt))}">${escapeHtml(formatDateJST(a.publishedAt))}</time>
            </header>
            <h3 class="card__title">
              <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
            </h3>
            <p class="card__summary">${escapeHtml(a.summary)}</p>
            <footer class="card__foot">
              <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
            </footer>
          </article>`;
}

function renderFilterButtons() {
  const filters = CATEGORY_ORDER.map(
    (c) =>
      `<button type="button" class="filter${c === 'all' ? ' is-active' : ''}" data-filter="${c}" aria-pressed="${c === 'all' ? 'true' : 'false'}">${CATEGORY_UI[c]}</button>`,
  ).join('\n          ');
  const worldLink = `<a class="filter filter--world-link" href="./deaf-navi-world-jp.html"><span class="filter--world-link__icon" aria-hidden="true">🌐</span><span>Deaf Navi World-JP</span></a>`;
  const aboutLink = `<a class="filter filter--about" href="./${ABOUT_FILE}" target="_blank" rel="noopener">Deaf Naviについて<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg></a>`;
  return `${filters}\n          ${worldLink}\n          ${aboutLink}`;
}

function renderDiscoveryTools() {
  return `
        <form class="discovery-tools" id="news-search-form" role="search">
          <div class="search-field">
            <label class="sr-only" for="news-search">ニュースを検索</label>
            <input id="news-search" name="q" type="search" inputmode="search" autocomplete="off" placeholder="記事タイトル・要約・情報源を検索">
            <button class="search-field__clear" id="news-search-clear" type="button" aria-label="検索語を消去" hidden>×</button>
          </div>
          <label class="source-select">
            <span class="source-select__label">情報源</span>
            <select id="source-filter" name="source">
              <option value="all">すべて</option>
              <option value="primary">一次・専門</option>
              <option value="news">報道・発見</option>
              <option value="other">関連媒体</option>
            </select>
          </label>
        </form>`;
}

/** 構造化データ JSON-LD（WebSite + Organization + ItemList of NewsArticle） */
function renderJsonLd({ generatedAt, articles }) {
  const topArticles = articles.slice(0, 30); // ItemListは上位30件に絞る
  const itemList = topArticles.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: a.id,
    item: {
      '@type': 'NewsArticle',
      '@id': a.id,
      headline: a.title,
      url: a.id,
      datePublished: a.publishedAt,
      dateModified: a.publishedAt,
      inLanguage: 'ja-JP',
      description: a.summary,
      isAccessibleForFree: true,
      publisher: {
        '@type': 'Organization',
        name: a.sourceName,
        url: a.sourceUrl,
      },
      articleSection: CATEGORY_UI[a.category] ?? '一般',
    },
  }));

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: 'Deaf Navi ニュース',
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        dateModified: generatedAt,
        publisher: { '@id': `${SITE_URL}#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}#organization`,
        name: 'TAMA',
        url: SITE_URL,
      },
      {
        '@type': 'CollectionPage',
        '@id': `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: `${IS_DEV ? '[DEV] ' : ''}${SITE_NAME} | ${SITE_TAGLINE}`,
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        isPartOf: { '@id': `${SITE_URL}#website` },
        dateModified: generatedAt,
        mainEntity: { '@id': `${PAGE_URL}#itemlist` },
        about: [
          { '@type': 'Thing', name: '聴覚障害' },
          { '@type': 'Thing', name: '難聴' },
          { '@type': 'Thing', name: 'ろう者' },
          { '@type': 'Thing', name: '手話' },
          { '@type': 'Thing', name: '情報保障' },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${PAGE_URL}#itemlist`,
        name: `${IS_DEV ? '[DEV] ' : ''}聴覚障害関連ニュース最新記事`,
        numberOfItems: topArticles.length,
        itemListElement: itemList,
      },
    ],
  };

  return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`;
}

function renderPage({ generatedAt, count, articles }) {
  let defaultIndex = 0;
  const articlesHtml = articles.map((a, i) => {
    const articleDefaultIndex = isDefaultVisibleCategory(a.category) ? defaultIndex++ : -1;
    return renderArticle(a, i, articleDefaultIndex);
  }).join('\n');
  const defaultCount = defaultIndex;
  const initialVisible = Math.min(INITIAL_VISIBLE, defaultCount);
  const generatedLocal = formatDateJST(generatedAt);
  const jsonLd = renderJsonLd({ generatedAt, articles });
  const sourceCounts = articles
    .filter((article) => isDefaultVisibleCategory(article.category))
    .reduce((counts, article) => {
      const tier = getSourceTier(article);
      counts[tier] = (counts[tier] ?? 0) + 1;
      return counts;
    }, {});
  const primarySourceCount = (sourceCounts.official ?? 0) + (sourceCounts.specialist ?? 0);
  const discoveredSourceCount = sourceCounts.news ?? 0;

  const updateLabel = '1日3回更新';
  const pageTitle = `${IS_DEV ? '[DEV] ' : ''}${SITE_NAME} | 聴覚障害・難聴・手話のニュース`;
  const ogImage = `${SITE_URL}${OG_FILE}`;
  const robots = IS_DEV ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const googlebot = IS_DEV ? robots : 'index,follow';
  const headerSub = IS_DEV ? 'Web DEV' : 'Web';
  const leadPrefix = IS_DEV ? 'テスト版。dev品質フィルタで生成中。 ' : '';
  const archiveLink = HAS_ARCHIVE
    ? `<p class="archive-link"><a href="./${OLD_INDEX_FILE}">過去アーカイブを見る</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(SITE_DESC)}">
  <meta name="keywords" content="${escapeHtml(SITE_KEYWORDS)}">
  <meta name="author" content="TAMA">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="robots" content="${robots}">
  <meta name="googlebot" content="${googlebot}">
  <meta name="theme-color" content="#075e57">

  <link rel="canonical" href="${IS_DEV ? SITE_URL : PAGE_URL}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)}" href="${FEED_URL}">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(SITE_DESC)}">
  <meta property="og:url" content="${PAGE_URL}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(SITE_DESC)}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:image:alt" content="Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="./${STYLES_FILE}">

  ${jsonLd}

  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>
    </div>
    <div class="container">
      <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">${headerSub}</span></h1>
      <p class="site-lead">${leadPrefix}聴覚障害・難聴・ろう者コミュニティに必要なニュースを、一次情報・専門情報・報道の区分とともに届けます。</p>
      <p class="site-update-schedule">${updateLabel} <span aria-hidden="true">•</span> JST 6:00 / 12:00 / 18:00ごろ</p>
    </div>
  </header>

  <nav class="filters" role="navigation" aria-label="カテゴリフィルター">
    <div class="container">
        <div class="filters__row" role="group" aria-label="カテゴリで絞り込む">
          ${renderFilterButtons()}
        </div>
${renderDiscoveryTools()}
      </div>
    </nav>

  <main id="main" class="container" role="main">
    <aside class="curation-overview" aria-label="キュレーション状況">
      <div>
        <p class="curation-overview__eyebrow">選定状況</p>
        <p class="curation-overview__summary">出典の種類を見分けながら、必要な情報へすばやく移動できます。</p>
      </div>
      <dl class="curation-overview__metrics">
        <div><dt>一次・専門</dt><dd>${primarySourceCount}件</dd></div>
        <div><dt>報道・発見</dt><dd>${discoveredSourceCount}件</dd></div>
        <div><dt>最終更新</dt><dd><time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time></dd></div>
      </dl>
      <a class="curation-overview__policy" href="./${ABOUT_FILE}#about-policy">選定方針を見る <span aria-hidden="true">→</span></a>
    </aside>

    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading">最新ニュース</h2>
        <p class="meta" aria-live="polite">
          表示中: <strong id="visible-count">${initialVisible}</strong> / 全 <strong id="total-count">${defaultCount}</strong> 件
          <span class="meta__sep" aria-hidden="true">/</span>
          最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
        </p>
      </div>
      <div id="articles" class="articles">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" hidden>該当する記事がありません。</p>
      <div class="load-more-wrap">
        <button type="button" id="load-more-btn" class="load-more-btn"${defaultCount <= INITIAL_VISIBLE ? ' hidden' : ''}>
          もっと読む<span class="load-more-btn__remain" id="load-more-remain">（あと ${defaultCount - initialVisible} 件）</span>
        </button>
      </div>
      ${archiveLink}

      <aside class="app-cta" aria-label="Deaf Navi アプリのご案内">
        <div class="app-cta__text">
          <span class="app-cta__label">iPhone App</span>
          <h2 class="app-cta__title">外出先でも、Deaf Navi を。</h2>
          <p class="app-cta__desc">同じキュレーションをスマホからも閲覧できる iOS アプリ「Deaf Navi」。緊急カード・手話ガイド・制度情報をオフラインでも。</p>
        </div>
        <a class="app-cta__btn" href="https://apps.apple.com/jp/app/deaf-navi/id6761352199" target="_blank" rel="noopener noreferrer">
          App Store で見る
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 17L17 7"/>
            <path d="M8 7h9v9"/>
          </svg>
        </a>
      </aside>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p>公式・専門団体の直接配信と Google News RSS を情報源に、関連性・鮮度・重複を自動判定しています。内容の確認は各元記事をご覧ください。</p>
      <p>記事の著作権は各発信元に帰属します。リンク先は外部サイトです。更新は1日3回です。</p>
      <p><a href="./${ABOUT_FILE}#about-policy">選定方針</a> ・ <a href="${FEED_URL}">RSSフィード</a> ・ <a href="${SITEMAP_HTML_URL}">サイトマップ</a></p>
      <hr class="site-footer__divider" aria-hidden="true">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>

  <script src="./${APP_FILE}" defer></script>
</body>
</html>
`;
}

function monthKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' }).format(d);
  return `${year}-${month}`;
}

function monthLabel(key) {
  if (key === 'unknown') return '日付不明';
  const [year, month] = key.split('-');
  return `${year}年${Number(month)}月`;
}

function groupArticlesByMonth(articles) {
  const groups = new Map();
  for (const article of articles) {
    const key = monthKey(article.publishedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function renderArchivePage({ generatedAt, count, articles }) {
  const groups = groupArticlesByMonth(articles);
  const generatedLocal = formatDateJST(generatedAt);
  const archiveTitle = IS_DEV ? '[DEV] Deaf Navi Web 過去アーカイブ' : 'Deaf Navi Web 過去アーカイブ';
  const archiveDescription = IS_DEV
    ? 'Deaf Navi Web dev版の400件超過分を年別・月別に蓄積した過去アーカイブ。'
    : 'Deaf Navi Web の400件超過分を年別・月別に蓄積した過去アーカイブ。';
  const archiveOgDescription = IS_DEV
    ? '400件超過分を年別・月別に蓄積したdev版アーカイブ。'
    : '400件超過分を年別・月別に蓄積したアーカイブ。';
  const archiveRobots = IS_DEV ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const archiveHomeLabel = IS_DEV ? 'Deaf Navi Web DEV' : 'Deaf Navi Web';
  const archiveBackLabel = IS_DEV ? 'DEVトップへ戻る' : 'トップへ戻る';
  const archiveHomeFile = IS_DEV ? 'index-dev.html' : '';
  const archiveSections = groups.map(([key, items]) => `
    <section class="archive-month" aria-labelledby="archive-${escapeHtml(key)}">
      <div class="archive-month__head">
        <h2 id="archive-${escapeHtml(key)}">${escapeHtml(monthLabel(key))}</h2>
        <p class="meta"><strong>${items.length}</strong> 件</p>
      </div>
      <div class="articles archive-articles">
${items.map(renderArchiveArticle).join('\n')}
      </div>
    </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(archiveTitle)}</title>
  <meta name="description" content="${escapeHtml(archiveDescription)}">
  <meta name="robots" content="${archiveRobots}">
  <meta name="googlebot" content="${archiveRobots}">
  <link rel="canonical" href="${OLD_PAGE_URL}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(archiveTitle)}">
  <meta property="og:description" content="${escapeHtml(archiveOgDescription)}">
  <meta property="og:url" content="${OLD_PAGE_URL}">
  <meta property="og:image" content="${SITE_URL}${OG_FILE}">
  <meta property="og:locale" content="ja_JP">
  <meta name="theme-color" content="#075e57">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="./${STYLES_FILE}">

  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--slim" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>
    </div>
    <div class="container">
      <p class="site-breadcrumb"><a href="./${archiveHomeFile}">${archiveHomeLabel}</a> <span aria-hidden="true">›</span> <span>過去アーカイブ</span></p>
      <h1 class="site-title site-title--small"><span class="site-title__brand">過去アーカイブ</span></h1>
      <p class="site-lead">400件を超えた記事を、年別・月別に蓄積しています。</p>
    </div>
  </header>

  <main id="main" class="container archive" role="main">
    <div class="articles-head">
      <h2 id="articles-heading">アーカイブ</h2>
      <p class="meta">
        全 <strong>${count}</strong> 件
        <span class="meta__sep" aria-hidden="true">/</span>
        最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
      </p>
    </div>
${archiveSections || '<p class="empty">アーカイブ対象の記事はまだありません。</p>'}
    <p class="about__back"><a href="./${archiveHomeFile}">← ${archiveBackLabel}</a></p>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderAboutPage({ generatedAt }) {
  const aboutTitle = `${IS_DEV ? '[DEV] ' : ''}Deaf Naviについて | ${SITE_NAME}`;
  const indexHref = IS_DEV ? './index-dev.html' : './';
  const robots = IS_DEV ? 'noindex,nofollow,noarchive' : 'index,follow';
  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': ABOUT_URL,
    url: ABOUT_URL,
    name: aboutTitle,
    description: 'Deaf Navi Web と Deaf Navi World-JP/Original のコンセプト・情報源・更新頻度・運営者情報。',
    inLanguage: 'ja-JP',
    dateModified: generatedAt,
    lastReviewed: LATEST_UPDATE_DATE,
    isPartOf: { '@id': `${SITE_URL}#website` },
  };
  const expandedSourceSection = `
      <h3 class="about__h3">国内版: 追加公式・専門ソース</h3>
      <ul>
        <li><a href="https://www.zennancho.or.jp/" target="_blank" rel="noopener noreferrer">全日本難聴者・中途失聴者団体連合会</a>、<a href="https://www.com-sagano.com/" target="_blank" rel="noopener noreferrer">全国手話研修センター</a>、<a href="https://www.jyoubun-center.or.jp/" target="_blank" rel="noopener noreferrer">聴力障害者情報文化センター</a> ほか</li>
        <li><a href="https://www.nftrs.or.jp/" target="_blank" rel="noopener noreferrer">電話リレーサービス</a>、<a href="https://zentsuken.cocolog-nifty.com/blog/" target="_blank" rel="noopener noreferrer">全通研NOW!!</a>、<a href="https://audiology-japan.jp/" target="_blank" rel="noopener noreferrer">日本聴覚医学会</a> ほか</li>
        <li>YouTube公式チャンネル、note、UDCast、Palabra、Silent Voice などの公開RSS/Atom</li>
        <li>追加ソースとSNS系は関連語スコアが一定以上の記事のみ掲載候補にしています</li>
      </ul>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(aboutTitle)}</title>
  <meta name="description" content="Deaf Navi Web と Deaf Navi World-JP/Original のコンセプト、情報源、更新頻度、運営者（TAMA）についてのご案内。聴覚障害・ろう者コミュニティ向けニュースキュレーションサイトのポリシー・背景情報。">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${IS_DEV ? `${SITE_URL}about.html` : ABOUT_URL}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)}" href="${FEED_URL}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(aboutTitle)}">
  <meta property="og:description" content="Deaf Navi Web と Deaf Navi World-JP/Original のコンセプト・情報源・更新頻度・運営者情報。">
  <meta property="og:url" content="${ABOUT_URL}">
  <meta property="og:image" content="${SITE_URL}${OG_FILE}">
  <meta property="og:locale" content="ja_JP">
  <meta property="article:modified_time" content="${escapeHtml(generatedAt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(aboutTitle)}">
  <meta name="twitter:description" content="Deaf Navi Web の情報源、選定方針、更新履歴をご案内します。">
  <meta name="twitter:image" content="${SITE_URL}${OG_FILE}">
  <meta name="theme-color" content="#075e57">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="./${STYLES_FILE}">

  <script type="application/ld+json">
${JSON.stringify(aboutJsonLd, null, 2)}
  </script>

  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--slim" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>
    </div>
    <div class="container">
      <p class="site-breadcrumb"><a href="${indexHref}">Deaf Navi Web</a> <span aria-hidden="true">›</span> <span>Deaf Naviについて${IS_DEV ? ' DEV' : ''}</span></p>
      <h1 class="site-title site-title--small"><span class="site-title__brand">Deaf Naviについて${IS_DEV ? ' DEV' : ''}</span></h1>
    </div>
  </header>

  <main id="main" class="container about" role="main">
    <section aria-labelledby="about-concept">
      <h2 id="about-concept" class="about__h2">このサイトについて</h2>
      <p>Deaf Navi Web は、<strong>聴覚障害・難聴・ろう者・中途失聴者</strong>のコミュニティに関わる情報を、信頼できる情報源から自動収集・分類してお届けする無料ニュースキュレーションサイトです。</p>
      <p>国内ニュースを扱う Deaf Navi Web に加え、海外ニュースを扱う <a href="./deaf-navi-world-jp.html">Deaf Navi World-JP</a>（日本語翻訳版）と <a href="./deaf-navi-world-original.html">Deaf Navi World-Original</a>（原文版）を公開しています。情報保障・手話・制度・医療・教育・技術・防災・文化・デフスポーツなど、暮らしと権利に直結するトピックを幅広くカバーします。</p>
    </section>

    <section id="updates" aria-labelledby="about-updates">
      <h2 id="about-updates" class="about__h2">アップデート情報</h2>
      <article class="release-note">
        <header class="release-note__head">
          <time datetime="${LATEST_UPDATE_DATE}">2026年7月14日</time>
          <h3>キュレーション品質・検索・視認性を改善</h3>
        </header>
        <ul>
          <li>記事ごとに「一次情報」「専門情報」「報道・発見」「関連媒体」の選定区分を表示</li>
          <li>フィード取得の再試行と前回記事の短期補完を追加し、一時的な配信障害でも一覧が欠けにくい構成へ変更</li>
          <li>公開日から180日を超える記事を最新一覧の候補から除外し、異なる日付・開催地の記事を誤って重複扱いしにくい判定へ改善</li>
          <li>記事検索と情報源フィルターを追加し、文字サイズ・コントラスト・一覧密度を見直し</li>
          <li>検索URL、構造化データ、ページ説明、更新情報を整備してSEOとサイトの透明性を強化</li>
        </ul>
      </article>
    </section>

    <section aria-labelledby="about-sources">
      <h2 id="about-sources" class="about__h2">情報源</h2>
      <h3 class="about__h3">国内版: 公式・専門媒体（直接RSS/Atom）</h3>
      <ul>
        <li><a href="https://www.jfd.or.jp/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟</a> — 全国規模の連盟公式情報（制度・手話言語法を含む）</li>
        <li><a href="https://www.tfd.deaf.tokyo/" target="_blank" rel="noopener noreferrer">東京都聴覚障害者連盟</a> — 地域連盟の活動情報</li>
        <li><a href="https://shikaku.in/" target="_blank" rel="noopener noreferrer">しかくタイムズ</a> — ろう者・難聴者向けイベント情報</li>
        <li><a href="https://co-coco.jp/" target="_blank" rel="noopener noreferrer">こここ</a> — マガジンハウス運営の福祉クリエイティブマガジン</li>
        <li><a href="https://ameblo.jp/jtd2009/" target="_blank" rel="noopener noreferrer">日本ろう者劇団</a> — 手話狂言・公演情報</li>
        <li><a href="https://www.jfd.or.jp/sc/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟スポーツ委員会</a>、<a href="https://jdba.sakura.ne.jp/" target="_blank" rel="noopener noreferrer">日本デフバスケットボール協会</a>、<a href="https://www.deafswim.or.jp/" target="_blank" rel="noopener noreferrer">日本デフ水泳協会</a> — 国内デフスポーツ情報</li>
      </ul>
${expandedSourceSection}
      <h3 class="about__h3">国内版: 主要報道機関・公的機関（Google News RSS）</h3>
      <ul>
        <li>朝日新聞・読売新聞・NHK系記事・自治体/公的機関・PR TIMES など、Google News RSS に掲載される国内ニュースを参照します。</li>
        <li>キーワード: 聴覚障害 / 難聴 / ろう者 / 手話 / 情報保障 / アクセシビリティ / 防災 / 技術・AI / イベント・講座 / 電話リレー / ヨメテル / 補聴器 / 人工内耳 / ろう学校 / デフスポーツ / ろう文化・芸能 ほか</li>
        <li>電話リレー・ヨメテル系の記事は専用カテゴリで表示し、トップの「すべて」からは除外しています。</li>
      </ul>

      <h3 class="about__h3">Deaf Navi World: 海外主要メディア + 多言語地域検索（Google News RSS）</h3>
      <ul>
        <li>海外版は、公式サイトの小さな更新を広く拾うのではなく、Google News RSS を入口に主要メディアの記事と多言語の地域別検索結果を収集します。</li>
        <li>アジア・オセアニア: ABC News Australia、SBS News、The Guardian、RNZ、CNA、The Japan Times、The Korea Herald ほか</li>
        <li>北米・中南米: AP News、Reuters、NPR、The New York Times、The Washington Post、CBC News、El Pais、Folha de S.Paulo ほか</li>
        <li>ヨーロッパ・CIS: BBC News、Reuters、Deutsche Welle、France 24、Euronews、POLITICO Europe、Le Monde、The Kyiv Independent ほか</li>
        <li>中東・アフリカ: Al Jazeera、The National、Arab News、Africanews、News24、Daily Maverick、Nation Africa ほか</li>
        <li>英語に加えて、スペイン語、ポルトガル語、フランス語、ドイツ語、イタリア語、トルコ語、韓国語、中国語、アラビア語などの検索語を使い、鮮度を優先しながら地域が偏りすぎないように並べています。</li>
        <li>Deaf Navi World-JP は自動翻訳後に「ろう」「難聴」「手話」「補聴器」「Auslan」などの用語補正を行い、Codex App Server が利用できる環境ではタイトル・要約をニュース見出しとして自然な日本語に整えます。Deaf Navi World-Original では翻訳せず、各ソースの原文タイトル・要約を表示します。</li>
      </ul>
    </section>

    <section id="about-policy" aria-labelledby="about-policy-heading">
      <h2 id="about-policy-heading" class="about__h2">選定方針と確実性</h2>
      <div class="policy-levels" aria-label="情報源の選定区分">
        <p><strong>一次情報</strong><span>公式団体・公的機関が発信した情報。直接フィードまたはGoogle News経由で取得</span></p>
        <p><strong>専門情報</strong><span>聴覚障害、手話、医療、教育、デフスポーツ等の専門団体・媒体が発信した情報</span></p>
        <p><strong>報道・発見</strong><span>Google News RSSを入口に発見し、関連度と出典優先度で選別した報道・公開情報</span></p>
        <p><strong>関連媒体</strong><span>周辺分野を扱う媒体から、関連度が基準を満たした記事</span></p>
      </div>
      <p>同じ話題が複数ある場合は、公式・専門ソース、公的機関、主要報道機関を優先します。タイトルの近似だけでなくURL・日付・数字も見て重複を整理し、見出しとほぼ同じ要約や配信システム由来の定型文は表示しません。</p>
      <p>自動キュレーションは記事の事実関係を独自に保証するものではありません。特に医療・制度・災害情報は、カードに表示される選定区分を参考にしつつ、必ずリンク先の公式情報・元記事で最新内容をご確認ください。</p>
    </section>

    <section aria-labelledby="about-categories">
      <h2 id="about-categories" class="about__h2">カテゴリ分類</h2>
      <p>記事はタイトル・要約から自動で以下のカテゴリに分類されます:</p>
      <ul>
        <li><strong>制度・政策</strong> — 法律・条例・給付・雇用・助成など</li>
        <li><strong>情報保障・アクセシビリティ</strong> — 手話通訳・要約筆記・字幕・合理的配慮・窓口対応など</li>
        <li><strong>電話リレー・ヨメテル</strong> — 電話リレーサービス・ヨメテル・手話リンクなど</li>
        <li><strong>医療</strong> — 病院・治療・補聴器・人工内耳・診断など</li>
        <li><strong>教育</strong> — 学校・大学・授業・入試・研究など</li>
        <li><strong>技術・AI</strong> — 音声認識・自動字幕・手話翻訳・支援技術・アプリなど</li>
        <li><strong>文化・芸能</strong> — ろう演劇・ろう映画・手話パフォーマンス・ろうアート・手話狂言など</li>
        <li><strong>デフスポーツ</strong> — デフリンピック・競技団体・選手・大会情報など</li>
        <li><strong>防災・安全</strong> — 災害情報・避難・緊急通報・警察/消防対応など</li>
        <li><strong>イベント・講座</strong> — 手話講座・講演会・セミナー・体験会・交流会など</li>
        <li><strong>地域</strong> — 都道府県・市区町村単位のローカル情報</li>
        <li><strong>一般</strong> — 上記以外の関連トピック</li>
      </ul>
    </section>

    <section aria-labelledby="about-update">
      <h2 id="about-update" class="about__h2">更新頻度・仕組み</h2>
      <p>国内本番版は GitHub Actions による自動ジョブが1日3回（JST 6:00 / 12:00 / 18:00ごろ）RSSを収集します。取得時の一時エラーは再試行し、前回取得した45日以内の記事を補完候補として使います。関連性・鮮度・出典優先度・近似重複・カテゴリを判定し、公開日から180日以内の候補を中心に、電話リレー・ヨメテルを除く通常カテゴリで最大400件を保持します。初期表示は60件で、追加表示しながら閲覧できます。</p>
      <p>Deaf Navi World は1日3回（JST 6:00 / 12:00 / 18:00ごろ）に海外ニュースを収集し、最大600件を保持します。World-JP は日本語翻訳版、World-Original は翻訳なしの原文版です。</p>
      <p>記事の本文・要約は各発信元のものを抜粋し、本文リンクはすべて各元記事の原文（外部サイト）に遷移します。記事の著作権はそれぞれの発信元に帰属します。</p>
    </section>

    <section aria-labelledby="about-operator">
      <h2 id="about-operator" class="about__h2">運営</h2>
      <p>Deaf Navi Web は <strong>TAMA</strong> が運営しています。本サイトは Deaf Navi iOS アプリのニュースキュレーション機能を Web 版として提供するものです。</p>
      <p>アプリ版: <a href="https://apps.apple.com/jp/app/deaf-navi/id6761352199" target="_blank" rel="noopener noreferrer">App Store で Deaf Navi を開く</a></p>
    </section>

    <section aria-labelledby="about-feeds">
      <h2 id="about-feeds" class="about__h2">配信・共有</h2>
      <ul>
        <li><a href="${FEED_URL}">RSS フィード</a>（最新50件）</li>
        <li><a href="./deaf-navi-world-jp.html">Deaf Navi World-JP</a>（日本語翻訳版） / <a href="./deaf-navi-world-original.html">Deaf Navi World-Original</a>（原文版）</li>
        <li><a href="https://tamas-hub.github.io/deaf-navi-web/feed-world.xml">World-JP RSS フィード</a> / <a href="https://tamas-hub.github.io/deaf-navi-web/feed-world-original.xml">World-Original RSS フィード</a></li>
        <li><a href="${SITEMAP_HTML_URL}">サイトマップ</a></li>
      </ul>
    </section>

    <p class="about__back"><a href="${indexHref}">← トップページへ戻る</a></p>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderSitemapPage({ generatedAt, count, articles }) {
  const generatedLocal = formatDateJST(generatedAt);
  const pageTitle = `${IS_DEV ? '[DEV] ' : ''}サイトマップ | ${SITE_NAME}`;
  const currentCount = Array.isArray(articles) ? articles.length : count;
  const archiveRow = HAS_ARCHIVE
    ? `<li><a href="./${OLD_INDEX_FILE}">過去アーカイブ</a><span>通常カテゴリ400件を超えた過去記事</span></li>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="Deaf Navi Web の主要ページ、RSS、XMLサイトマップ、アプリ連携用JSONへのリンクをまとめたHTMLサイトマップ。">
  <meta name="robots" content="${IS_DEV ? 'noindex,nofollow,noarchive' : 'index,follow'}">
  <meta name="theme-color" content="#075e57">
  <link rel="canonical" href="${SITEMAP_HTML_URL}">
  <link rel="stylesheet" href="./${STYLES_FILE}">
  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--slim" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>
    </div>
    <div class="container">
      <p class="site-breadcrumb"><a href="./${IS_DEV ? 'index-dev.html' : 'index.html'}">Deaf Navi Web</a> <span aria-hidden="true">›</span> <span>サイトマップ${IS_DEV ? ' DEV' : ''}</span></p>
      <h1 class="site-title site-title--small"><span class="site-title__brand">サイトマップ${IS_DEV ? ' DEV' : ''}</span></h1>
      <p class="site-lead site-lead--compact">Deaf Navi Web の公開ページと配信データへの入口をまとめています。</p>
    </div>
  </header>

  <main id="main" class="container sitemap-page" role="main">
    <section class="sitemap-summary" aria-label="サイトマップ概要">
      <div>
        <span class="sitemap-summary__label">Latest build</span>
        <strong>${escapeHtml(generatedLocal)}</strong>
      </div>
      <div>
        <span class="sitemap-summary__label">Domestic articles</span>
        <strong>${escapeHtml(String(currentCount))}</strong>
      </div>
      <div>
        <span class="sitemap-summary__label">Sitemap XML</span>
        <strong><a href="./${SITEMAP_FILE}">検索エンジン用</a></strong>
      </div>
    </section>

    <div class="sitemap-grid">
      <section class="sitemap-card" aria-labelledby="sitemap-domestic">
        <h2 id="sitemap-domestic">国内ニュース</h2>
        <ul>
          <li><a href="./${IS_DEV ? 'index-dev.html' : 'index.html'}">Deaf Navi Web トップ</a><span>聴覚障害・難聴・ろう者コミュニティ向け国内ニュース</span></li>
          ${archiveRow}
          <li><a href="./${FEED_FILE}">RSSフィード</a><span>国内ニュース最新50件</span></li>
        </ul>
      </section>

      <section class="sitemap-card" aria-labelledby="sitemap-world">
        <h2 id="sitemap-world">World</h2>
        <ul>
          <li><a href="./deaf-navi-world-jp.html">Deaf Navi World-JP</a><span>海外ニュースの日本語翻訳版</span></li>
          <li><a href="./deaf-navi-world-original.html">Deaf Navi World-Original</a><span>海外ニュースの原文版</span></li>
          <li><a href="./feed-world.xml">World-JP RSSフィード</a><span>翻訳版の最新フィード</span></li>
          <li><a href="./feed-world-original.xml">World-Original RSSフィード</a><span>原文版の最新フィード</span></li>
        </ul>
      </section>

      <section class="sitemap-card" aria-labelledby="sitemap-info">
        <h2 id="sitemap-info">サイト情報</h2>
        <ul>
          <li><a href="./${ABOUT_FILE}">Deaf Naviについて</a><span>情報源・更新頻度・運営情報</span></li>
          <li><a href="./${SITEMAP_FILE}">XMLサイトマップ</a><span>検索エンジン向けURL一覧</span></li>
          <li><a href="./sitemap-world.xml">World XMLサイトマップ</a><span>Worldページ用URL一覧</span></li>
          <li><a href="./${ROBOTS_FILE}">robots.txt</a><span>クロール設定</span></li>
        </ul>
      </section>

      <section class="sitemap-card" aria-labelledby="sitemap-api">
        <h2 id="sitemap-api">アプリ連携JSON</h2>
        <ul>
          <li><a href="./app/v1/manifest.json">manifest.json</a><span>iOSアプリ同期用マニフェスト</span></li>
          <li><a href="./app/v1/ios-news-v2.json">ios-news-v2.json</a><span>国内ニュース iOS 互換データ</span></li>
          <li><a href="./app/v1/ios-world-jp-v2.json">ios-world-jp-v2.json</a><span>World-JP iOS 互換データ</span></li>
          <li><a href="./app/v1/ios-world-original-v2.json">ios-world-original-v2.json</a><span>World-Original iOS 互換データ</span></li>
        </ul>
      </section>
    </div>

    <p class="about__back"><a href="./${IS_DEV ? 'index-dev.html' : 'index.html'}">← トップページへ戻る</a></p>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderSitemap({ generatedAt }) {
  const lastmod = new Date(generatedAt).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PAGE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${HAS_ARCHIVE ? `  <url>
    <loc>${OLD_PAGE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
` : ''}
  <url>
    <loc>${ABOUT_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITEMAP_HTML_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${SITE_URL}deaf-navi-world-jp.html</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}deaf-navi-world-original.html</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`;
}

function renderRobots() {
  if (IS_DEV) {
    return `User-agent: *
Disallow: /index-dev.html
Disallow: /index-old-dev.html
Disallow: /about-dev.html
Disallow: /articles-dev.json
Disallow: /articles-old-dev.json
Disallow: /feed-dev.xml
Disallow: /sitemap-dev.xml
`;
  }

  return `User-agent: *
Allow: /
Disallow: /articles.json$
Disallow: /articles-old.json$

Sitemap: ${SITEMAP_URL}
Sitemap: ${SITE_URL}sitemap-world.xml
`;
}

function renderRss({ generatedAt, articles }) {
  const items = articles.slice(0, 50).map((a) => {
    const pubDate = new Date(a.publishedAt).toUTCString();
    return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.id)}</link>
      <guid isPermaLink="true">${escapeXml(a.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(a.summary)}</description>
      <category>${escapeXml(CATEGORY_UI[a.category] ?? '一般')}</category>
      <source url="${escapeXml(a.sourceUrl)}">${escapeXml(a.sourceName)}</source>
    </item>`;
  }).join('\n');

  const lastBuildDate = new Date(generatedAt).toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(IS_DEV ? `${SITE_NAME} DEV` : SITE_NAME)}</title>
    <link>${PAGE_URL}</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESC)}</description>
    <language>ja-JP</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>
`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Build variant: ${VARIANT}`);
  const raw = await readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  let oldData = null;
  if (HAS_ARCHIVE) {
    try {
      oldData = JSON.parse(await readFile(OLD_DATA_FILE, 'utf8'));
    } catch {
      oldData = { generatedAt: data.generatedAt, count: 0, articles: [] };
    }
  }

  await mkdir(DOCS, { recursive: true });

  await writeFile(HTML_OUT, renderPage(data), 'utf8');
  console.log(`書き出し: ${HTML_OUT}`);

  if (HAS_ARCHIVE) {
    await writeFile(OLD_HTML_OUT, renderArchivePage(oldData), 'utf8');
    console.log(`書き出し: ${OLD_HTML_OUT}`);
  }

  await writeFile(join(DOCS, ABOUT_FILE), renderAboutPage({ generatedAt: data.generatedAt }), 'utf8');
  console.log(`書き出し: ${join(DOCS, ABOUT_FILE)}`);

  await writeFile(join(DOCS, SITEMAP_HTML_FILE), renderSitemapPage(data), 'utf8');
  console.log(`書き出し: ${join(DOCS, SITEMAP_HTML_FILE)}`);

  await writeFile(join(DOCS, SITEMAP_FILE), renderSitemap(data), 'utf8');
  console.log(`書き出し: ${join(DOCS, SITEMAP_FILE)}`);

  await writeFile(join(DOCS, ROBOTS_FILE), renderRobots(), 'utf8');
  console.log(`書き出し: ${join(DOCS, ROBOTS_FILE)}`);

  await writeFile(join(DOCS, FEED_FILE), renderRss(data), 'utf8');
  console.log(`書き出し: ${join(DOCS, FEED_FILE)}`);

  if (await fileExists(STYLES_SRC)) {
    await copyFile(STYLES_SRC, STYLES_OUT);
    console.log(`コピー: ${STYLES_OUT}`);
  }
  if (await fileExists(APP_SRC)) {
    await copyFile(APP_SRC, APP_OUT);
    console.log(`コピー: ${APP_OUT}`);
  }
  if (await fileExists(OG_SRC)) {
    await copyFile(OG_SRC, OG_OUT);
    console.log(`コピー: ${OG_OUT}`);
  }
}

main().catch((err) => {
  console.error('ビルド失敗:', err);
  process.exit(1);
});
