/**
 * 過去アーカイブ 2.0。
 *
 * v1 は index-old.html に全記事（最大5000件・5MB超）を埋め込んでいた。
 * 2.0 では index-old.html を「月別の目次ページ」にし、実際の記事は
 * archive/YYYY-MM.html へ月単位で分割して出力する（1ページ数百KB以下）。
 * 既存URL index-old.html は目次として維持する。
 */

import { SITE_NAME, SITE_URL } from '../../config/site.mjs';
import { CATEGORY_UI } from '../../config/categories.mjs';
import { escapeHtml } from '../lib/text.mjs';
import { formatDateJST, monthKey, monthLabel } from '../lib/dates.mjs';
import {
  renderFooter,
  renderHead,
  renderSkipLink,
  renderSubHeader,
} from './partials.mjs';

/**
 * サイト開設（2025年）より前の月キーは v1 の日付解析バグ由来がほとんどのため、
 * 月別ページを乱立させず legacy 1ページへまとめる。
 */
export const LEGACY_MONTH_THRESHOLD = '2025-01';
export const LEGACY_KEY = 'legacy';

export function groupArticlesByMonth(articles) {
  const groups = new Map();
  const legacy = [];
  for (const article of articles) {
    const key = monthKey(article.publishedAt);
    if (key === 'unknown' || key < LEGACY_MONTH_THRESHOLD) {
      legacy.push(article);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  if (legacy.length) sorted.push([LEGACY_KEY, legacy]);
  return sorted;
}

function archiveMonthLabel(key) {
  return key === LEGACY_KEY ? '2024年以前・日付情報の不確かな記事' : monthLabel(key);
}

function renderArchiveArticle(a) {
  const catLabel = CATEGORY_UI[a.category] ?? '一般';
  return `
          <article class="card archive-card" data-category="${escapeHtml(a.category)}">
            <header class="card__head">
              <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(catLabel)}</span>
              <time class="card__time" datetime="${escapeHtml(a.publishedAt)}">${escapeHtml(formatDateJST(a.publishedAt))}</time>
            </header>
            <h3 class="card__title">
              <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
            </h3>${a.summary ? `
            <p class="card__summary">${escapeHtml(a.summary)}</p>` : ''}
            <footer class="card__foot">
              <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
            </footer>
          </article>`;
}

/** 月別ページ（archive/YYYY-MM.html） */
export function renderArchiveMonthPage({ key, items, generatedAt, isDev, files }) {
  const label = archiveMonthLabel(key);
  const title = `${isDev ? '[DEV] ' : ''}${label}のアーカイブ | ${SITE_NAME}`;
  const pageUrl = `${SITE_URL}archive/${key}${isDev ? '-dev' : ''}.html`;
  const robots = isDev ? 'noindex,nofollow,noarchive' : 'index,follow';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title,
    description: `${label}に掲載した聴覚障害・難聴・手話関連ニュースのアーカイブ（${items.length}件）。`,
    canonical: pageUrl,
    robots,
    stylesFile: files.styles,
    basePath: '../',
  })}
</head>
<body>
  ${renderSkipLink()}

${renderSubHeader({
    crumbLabel: `アーカイブ ${label}`,
    title: `${label}のアーカイブ`,
    lead: `${label}に掲載した記事 ${items.length}件`,
    homeHref: '../',
  })}

  <main id="main" class="container archive" role="main">
    <p class="site-breadcrumb"><a href="../${files.oldIndex}">← アーカイブ目次へ戻る</a></p>
    <div class="articles archive-articles">
${items.map(renderArchiveArticle).join('\n')}
    </div>
    <p class="about__back"><a href="../${files.oldIndex}">← アーカイブ目次へ戻る</a></p>
  </main>

${renderFooter({ year: new Date().getFullYear() })}
</body>
</html>
`;
}

/** アーカイブ目次ページ（index-old.html） */
export function renderArchiveIndexPage({ generatedAt, count, groups, isDev, files }) {
  const generatedLocal = formatDateJST(generatedAt);
  const archiveTitle = isDev ? '[DEV] Deaf Navi Web 過去アーカイブ' : 'Deaf Navi Web 過去アーカイブ';
  const pageUrl = `${SITE_URL}${files.oldIndex}`;
  const robots = isDev ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1';

  const monthRows = groups.map(([key, items]) => `        <li class="archive-index__item">
          <a class="archive-index__link" href="./archive/${key}${isDev ? '-dev' : ''}.html">
            <span class="archive-index__label">${escapeHtml(archiveMonthLabel(key))}</span>
            <span class="archive-index__count">${items.length}件</span>
          </a>
        </li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title: archiveTitle,
    description: 'Deaf Navi Web の掲載期間を過ぎた記事を、月別に閲覧できる過去アーカイブの目次。',
    canonical: pageUrl,
    robots,
    stylesFile: files.styles,
  })}
</head>
<body>
  ${renderSkipLink()}

${renderSubHeader({
    crumbLabel: '過去アーカイブ',
    title: '過去アーカイブ',
    lead: '掲載期間を過ぎた記事を月別に保管しています。月を選んでください。',
    homeHref: isDev ? './index-dev.html' : './',
  })}

  <main id="main" class="container archive" role="main">
    <div class="articles-head">
      <h2 id="articles-heading">月別の目次</h2>
      <p class="meta">
        全 <strong>${count}</strong> 件
        <span class="meta__sep" aria-hidden="true">/</span>
        最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
      </p>
    </div>
${groups.length ? `    <ul class="archive-index">\n${monthRows}\n    </ul>` : '    <p class="empty">アーカイブ対象の記事はまだありません。</p>'}
    <p class="about__back"><a href="${isDev ? './index-dev.html' : './'}">← トップへ戻る</a></p>
  </main>

${renderFooter({ year: new Date().getFullYear() })}
</body>
</html>
`;
}
