import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');

const DATA_FILE = join(DOCS, 'articles-world.json');
const JP_HTML_OUT = join(DOCS, 'deaf-navi-world-jp.html');
const ORIGINAL_HTML_OUT = join(DOCS, 'deaf-navi-world-original.html');
const EN_LEGACY_HTML_OUT = join(DOCS, 'deaf-navi-world-en.html');
const LEGACY_HTML_OUT = join(DOCS, 'deaf-navi-world.html');
const FEED_OUT = join(DOCS, 'feed-world.xml');
const ORIGINAL_FEED_OUT = join(DOCS, 'feed-world-original.xml');
const EN_LEGACY_FEED_OUT = join(DOCS, 'feed-world-en.xml');
const SITEMAP_OUT = join(DOCS, 'sitemap-world.xml');
const STYLES_SRC = join(__dirname, 'styles.css');
const STYLES_OUT = join(DOCS, 'styles-world.css');
const APP_SRC = join(__dirname, 'world-app.js');
const APP_OUT = join(DOCS, 'app-world.js');
const OG_SRC = join(__dirname, 'og-image.svg');
const OG_OUT = join(DOCS, 'og-image-world.svg');

const SITE_URL = 'https://tamas-hub.github.io/deaf-navi-web/';
const JP_PAGE_FILE = 'deaf-navi-world-jp.html';
const ORIGINAL_PAGE_FILE = 'deaf-navi-world-original.html';
const JP_PAGE_URL = `${SITE_URL}${JP_PAGE_FILE}`;
const ORIGINAL_PAGE_URL = `${SITE_URL}${ORIGINAL_PAGE_FILE}`;
const FEED_URL = `${SITE_URL}feed-world.xml`;
const ORIGINAL_FEED_URL = `${SITE_URL}feed-world-original.xml`;
const SITEMAP_URL = `${SITE_URL}sitemap-world.xml`;
const HTML_SITEMAP_URL = `${SITE_URL}sitemap.html`;
const JP_SITE_NAME = 'Deaf Navi World-JP';
const ORIGINAL_SITE_NAME = 'Deaf Navi World-Original';
const SITE_DESC = '世界中の主要メディアと多言語の地域別Google News検索から、聴覚障害・ろう者・難聴・手話・情報保障関連ニュースを日本語に翻訳してキュレーションするDeaf Naviの世界版ページ。';
const ORIGINAL_SITE_DESC = 'Original-language global news articles gathered from major media and multilingual regional Google News queries about deaf, hard-of-hearing, sign language, accessibility, health, education, culture, and deaf sports topics.';
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

const REGION_UI_EN = {
  all: 'All regions',
  asia_oceania: 'Asia / Oceania',
  americas: 'Americas',
  europe_cis: 'Europe / CIS',
  middle_east_africa: 'Middle East / Africa',
};

const TOPIC_UI_EN = {
  all: 'All topics',
  accessibility: 'Accessibility / interpreting',
  rights: 'Rights / policy',
  health: 'Health / hearing',
  education: 'Education',
  technology: 'Technology / AI',
  culture: 'Culture / society',
  sports: 'Deaf sports',
  safety: 'Safety / emergencies',
  general: 'General',
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

function refineJapanese(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([、。！？])/g, '$1')
    .replace(/（ /g, '（')
    .replace(/ ）/g, '）')
    .replace(/オーストラリア手話/g, 'Auslan（オーストラリア手話）')
    .replace(/オースラン語/g, 'Auslan')
    .replace(/オースラン/g, 'Auslan')
    .replace(/デフコミュニティ/g, 'ろう者コミュニティ')
    .replace(/聴覚障害者コミュニティ/g, 'ろう者コミュニティ')
    .replace(/聴覚障害者および難聴の/g, 'ろう・難聴の')
    .replace(/聴覚障害者および難聴者/g, 'ろう・難聴者')
    .replace(/どれほど耳が遠いのか知りませんでした/g, 'どれほど聞こえていなかったのか気づいていませんでした')
    .replace(/ニュースを「見逃す」のではないかと懸念/g, 'ニュースから取り残される懸念')
    .replace(/6月に最終回を放送する/g, '6月に最終回を迎える')
    .replace(/この物語は(.+?)で解釈されています。?/g, 'この記事は$1で通訳されています。')
    .replace(/キウイの 6 人に 1 人/g, 'ニュージーランド人の6人に1人')
    .replace(/SA の学校/g, '南アフリカの学校')
    .replace(/AI WhatsApp ボット/g, 'WhatsApp対応AIボット')
    .replace(/手話のロックで/g, '手話通訳で')
    .replace(/リオの手話のロック/g, 'ロック・イン・リオの手話通訳')
    .replace(/聞く手: 手話を使ってギャップを埋める/g, '聞こえる手: 手話で隔たりを埋める')
    .replace(/聴覚障害者のための/g, 'ろう者のための')
    .replace(/聴覚障害者向け/g, 'ろう者向け')
    .replace(/Auslan（Auslan（オーストラリア手話））/g, 'Auslan（オーストラリア手話）')
    .replace(/Auslan（オーストラリア手話）のAuslan/g, 'Auslan（オーストラリア手話）')
    .replace(/(?:Auslan（)+オーストラリア手話(?:）)+/g, 'Auslan（オーストラリア手話）')
    .trim();
}

