import { SITE_URL } from '../../config/site.mjs';
import { GUESTHOUSE_GUIDE as guide, GUESTHOUSES } from '../guesthouses-data.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderReaderPage } from './reader.mjs';

const highlights = {
  tarakoyu: '温泉があり、ペット同伴で泊まれる全6室の宿',
  'haru-no-sora': '1部屋のみ、通常は大人2人用の宿',
  sakanagi: '善光寺そば、ドミトリー（相部屋）と個室がある素泊まり宿',
  'cozy-sign': 'ライダー以外も泊まれる、個室4室の小さな宿',
};

export const INQUIRY_TEMPLATE = '○月○日から○泊、大人○名・子ども○名で宿泊を検討しています。子どもがいる場合の年齢：○歳。\n部屋は［個室／相部屋／指定なし］を希望します。\n当日のやりとりは［手話／筆談／口話／音声認識アプリ／どれでも可］を希望します。\n空室状況と、暖房費や宿泊税など追加費用を含めた総額を教えてください。\nまた、光・振動で知らせる設備の有無と、到着が遅れるときや夜間・非常時の連絡方法を教えてください。';

function renderComparison() {
  const columns = [['rooms', '部屋タイプ'], ['booking', '予約窓口'], ['emergency', '非常時の光・振動設備']];
  return `<section class="guesthouse-comparison" aria-labelledby="comparison-heading">
    <h2 id="comparison-heading">${GUESTHOUSES.length}施設を比べる</h2>
    <p id="comparison-note" class="reader-note">「未確認」は設備がないという意味ではありません。設備の使い方や夜間の対応は、予約前に宿へ確認してください。公式案内の確認日は各施設の詳しい説明に記載しています。</p>
    <table role="table" aria-labelledby="comparison-heading" aria-describedby="comparison-note">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">宿・地域</th>${columns.map(([, label]) => `<th scope="col" role="columnheader">${label}</th>`).join('')}</tr></thead>
      <tbody role="rowgroup">${GUESTHOUSES.map(h => `<tr role="row">
        <th scope="row" role="rowheader"><a href="#${e(h.id)}">${e(h.name)}</a><span class="guesthouse-comparison-area">${e(h.area)}</span></th>
        ${columns.map(([key, label]) => `<td role="cell"><span class="guesthouse-comparison-label" aria-hidden="true">${label}</span>${e(h.comparison[key])}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table>
    <p class="reader-note">宿名から詳しい案内・公式情報へ進めます。予約の確定条件や利用できるプランは宿ごとに異なります。</p>
  </section>`;
}

function renderFacts(h, facts, heading, key, booking = false) {
  if (!facts.length) return '';
  return `<div class="guesthouse-details" aria-labelledby="${e(h.id)}-${key}">
    <h3 id="${e(h.id)}-${key}">${e(heading)}</h3>
    <dl class="reader-facts">${facts.map(([label, text]) => `<div><dt>${e(label)}</dt><dd>${e(text)}</dd></div>`).join('')}</dl>${booking ? `
    <p class="reader-actions"><a href="${e(h.bookingUrl)}" data-guesthouse-booking target="_blank" rel="noopener noreferrer">${e(h.name)}の公式予約案内（新しいタブ）</a></p>${h.bookingLinks?.length ? `<nav class="reader-links" aria-label="${e(h.name)}の予約プラン">${h.bookingLinks.map(link => `<a href="${e(link.url)}" data-guesthouse-booking target="_blank" rel="noopener noreferrer">${e(link.label)}（新しいタブ）</a>`).join('')}</nav>` : ''}` : ''}
  </div>`;
}

function renderDetails(h) {
  const conversation = new Set(['運営・会話']);
  const stay = new Set(['客室・滞在', '備品・持ち物', '光・振動の設備', '所在地']);
  const booking = new Set(['予約', '料金の目安', '追加料金・支払い', '子ども連れ', '時間外の入退室', '到着・出入り', '貸切・連泊', '補助犬の同伴', '予約前の確認']);
  return renderFacts(h, h.facts.filter(([label]) => conversation.has(label)), '運営者と会話', 'conversation')
    + renderFacts(h, h.facts.filter(([label]) => stay.has(label)), '部屋と所在地', 'stay')
    + renderFacts(h, h.facts.filter(([label]) => !conversation.has(label) && !stay.has(label) && !booking.has(label)), 'その他の案内', 'other')
    + renderFacts(h, h.facts.filter(([label]) => booking.has(label)), '予約と料金', 'booking', true);
}

function renderSources(h) {
  const sources = h.sources.filter(s => !h.media?.some(m => m.url === s.url));
  return sources.length ? `<div class="guesthouse-sources"><p class="reader-note">施設・料金などの詳しい案内</p><nav class="reader-links" aria-label="${e(h.name)}の詳しい案内">${sources.map(s => `<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.label)}（新しいタブ）</a>`).join('')}</nav></div>` : '';
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
  const body = `<nav class="reader-links" aria-label="掲載している宿">${GUESTHOUSES.map(h => `<a href="#${e(h.id)}">${e(h.area)}：${e(h.name)}</a>`).join('')}<a href="#before-booking">予約前の確認</a></nav>
    ${renderComparison()}
    <p class="reader-note">料金は確認時点の公式掲載例で、空室や予約金額を保証するものではありません。最新の料金・営業日・取消条件はリンク先で確認できます。予約・問い合わせは各宿へ直接お願いします。</p>
    ${GUESTHOUSES.map(h => `<section class="guesthouse-entry" id="${e(h.id)}" aria-labelledby="${e(h.id)}-heading">
      <header class="guesthouse-heading"><h2 id="${e(h.id)}-heading">${e(h.name)}</h2>
        <p class="guesthouse-area">${e(h.area)}</p>
        ${highlights[h.id] ? `<p class="guesthouse-highlight">${e(highlights[h.id])}</p>` : ''}
      </header>
      <p>${e(h.description)}</p>${renderDetails(h)}
      <p class="reader-note">公式案内の確認：<time datetime="${e(h.reviewedAt)}">${e(h.reviewedAt)}</time></p>
      ${renderSources(h)}${renderMedia(h)}
    </section>`).join('')}
    <section class="guesthouse-closing" id="before-booking"><h2>予約前に確認しておくこと</h2>
      <ul><li><strong>会話と連絡：</strong>手話・筆談など希望する会話方法、到着が遅れるときの連絡手段、夜間にスタッフへ連絡する方法を確認しましょう。手話で対応できる宿でも、時間帯によって対応できる人が不在の場合があります。希望する方法でやりとりできるか、事前に相談しておくと安心です。</li>
      <li><strong>部屋と共用設備：</strong>個室か相部屋か、階段の有無、浴室・トイレの共用範囲。ペットや子どもと泊まる場合は受入条件も確認します。</li>
      <li><strong>支払総額と取消条件：</strong>1人料金か1室料金か、宿泊税・冷暖房費・予約サイトの手数料、人数や日程を変える場合の扱い。最安値の表示だけで比べず、同じ条件で確認します。</li>
      <li><strong>非常時の知らせ方：</strong>光・振動などの設備の有無と使い方、避難口、夜間の対応。記載のない設備は「ない」と断定せず、宿へ確認してください。</li></ul>
      <h3>文字で問い合わせるときの例</h3>
      <div class="guesthouse-inquiry">
        <p id="inquiry-help" class="reader-note">希望の部屋・会話方法・子どもの人数を文面に反映できます。コピー後に日付・泊数・大人の人数・子どもの年齢を記入し、宿へ送ってください。ここで選んだ内容や人数は送信・保存されません。</p>
        <div class="guesthouse-inquiry-controls" data-inquiry-controls hidden>
          <label for="inquiry-room">希望する部屋<select id="inquiry-room" name="room" autocomplete="off"><option value="">選んでください</option><option value="個室">個室</option><option value="相部屋">相部屋</option><option value="指定なし">指定なし</option></select></label>
          <label for="inquiry-communication">希望する会話方法<select id="inquiry-communication" name="communication" autocomplete="off"><option value="">選んでください</option><option value="手話">手話</option><option value="筆談">筆談</option><option value="口話">口話</option><option value="音声認識アプリ">音声認識アプリ</option><option value="どれでも可">どれでも可</option></select></label>
          <label for="inquiry-children">子どもの人数（任意）<input id="inquiry-children" name="children" autocomplete="off" type="number" min="0" max="99" step="1" inputmode="numeric" placeholder="例：2" aria-describedby="inquiry-children-help"></label>
        </div>
        <p id="inquiry-children-help" class="reader-note">子どもがいない場合は0、未入力なら文面に「○名」を残します。子どもの年齢区分・料金・定員は宿や予約方法によって異なります。</p>
        <label class="guesthouse-inquiry-label" for="inquiry-text">問い合わせ文</label>
        <textarea id="inquiry-text" name="inquiry" rows="7" readonly aria-describedby="inquiry-help">${e(INQUIRY_TEMPLATE)}</textarea>
        <button type="button" data-copy-inquiry hidden>問い合わせ文をコピー</button>
        <p class="reader-note" data-inquiry-status role="status" aria-live="polite" aria-atomic="true"></p>
        <noscript><p class="reader-note">上の文章を選択してコピーし、［ ］内から希望する内容を選んで書き換えてください。</p></noscript>
      </div>
    </section>
    <section class="guesthouse-closing"><h2>旅先で立ち寄る場所も探す</h2><nav class="reader-links" aria-label="関連する情報"><a href="/connect/sign-cafe/">手話カフェを探す</a><a href="/events.html">国内のイベントを見る</a><a href="/stories/relay-yometel-net119/">文字や手話で電話を利用する方法</a><a href="/guide.html">暮らしのガイドへ</a></nav></section>
    <p class="reader-note">全国のすべての宿を掲載しているわけではありません。掲載内容の変更・追加情報は<a href="/about.html#about-correction">Deaf Naviのお問い合わせ</a>へお知らせください。</p>`;
  return {
    file: 'guide/guesthouses/index.html',
    html: renderReaderPage({ ...guide, body, scripts: '<script src="/guesthouses.js?v=20261026details" defer></script>', schemas: [{
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
