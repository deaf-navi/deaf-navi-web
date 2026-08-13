/**
 * 暮らしのガイドページ。掲載データは src/guide-data.mjs で管理する。
 */

import { SITE_NAME, SITE_URL } from '../../config/site.mjs';
import { GUIDE_LAST_REVIEWED, GUIDE_SECTIONS } from '../guide-data.mjs';
import { escapeHtml } from '../lib/text.mjs';
import { formatDateJaJST } from '../lib/dates.mjs';
import {
  jsonLdScript,
  renderFooter,
  renderHead,
  renderSkipLink,
  renderSubHeader,
} from './partials.mjs';

function renderGuideItem(item, sectionLabel) {
  const searchText = [sectionLabel, item.title, item.summary, item.detail].join(' ');
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
          <a class="guide-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.title)}の公式情報を見る（新しいタブで開く）">
            公式情報を見る <span aria-hidden="true">↗</span>
          </a>
        </article>`;
}

export function renderGuidePage({ isDev, files }) {
  const guideTitle = `暮らしのガイド | ${SITE_NAME}`;
  const guideUrl = `${SITE_URL}${files.guide}`;
  const description = '聴覚障害・難聴・ろう者の暮らしに役立つ緊急通報、医療、教育、就労、電話サービス、デフスポーツの公的情報を検索できるガイド。';
  const totalItems = GUIDE_SECTIONS.reduce((total, section) => total + section.items.length, 0);
  const reviewedLabel = formatDateJaJST(GUIDE_LAST_REVIEWED);
  const sectionsHtml = GUIDE_SECTIONS.map((section) => `
    <section class="guide-section" data-guide-section aria-labelledby="guide-${escapeHtml(section.id)}">
      <div class="guide-section__head">
        <div>
          <h2 id="guide-${escapeHtml(section.id)}">${escapeHtml(section.label)}</h2>
          <p>${escapeHtml(section.summary)}</p>
        </div>
        <span class="guide-section__count" data-guide-section-count>${section.items.length}件</span>
      </div>
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
</head>
<body>
  ${renderSkipLink()}

${renderSubHeader({
    crumbLabel: '暮らしのガイド',
    title: '暮らしのガイド',
    lead: '緊急時、医療、教育、就労など、知りたい場面から公的な情報を探せます。',
  })}

  <main id="main" class="container guide" role="main">
    <section class="guide-search" aria-labelledby="guide-search-heading">
      <div class="guide-search__head">
        <div>
          <h2 id="guide-search-heading">ガイドを検索</h2>
          <p>制度名、場面、キーワードで絞り込めます。</p>
        </div>
        <p class="guide-search__meta" aria-live="polite"><strong id="guide-visible-count">${totalItems}</strong> / ${totalItems}件</p>
      </div>
      <label class="guide-search__label" for="guide-search">キーワード</label>
      <input class="guide-search__input" id="guide-search" type="search" inputmode="search" autocomplete="off" placeholder="例: 110、補聴器、就職、受験">
      <p class="guide-search__reviewed">最終確認: <time datetime="${GUIDE_LAST_REVIEWED}">${escapeHtml(reviewedLabel)}</time></p>
    </section>

    <aside class="guide-alert" aria-label="緊急通報に関する注意">
      <strong>緊急時に備えて、事前登録と操作確認を。</strong>
      <span>サービスごとに登録条件や対応地域が異なります。実際の緊急時には、利用できる手段ですぐに通報してください。</span>
    </aside>

${sectionsHtml}
    <p id="guide-empty" class="empty" role="status" hidden>該当するガイドがありません。別のキーワードで検索してください。</p>

    <p class="guide-disclaimer">掲載内容は公式情報への入口です。制度・受付期間・対応地域は変更される場合があるため、申請や利用の前にリンク先の最新情報をご確認ください。</p>
    <p class="about__back"><a href="./">← ニュースへ戻る</a></p>
  </main>

${renderFooter({
    year: new Date().getFullYear(),
    links: [
      { href: './deaf-navi-world-jp.html', label: 'Deaf Navi World-JP' },
      { href: './about.html', label: 'Deaf Naviについて' },
    ],
  })}

  <script src="./${files.guideJs}" defer></script>
</body>
</html>`;
}
