/**
 * トップページ（index.html）テンプレート 2.0。
 *
 * 情報設計:
 *   1. ヘッダー（ナビ・最終更新・表示設定）
 *   2. いま必要な情報（緊急通報・防災・制度・ガイドへの大きな導線）
 *   3. 注目: 公式・専門団体の新着
 *   4. 検索・絞り込みツールバー
 *   5. 最新ニュース（初期表示60件をSSR、残りは articles.json から遅延描画）
 *
 * パフォーマンス方針: v1 は全505件をHTMLに埋め込み966KBあった。
 * 2.0 は初期60件のみSSRし、全件データはクライアントが articles.json を
 * 必要時に取得する（HTML約1/5、DOMノード約1/8）。
 */

import {
  APP_STORE_URL,
  SITE_DESC,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  UPDATE_SCHEDULE_DETAIL,
  UPDATE_SCHEDULE_LABEL,
} from '../../config/site.mjs';
import {
  CATEGORY_ORDER,
  CATEGORY_UI,
  CATEGORY_UI_SHORT,
  EXCLUDED_FROM_ALL,
} from '../../config/categories.mjs';
import { REGION_ORDER, REGION_UI } from '../../config/regions.mjs';
import { escapeHtml } from '../lib/text.mjs';
import { formatDateJST } from '../lib/dates.mjs';
import {
  EXTERNAL_ARROW_SVG,
  ICONS,
  LEAF_SVG,
  getSourceTier,
  jsonLdScript,
  renderArticleCard,
  renderDisplayControls,
  renderFooter,
  renderHead,
  renderSkipLink,
} from './partials.mjs';

export const INITIAL_VISIBLE = 60;
export const FEATURED_COUNT = 4;
export const FEATURED_MAX_AGE_DAYS = 14;

/** 「注目」= 公式・専門情報源の新着（透明なルール。スコア等の権威付けはしない） */
export function selectFeatured(articles, now = Date.now()) {
  return articles
    .filter((a) => !EXCLUDED_FROM_ALL.has(a.category))
    .filter((a) => ['official', 'specialist'].includes(getSourceTier(a)))
    .filter((a) => {
      const t = new Date(a.publishedAt).getTime();
      return Number.isFinite(t) && (now - t) / 86_400_000 <= FEATURED_MAX_AGE_DAYS;
    })
    .slice(0, FEATURED_COUNT);
}

function renderJsonLd({ generatedAt, articles, pageUrl, isDev }) {
  const topArticles = articles.slice(0, 30);
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
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: `${isDev ? '[DEV] ' : ''}${SITE_NAME} | ${SITE_TAGLINE}`,
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        isPartOf: { '@id': `${SITE_URL}#website` },
        dateModified: generatedAt,
        mainEntity: { '@id': `${pageUrl}#itemlist` },
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
        '@id': `${pageUrl}#itemlist`,
        name: `${isDev ? '[DEV] ' : ''}聴覚障害関連ニュース最新記事`,
        numberOfItems: topArticles.length,
        itemListElement: itemList,
      },
    ],
  };

  return jsonLdScript(data);
}

function renderQuickAccess({ guideFile }) {
  const items = [
    {
      href: `./${guideFile}#guide-emergency`,
      icon: ICONS.phone,
      tone: 'alert',
      title: '緊急通報の準備',
      desc: '110番アプリ・NET118・電話リレー緊急通報の登録方法',
    },
    {
      href: './?category=safety',
      icon: ICONS.alert,
      title: '防災・安全の新着',
      desc: '災害情報・避難・緊急通報に関するニュース',
      filter: 'safety',
    },
    {
      href: './?category=policy',
      icon: ICONS.landmark,
      title: '制度・政策',
      desc: '法律・条例・給付・雇用・助成のニュース',
      filter: 'policy',
    },
    {
      href: `./${guideFile}`,
      icon: ICONS.book,
      title: '暮らしのガイド',
      desc: '医療・教育・就労・電話サービスの公式情報',
    },
  ];
  return `    <nav class="quick-access" aria-label="よく使う情報への近道">
${items.map((item) => `      <a class="quick-access__item${item.tone ? ` quick-access__item--${item.tone}` : ''}" href="${item.href}"${item.filter ? ` data-quick-filter="${item.filter}"` : ''}>
        <span class="quick-access__icon" aria-hidden="true">${item.icon}</span>
        <span class="quick-access__body">
          <span class="quick-access__title">${escapeHtml(item.title)}</span>
          <span class="quick-access__desc">${escapeHtml(item.desc)}</span>
        </span>
      </a>`).join('\n')}
    </nav>`;
}

function renderFeatured(featured) {
  if (!featured.length) return '';
  const items = featured.map((a) => `        <li class="featured__item">
          <a class="featured__link" href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">
            <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(CATEGORY_UI[a.category] ?? '一般')}</span>
            <span class="featured__title">${escapeHtml(a.title)}</span>
            <span class="featured__meta">${escapeHtml(a.sourceName)} ・ <time datetime="${escapeHtml(a.publishedAt)}" data-relative-time>${escapeHtml(formatDateJST(a.publishedAt).replace(' JST', ''))}</time></span>
          </a>
        </li>`).join('\n');
  return `    <section class="featured" aria-labelledby="featured-heading">
      <div class="featured__head">
        <h2 id="featured-heading">注目 <span class="featured__note">公式・専門団体の新着</span></h2>
      </div>
      <ul class="featured__list">
${items}
      </ul>
    </section>`;
}

