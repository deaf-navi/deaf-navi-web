import { SITE_URL } from '../../config/site.mjs';
import { EVENT_KINDS, EVENT_RECHECK_MS } from '../../config/events.mjs';
import { eventPeriod, validEvent, eventDateLabel } from '../lib/events.mjs';
import { PREFECTURES } from '../../config/regions.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderHead, renderSiteHeader, renderSkipLink, renderFooter } from './partials.mjs';
import { renderThumbnail } from './thumbnail.mjs';

export function renderEventsPage(snapshot, { files, isDev=false, clientAssetVersion='20261016polish' } = {}) {
  const events=(snapshot.events||[]).filter(validEvent);
  const labels={upcoming:'開催予定',past:'過去の告知',review:'再確認中',cancelled:'中止の告知'};
  const count=events.filter(event=>eventPeriod(event)==='upcoming').length;
  const prefectures=[...PREFECTURES.map(p=>p.name), 'オンライン'];
  const rows=events.map(event=>{
    const period=eventPeriod(event), date=eventDateLabel(event.startDate), end=event.endDate&&event.endDate!==event.startDate?`〜<time datetime="${e(event.endDate)}">${e(eventDateLabel(event.endDate))}</time>`:'';
    const search=[event.title,event.prefecture,event.venue,event.organizer,event.description,EVENT_KINDS[event.kind]].join(' ');
    return `<article class="event-row" id="${e(event.id)}" data-event data-start="${e(event.startDate)}" data-end="${e(event.endDate||event.startDate)}" data-verified="${e(event.verifiedAt)}" data-verification="${e(event.verification)}" data-status="${e(event.status)}" data-prefecture="${e(event.prefecture)}" data-kind="${e(event.kind)}" data-search="${e(search)}"${period==='upcoming'?'':' hidden'}>
      <div class="event-when"><div class="event-dates"><time datetime="${e(event.startDate)}">${e(date)}</time>${end}</div><span data-event-state>${e(event.status==='cancelled'?'中止の告知':event.status==='closed'&&period==='upcoming'?'受付終了の告知':labels[period])}</span></div>
      <div class="event-content">${renderThumbnail(event)}<p class="event-meta">${e(event.prefecture)} · ${e(EVENT_KINDS[event.kind])}</p><h2><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.title)}</a></h2>
      <p class="event-venue">${e(event.venue)}${event.time?` · ${e(event.time)}`:' · 時間は告知をご確認ください'}</p>
      ${event.description?`<p>${e(event.description)}</p>`:''}
      ${event.fee||event.target?`<dl class="event-participation">${[['参加費',event.fee],['対象・申込',event.target]].filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`:''}
      <p class="event-action"><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${e(event.title)}の公式案内・申込方法を見る（新しいタブ）">公式案内・申込方法を見る<span aria-hidden="true"> ↗</span></a></p>
      <details><summary>主催・情報源</summary><dl><div><dt>主催</dt><dd>${e(event.organizer||'告知をご確認ください')}</dd></div></dl>
      <p><a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.sourceName)}の告知</a> · 内容照合 <time datetime="${e(event.verifiedAt)}">${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST</time></p></details></div></article>`;
  }).join('\n');
  return `<!doctype html><html lang="ja"><head>${renderHead({title:'国内の手話イベント | Deaf Navi',description:'国内の手話・ろう者コミュニティのイベントを開催日と地域から探せます。主催者・出演団体・会場の告知を確認して掲載します。',canonical:SITE_URL+'events.html',ogUrl:SITE_URL+'events.html',stylesFile:files?.styles||'styles.css',robots:isDev?'noindex,nofollow':'index,follow'})}<link rel="stylesheet" href="./events.css?v=20261016discover"><link rel="stylesheet" href="./browse.css?v=${e(clientAssetVersion)}"><noscript><style>[data-event][hidden]{display:grid!important}</style></noscript></head><body class="browse-page events-page">${renderSkipLink()}
  ${renderSiteHeader({current:'events',subLabel:'手話イベント',lead:'交流会、講座、公演。国内の催しを開催日と地域から探せます。'})}
  <main class="container event-page" id="main" data-recheck-ms="${EVENT_RECHECK_MS}">
    <form id="event-filters" class="event-filters" hidden role="search" aria-label="イベントを探す">
      <label class="event-search">キーワード<input type="search" id="event-query" name="q" placeholder="例：手話 交流会" autocomplete="off"></label>
      <button type="reset" class="filter">条件を解除</button>
      <details class="event-more-filters"><summary>地域・種類・開催月で絞り込む</summary><div class="event-filter-options">
      <label>地域<select id="event-prefecture" name="prefecture"><option value="">すべての地域</option>${prefectures.map(p=>`<option>${e(p)}</option>`).join('')}</select></label>
      <label>種類<select id="event-kind" name="kind"><option value="">すべての種類</option>${Object.entries(EVENT_KINDS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
      <label>開催月<input type="month" id="event-month" name="month"></label>
      </div><label class="event-remember"><input type="checkbox" id="event-remember-region">この端末に地域を記憶する</label></details>
    </form>
    <div class="event-browse" hidden><div class="event-quick" role="group" aria-label="近日のイベント">${[['','開催予定'],['weekend','今週末'],['month','今月']].map(([id,name])=>`<button type="button" class="filter" data-range="${id}" aria-pressed="${id===''}">${name}</button>`).join('')}</div>
    <details class="event-history"><summary>過去・確認中など</summary><div class="event-periods" role="group" aria-label="開催時期" hidden>${Object.entries(labels).map(([id,name])=>`<button type="button" class="filter" data-period="${id}" aria-pressed="${id==='upcoming'}">${name}</button>`).join('')}</div></details></div>
    <div class="event-results"><p id="event-count" role="status" aria-live="polite">開催予定 ${count}件</p><a href="./connect/sign-cafe/events/">手話カフェの開催情報も見る</a></div>
    <p class="event-guidance">日時や参加条件は変更される場合があります。参加・申込の前に告知をご確認ください。掲載のない地域も順次調査しています。</p>
    <noscript><p>以下は掲載時点で確認した全件です。開催日と告知をご確認ください。</p></noscript>
    <section class="event-list" aria-label="イベント一覧">${rows}</section>
    <div id="event-empty" class="empty"${count?' hidden':''}><p>この条件の掲載情報はまだありません。イベントが開催されていないという意味ではありません。</p><button type="reset" form="event-filters" class="filter" hidden data-event-empty-reset>条件を解除して探す</button></div>
    <details class="event-policy"><summary>掲載・更新について</summary><p>ニュースと同じ1日3回、6:10・12:10・18:10ごろに公開情報を照合します。処理状況により遅れる場合があります。主催者、出演団体、会場の告知に明記された開催日と場所を掲載し、投稿日時を開催日として扱いません。</p><p>SNSの告知は公開本文・画像の内容を確認できたものを掲載します。取得できない告知、内容が変わった情報、48時間以上照合できない情報は「再確認中」とし、開催予定から外します。過去の告知は実施済みを意味しません。</p><p>時刻・料金・主催者などが読み取れない場合は推測で補いません。告知ページが公開しているプレビュー画像を表示する場合があります。画像を取得できない場合も本文と情報源を掲載します。SNSの自動埋め込みは行いません。</p><p><a href="mailto:info@flamenut.com?subject=Deaf%20Navi%20イベント情報">イベントの情報提供・訂正</a> ／ <a href="./about.html#about-policy">サイトの選定方針</a></p></details>
  </main>${renderFooter({year:new Date().getFullYear(),links:[{href:'./',label:'ニュース'},{href:'./connect/sign-cafe/',label:'手話カフェ'},{href:'./about.html',label:'サイトについて'}]})}
  <script src="./ui-controls.js" defer></script><script type="module" src="./events.js?v=20261016discover"></script></body></html>`;
}
