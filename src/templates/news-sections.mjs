import { renderNewsNavigation } from './news-navigation.mjs';
import { NEWS_SECTIONS } from '../../config/news-sections.mjs';
import { SITE_URL } from '../../config/site.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { formatDateJST } from '../lib/dates.mjs';
import { groupNewsTopics } from '../lib/news-topics.mjs';
import { getSourceTier, renderNewsContext } from './partials.mjs';
import { SOURCE_TIER_UI } from '../../config/categories.mjs';
import { renderReaderPage } from './reader.mjs';

export function newsSectionArticles(section, articles) {
  // General technology/education stories are not automatically about access or support.
  // Use only the already-approved publication snapshot; do not relax its relevance gates.
  return groupNewsTopics(articles.filter(a => section.categories.includes(a.category)).filter(a => {
    const text = `${a.title || ''} ${a.summary || ''}`;
    if (a.category === 'technology') return /字幕|手話|通訳|要約筆記|筆談|音声認識|文字変換|情報保障|アクセシビリティ|コミュニケーション|聞こえ|きこえ/u.test(text);
    if (a.category === 'education') return /(?<!特別)支援|制度|配慮|奨学|助成|補助|就学|受験|入試|学習保障|通級/u.test(text);
    return true;
  }))
    .slice(0, 24);
}

export function renderNewsSections({ articles, generatedAt }) {
  return NEWS_SECTIONS.map(section => {
    const path = `/news/${section.slug}/`;
    const groups = newsSectionArticles(section, articles);
    const body = `<nav class="reader-links" aria-label="このページの内容"><a href="#section-news">新着ニュースへ</a><a href="#reading-checks">読むときの確認ポイント</a><a href="${section.guide}">${e(section.guideLabel)}</a></nav>
      ${renderNewsNavigation(section.slug)}
      <section aria-labelledby="section-news"><h2 id="section-news">この分野の新着ニュース</h2><p class="reader-note">収集した記事から関連する分野を表示。同じ話題の出典はまとめています。更新：<time datetime="${e(generatedAt)}">${e(formatDateJST(generatedAt))}</time></p>
      ${groups.length ? `<ul class="reader-news">${groups.map(({lead:a,articles:related}) => `<li><div class="reader-news-meta"><span>${e(SOURCE_TIER_UI[getSourceTier(a)]?.label || '出典情報')}</span> · <time datetime="${e(a.publishedAt)}">${e(formatDateJST(a.publishedAt).slice(0,10))}</time>${renderNewsContext(a)}</div><h3><a href="${e(a.id)}" target="_blank" rel="noopener noreferrer">${e(a.title)} <span class="sr-only">（元記事・新しいタブ）</span></a></h3><p class="reader-resource-meta">${e(a.sourceName)}</p>${a.summary && !/^聴覚・手話に関わる取り組みについてのお知らせです。/u.test(a.summary) ? `<p>${e(a.summary)}</p>` : ''}${related.length > 1 ? `<details><summary>同じ話題の出典 ${related.length - 1}件</summary><ul>${related.slice(1).map(other=>`<li><a href="${e(other.id)}" target="_blank" rel="noopener noreferrer">${e(other.title)}（${e(other.sourceName)}・新しいタブ）</a></li>`).join('')}</ul></details>` : ''}</li>`).join('')}</ul>` : '<p>現在、この分野の新着はありません。暮らしのガイドや国内ニュースからお探しください。</p>'}
      <p><a href="/">聴覚障害・難聴・手話のニュース一覧へ</a></p></section>
      <section aria-labelledby="reading-checks"><h2 id="reading-checks">${e(section.heading)}</h2><p>${e(section.text)}</p><ul>${section.checks.map(t=>`<li>${e(t)}</li>`).join('')}</ul><nav class="reader-links" aria-label="関連するガイド"><a href="${section.guide}">${e(section.guideLabel)}</a><a href="${section.related}">${e(section.relatedLabel)}</a></nav></section>
      <section><h2>出典と掲載方針</h2><p>公式団体・専門媒体・報道の新着を自動で収集・選別しています。すべての記事を人が事前確認しているわけではありません。見出しから元記事を開き、最新の条件をご確認ください。</p><nav class="reader-links" aria-label="掲載方針と他の分野"><a href="/about.html#about-policy">選定方針・訂正の連絡先</a>${NEWS_SECTIONS.filter(s=>s!==section).map(s=>`<a href="/news/${s.slug}/">${e(s.label)}</a>`).join('')}</nav></section>`;
    const schema = {'@context':'https://schema.org','@type':'CollectionPage',name:section.title,description:section.description,url:new URL(path,SITE_URL).href,mainEntity:{'@type':'ItemList',numberOfItems:groups.length,itemListElement:groups.map(({lead:a},i)=>({'@type':'ListItem',position:i+1,name:a.title,url:a.id}))}};
    return {file:`news/${section.slug}/index.html`,html:renderReaderPage({path,title:section.title,description:section.description,current:'news',section:'国内ニュース',sectionPath:'/',body,schemas:[schema]})};
  });
}