function renderToolbar() {
  const categoryChips = CATEGORY_ORDER.map(
    (c) =>
      `<button type="button" class="filter${c === 'all' ? ' is-active' : ''}" data-filter="${c}" aria-pressed="${c === 'all' ? 'true' : 'false'}" title="${escapeHtml(CATEGORY_UI[c])}">${escapeHtml(CATEGORY_UI_SHORT[c])}</button>`,
  ).join('\n          ');
  const regionOptions = ['<option value="all">すべての地域</option>']
    .concat(REGION_ORDER.filter((r) => r !== 'nationwide').map((r) => `<option value="${r}">${escapeHtml(REGION_UI[r])}</option>`))
    .join('\n              ');
  return `      <div class="toolbar" id="news-toolbar">
        <form class="discovery-tools" id="news-search-form" role="search">
          <div class="search-field">
            <label class="sr-only" for="news-search">ニュースを検索</label>
            <input id="news-search" name="q" type="search" inputmode="search" autocomplete="off" placeholder="キーワードで検索（例: 手話通訳、補聴器）">
            <button class="search-field__clear" id="news-search-clear" type="button" aria-label="検索語を消去" hidden>×</button>
          </div>
          <div class="discovery-tools__row">
            <label class="tool-select">
              <span class="tool-select__label">情報源</span>
              <select id="source-filter" name="source">
                <option value="all">すべて</option>
                <option value="primary">一次・専門</option>
                <option value="news">報道・発見</option>
                <option value="other">関連媒体</option>
              </select>
            </label>
            <label class="tool-select">
              <span class="tool-select__label">期間</span>
              <select id="period-filter" name="period">
                <option value="all">すべて</option>
                <option value="1">24時間以内</option>
                <option value="7">1週間以内</option>
                <option value="30">1ヶ月以内</option>
              </select>
            </label>
            <label class="tool-select">
              <span class="tool-select__label">地域</span>
              <select id="region-filter" name="region">
              ${regionOptions}
              </select>
            </label>
            <button type="button" class="toolbar__reset" id="filter-reset" hidden>条件をクリア</button>
          </div>
        </form>
        <nav class="filters" role="navigation" aria-label="カテゴリフィルター">
          <div class="filters__row" role="group" aria-label="カテゴリで絞り込む">
          ${categoryChips}
          </div>
        </nav>
      </div>`;
}

/** クライアント描画用の記事カード雛形（app.js が clone して値を差し込む） */
function renderCardTemplate() {
  return `  <template id="card-template">
      <article class="card">
        <header class="card__head">
          <span class="chip"></span>
          <time class="card__time" data-relative-time></time>
        </header>
        <h3 class="card__title"><a target="_blank" rel="noopener noreferrer"></a></h3>
        <p class="card__summary"></p>
        <footer class="card__foot">
          <div class="card__source-group">
            <span class="source-tier"></span>
            <a class="card__source" target="_blank" rel="noopener noreferrer"></a>
            <span class="card__region" hidden></span>
          </div>
          <a class="card__read" target="_blank" rel="noopener noreferrer">記事を読む <span aria-hidden="true">↗</span></a>
        </footer>
      </article>
  </template>`;
}

/**
 * @param {object} data articles.json のパース結果
 * @param {object} opts { isDev, files: {...}, worldTeaser }
 */
export function renderHomePage(data, opts) {
  const { generatedAt, articles } = data;
  const { isDev, files } = opts;
  const now = Date.now();

  const pageUrl = isDev ? `${SITE_URL}index-dev.html` : SITE_URL;
  const pageTitle = `${isDev ? '[DEV] ' : ''}${SITE_NAME} | 聴覚障害・難聴・手話のニュース`;
  const robots = isDev ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const generatedLocal = formatDateJST(generatedAt);

  const defaultVisible = articles.filter((a) => !EXCLUDED_FROM_ALL.has(a.category));
  const featured = selectFeatured(articles, now);
  const initialCards = defaultVisible.slice(0, INITIAL_VISIBLE);
  const initialVisibleCount = initialCards.length;
  const totalDefaultCount = defaultVisible.length;

  const articlesHtml = initialCards
    .map((a) => renderArticleCard(a, { now }))
    .join('\n');

  const sourceCounts = defaultVisible.reduce((counts, article) => {
    const tier = getSourceTier(article);
    counts[tier] = (counts[tier] ?? 0) + 1;
    return counts;
  }, {});
  const primarySourceCount = (sourceCounts.official ?? 0) + (sourceCounts.specialist ?? 0);
  const discoveredSourceCount = sourceCounts.news ?? 0;

  const jsonLd = renderJsonLd({ generatedAt, articles, pageUrl, isDev });
  const leadPrefix = isDev ? 'テスト版。dev品質フィルタで生成中。 ' : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title: pageTitle,
    description: SITE_DESC,
    canonical: isDev ? SITE_URL : pageUrl,
    robots,
    ogUrl: pageUrl,
    stylesFile: files.styles,
    feedUrl: `${SITE_URL}${files.feed}`,
    jsonLd,
    extraHead: `  <meta name="keywords" content="${escapeHtml(opts.keywords)}">\n  <meta name="author" content="TAMA">\n  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">\n`,
  })}
