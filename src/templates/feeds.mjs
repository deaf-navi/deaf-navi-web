/**
 * サイトマップ（XML/HTML）・robots.txt・RSSフィードの生成。
 */

import {
  SITE_DESC,
  SITE_NAME,
  SITE_URL,
} from '../../config/site.mjs';
import { CATEGORY_UI } from '../../config/categories.mjs';
import { GUIDE_LAST_REVIEWED } from '../guide-data.mjs';
import { escapeHtml, escapeXml } from '../lib/text.mjs';
import { formatDateJST } from '../lib/dates.mjs';
import {
  renderFooter,
  renderHead,
  renderSkipLink,
  renderSubHeader,
} from './partials.mjs';

export function renderSitemapXml({ generatedAt, isDev, files, archiveMonths = [] }) {
  const lastmod = new Date(generatedAt).toISOString();
  const pageUrl = isDev ? `${SITE_URL}index-dev.html` : SITE_URL;
  const urls = [
    { loc: pageUrl, lastmod, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}${files.oldIndex}`, lastmod, changefreq: 'daily', priority: '0.6' },
    ...archiveMonths.map((key) => ({
      loc: `${SITE_URL}archive/${key}${isDev ? '-dev' : ''}.html`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.3',
    })),
    { loc: `${SITE_URL}${files.about}`, lastmod, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}${files.guide}`, lastmod: GUIDE_LAST_REVIEWED, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE_URL}otomado/`, lastmod, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE_URL}${files.sitemapHtml}`, lastmod, changefreq: 'weekly', priority: '0.4' },
    { loc: `${SITE_URL}deaf-navi-world-jp.html`, lastmod, changefreq: 'daily', priority: '0.8' },
    { loc: `${SITE_URL}deaf-navi-world-original.html`, lastmod, changefreq: 'daily', priority: '0.7' },
  ];
  const body = urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function renderRobots({ isDev, files }) {
  if (isDev) {
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

Sitemap: ${SITE_URL}${files.sitemap}
Sitemap: ${SITE_URL}sitemap-world.xml
`;
}

export function renderRss({ generatedAt, articles, isDev, files }) {
  const pageUrl = isDev ? `${SITE_URL}index-dev.html` : SITE_URL;
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
    <title>${escapeXml(isDev ? `${SITE_NAME} DEV` : SITE_NAME)}</title>
    <link>${pageUrl}</link>
    <atom:link href="${SITE_URL}${files.feed}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESC)}</description>
    <language>ja-JP</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>
`;
}

export function renderSitemapHtmlPage({ generatedAt, count, isDev, files }) {
  const generatedLocal = formatDateJST(generatedAt);
  const pageTitle = `${isDev ? '[DEV] ' : ''}サイトマップ | ${SITE_NAME}`;
  const indexFile = isDev ? 'index-dev.html' : 'index.html';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title: pageTitle,
    description: 'Deaf Navi Web の主要ページ、RSS、XMLサイトマップ、アプリ連携用JSONへのリンクをまとめたHTMLサイトマップ。',
    canonical: `${SITE_URL}${files.sitemapHtml}`,
    robots: isDev ? 'noindex,nofollow,noarchive' : 'index,follow',
    stylesFile: files.styles,
  })}
</head>
<body>
  ${renderSkipLink()}

${renderSubHeader({
    crumbLabel: `サイトマップ${isDev ? ' DEV' : ''}`,
    title: `サイトマップ${isDev ? ' DEV' : ''}`,
    lead: 'Deaf Navi Web の公開ページと配信データへの入口をまとめています。',
    homeHref: `./${indexFile}`,
  })}

  <main id="main" class="container sitemap-page" role="main">
    <section class="sitemap-summary" aria-label="サイトマップ概要">
      <div>
        <span class="sitemap-summary__label">最終ビルド</span>
        <strong>${escapeHtml(generatedLocal)}</strong>
      </div>
      <div>
        <span class="sitemap-summary__label">国内記事数</span>
        <strong>${escapeHtml(String(count))}</strong>
      </div>
      <div>
        <span class="sitemap-summary__label">XMLサイトマップ</span>
        <strong><a href="./${files.sitemap}">検索エンジン用</a></strong>
      </div>
    </section>

    <div class="sitemap-grid">
      <section class="sitemap-card" aria-labelledby="sitemap-domestic">
        <h2 id="sitemap-domestic">国内ニュース</h2>
        <ul>
          <li><a href="./${indexFile}">Deaf Navi Web トップ</a><span>聴覚障害・難聴・ろう者コミュニティ向け国内ニュース</span></li>
          <li><a href="./${files.oldIndex}">過去アーカイブ</a><span>掲載期間を過ぎた記事の月別アーカイブ</span></li>
          <li><a href="./${files.guide}">暮らしのガイド</a><span>緊急通報・医療・教育・就労などの公式情報</span></li>
          <li><a href="./${files.feed}">RSSフィード</a><span>国内ニュース最新50件</span></li>
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

      <section class="sitemap-card" aria-labelledby="sitemap-tools">
        <h2 id="sitemap-tools">情報保障ツール</h2>
        <ul>
          <li><a href="./otomado/">おとまど</a><span>音の可視化・リアルタイム字幕・筆談ボード</span></li>
        </ul>
      </section>

      <section class="sitemap-card" aria-labelledby="sitemap-info">
        <h2 id="sitemap-info">サイト情報</h2>
        <ul>
          <li><a href="./${files.about}">Deaf Naviについて</a><span>情報源・更新頻度・運営情報</span></li>
          <li><a href="./${files.sitemap}">XMLサイトマップ</a><span>検索エンジン向けURL一覧</span></li>
          <li><a href="./sitemap-world.xml">World XMLサイトマップ</a><span>Worldページ用URL一覧</span></li>
          <li><a href="./${files.robots}">robots.txt</a><span>クロール設定</span></li>
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

    <p class="about__back"><a href="./${indexFile}">← トップページへ戻る</a></p>
  </main>

${renderFooter({ year: new Date().getFullYear() })}

  <script src="./ui-controls.js" defer></script>
</body>
</html>
`;
}