function detectOriginalLang(text) {
  const value = String(text ?? '');
  if (/[\u0600-\u06ff]/.test(value)) return 'ar';
  if (/[\uac00-\ud7af]/.test(value)) return 'ko';
  if (/[\u3400-\u9fff]/.test(value)) return 'zh';
  if (/[ぁ-んァ-ヶ]/.test(value)) return 'ja';
  if (/[а-яё]/i.test(value)) return 'ru';
  if (/[ğışİöüç]/i.test(value)) return 'tr';
  if (/[äöüß]/i.test(value)) return 'de';
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(value)) return 'fr';
  if (/[ãõáéíóúâêô]/i.test(value)) return 'pt';
  if (/[ñ¿¡]/i.test(value)) return 'es';
  if (/[àèéìíîòóùú]/i.test(value)) return 'it';
  return 'en';
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

function articleText(article, mode) {
  if (mode === 'original') {
    const title = article.originalTitle || article.title;
    return {
      title,
      summary: article.originalSummary || article.summary || article.originalTitle || article.title,
      original: '',
      lang: detectOriginalLang(title),
    };
  }

  return {
    title: refineJapanese(article.title || article.originalTitle),
    summary: refineJapanese(article.summary || article.originalSummary || article.title || article.originalTitle),
    original: article.originalTitle || '',
    lang: 'ja',
  };
}

function renderArticle(article, index, mode = 'jp') {
  const hidden = index >= INITIAL_VISIBLE ? ' hidden' : '';
  const isOriginal = mode === 'original';
  const regionUi = isOriginal ? REGION_UI_EN : REGION_UI;
  const topicUi = isOriginal ? TOPIC_UI_EN : TOPIC_UI;
  const regionLabel = regionUi[article.region] ?? article.regionLabel ?? 'Uncategorized';
  const topicLabel = topicUi[article.topic] ?? article.topicLabel ?? 'General';
  const text = articleText(article, mode);
  const originalHtml = mode === 'jp' && text.original
    ? `\n        <p class="card__original" lang="en">${escapeHtml(text.original)}</p>`
    : '';
  return `
      <article class="card world-card" data-region="${escapeHtml(article.region)}" data-topic="${escapeHtml(article.topic)}" data-index="${index}"${hidden}>
        <header class="card__head world-card__head">
          <span class="chip chip--world-region chip--region-${escapeHtml(article.region)}">${escapeHtml(regionLabel)}</span>
          <span class="chip chip--world-topic chip--topic-${escapeHtml(article.topic)}">${escapeHtml(topicLabel)}</span>
        </header>
        <time class="card__time" datetime="${escapeHtml(article.publishedAt)}" title="${escapeHtml(formatDateJST(article.publishedAt))}">${escapeHtml(relativeTime(article.publishedAt))}</time>
        <h3 class="card__title" lang="${text.lang}">
          <a href="${escapeHtml(article.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text.title)}</a>
        </h3>
        <p class="card__summary" lang="${text.lang}">${escapeHtml(text.summary)}</p>${originalHtml}
        <footer class="card__foot">
          <a class="card__source" href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.sourceName)}</a>
          <span class="world-card__score" title="curation score">score ${escapeHtml(article.curationScore ?? '')}</span>
        </footer>
      </article>`;
}

