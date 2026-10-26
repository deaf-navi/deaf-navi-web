/**
 * 暮らしのガイドページ。掲載データは src/guide-data.mjs で管理する。
 */

import { SITE_NAME, SITE_URL } from '../../config/site.mjs';
import { GUIDE_LAST_REVIEWED, GUIDE_SECTIONS } from '../guide-data.mjs';
import { GUIDE_TOPICS } from '../guide-topics.mjs';
import { escapeHtml } from '../lib/text.mjs';
import { formatDateJaJST } from '../lib/dates.mjs';
import {
  jsonLdScript,
  renderFooter,
  renderHead,
  renderSkipLink,
  renderSiteHeader,
} from './partials.mjs';

function renderGuideItem(item, sectionLabel) {
  const searchText = [sectionLabel, item.title, item.summary, item.detail, ...(item.steps||[]), ...(item.relatedLinks||[]).map(link=>link.label)].join(' ');
  const linkLabel = item.linkLabel ?? '公式情報を見る';
  const recommended = item.recommended
    ? '\n            <span class="guide-card__badge">まず確認</span>'
    : '';
  return `
        <article class="guide-card" data-guide-item data-guide-search="${escapeHtml(searchText)}">
          <div class="guide-card__head">
            <h3 class="guide-card__title">${escapeHtml(item.title)}</h3>${recommended}
          </div>
          <p class="guide-card__summary">${escapeHtml(item.summary)}</p>
          <p class="guide-card__detail">${escapeHtml(item.detail)}</p>
${item.steps?.length ? `          <ol class="guide-card__steps" aria-label="利用の手順">${item.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}
          ${item.reviewedAt ? `<p class="guide-card__reviewed">掲載説明の確認: <time datetime="${escapeHtml(item.reviewedAt)}">${escapeHtml(item.reviewedAt)}</time></p>` : ''}
          <a class="guide-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.title)}の${escapeHtml(linkLabel)}（新しいタブで開く）">
            ${escapeHtml(linkLabel)} <span aria-hidden="true">↗</span>
          </a>
${(item.relatedLinks||[]).map(link=>`          <a class="guide-card__link guide-card__related" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.label)}（新しいタブで開く）">${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a>`).join('')}
        </article>`;
}

export function renderGuidePage({ isDev, files, clientAssetVersion = '20261016info' }) {
  const guideTitle = `暮らしのガイド | ${SITE_NAME}`;
  const guideUrl = `${SITE_URL}${files.guide}`;
  const description = '聴覚障害・難聴・ろう者の暮らしに役立つ緊急通報、医療、教育、就労、電話サービス、デフスポーツの公的情報と実用ツールを検索できるガイド。';
  const totalItems = GUIDE_SECTIONS.reduce((total, section) => total + section.items.length, 0);
  const reviewedLabel = formatDateJaJST(GUIDE_LAST_REVIEWED);
  const sectionsHtml = GUIDE_SECTIONS.map((section) => `
    <section class="guide-section" data-guide-section aria-labelledby="guide-${escapeHtml(section.id)}">
      <div class="guide-section__head">
        <h2 id="guide-${escapeHtml(section.id)}">${escapeHtml(section.label)}</h2>
        <span class="guide-section__count" data-guide-section-count>${section.items.length}件</span>
      </div>
      <p class="guide-section__summary">${escapeHtml(section.summary)}</p>
      <div class="guide-grid">
${section.items.map((item) => renderGuideItem(item, section.label)).join('\n')}
      </div>
    </section>`).join('\n');
  const guideJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': guideUrl,
    url: guideUrl,
    name: guideTitle,
    description,
    inLanguage: 'ja-JP',
    dateModified: GUIDE_LAST_REVIEWED,
    isPartOf: { '@id': `${SITE_URL}#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: totalItems,
      itemListElement: GUIDE_SECTIONS.flatMap((section) => section.items).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: item.url,
      })),
    },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title: guideTitle,
    description,
    canonical: guideUrl,
    robots: isDev ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1',
    ogUrl: guideUrl,
    stylesFile: files.styles,
    jsonLd: jsonLdScript(guideJsonLd),
  })}
  <link rel="stylesheet" href="./browse.css?v=${escapeHtml(clientAssetVersion)}">
  <link rel="stylesheet" href="./info.css?v=${escapeHtml(clientAssetVersion)}">
  <link rel="stylesheet" href="./reader.css?v=20261017seo">
