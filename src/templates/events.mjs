import { SITE_URL } from '../../config/site.mjs';
import { EVENT_KINDS, EVENT_RECHECK_MS, EVENT_COMMUNICATION } from '../../config/events.mjs';
import { eventPeriod, validEvent, eventDateLabel, eventSearchText } from '../lib/events.mjs';
import { eventDetailPath } from './event-detail.mjs';
import { PREFECTURES } from '../../config/regions.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { renderHead, renderSiteHeader, renderSkipLink, renderFooter } from './partials.mjs';
import { renderNewsThumbnail } from './thumbnail.mjs';

export function renderEventsPage(snapshot, { files, isDev=false, clientAssetVersion='20261016polish' } = {}) {
  const events=(snapshot.events||[]).filter(validEvent);
  const labels={upcoming:'開催予定',past:'過去の告知',review:'最新状況は公式案内へ',cancelled:'中止の告知'};
  const count=events.filter(event=>eventPeriod(event)==='upcoming').length;
  const prefectures=[...PREFECTURES.map(p=>p.name), 'オンライン'];
  const rows=events.map(event=>{
    const period=eventPeriod(event), date=eventDateLabel(event.startDate), end=event.endDate&&event.endDate!==event.startDate?`〜<time datetime="${e(event.endDate)}">${e(eventDateLabel(event.endDate))}</time>`:'';
    const search=eventSearchText(event);
    const communication=event.communication||[];
    return `<article class="event-row" id="${e(event.id)}" data-event data-start="${e(event.startDate)}" data-end="${e(event.endDate||event.startDate)}" data-verified="${e(event.verifiedAt)}" data-verification="${e(event.verification)}" data-status="${e(event.status)}" data-prefecture="${e(event.prefecture)}" data-kind="${e(event.kind)}" data-search="${e(search)}"${period==='upcoming'?'':' hidden'}>
      <div class="event-when"><div class="event-dates"><time datetime="${e(event.startDate)}">${e(date)}</time>${end}</div><span data-event-state>${e(event.status==='cancelled'?'中止の告知':event.status==='closed'&&period==='upcoming'?'受付終了の告知':labels[period])}</span></div>
      <div class="event-content"><div class="event-intro">${renderNewsThumbnail(event, EVENT_KINDS[event.kind].split('・')[0])}<div class="event-heading"><p class="event-meta">${e(event.prefecture)} · ${e(EVENT_KINDS[event.kind])}</p><h2><a href="${e(eventDetailPath(event))}">${e(event.title)}</a></h2></div></div>
      <p class="event-venue">${e(event.venue)}${event.time?` · ${e(event.time)}`:' · 時間は告知をご確認ください'}</p>${event.sourceStatus==='retrying'?`
      <p class="event-filter-help" data-source-retry>掲載内容は${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST時点のものです。参加・申込の前に主催者の最新案内をご確認ください。</p>`:''}
      ${event.description?`<p>${e(event.description)}</p>`:''}
      <div class="event-communication" data-communication="${communication.map(item=>item.method).join(' ')}"><p class="event-communication-label">情報の受け取り方</p>${communication.length?`<ul>${communication.map(item=>`<li><strong>${e(EVENT_COMMUNICATION[item.method])}</strong>：${e(item.detail)}</li>`).join('')}</ul>`:'<p class="event-communication-unknown">通訳・字幕・筆談など、利用できる方法は主催者へお問い合わせください。</p>'}</div>
      ${event.fee||event.target?`<dl class="event-participation">${[['参加費',event.fee],['対象・申込',event.target]].filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`:''}
      <p class="event-action"><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${e(event.title)}の公式案内・申込方法を見る（新しいタブ）">公式案内・申込方法を見る<span aria-hidden="true"> ↗</span></a></p>
      <details><summary>主催・情報源</summary><dl><div><dt>主催</dt><dd>${e(event.organizer||'告知をご確認ください')}</dd></div></dl>
      <p><a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.sourceName)}の告知</a> · 情報確認 <time datetime="${e(event.verifiedAt)}">${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST</time></p></details></div></article>`;
  }).join('\n');
  return `<!doctype html><html lang="ja"><head>${renderHead({title:'国内の手話イベント | Deaf Navi',description:'国内の手話・ろう者コミュニティのイベントを開催日と地域から探せます。主催者・出演団体・会場の告知を確認して掲載します。',canonical:SITE_URL+'events.html',ogUrl:SITE_URL+'events.html',stylesFile:files?.styles||'styles.css',robots:isDev?'noindex,nofollow':'index,follow'})}<link rel="stylesheet" href="./events.css?v=20261017edition"><link rel="stylesheet" href="./browse.css?v=${e(clientAssetVersion)}"><noscript><style>[data-event][hidden]{display:grid!important}</style></noscript></head><body class="browse-page events-page">${renderSkipLink()}
  ${renderSiteHeader({current:'events',subLabel:'手話イベント',lead:'交流会、講座、公演、手話カフェ。国内の催しを開催日と地域から探せます。'})}
  <main class="container event-page" id="main" data-recheck-ms="${EVENT_RECHECK_MS}">
    <form id="event-filters" class="event-filters" hidden role="search" aria-label="イベントを探す">
      <label class="event-search">イベントを検索<input type="search" id="event-query" name="q" placeholder="例：手話劇、交流会" autocomplete="off"></label>
      <button type="reset" class="filter">条件を解除</button>
      <label class="event-region-filter">地域<select id="event-prefecture" name="prefecture"><option value="">すべての地域</option>${prefectures.map(p=>`<option>${e(p)}</option>`).join('')}</select></label>
      <details class="event-more-filters"><summary id="event-filter-summary">種類・開催月・情報の受け取り方で絞り込む</summary><div class="event-filter-options">

      <label>種類<select id="event-kind" name="kind"><option value="">すべての種類</option>${Object.entries({...EVENT_KINDS,cafe:'手話カフェ'}).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
      <label>開催月<input type="month" id="event-month" name="month"></label>
      <label class="event-communication-filter">情報の受け取り方<select id="event-communication" name="communication" aria-describedby="event-communication-help"><option value="">指定しない</option>${Object.entries(EVENT_COMMUNICATION).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
      <p id="event-communication-help" class="event-filter-help">告知で確認できた方法から探せます。「手話の催し」でも、通訳・字幕が付くとは限りません。未確認は「対応なし」を意味しません。</p>
      </div><label class="event-remember"><input type="checkbox" id="event-remember-region">この端末に地域を記憶する</label></details>
    </form>
    <div class="event-browse" hidden><div class="event-quick" role="group" aria-label="近日のイベント">${[['','開催予定'],['weekend','今週末'],['month','今月']].map(([id,name])=>`<button type="button" class="filter" data-range="${id}" aria-pressed="${id===''}">${name}</button>`).join('')}</div>
    <details class="event-history"><summary>過去の告知・その他</summary><div class="event-periods" role="group" aria-label="開催時期" hidden>${Object.entries(labels).map(([id,name])=>`<button type="button" class="filter" data-period="${id}" aria-pressed="${id==='upcoming'}">${name}</button>`).join('')}</div></details></div>
    <div class="event-results"><p id="event-count" role="status" aria-live="polite">開催予定 ${count}件</p><a href="./connect/sign-cafe/events/">手話カフェイベント一覧</a></div>
    <p id="event-cafe-status" class="event-filter-help" role="status" hidden>手話カフェの開催情報を読み込み中…</p>
    <p class="event-guidance">日時や参加条件は変更される場合があります。参加・申込の前に告知をご確認ください。</p>
    <noscript><p>以下は掲載時点のイベント情報です。手話カフェの開催情報は<a href="./connect/sign-cafe/events/">手話カフェイベント一覧</a>をご覧ください。</p></noscript>
    <section class="event-list" aria-label="イベント一覧">${rows}</section>
    <div id="event-empty" class="empty"${count?' hidden':''}><p>この条件の掲載情報はまだありません。イベントが開催されていないという意味ではありません。</p><button type="reset" form="event-filters" class="filter" hidden data-event-empty-reset>条件を解除して探す</button></div>
    <details class="event-policy"><summary>掲載・更新について</summary><p>主催者・出演団体・会場の告知をもとに、開催日や参加条件を紹介しています。最新の受付状況や変更は、各イベントの公式案内をご確認ください。</p><p>古い掲載情報は、開催予定と分けて残しています。掲載情報が古いことや公式ページを開けないことだけでは、中止とは判断できません。過去の告知も、実際に開催されたことや次回の予定を示すものではありません。</p><p>時刻・料金・情報保障など記載のない条件は、主催者へお問い合わせください。告知画像とあわせて、本文と公式案内へのリンクをご利用ください。</p><p><a href="mailto:info@flamenut.com?subject=Deaf%20Navi%20イベント情報">イベントの情報提供・訂正</a> ／ <a href="./about.html#about-policy">サイトの選定方針</a></p></details>
  </main>${renderFooter({year:new Date().getFullYear(),links:[{href:'./',label:'ニュース'},{href:'./connect/sign-cafe/',label:'手話カフェ'},{href:'./about.html',label:'サイトについて'}]})}
  <script src="./ui-controls.js" defer></script><script type="module" src="./events.js?v=20261029cafes"></script></body></html>`;
}
