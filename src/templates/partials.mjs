/**
 * 各ページ共通のHTML部品。
 * すべての描画関数は文字列を返す純関数（I/Oなし）。
 */

import {
  CF_ANALYTICS_SNIPPET,
  SITE_NAME,
  SITE_URL,
  UPDATE_SCHEDULE_DETAIL,
  UPDATE_SCHEDULE_LABEL,
} from '../../config/site.mjs';
import { CATEGORY_UI, SOURCE_TIER_UI } from '../../config/categories.mjs';
import { REGION_UI } from '../../config/regions.mjs';
import { escapeHtml } from '../lib/text.mjs';
import { formatDateJST, relativeTime } from '../lib/dates.mjs';

export const LEAF_SVG = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>`;

export const EXTERNAL_ARROW_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';

/**
 * 共通アイコンセット（絵文字不使用の方針）。
 * 24pxグリッドのストロークSVG・currentColor・装飾用途は aria-hidden で使う。
 */
function icon(paths, { size = 24, strokeWidth = 1.8 } = {}) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const ICONS = {
  /** 緊急通報（電話） */
  phone: icon('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>'),
  /** 防災・安全（警告） */
  alert: icon('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  /** 制度・政策（公共建築） */
  landmark: icon('<path d="M3 21h18"/><path d="M5 21v-8"/><path d="M9.5 21v-8"/><path d="M14.5 21v-8"/><path d="M19 21v-8"/><path d="M3 10l9-6 9 6z"/>'),
  /** ガイド（開いた本） */
  book: icon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  /** ダーク表示（月） */
  moon: icon('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>', { size: 16 }),
  /** ライト表示（太陽） */
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>', { size: 16 }),
  /** 地球（World導線） */
  globe: icon('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', { size: 16 }),
  /** おとまど（音の可視化ツール） */
  waveform: icon('<path d="M3 12h2"/><path d="M7 8v8"/><path d="M11 4v16"/><path d="M15 7v10"/><path d="M19 10v4"/><path d="M22 12h-1"/>'),
};

/**
 * JSON-LD を <script> 内へ安全に埋め込む。
 * JSON.stringify は "<" をエスケープしないため、フィード由来のURL等に
 * "</script>" が含まれるとスクリプト脱出できてしまう。必ずこの関数を使うこと。
 */
export function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/**
 * 共通<head>要素。テーマ・文字サイズのFOUC防止スクリプトを含む。
 * @param {object} opts
 */
export function renderHead({
  title,
  description,
  canonical,
  robots = 'index,follow,max-image-preview:large,max-snippet:-1',
  ogType = 'website',
  ogUrl,
  ogImage = `${SITE_URL}og-image.png`,
  ogImageAlt = 'Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション',
  stylesFile = 'styles.css',
  feedUrl = null,
  jsonLd = '',
  extraHead = '',
  basePath = './',
}) {
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#075e57">
  <link rel="canonical" href="${canonical}">
${feedUrl ? `  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)}" href="${feedUrl}">\n` : ''}  <link rel="icon" href="${basePath}favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${basePath}icons/apple-touch-icon.png">
  <link rel="manifest" href="${basePath}manifest.webmanifest">

  <!-- Open Graph -->
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${ogUrl ?? canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">
  <meta property="og:locale" content="ja_JP">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImage}">

  <!-- テーマ・文字サイズをペイント前に適用（FOUC防止・localStorage参照のみ） -->
  <script>
    (function () {
      try {
        var t = localStorage.getItem('dn-theme');
        if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
        var f = localStorage.getItem('dn-font');
        if (f === 'large' || f === 'xlarge') document.documentElement.setAttribute('data-font', f);
      } catch (e) { /* private mode 等は既定値で表示 */ }
    })();
  </script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="${basePath}${stylesFile}">