</head>
<body class="browse-page guide-page">
  ${renderSkipLink()}

${renderSiteHeader({
    subLabel: '暮らしのガイド',
    lead: '緊急時、医療、教育、就労など、知りたい場面から公的情報や実用ツールを探せます。',
    current: 'guide',
  })}

  <main id="main" class="container guide" role="main">
    <section class="guide-reading" aria-labelledby="guide-reading-heading"><h2 id="guide-reading-heading">目的に合わせて読む</h2><nav class="reader-links" aria-label="目的別ガイド">${GUIDE_TOPICS.map(topic=>`<a href="/guide/${topic.slug}/">${escapeHtml(topic.label)}</a>`).join('')}<a href="/guide/guesthouses/">ろう者が営むゲストハウス・民泊</a><a href="/guide/hearing-disaster/">聞こえと防災</a></nav></section>
    <section class="guide-search" aria-labelledby="guide-search-heading">
      <div class="guide-search__head">
        <div>
          <h2 id="guide-search-heading">ガイドを検索</h2>
        </div>
        <p class="guide-search__meta" aria-live="polite"><strong id="guide-visible-count">${totalItems}</strong> / ${totalItems}件</p>
      </div>
      <label class="guide-search__label" for="guide-search">キーワード</label>
      <div class="guide-search-row"><input class="guide-search__input" id="guide-search" name="q" type="search" inputmode="search" autocomplete="off" placeholder="例: 補聴器 医療費"><button type="button" class="filter" id="guide-clear" hidden>検索をクリア</button></div>
      <p class="guide-search__reviewed">ガイドの最終更新: <time datetime="${GUIDE_LAST_REVIEWED}">${escapeHtml(reviewedLabel)}</time>（確認日は各項目に記載）</p>
    </section>

    <nav class="guide-topics" aria-label="場面から探す">${GUIDE_SECTIONS.map(section => `<a href="#guide-${escapeHtml(section.id)}">${escapeHtml(section.label)}</a>`).join('')}</nav>

    <aside class="guide-alert" aria-label="緊急通報に関する注意">
      <strong>緊急時に備えて、事前登録と操作確認を。</strong>
      <span>サービスごとに登録条件や対応地域が異なります。実際の緊急時には、利用できる手段ですぐに通報してください。</span>
    </aside>

${sectionsHtml}
    <p id="guide-empty" class="empty" role="status" hidden>該当するガイドがありません。別のキーワードで検索してください。</p>

    <p class="guide-related">会話の補助に <a href="./otomado/#/board">おとまどの筆談</a> ／ 出かける場所を探すなら <a href="./connect/sign-cafe/">手話カフェ</a></p>
    <p class="guide-disclaimer">掲載内容は公的情報や実用ツールへの入口です。制度・受付期間・対応地域・サービス内容は変更される場合があるため、申請や利用の前にリンク先の最新情報をご確認ください。</p>
    <p class="about__back"><a href="./">← ニュースへ戻る</a></p>
  </main>

${renderFooter({
    year: new Date().getFullYear(),
    links: [
      { href: './deaf-navi-world-jp.html', label: 'Deaf Navi World-JP' },
      { href: './otomado/', label: 'おとまど' },
      { href: './about.html', label: 'Deaf Naviについて' },
    ],
  })}

  <script src="./ui-controls.js" defer></script>
  <script src="./${files.guideJs}" defer></script>
</body>
</html>`;
}