</head>
<body>
  ${renderSkipLink()}

  <header class="site-header" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      ${LEAF_SVG}
    </div>
    <div class="container">
      <div class="site-header__top">
        <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">${isDev ? 'Web DEV' : 'Web'}</span></h1>
        ${renderDisplayControls()}
      </div>
      <p class="site-lead">${leadPrefix}聴覚障害・難聴・ろう者コミュニティに必要なニュースを、一次情報・専門情報・報道の区分とともに届けます。</p>
      <p class="site-update-schedule">
        ${UPDATE_SCHEDULE_LABEL} <span aria-hidden="true">•</span> ${UPDATE_SCHEDULE_DETAIL}
        <span class="meta__sep" aria-hidden="true">/</span>
        最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
      </p>
      <nav class="site-nav" aria-label="サイト内ページ">
        <a class="site-nav__link is-current" href="./" aria-current="page">ニュース</a>
        <a class="site-nav__link" href="./${files.guide}">暮らしのガイド</a>
        <a class="site-nav__link" href="./deaf-navi-world-jp.html">World</a>
        <a class="site-nav__link" href="./${files.about}">Deaf Naviについて</a>
      </nav>
    </div>
  </header>

  <main id="main" class="container" role="main">
${renderQuickAccess({ guideFile: files.guide })}

${renderFeatured(featured)}

${renderToolbar()}

    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading">最新ニュース</h2>
        <p class="meta" aria-live="polite">
          表示中: <strong id="visible-count">${initialVisibleCount}</strong> / 全 <strong id="total-count">${totalDefaultCount}</strong> 件
        </p>
      </div>
      <aside class="curation-overview" aria-label="キュレーション状況">
        <dl class="curation-overview__metrics">
          <div><dt>一次・専門</dt><dd>${primarySourceCount}件</dd></div>
          <div><dt>報道・発見</dt><dd>${discoveredSourceCount}件</dd></div>
          <div><dt>最終更新</dt><dd><time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time></dd></div>
        </dl>
        <a class="curation-overview__policy" href="./${files.about}#about-policy">選定方針を見る <span aria-hidden="true">→</span></a>
      </aside>
      <p class="offline-note" id="offline-note" role="status" hidden>オフライン表示中です。保存済みの内容を表示しています（最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>）。</p>
      <div id="articles" class="articles" data-total="${totalDefaultCount}" data-initial="${initialVisibleCount}" data-src="./${files.articlesJson}">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" role="status" hidden>該当する記事がありません。検索条件を変えるか、「条件をクリア」を押してください。</p>
      <noscript>
        <p class="empty">検索・絞り込み・61件目以降の表示にはJavaScriptが必要です。最新${initialVisibleCount}件を表示しています。すべての記事は <a href="./${files.feed}">RSSフィード</a> や <a href="./${files.oldIndex}">過去アーカイブ</a> からも確認できます。</p>
      </noscript>
      <div class="load-more-wrap">
        <button type="button" id="load-more-btn" class="load-more-btn"${totalDefaultCount <= INITIAL_VISIBLE ? ' hidden' : ''}>
          もっと読む<span class="load-more-btn__remain" id="load-more-remain">（あと ${totalDefaultCount - initialVisibleCount} 件）</span>
        </button>
      </div>
      <p class="archive-link"><a href="./${files.oldIndex}">過去アーカイブを見る</a></p>

      <aside class="app-cta" aria-label="Deaf Navi アプリのご案内">
        <div class="app-cta__text">
          <span class="app-cta__label" lang="en">iPhone App</span>
          <h2 class="app-cta__title">外出先でも、Deaf Navi を。</h2>
          <p class="app-cta__desc">同じキュレーションをスマホからも閲覧できる iOS アプリ「Deaf Navi」。緊急カード・手話ガイド・制度情報をオフラインでも。</p>
        </div>
        <a class="app-cta__btn" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">
          App Store で見る
          ${EXTERNAL_ARROW_SVG}
        </a>
      </aside>
    </section>
  </main>

${renderFooter({
    year: new Date().getFullYear(),
    links: [
      { href: `./${files.guide}`, label: '暮らしのガイド' },
      { href: `./${files.about}#about-policy`, label: '選定方針' },
      { href: `${SITE_URL}${files.feed}`, label: 'RSSフィード' },
      { href: `${SITE_URL}${files.sitemapHtml}`, label: 'サイトマップ' },
    ],
  })}

${renderCardTemplate()}

  <script src="./ui-controls.js" defer></script>
  <script src="./${files.app}" defer></script>
</body>
</html>
`;
}