function renderJsonLd({ generatedAt, articles, mode, pageUrl, siteName, siteDesc }) {
  const itemList = articles.slice(0, 40).map((article, index) => {
    const text = articleText(article, mode);
    const item = {
      '@type': 'NewsArticle',
      '@id': article.id,
      headline: text.title,
      url: article.id,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: mode === 'jp' ? 'ja-JP' : 'und',
      description: text.summary,
      publisher: {
        '@type': 'Organization',
        name: article.sourceName,
        url: article.sourceUrl,
      },
      articleSection: mode === 'original'
        ? TOPIC_UI_EN[article.topic] ?? 'General'
        : article.topicLabel ?? TOPIC_UI[article.topic] ?? '一般',
      spatialCoverage: mode === 'original'
        ? REGION_UI_EN[article.region] ?? ''
        : article.regionLabel ?? REGION_UI[article.region] ?? '',
    };
    if (mode === 'jp') {
      item.translationOfWork = {
        '@type': 'NewsArticle',
        headline: article.originalTitle,
        inLanguage: 'und',
      };
    }
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: article.id,
      item,
    };
  });

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
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: siteName,
        description: siteDesc,
        inLanguage: mode === 'jp' ? 'ja-JP' : 'und',
        isPartOf: { '@id': `${SITE_URL}#website` },
        dateModified: generatedAt,
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#itemlist`,
        name: siteName,
        numberOfItems: itemList.length,
        itemListElement: itemList,
      },
    ],
  }, null, 2)}
