import { SITE_URL } from '../../config/site.mjs';
import { EVENT_KINDS, EVENT_RECHECK_MS } from '../../config/events.mjs';
import { eventPeriod, validEvent } from '../lib/events.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderHead, renderSiteHeader, renderSkipLink, renderFooter } from './partials.mjs';

export function renderEventsPage(snapshot, { files, isDev=false } = {}) {
  const events=(snapshot.events||[]).filter(validEvent);
  const labels={upcoming:'開催予定',past:'過去の告知',review:'再確認中',cancelled:'中止の告知'};
  const count=events.filter(event=>eventPeriod(event)==='upcoming').length;
  const prefectures=[...new Set(events.map(event=>event.prefecture))].sort((a,b)=>a.localeCompare(b,'ja'));
  const rows=events.map(event=>{
    const period=eventPeriod(event), date=event.startDate.replaceAll('-','.'), end=event.endDate&&event.endDate!==event.startDate?`〜${event.endDate.replaceAll('-','.')}`:'';
    const search=[event.title,event.prefecture,event.venue,event.organizer,event.description,EVENT_KINDS[event.kind]].join(' ');
    return `<article class="event-row" id="${e(event.id)}" data-event data-start="${e(event.startDate)}" data-end="${e(event.endDate||event.startDate)}" data-verified="${e(event.verifiedAt)}" data-verification="${e(event.verification)}" data-status="${e(event.status)}" data-prefecture="${e(event.prefecture)}" data-kind="${e(event.kind)}" data-search="${e(search)}"${period==='upcoming'?'':' hidden'}>
      <div class="event-when"><time datetime="${e(event.startDate)}">${e(date+end)}</time><span data-event-state>${e(event.status==='cancelled'?'中止の告知':event.status==='closed'&&period==='upcoming'?'受付終了の告知':labels[period])}</span></div>
      <div class="event-content"><p class="event-meta">${e(event.prefecture)} · ${e(EVENT_KINDS[event.kind])}</p><h2><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.title)}</a></h2>
      <p class="event-venue">${e(event.venue)}${event.time?` · ${e(event.time)}`:' · 時間は告知をご確認ください'}</p>
      ${event.description?`<p>${e(event.description)}</p>`:''}
      <details><summary>参加条件・情報源</summary><dl>${[['主催',event.organizer],['参加費',event.fee],['対象・申込',event.target]].map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value||'告知をご確認ください')}</dd></div>`).join('')}</dl>
      <p><a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.sourceName)}の告知</a> · 内容照合 <time datetime="${e(event.verifiedAt)}">${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST</time></p></details></div></article>`;
  }).join('\n');
  return `<!doctype html><html lang="ja"><head>${renderHead({title:'国内の手話イベント | Deaf Navi',description:'国内の手話・ろう者コミュニティのイベントを開催日と地域から探せます。主催者・出演団体・会場の告知を確認して掲載します。',canonical:SITE_URL+'events.html',ogUrl:SITE_URL+'events.html',stylesFile:files?.styles||'styles.css',robots:isDev?'noindex,nofollow':'index,follow'})}<link rel="stylesheet" href="./events.css?v=20261016"><noscript><style>[data-event][hidden]{display:grid!important}</style></noscript></head><body>${renderSkipLink()}
  ${renderSiteHeader({current:'events',subLabel:'手話イベント',lead:'交流会、講座、公演。国内の催しを、開催日と地域から。'})}
  <main class="container event-page" id="main" data-recheck-ms="${EVENT_RECHECK_MS}">
    <form id="event-filters" class="event-filters" hidden role="search" aria-label="イベントを探す">
      <label class="event-search">キーワード<input type="search" id="event-query" name="q" placeholder="例：手話 交流会" autocomplete="off"></label>
      <button type="reset" class="filter">条件を解除</button>
      <details class="event-more-filters"><summary>地域・種類・開催月で絞り込む</summary><div class="event-filter-options">
      <label>地域<select id="event-prefecture" name="prefecture"><option value="">すべての地域</option>${prefectures.map(p=>`<option>${e(p)}</option>`).join('')}</select></label>
      <label>種類<select id="event-kind" name="kind"><option value="">すべての種類</option>${Object.entries(EVENT_KINDS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
      <label>開催月<input type="month" id="event-month" name="month"></label>
      </div></details>
    </form>
    <div class="event-periods" role="group" aria-label="開催時期" hidden>${Object.entries(labels).map(([id,name])=>`<button type="button" class="filter" data-period="${id}" aria-pressed="${id==='upcoming'}">${name}</button>`).join('')}</div>
    <div class="event-results"><p id="event-count" role="status" aria-live="polite">開催予定 ${count}件</p><a href="./connect/sign-cafe/events/">手話カフェの開催情報も見る</a></div>
    <p class="event-guidance">日時や参加条件は変更される場合があります。参加・申込の前に告知をご確認ください。掲載のない地域も順次調査しています。</p>
    <noscript><p>以下は掲載時点で確認した全件です。開催日と告知をご確認ください。</p></noscript>
    <section class="event-list" aria-label="イベント一覧">${rows}</section>
    <p id="event-empty" class="empty"${count?' hidden':''}>この条件の掲載情報はまだありません。条件を変えるか、手話カフェの開催情報もご覧ください。</p>
    <details class="event-policy"><summary>掲載・更新について</summary><p>ニュースと同じ1日3回、6:10・12:10・18:10ごろに公開情報を照合します。処理状況により遅れる場合があります。主催者、出演団体、会場の告知に明記された開催日と場所を掲載し、投稿日時を開催日として扱いません。</p><p>SNSの告知は公開本文・画像の内容を確認できたものを掲載します。取得できない告知、内容が変わった情報、48時間以上照合できない情報は「再確認中」とし、開催予定から外します。過去の告知は実施済みを意味しません。</p><p>時刻・料金・主催者などが読み取れない場合は推測で補いません。告知画像の転載やSNSの自動埋め込みは行わず、情報源へ案内します。</p><p><a href="mailto:info@flamenut.com?subject=Deaf%20Navi%20イベント情報">イベントの情報提供・訂正</a> ／ <a href="./about.html#about-policy">サイトの選定方針</a></p></details>
  </main>${renderFooter({year:new Date().getFullYear(),links:[{href:'./',label:'ニュース'},{href:'./connect/sign-cafe/',label:'手話カフェ'},{href:'./about.html',label:'サイトについて'}]})}
  <script src="./ui-controls.js" defer></script><script src="./events.js?v=20261016" defer></script></body></html>`;
}