${jsonLd ? `\n  ${jsonLd}\n` : ''}${extraHead}
  ${CF_ANALYTICS_SNIPPET}`;
}

export function renderSkipLink() {
  return '<a class="skip-link" href="#main">メインコンテンツにスキップ</a>';
}

/** 表示設定（テーマ・文字サイズ）ボタン群。ロジックは ui-controls.js */
export function renderDisplayControls() {
  return `<div class="display-controls" data-display-controls hidden>
        <button type="button" class="display-controls__btn" id="theme-toggle" aria-pressed="false">
          <span class="display-controls__icon" data-theme-icon>${ICONS.moon}</span><span data-theme-label>ダーク表示</span>
        </button>
        <button type="button" class="display-controls__btn" id="font-toggle" aria-pressed="false">
          <span class="display-controls__icon display-controls__icon--text" aria-hidden="true">あ</span><span data-font-label>文字を大きく</span>
        </button>
      </div>`;
}

/** 主要ページ間を移動する共通ナビゲーション。 */
export function renderSiteNav({
  current = '',
  newsHref = './',
  worldHref = './deaf-navi-world-jp.html',
  guideHref = './guide.html',
  toolHref = './otomado/',
  aboutHref = './about.html',
  locale = 'ja',
} = {}) {
  const isEnglish = locale === 'en';
  const items = [
    { key: 'news', href: newsHref, label: isEnglish ? 'Japan News' : 'ニュース' },
    { key: 'world', href: worldHref, label: 'World', className: 'site-nav__link--world', icon: ICONS.globe },
    { key: 'guide', href: guideHref, label: isEnglish ? 'Guide' : '暮らしのガイド' },
    { key: 'tool', href: toolHref, label: isEnglish ? 'OtoMado' : 'おとまど', className: 'site-nav__link--tool' },
    { key: 'about', href: aboutHref, label: isEnglish ? 'About Deaf Navi' : 'Deaf Naviについて' },
  ];
  const links = items.map((item) => {
    const isCurrent = item.key === current;
    const classes = ['site-nav__link', item.className, isCurrent ? 'is-current' : ''].filter(Boolean).join(' ');
    const iconHtml = item.icon ? `<span class="site-nav__icon">${item.icon}</span>` : '';
    return `<a class="${classes}" href="${escapeHtml(item.href)}"${isCurrent ? ' aria-current="page"' : ''}>${iconHtml}<span>${escapeHtml(item.label)}</span></a>`;
  }).join('\n        ');
  return `<nav class="site-nav" aria-label="${isEnglish ? 'Deaf Navi pages' : 'サイト内ページ'}">
        ${links}
      </nav>`;
}

/** トップ・World・暮らしのガイドで共有するブランドヘッダー。 */
export function renderSiteHeader({
  subLabel,
  lead,
  current,
  nav = {},
  modifier = '',
  extra = '',
}) {
  const modifierClass = modifier ? ` ${modifier}` : '';
  return `  <header class="site-header${modifierClass}" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      ${LEAF_SVG}
    </div>
    <div class="container">
      <div class="site-header__top">
        <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">${escapeHtml(subLabel)}</span></h1>
        ${renderDisplayControls()}
      </div>
      <p class="site-lead">${escapeHtml(lead)}</p>
      ${renderSiteNav({ current, ...nav })}
${extra ? `      ${extra}\n` : ''}    </div>
  </header>`;
}

/** スリムヘッダー（サブページ用・パンくず＋表示設定付き） */
export function renderSubHeader({ crumbLabel, title, lead = '', homeHref = './' }) {
  return `  <header class="site-header site-header--slim" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      ${LEAF_SVG}
    </div>
    <div class="container">
      <p class="site-breadcrumb"><a href="${homeHref}">Deaf Navi Web</a> <span aria-hidden="true">›</span> <span>${escapeHtml(crumbLabel)}</span></p>
      <div class="site-header__top">
        <h1 class="site-title site-title--small"><span class="site-title__brand">${escapeHtml(title)}</span></h1>
        ${renderDisplayControls()}
      </div>