</script>`;
}

function renderLanguageSwitch(mode) {
  const isOriginal = mode === 'original';
  const aboutLabel = isOriginal ? 'About Deaf Navi' : 'Deaf Naviについて';
  const guideLabel = isOriginal ? 'Guide' : '暮らしのガイド';
  const ariaLabel = isOriginal ? 'World page navigation' : 'Worldページ内ナビゲーション';
  return `<div class="world-language-switch" aria-label="${ariaLabel}">
        <a class="world-language-switch__item${mode === 'jp' ? ' is-active' : ''}" href="./${JP_PAGE_FILE}"${mode === 'jp' ? ' aria-current="page"' : ''}>JP 日本語</a>
        <a class="world-language-switch__item${isOriginal ? ' is-active' : ''}" href="./${ORIGINAL_PAGE_FILE}"${isOriginal ? ' aria-current="page"' : ''}>Original 原文</a>
        <a class="world-language-switch__item" href="./guide.html">${guideLabel}</a>
        <a class="world-language-switch__item" href="./about.html">${aboutLabel}</a>
      </div>`;
}

function renderPage(data, mode = 'jp') {
  const articles = data.articles ?? [];
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  const initialVisible = Math.min(INITIAL_VISIBLE, articles.length);
  const generatedLocal = formatDateJST(generatedAt);
  const articlesHtml = articles.map((article, index) => renderArticle(article, index, mode)).join('\n');
  const isOriginal = mode === 'original';
  const ogLocale = isOriginal ? 'en_US' : 'ja_JP';
  const pageUrl = isOriginal ? ORIGINAL_PAGE_URL : JP_PAGE_URL;
  const siteName = isOriginal ? ORIGINAL_SITE_NAME : JP_SITE_NAME;
  const siteDesc = isOriginal ? ORIGINAL_SITE_DESC : SITE_DESC;
  const feedUrl = isOriginal ? ORIGINAL_FEED_URL : FEED_URL;
  const regionButtons = renderButtons(REGION_ORDER, isOriginal ? REGION_UI_EN : REGION_UI, 'data-filter-region', isOriginal ? 'All regions' : 'すべての地域');
  const topicButtons = renderButtons(TOPIC_ORDER, isOriginal ? TOPIC_UI_EN : TOPIC_UI, 'data-filter-topic', isOriginal ? 'All topics' : 'すべてのカテゴリ');
  const ogImage = `${SITE_URL}og-image-world.svg`;
  const jsonLd = renderJsonLd({ generatedAt, articles, mode, pageUrl, siteName, siteDesc });
  const title = isOriginal ? `${siteName} | Original-language global deaf news` : `${siteName} | 世界の聴覚障害ニュース`;
  const heading = isOriginal ? 'World News Original' : 'World News JP';
  const lead = isOriginal
    ? 'Fresh global news related to deaf, hard-of-hearing, sign language, accessibility, health, education, and culture is shown in each source article language.'
    : '世界中の主要メディアと多言語の地域別検索から、聴覚障害・ろう者・難聴・手話・情報保障のニュースを日本語に翻訳してキュレーションします。';
  const note = isOriginal
    ? 'Titles and summaries are not translated here; they stay in the original source language. Recent articles are prioritized, then balanced across regions.'
    : 'タイトルと要約は日本語翻訳後にニュース見出しとして自然になるよう整えています。鮮度を優先しつつ、地域が偏りすぎないように並べています。';
  const filterAria = isOriginal ? 'Deaf Navi World filters' : 'Deaf Navi World フィルタ';
  const regionLabel = isOriginal ? 'Region' : '地域';
  const topicLabel = isOriginal ? 'Topic' : 'カテゴリ';
  const showingLabel = isOriginal ? 'Showing' : '表示中';
  const totalLabel = isOriginal ? 'total' : '全';
  const updatedLabel = isOriginal ? 'Updated' : '最終更新';
  const loadMoreLabel = isOriginal ? 'Load more' : 'もっと読む';
  const remainingLabel = isOriginal ? `${articles.length - initialVisible} more` : `あと ${articles.length - initialVisible} 件`;
  const emptyLabel = isOriginal ? 'No matching articles.' : '該当する記事がありません。';
  const backLabel = isOriginal ? 'Back to Deaf Navi Web (Japan)' : '国内版 Deaf Navi Webへ戻る';
  const homeLabel = isOriginal ? 'Domestic Deaf Navi Web' : '国内版 Deaf Navi Webへ';
  const htmlLang = isOriginal ? 'en' : 'ja';

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(siteDesc)}">
  <meta name="keywords" content="Deaf Navi World,聴覚障害,ろう者,難聴,手話,情報保障,海外ニュース,世界ニュース,deaf,hard of hearing,sign language">
  <meta name="author" content="TAMA">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <meta name="googlebot" content="index,follow">
  <meta name="theme-color" content="#075e57">
  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" hreflang="ja" href="${JP_PAGE_URL}">
  <link rel="alternate" hreflang="x-default" href="${ORIGINAL_PAGE_URL}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)}" href="${feedUrl}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Deaf Navi">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(siteDesc)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(siteName)}">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(siteDesc)}">
  <meta name="twitter:image" content="${ogImage}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="./styles-world.css">

  ${jsonLd}
  ${CF_ANALYTICS_SNIPPET}
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--world" role="banner">
    <div class="container">
      <p class="site-breadcrumb"><a href="./index.html">Deaf Navi Web</a> <span aria-hidden="true">›</span> <span>${escapeHtml(siteName)}</span></p>
      <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">${isOriginal ? 'World-Original' : 'World-JP'}</span></h1>
      <p class="site-lead">${escapeHtml(lead)}</p>
      <div class="world-header-actions">
        <a class="world-home-link" href="./index.html"><span aria-hidden="true">←</span><span>${escapeHtml(homeLabel)}</span></a>
        ${renderLanguageSwitch(mode)}
      </div>
    </div>
  </header>

  <nav class="filters filters--world" role="navigation" aria-label="${escapeHtml(filterAria)}">
    <div class="container">
      <div class="world-filter-group" aria-label="地域で絞り込み">
        <span class="filters__label">${escapeHtml(regionLabel)}</span>
        <div class="filters__row" role="group" aria-label="地域で絞り込み">
          ${regionButtons}
        </div>
      </div>
      <div class="world-filter-group" aria-label="カテゴリで絞り込み">
        <span class="filters__label">${escapeHtml(topicLabel)}</span>
        <div class="filters__row" role="group" aria-label="カテゴリで絞り込み">
          ${topicButtons}
        </div>
      </div>
    </div>
  </nav>

  <main id="main" class="container" role="main">
    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading">${escapeHtml(heading)}</h2>
        <p class="meta">
          ${escapeHtml(showingLabel)}: <strong id="visible-count">${initialVisible}</strong> / ${escapeHtml(totalLabel)} <strong id="total-count">${articles.length}</strong> ${isOriginal ? 'articles' : '件'}
          <span class="meta__sep" aria-hidden="true">/</span>
          ${escapeHtml(updatedLabel)}: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
        </p>
      </div>
      <p class="world-note">${escapeHtml(note)}</p>
      <div id="articles" class="articles">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" hidden>${escapeHtml(emptyLabel)}</p>
      <div class="load-more-wrap">
        <button type="button" id="load-more-btn" class="load-more-btn"${articles.length <= INITIAL_VISIBLE ? ' hidden' : ''}>
          ${escapeHtml(loadMoreLabel)}<span class="load-more-btn__remain" id="load-more-remain">（${escapeHtml(remainingLabel)}）</span>
        </button>
      </div>
      <p class="about__back"><a href="./">← ${escapeHtml(backLabel)}</a></p>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p>${isOriginal ? 'Deaf Navi World-Original shows article titles and summaries in the original source language, gathered from major media and multilingual regional Google News queries.' : 'Deaf Navi World-JP は Google News RSS を入口に、主要メディアと多言語の地域別検索を関連性スコアで絞り込み、自動翻訳とDeaf Navi向け用語補正、必要に応じたCodex App Server後編集を通して掲載しています。'}</p>
      <p>${isOriginal ? 'Article copyrights belong to each source. Links open the original external articles.' : '記事の著作権は各発信元に帰属します。リンク先は外部サイトです。翻訳は概要把握のための自動翻訳と編集補助です。'}</p>
      <p><a href="./guide.html">${isOriginal ? 'Guide' : '暮らしのガイド'}</a> ・ <a href="./about.html">${isOriginal ? 'About Deaf Navi' : 'Deaf Naviについて'}</a> ・ <a href="${feedUrl}">${isOriginal ? 'RSS feed' : 'RSSフィード'}</a> ・ <a href="${HTML_SITEMAP_URL}">${isOriginal ? 'Sitemap' : 'サイトマップ'}</a></p>
      <hr class="site-footer__divider" aria-hidden="true">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>${escapeHtml(siteName)}.</span>
      </p>
    </div>
  </footer>

  <script src="./app-world.js" defer></script>
</body>
</html>`;
}

