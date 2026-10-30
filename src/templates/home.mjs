/**
 * トップページ（index.html）テンプレート 2.0。
 *
 * 情報設計:
 *   1. ヘッダー（ナビ・表示設定）
 *   2. 目的別の入口（出かける・暮らし・その場で使う）とニュース一覧への移動
 *   3. 検索・絞り込みツールバー
 *   4. 注目: 公式・専門団体の新着（見出し中心）
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
import { groupNewsTopics } from '../lib/news-topics.mjs';
import { renderNewsNavigation } from './news-navigation.mjs';
import {
  EXTERNAL_ARROW_SVG,
  ICONS,
  getSourceTier,
  jsonLdScript,
  renderArticleCard,
  renderNewsContext,
  renderFooter,
  renderHead,
  renderSkipLink,
  renderGlobalHeader,
} from './partials.mjs';

export const INITIAL_VISIBLE = 60;
export const FEATURED_COUNT = 2;
export const FEATURED_MAX_AGE_DAYS = 14;

/** 「注目」= 公式・専門情報源の新着（透明なルール。スコア等の権威付けはしない） */
export function selectFeatured(articles, now = Date.now()) {
  return groupNewsTopics(articles).map(group => group.lead)
    .filter((a) => !EXCLUDED_FROM_ALL.has(a.category))
    .filter((a) => ['official', 'specialist'].includes(getSourceTier(a)))
    .filter((a) => {
      const t = new Date(a.publishedAt).getTime();
      return Number.isFinite(t) && (now - t) / 86_400_000 <= FEATURED_MAX_AGE_DAYS;
    })
    .slice(0, FEATURED_COUNT);
}

