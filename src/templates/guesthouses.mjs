import { SITE_URL } from '../../config/site.mjs';
import { GUESTHOUSE_GUIDE as guide, GUESTHOUSES } from '../guesthouses-data.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderReaderPage } from './reader.mjs';

function renderSources(h) {
  const sources = h.sources.filter(s => !h.media?.some(m => m.url === s.url));
  return sources.length ? `<nav class="reader-links" aria-label="${e(h.name)}の確認に使った情報源">${sources.map(s => `<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.label)}（新しいタブ）</a>`).join('')}</nav>` : '';
}

function renderMedia(h) {
  if (!h.media?.length) return '';
  return `<div class="guesthouse-media" aria-labelledby="${e(h.id)}-media-heading">
    <h3 id="${e(h.id)}-media-heading">宿の雰囲気や運営者を知る</h3>
    <ul class="reader-resources">${h.media.map(m => `<li>
      <p class="reader-note">${e(m.publisher)} · ${e(m.type)} · <time datetime="${e(m.publishedAt)}">${e(m.publishedAt)}</time>公開${m.updatedAt ? `（<time datetime="${e(m.updatedAt)}">${e(m.updatedAt)}</time>更新）` : ''}</p>
      <p class="reader-actions"><a href="${e(m.url)}" target="_blank" rel="noopener noreferrer">${e(m.title)}（新しいタブ）</a></p>
      <p>${e(m.description)}</p>
    </li>`).join('')}</ul>
    <p class="reader-note">紹介内容は掲載当時のものです。現在の料金・予約方法は上の公式予約案内で確認してください。</p>
  </div>`;
}

export function renderGuesthousesPage() {
  const body = `<p class="reader-note">掲載内容の確認：<time datetime="${guide.reviewedAt}">${guide.reviewedAt}</time> · 国内で確認できた${GUESTHOUSES.length}施設</p>
    <p>ろう者が運営に関わることを公式サイトや公表された取材記事で確認した宿を紹介しています。宿ごとに会話の方法や設備は異なります。希望する対応と宿泊条件は、予約前に各宿へ確認してください。</p>
    <nav class="reader-links" aria-label="掲載している宿">${GUESTHOUSES.map(h => `<a href="#${e(h.id)}">${e(h.area)}：${e(h.name)}</a>`).join('')}<a href="#before-booking">予約前の確認</a></nav>
    <p class="reader-note">料金は確認時点の公式掲載例で、空室や予約金額を保証するものではありません。最新の料金・営業日・取消条件はリンク先で確認できます。予約・問い合わせは各宿へ直接お願いします。</p>
    ${GUESTHOUSES.map(h => `<section id="${e(h.id)}" aria-labelledby="${e(h.id)}-heading" style="scroll-margin-top:7rem">
      <h2 id="${e(h.id)}-heading">${e(h.name)}</h2><p class="reader-note">${e(h.area)} · 公式案内の確認：<time datetime="${e(h.reviewedAt)}">${e(h.reviewedAt)}</time></p>
      <p>${e(h.description)}</p><dl class="reader-facts">${h.facts.map(([label, text]) => `<div><dt>${e(label)}</dt><dd>${e(text)}</dd></div>`).join('')}</dl>
      <p class="reader-actions"><a href="${e(h.bookingUrl)}" target="_blank" rel="noopener noreferrer">${e(h.name)}の公式予約案内（新しいタブ）</a></p>
      ${renderSources(h)}${renderMedia(h)}
    </section>`).join('')}
    <section id="before-booking" style="scroll-margin-top:7rem"><h2>予約前に確認しておくこと</h2>
      <ul><li><strong>会話と連絡：</strong>手話・筆談など希望する方法、到着が遅れるときの連絡先、夜間にスタッフへ連絡する方法。手話が使えることから、常時スタッフが対応できるとは判断できません。</li>
      <li><strong>部屋と共用設備：</strong>個室か相部屋か、階段の有無、浴室・トイレの共用範囲。ペットや子どもと泊まる場合は受入条件も確認します。</li>
      <li><strong>支払総額と取消条件：</strong>1人料金か1室料金か、宿泊税・冷暖房費・予約サイトの手数料、人数や日程を変える場合の扱い。最安値の表示だけで比べず、同じ条件で確認します。</li>
      <li><strong>非常時の知らせ方：</strong>光・振動などの設備の有無と使い方、避難口、夜間の対応。記載のない設備は「ない」と断定せず、宿へ確認してください。</li></ul>
      <h3>文字で問い合わせるときの例</h3><p class="reader-example">○月○日から○泊、大人○人で宿泊を検討しています。個室を希望し、会話は筆談を使います。予約できる部屋と追加費用を含めた料金、夜間・非常時の連絡方法を教えてください。</p>
    </section>
    <section><h2>旅先で立ち寄る場所も探す</h2><nav class="reader-links" aria-label="関連する情報"><a href="/connect/sign-cafe/">手話カフェを探す</a><a href="/events.html">国内のイベントを見る</a><a href="/guide.html">暮らしのガイドへ</a></nav></section>
    <p class="reader-note">全国を網羅した一覧ではありません。未確認の料金や設備を推測で補わず、公表情報をもとに紹介しています。掲載内容の変更・追加情報は<a href="/about.html#about-correction">Deaf Naviのお問い合わせ</a>へお知らせください。</p>`;
  return {
    file: 'guide/guesthouses/index.html',
    html: renderReaderPage({ ...guide, body, schemas: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: guide.title, description: guide.description,
      url: new URL(guide.path, SITE_URL).href, dateModified: guide.reviewedAt,
      mainEntity: { '@type': 'ItemList', itemListElement: GUESTHOUSES.map((h, i) => ({
        '@type': 'ListItem', position: i + 1, name: h.name,
        url: new URL(guide.path + '#' + h.id, SITE_URL).href,
      })) },
    }] }),
  };
}
