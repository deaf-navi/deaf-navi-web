import { SITE_URL } from '../../config/site.mjs';
import { HEARING_DISASTER, DISASTER_RESOURCES } from '../hearing-disaster-data.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { groupNewsTopics } from '../lib/news-topics.mjs';
import { assertPublicCopy } from '../lib/public-copy.mjs';
import { renderReaderPage } from './reader.mjs';
import { renderNewsSectionItem } from './news-sections.mjs';

// Select only from the existing publication-approved domestic news snapshot.
// Safety also includes crime/emergency medicine; it is not itself a disaster match.
export function disasterNews(articles, { now = Date.now(), limit = 12 } = {}) {
  const seen = new Set();
  const selected = articles.filter(article => {
    const text = `${article.title || ''} ${article.summary || ''}`;
    if (!/防災|減災|災害|被災|避難|震災|地震|津波|豪雨|洪水|台風/u.test(text)) return false;
    if (article.category !== 'safety' && !/聴覚|難聴|失聴|ろう者|盲ろう|聞こえ|きこえ|聞こえない|手話|要約筆記|筆談|情報保障/u.test(text)) return false;
    const time = Date.parse(article.publishedAt);
    if (!Number.isFinite(time) || time > now || !/^https?:\/\//i.test(article.id || '') || seen.has(article.id)) return false;
    seen.add(article.id); return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return groupNewsTopics(selected).slice(0, limit);
}

export function renderHearingDisasterPage({ articles = [], now = Date.now() } = {}) {
  assertPublicCopy(DISASTER_RESOURCES.map(r => ({title:r.title,summary:[r.description,r.note].join(' ')})), 'news');
  const groups = disasterNews(articles, { now });
  const sections = [
    ['communication', '伝え方・受け取り方を知る'],
    ['support', '制度と支援のつながりを知る'],
    ['records', '過去の災害から学ぶ'],
  ];
  const body = `<nav class="reader-links" aria-label="特集の内容"><a href="#resources">公式資料・当事者団体の資料</a><a href="#disaster-news">関連ニュース</a></nav>
    <p class="reader-note">防災と情報保障について学ぶための特集です。現在の警報・避難情報は、気象庁やお住まいの自治体の公式発表をご確認ください。</p>
    <section class="disaster-part" aria-labelledby="resources"><h2 id="resources">公式資料・当事者団体の資料</h2>
      <p>避難所の放送、物資の配布、相談窓口でのやりとり。災害時の情報は、本人が受け取れる方法で届くことが欠かせません。知りたい内容に合わせて、発行元の資料へ進めます。</p>
      ${sections.map(([id,label])=>`<section class="disaster-group" aria-labelledby="resources-${id}"><h3 id="resources-${id}">${label}</h3><ul class="reader-resources">${DISASTER_RESOURCES.filter(r=>r.group===id).map(r=>`<li id="${e(r.id)}"><h4><a href="${e(r.url)}" target="_blank" rel="noopener noreferrer">${e(r.title)}<span class="sr-only">（新しいタブ）</span></a></h4><p class="reader-resource-meta">${e(r.publisher)} · ${e(r.dateLabel)}</p><p>${e(r.description)}</p><p class="reader-note">${e(r.note)}</p></li>`).join('')}</ul></section>`).join('')}
    </section>
    <section class="disaster-part" aria-labelledby="disaster-news"><h2 id="disaster-news">防災・災害に関するニュース</h2>
      <p>Deaf Naviの国内ニュースから、情報保障、防災の取組、被災後の支援に関する記事を掲載しています。過去の災害や開催済みの催しも含みます。記事の日付と対象地域を確認してお読みください。</p>
      ${groups.length ? `<ul class="reader-news">${groups.map(renderNewsSectionItem).join('')}</ul>` : '<p>現在、掲載中の国内ニュースに該当する記事はありません。上の資料から、防災と情報保障について読むことができます。</p>'}
      <p><a href="/">国内ニュースをすべて見る</a> · <a href="/index-old.html">過去のニュースを探す</a></p>
    </section>
    <section class="disaster-part" aria-labelledby="about-feature"><h2 id="about-feature">この特集について</h2><p>資料の紹介はDeaf Navi編集によるものです。関連ニュースのリンクは、各発行元の記事へつながります。支援の対象や受付期間などは地域・時期によって異なるため、現在の案内は発行元でご確認ください。</p><p class="reader-note">資料の掲載内容を確認した日：<time datetime="${HEARING_DISASTER.reviewedAt}">2026年10月26日</time></p><nav class="reader-links" aria-label="関連ページ"><a href="/stories/">読みもの一覧</a><a href="/guide.html#guide-emergency">暮らしのガイドの防災・緊急連絡</a><a href="/about.html#about-policy">掲載方針・訂正の連絡先</a></nav></section>`;
  const schema = {'@context':'https://schema.org','@type':'CollectionPage',name:HEARING_DISASTER.title,description:HEARING_DISASTER.description,url:new URL(HEARING_DISASTER.path,SITE_URL).href,mainEntity:{'@type':'ItemList',numberOfItems:DISASTER_RESOURCES.length,itemListElement:DISASTER_RESOURCES.map((r,i)=>({'@type':'ListItem',position:i+1,name:r.title,url:r.url}))}};
  return { file:'guide/hearing-disaster/index.html', html:renderReaderPage({...HEARING_DISASTER,body,schemas:[schema]}) };
}