function renderJsonLd({ generatedAt, articles, pageUrl, pageTitle, isDev }) {
  const topArticles = articles.slice(0, 30);
  const itemList = topArticles.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: a.id,
    name: a.title,
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
        name: pageTitle,
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
      desc: '110番アプリ・NET119・NET118・電話リレー緊急通報の登録方法',
    },
    {
      href: './?category=safety',
      icon: ICONS.alert,
      title: '防災・安全の新着',
      desc: '災害情報・避難・緊急通報に関するニュース',
      filter: 'safety',
    },
    {
      href: '/news/support/',
      icon: ICONS.landmark,
      title: '制度・支援',
      desc: '法律・条例・給付・雇用・助成のニュース',
    },
    {
      href: `./${guideFile}`,
      icon: ICONS.book,
      title: '暮らしのガイド',
      desc: '医療・教育・就労・電話の公式情報',
    },
    {
      href: './otomado/',
      icon: ICONS.waveform,
      tone: 'tool',
      title: 'おとまど',
      desc: '周囲の音・字幕・筆談を見やすく',
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

/**
 * ニュースより前に置く目的別の入口。新しい中間ページは作らず、既存ページへ直接つなぐ。
 * 下部の近道カード（renderQuickAccess）とは役割を分け、文字と罫線だけで示す。
 */
function renderPurposeNav({ guideFile }) {
  const groups = [
    {
      title: '出かける',
      desc: '会話の方法に合う行き先や催し、宿を探す',
      links: [
        ['./events.html', 'イベント'],
        ['./connect/sign-cafe/', '手話カフェ'],
        ['./guide/guesthouses/', 'ろう者が営む宿'],
      ],
    },
    {
      title: '暮らしで困ったとき',
      desc: '病院・窓口での伝え方、電話や緊急時の連絡',
      links: [
        ['./guide/life/', '病院・窓口で伝える'],
        [`./${guideFile}#guide-emergency`, '緊急時の連絡方法'],
        ['./stories/relay-yometel-net119/', '電話リレーなどの記事'],
        [`./${guideFile}`, '暮らしのガイド'],
      ],
    },
    {
      title: 'その場で使う',
      desc: '筆談・字幕・音の見張りをブラウザですぐ使う',
      links: [
        ['./otomado/#/board', '筆談ボードを開く'],
        ['./otomado/', 'おとまどの機能と説明'],
      ],
    },
  ];
  return `    <nav class="purpose-nav" aria-labelledby="purpose-nav-heading">
      <h2 id="purpose-nav-heading" class="sr-only">目的から探す</h2>
${groups.map((group) => `      <div class="purpose-nav__group">
        <h3 class="purpose-nav__title">${escapeHtml(group.title)}</h3>
        <p class="purpose-nav__desc">${escapeHtml(group.desc)}</p>
        <ul class="purpose-nav__links">${group.links.map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('')}</ul>
      </div>`).join('\n')}
      <p class="purpose-nav__news"><a href="#articles-heading">最新ニュースへ</a></p>
    </nav>`;
}

function renderFeatured(featured) {
  if (!featured.length) return '';
  const items = featured.map((a) => `        <li class="featured__item">
          <a class="featured__link" href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">
            <div class="featured__body">
            <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(CATEGORY_UI[a.category] ?? '一般')}</span>${renderNewsContext(a)}
            <h3 class="featured__title">${escapeHtml(a.title)}</h3>
            <span class="featured__meta">${escapeHtml(a.sourceName)} ・ <time datetime="${escapeHtml(a.publishedAt)}">${escapeHtml(formatDateJST(a.publishedAt).slice(0, 10))}</time></span>
            </div>
          </a>
        </li>`).join('\n');
  return `    <section class="featured" id="featured-news" aria-labelledby="featured-heading">
      <div class="featured__head">
        <h2 id="featured-heading">注目 <span class="featured__note">公式・専門団体の新着</span></h2>
      </div>
      <ul class="featured__list">
${items}
      </ul>
    </section>`;
}

function renderTopic(group, now) {
  const related = group.articles.slice(1);
  return `<div class="news-topic">${renderArticleCard(group.lead, { now, newsMedia: true })}${related.length ? `
        <details class="topic-related"><summary>同じ話題の報道 <span>${related.length}件</span></summary>
          <ul>${related.map(a => `<li>${renderArticleCard(a, { now })}</li>`).join('')}</ul>
        </details>` : ''}</div>`;
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
            <input id="news-search" name="q" type="search" inputmode="search" autocomplete="off" placeholder="ニュースを検索（例：字幕、補聴器）">
            <button class="search-field__clear" id="news-search-clear" type="button" aria-label="検索語を消去" hidden>×</button>
          </div>
        </form>
        <details class="news-filters" id="news-filters">
          <summary>カテゴリ・地域などで絞り込む<span id="filter-active-count"></span></summary>
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
        <nav class="filters" role="navigation" aria-label="カテゴリフィルター">
          <div class="filters__row" role="group" aria-label="カテゴリで絞り込む">
          ${categoryChips}
          </div>
        </nav>
        <p class="news-group-note" id="news-group-note">同じ話題はまとめて表示。各媒体の記事は開いて読めます。</p>
        </details>
      </div>`;
  }

function renderAgentActivity() {
  return `      <aside class="agent-activity" id="agent-activity" aria-labelledby="agent-activity-heading" hidden aria-hidden="true">
        <div class="agent-activity__head">
          <div>
            <p class="agent-activity__eyebrow">Human + Agent</p>
            <h2 id="agent-activity-heading">Agent Activity</h2>
          </div>
          <span class="agent-activity__status" id="agent-activity-status" data-status="checking">接続確認中</span>
        </div>
        <p class="agent-activity__intro">Agentが変えた検索条件や表示設定を、同じ画面で確認できます。</p>
        <ol class="agent-activity__log" id="agent-activity-log" aria-live="polite" aria-relevant="additions text">
          <li class="agent-activity__empty" data-agent-activity-empty>Agentの操作はまだありません。</li>
        </ol>
        <div class="agent-activity__actions">
          <button class="agent-activity__undo" id="agent-activity-undo" type="button" disabled>Undo agent changes</button>
          <span class="agent-activity__note">手動操作は常に優先されます</span>
        </div>
      </aside>`;
}

/** クライアント描画用の記事カード雛形（app.js が clone して値を差し込む） */
function renderCardTemplate() {
  return `  <template id="card-template">
      <article class="card">
        <header class="card__head">
          <span class="chip"></span>
          <time class="card__time" data-relative-time></time>
        </header>
        <div class="card__content"><div class="card__text">
        <h3 class="card__title"><a target="_blank" rel="noopener noreferrer"></a></h3>
        <p class="card__summary"></p>
        </div></div>
        <footer class="card__foot">
          <div class="card__source-group">
            <span class="source-tier"></span>
            <a class="card__source" target="_blank" rel="noopener noreferrer"></a>
            <span class="card__region" hidden></span>
          </div>
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
  const assetVersion = opts.clientAssetVersion
    ? `?v=${encodeURIComponent(opts.clientAssetVersion)}`
    : '';
  const now = opts.now ?? Date.now();

  const pageUrl = isDev ? `${SITE_URL}index-dev.html` : SITE_URL;
  const pageTitle = `${isDev ? '[DEV] ' : ''}聴覚障害のニュース｜難聴・手話・暮らしの情報 | ${SITE_NAME}`;
  const robots = isDev ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const generatedLocal = formatDateJST(generatedAt);

  const defaultVisible = articles.filter((a) => !EXCLUDED_FROM_ALL.has(a.category));
  const featured = selectFeatured(articles, now);
  const topics = groupNewsTopics(defaultVisible);
  const topicMap = topics.filter(g => g.articles.length > 1).map(g => g.articles.map(a => a.id));
  const initialCards = topics.slice(0, INITIAL_VISIBLE);
  const initialVisibleCount = initialCards.length;
  const totalDefaultCount = topics.length;

  const articlesHtml = initialCards
    .map((group) => renderTopic(group, now))
    .join('\n');

  const jsonLd = renderJsonLd({ generatedAt, articles, pageUrl, pageTitle, isDev });
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
    stylesFile: `${files.styles}${assetVersion}`,
    feedUrl: `${SITE_URL}${files.feed}`,
    jsonLd,
    extraHead: `  <meta name="keywords" content="${escapeHtml(opts.keywords)}">\n  <meta name="author" content="TAMA">\n  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">\n`,
  })}
  <link rel="stylesheet" href="./home.css${assetVersion}">
