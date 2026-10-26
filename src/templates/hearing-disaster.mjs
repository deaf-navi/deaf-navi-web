import { SITE_URL } from '../../config/site.mjs';
import { HEARING_DISASTER, DISASTER_RESOURCES } from '../hearing-disaster-data.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { disasterNews, disasterNewsDisplay } from '../lib/disaster-news.mjs';
import { assertPublicCopy } from '../lib/public-copy.mjs';
import { renderReaderPage } from './reader.mjs';
import { renderNewsSectionItem } from './news-sections.mjs';

export { disasterNews };

export function renderHearingDisasterPage({ articles = [], now = Date.now() } = {}) {
  assertPublicCopy(DISASTER_RESOURCES.map(r => ({title:r.title,summary:[r.description,r.note].join(' ')})), 'news');
  const groups = disasterNews(articles, { now }).map(group => ({
    lead: disasterNewsDisplay(group.lead),
    articles: group.articles.map(article => disasterNewsDisplay(article)),
  }));
  assertPublicCopy(groups.flatMap(group => group.articles), 'news');
  const sections = [
    ['preparation', '本人・家族の備えを知る'],
    ['communication', '伝え方・受け取り方を知る'],
    ['support', '制度と支援のつながりを知る'],
    ['records', '被災地の支援と記録を読む'],
  ];
  const body = `<nav class="reader-links" aria-label="特集の内容"><a href="#resources">公式資料・当事者団体の資料</a><a href="#disaster-news">防災・災害に関するニュース</a></nav>
    <p class="reader-note">防災と情報保障について学ぶための特集です。現在の警報・避難情報は、<a href="https://www.jma.go.jp/" target="_blank" rel="noopener noreferrer">気象庁<span class="sr-only">（新しいタブ）</span></a>やお住まいの自治体の公式発表をご確認ください。</p>
    <p>110番アプリ、NET119、電話リレーサービスなどの緊急通報手段と事前登録の案内は、<a href="/guide.html#guide-emergency">暮らしのガイド「災害・緊急時」</a>にまとめています。</p>
    <section class="disaster-part" aria-labelledby="resources"><h2 id="resources">公式資料・当事者団体の資料</h2>
      <p>避難所の放送、物資の配布、相談窓口でのやりとり。災害時の情報は、本人が受け取れる方法で届くことが欠かせません。知りたい内容に合わせて、発行元の資料へ進めます。</p>
      ${sections.map(([id,label])=>`<section class="disaster-group" aria-labelledby="resources-${id}"><h3 id="resources-${id}">${label}</h3><ul class="reader-resources">${DISASTER_RESOURCES.filter(r=>r.group===id).map(r=>`<li id="${e(r.id)}"><h4><a href="${e(r.url)}" target="_blank" rel="noopener noreferrer">${e(r.title)}<span class="sr-only">（新しいタブ）</span></a></h4><p class="reader-resource-meta">${e(r.publisher)} · ${e(r.dateLabel)}</p><p>${e(r.description)}</p><p class="reader-note">${e(r.note)}</p>${r.links?.length?`<p>${r.links.map(link=>`<a href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)}<span class="sr-only">（新しいタブ）</span></a>`).join(' · ')}</p>`:''}</li>`).join('')}</ul></section>`).join('')}
    </section>
    <section class="disaster-part" aria-labelledby="disaster-news"><h2 id="disaster-news">防災・災害に関するニュース</h2>
      <p>Deaf Naviの国内ニュースから、聞こえに関わる防災の取組、情報保障、被災後の支援の記事を掲載しています。過去の災害や開催済みの催しも含みます。記事の日付と対象地域を確認してお読みください。</p>
      ${groups.length ? `<ul class="reader-news">${groups.map(group=>renderNewsSectionItem(group)).join('')}</ul><p class="reader-note">概要にはDeaf Navi編集による要約を含みます。同じ話題の出典はまとめて表示しています。</p>` : '<p>現在、掲載中の国内ニュースに該当する記事はありません。上の資料から、防災と情報保障について読むことができます。</p>'}
      <p><a href="/">国内ニュースをすべて見る</a> · <a href="/index-old.html">過去のニュースを探す</a></p>
    </section>
    <section class="disaster-part" aria-labelledby="about-feature"><h2 id="about-feature">この特集について</h2><p>資料の紹介はDeaf Navi編集によるものです。関連ニュースのリンクは、各発行元の記事へつながります。支援の対象や受付期間などは地域・時期によって異なるため、現在の案内は発行元でご確認ください。</p><p class="reader-note">資料の掲載内容を確認した日：<time datetime="${HEARING_DISASTER.reviewedAt}">2026年10月26日</time></p><nav class="reader-links" aria-label="関連ページ"><a href="/stories/">読みもの一覧</a><a href="/guide.html#guide-emergency">暮らしのガイドの防災・緊急連絡</a><a href="/about.html#about-policy">掲載方針・訂正の連絡先</a></nav></section>`;
  const schema = {'@context':'https://schema.org','@type':'CollectionPage',name:HEARING_DISASTER.title,description:HEARING_DISASTER.description,url:new URL(HEARING_DISASTER.path,SITE_URL).href,mainEntity:{'@type':'ItemList',numberOfItems:DISASTER_RESOURCES.length,itemListElement:DISASTER_RESOURCES.map((r,i)=>({'@type':'ListItem',position:i+1,name:r.title,url:r.url}))}};
  return { file:'guide/hearing-disaster/index.html', html:renderReaderPage({...HEARING_DISASTER,body,schemas:[schema]}) };
}