${lead ? `      <p class="site-lead">${escapeHtml(lead)}</p>\n` : ''}    </div>
  </header>`;
}

export function renderFooter({ year, links = [], updateScheduleAt = '' }) {
  const linksHtml = links.length
    ? `      <p>${links.map(({ href, label }) => `<a href="${href}">${escapeHtml(label)}</a>`).join(' ・ ')}</p>\n`
    : '';
  const updateHtml = updateScheduleAt
    ? `      <p class="site-footer__update">
        ${UPDATE_SCHEDULE_LABEL} <span aria-hidden="true">•</span> ${UPDATE_SCHEDULE_DETAIL}
        <span class="meta__sep" aria-hidden="true">/</span>
        最終更新: <time datetime="${escapeHtml(updateScheduleAt)}">${escapeHtml(formatDateJST(updateScheduleAt))}</time>
      </p>\n`
    : '';
  return `  <footer class="site-footer" role="contentinfo">
    <div class="container">
${linksHtml}${updateHtml}      <hr class="site-footer__divider" aria-hidden="true">
      <p class="site-footer__copyright">
        <span>&copy; ${year} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span lang="en">Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span lang="en">Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>`;
}

export function getSourceTier(article) {
  return SOURCE_TIER_UI[article.sourceTier] ? article.sourceTier : 'news';
}

/** 公開から24時間以内なら true（NEWバッジ用） */
export function isNewArticle(article, now = Date.now()) {
  const t = new Date(article.publishedAt).getTime();
  return Number.isFinite(t) && now - t < 24 * 3600 * 1000 && now - t >= 0;
}

/**
 * 記事カード（国内版 2.0）。
 * クラス名は World 版と共通の .card 系 API を維持する。
 * data-* 属性はクライアント側フィルタリング（app.js）が参照する。
 */
export function renderArticleCard(a, { hidden = false, featured = false, now = Date.now() } = {}) {
  const catLabel = CATEGORY_UI[a.category] ?? '一般';
  const sourceTier = getSourceTier(a);
  const sourceMeta = SOURCE_TIER_UI[sourceTier];
  const newBadge = isNewArticle(a, now)
    ? '\n          <span class="card__new-badge">NEW</span>'
    : '';
  const regionAttr = a.region ? ` data-region="${escapeHtml(a.region)}"` : '';
  const regionChip = a.prefecture
    ? `<span class="card__region" title="地域: ${escapeHtml(a.prefecture)}">${escapeHtml(a.prefecture)}</span>`
    : '';
  return `
      <article class="card${featured ? ' card--featured' : ''}" data-category="${escapeHtml(a.category)}" data-source-tier="${escapeHtml(sourceTier)}"${regionAttr} data-published="${escapeHtml(a.publishedAt)}"${hidden ? ' hidden' : ''}>
        <header class="card__head">
          <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(catLabel)}</span>${newBadge}
          <time class="card__time" datetime="${escapeHtml(a.publishedAt)}" data-relative-time>${escapeHtml(formatDateJST(a.publishedAt).replace(' JST', ''))}<span class="card__time-rel">（${escapeHtml(relativeTime(a.publishedAt, now))}）</span></time>
        </header>
        <h3 class="card__title">
          <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
        </h3>${a.summary ? `
        <p class="card__summary">${escapeHtml(a.summary)}</p>` : ''}
        <footer class="card__foot">
          <div class="card__source-group">
            <span class="source-tier source-tier--${escapeHtml(sourceTier)}" title="${escapeHtml(sourceMeta.description)}">${escapeHtml(sourceMeta.label)}</span>
            <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
            ${regionChip}
          </div>
          <a class="card__read" href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(a.title)}（新しいタブで開く）">記事を読む <span aria-hidden="true">↗</span></a>
        </footer>
      </article>`;
}

export { REGION_UI };