</head>
<body class="news-page">
  ${renderSkipLink()}

${renderGlobalHeader({
    current: 'news',
    nav: {
      guideHref: `./${files.guide}`,
      aboutHref: `./${files.about}`,
    },
  })}
  <div class="dn-page-intro"><div class="container news-opening">
    <div class="news-opening__text">
      <h1 class="dn-page-title"><span>聴覚障害・難聴・</span><span>手話のニュース</span></h1>
    </div>
    <p class="site-lead">${leadPrefix}ろう者・難聴者・中途失聴者と、その家族・支援者へ。</p>
  </div></div>

  <main id="main" class="container" role="main">
${renderPurposeNav({ guideFile: files.guide })}
${renderToolbar()}
${renderFeatured(featured)}

${renderAgentActivity()}

    ${renderNewsNavigation()}
    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading">最新ニュース</h2>
        <p class="meta" aria-live="polite">
          表示中: <strong id="visible-count">${initialVisibleCount}</strong> / 全 <strong id="total-count">${totalDefaultCount}</strong> <span id="news-count-unit">話題</span>
        </p>
      </div>
      <p class="news-update">更新 <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time> · <a href="./${files.about}#about-policy">選定方針</a></p>
      <p class="offline-note" id="offline-note" role="status" data-generated-at="${escapeHtml(generatedAt)}" hidden></p>
      <div id="articles" class="articles" data-total="${totalDefaultCount}" data-initial="${initialVisibleCount}" data-src="./${files.articlesJson}">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" role="status" hidden>該当する記事がありません。検索条件を変えるか、「条件をクリア」を押してください。</p>
      <noscript>
        <p class="empty">検索・絞り込み・続きの読み込みにはJavaScriptが必要です。最新${initialVisibleCount}話題を表示しています。同じ話題の報道は開いて読めます。すべての記事は <a href="./${files.feed}">RSSフィード</a> や <a href="./${files.oldIndex}">過去アーカイブ</a> からも確認できます。</p>
      </noscript>
      <div class="load-more-wrap">
        <button type="button" id="load-more-btn" class="load-more-btn"${totalDefaultCount <= INITIAL_VISIBLE ? ' hidden' : ''}>
          もっと読む<span class="load-more-btn__remain" id="load-more-remain">（あと ${totalDefaultCount - initialVisibleCount} 話題）</span>
        </button>
      </div>
      <p class="archive-link"><a href="./${files.oldIndex}">過去アーカイブを見る</a></p>

${renderQuickAccess({ guideFile: files.guide })}

      <section class="news-next" aria-labelledby="news-next-heading">
        <div><h2 id="news-next-heading">知ったことを、出かけるきっかけに。</h2><p>手話や筆談で交流できる場所、参加できる催しを探せます。自分に合う会話の方法や参加条件も、出かける前に確認しましょう。</p><nav aria-label="出かけるための情報"><a href="/connect/sign-cafe/">全国の手話カフェ一覧</a><a href="/events.html">きこえ・手話のイベント</a><a href="/guide/accessibility/">通訳・字幕・筆談の確認ポイント</a></nav></div>
      </section>

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
    updateScheduleAt: generatedAt,
    links: [
      { href: `./${files.guide}`, label: '暮らしのガイド' },
      { href: './otomado/', label: 'おとまど' },
      { href: `./${files.about}#about-policy`, label: '選定方針' },
      { href: `${SITE_URL}${files.feed}`, label: 'RSSフィード' },
      { href: `${SITE_URL}${files.sitemapHtml}`, label: 'サイトマップ' },
    ],
  })}

${renderCardTemplate()}
  <script type="application/json" id="news-topic-map">${JSON.stringify(topicMap).replace(/</g, '\\u003c')}</script>

  <script src="./ui-controls.js${assetVersion}" defer></script>
  <script src="./${files.app}${assetVersion}" defer></script>
  <script src="./webmcp.js${assetVersion}" defer></script>
</body>
</html>
`;
}