function renderRss(data, mode = 'jp') {
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  const isOriginal = mode === 'original';
  const pageUrl = isOriginal ? ORIGINAL_PAGE_URL : JP_PAGE_URL;
  const siteName = isOriginal ? ORIGINAL_SITE_NAME : JP_SITE_NAME;
  const siteDesc = isOriginal ? ORIGINAL_SITE_DESC : SITE_DESC;
  const items = (data.articles ?? []).slice(0, 80).map((article) => {
    const text = articleText(article, mode);
    const categoryRegion = isOriginal ? REGION_UI_EN[article.region] : article.regionLabel ?? REGION_UI[article.region] ?? '';
    const categoryTopic = isOriginal ? TOPIC_UI_EN[article.topic] : article.topicLabel ?? TOPIC_UI[article.topic] ?? '';
    return `    <item>
      <title>${escapeXml(text.title)}</title>
      <link>${escapeXml(article.id)}</link>
      <guid isPermaLink="true">${escapeXml(article.id)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(text.summary)}</description>
      <source url="${escapeXml(article.sourceUrl)}">${escapeXml(article.sourceName)}</source>
      <category>${escapeXml(categoryRegion)}</category>
      <category>${escapeXml(categoryTopic)}</category>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${siteName}</title>
    <link>${pageUrl}</link>
    <description>${siteDesc}</description>
    <language>${isOriginal ? 'und' : 'ja'}</language>
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
    <loc>${JP_PAGE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${ORIGINAL_PAGE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`;
}

function renderLegacyRedirect() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,follow">
  <meta http-equiv="refresh" content="0; url=./${JP_PAGE_FILE}">
  <link rel="canonical" href="${JP_PAGE_URL}">
  <title>Deaf Navi World-JPへ移動</title>
  <script>window.location.replace('./${JP_PAGE_FILE}');</script>
</head>
<body>
  <p><a href="./${JP_PAGE_FILE}">Deaf Navi World-JPへ移動</a></p>
</body>
</html>`;
}

function renderOriginalLegacyRedirect() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,follow">
  <meta http-equiv="refresh" content="0; url=./${ORIGINAL_PAGE_FILE}">
  <link rel="canonical" href="${ORIGINAL_PAGE_URL}">
  <title>Moved to Deaf Navi World-Original</title>
  <script>window.location.replace('./${ORIGINAL_PAGE_FILE}');</script>
</head>
<body>
  <p><a href="./${ORIGINAL_PAGE_FILE}">Moved to Deaf Navi World-Original</a></p>
</body>
</html>`;
}

async function main() {
  const raw = await readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  await mkdir(DOCS, { recursive: true });
  await writeFile(JP_HTML_OUT, renderPage(data, 'jp'), 'utf8');
  await writeFile(ORIGINAL_HTML_OUT, renderPage(data, 'original'), 'utf8');
  await writeFile(EN_LEGACY_HTML_OUT, renderOriginalLegacyRedirect(), 'utf8');
  await writeFile(LEGACY_HTML_OUT, renderLegacyRedirect(), 'utf8');
  await writeFile(FEED_OUT, renderRss(data, 'jp'), 'utf8');
  const originalFeed = renderRss(data, 'original');
  await writeFile(ORIGINAL_FEED_OUT, originalFeed, 'utf8');
  await writeFile(EN_LEGACY_FEED_OUT, originalFeed, 'utf8');
  await writeFile(SITEMAP_OUT, renderSitemap(data), 'utf8');
  await copyFile(STYLES_SRC, STYLES_OUT);
  await copyFile(APP_SRC, APP_OUT);
  await copyFile(OG_SRC, OG_OUT);
  console.log(`Deaf Navi World: built ${JP_HTML_OUT} and ${ORIGINAL_HTML_OUT}`);
}

main().catch((err) => {
  console.error('Deaf Navi World build failed:', err);
  process.exit(1);
});
