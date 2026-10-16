import { SITE_URL } from '../../config/site.mjs';
import { EVENT_COMMUNICATION, EVENT_RECHECK_MS } from '../../config/events.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { eventPeriod, eventDateLabel, validEvent } from '../lib/events.mjs';
import { renderReaderPage } from './reader.mjs';
export const eventDetailPath=event=>`/events/${event.id}/`;
export function eventDetailState(event,now=Date.now()) {
 const period=eventPeriod(event,now);
 if(event.status==='cancelled')return {period,label:'中止の告知',note:'主催者による中止の告知があります。最新の案内をご確認ください。'};
 if(period==='past')return {period,label:'過去の開催告知',note:'日程を過ぎた告知の記録です。開催の実施や次回の日程を示すものではありません。'};
 if(period==='review')return {period,label:'再確認中',note:'情報の再確認が必要なため、開催予定としての案内を停止しています。以下は前回確認時の情報です。最新の告知をご確認ください。'};
 return {period,label:event.status==='closed'?'受付終了の告知':'開催予定',note:event.status==='closed'?'申込受付が終了した旨の告知があります。追加募集などは公式案内をご確認ください。':'日時・参加条件は変更される場合があります。申込・お出かけ前に公式案内をご確認ください。'};
}
export function eventSchema(event,now=Date.now()) {
 if(!validEvent(event)||eventPeriod(event,now)!=='upcoming'||event.prefecture==='オンライン')return null;
 return {'@context':'https://schema.org','@type':'Event',name:event.title,url:new URL(eventDetailPath(event),SITE_URL).href,startDate:event.startDate,endDate:event.endDate||event.startDate,eventStatus:'https://schema.org/EventScheduled',location:{'@type':'Place',name:event.venue,address:{'@type':'PostalAddress',addressRegion:event.prefecture,addressCountry:'JP'}},...(event.description?{description:event.description}:{}),...(event.organizer?{organizer:{'@type':'Organization',name:event.organizer}}:{})};
}
export function renderEventDetail(event,{now=Date.now()}={}) {
 if(!validEvent(event))throw new Error('Invalid event detail');
 const state=eventDetailState(event,now),schema=eventSchema(event,now),path=eventDetailPath(event);
 const date=eventDateLabel(event.startDate)+(event.endDate&&event.endDate!==event.startDate?' 〜 '+eventDateLabel(event.endDate):'');
 const facts=[['開催日',date],['時間',event.time||'告知で未確認。公式案内をご確認ください。'],['会場',event.prefecture+' / '+event.venue],['参加費',event.fee||'告知で未確認'],['対象・申込',event.target||'対象・申込方法は公式案内をご確認ください。'],['主催',event.organizer||'告知で未確認']];
 const body=`<article data-event-detail data-end="${e(event.endDate||event.startDate)}" data-status="${e(event.status)}" data-verification="${e(event.verification)}" data-verified="${e(event.verifiedAt)}" data-recheck-ms="${EVENT_RECHECK_MS}"><p class="reader-status" data-detail-status role="status">${e(state.label)}</p><p data-detail-notice>${e(state.note)}</p>${event.sourceStatus==='retrying'?`<p class="reader-note" data-source-retry>情報源を再取得中です。以下は最後に確認できた内容です。確認日時はページ末尾に記載しています。</p>`:''}<dl class="reader-facts">${facts.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl><div class="reader-actions"><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer">公式案内・申込方法を見る（新しいタブ）</a><a href="/events.html?prefecture=${encodeURIComponent(event.prefecture)}">同じ地域のイベントを探す</a></div><h2>情報の受け取り方</h2>${event.communication?.length?`<ul>${event.communication.map(c=>`<li><strong>${e(EVENT_COMMUNICATION[c.method])}</strong>：${e(c.detail)}</li>`).join('')}</ul>`:'<p>通訳・字幕・要約筆記・筆談などの対応は告知で確認できていません。未確認は「対応なし」を意味しません。</p>'}<p>必要な方法がある場合は主催者へご相談ください。手話の催しでも、すべての人に同じ方法が合うとは限りません。</p><p><a href="/guide/accessibility/">通訳・字幕・筆談の確認ポイント</a></p>${event.thumbnail?.url?`<img class="reader-poster" src="${e(event.thumbnail.url)}" alt="${e(event.title)}の公式告知画像" width="240" height="320" loading="lazy" referrerpolicy="no-referrer">`:''}<h2>情報源と確認日</h2><p><a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.sourceName)}の告知（新しいタブ）</a></p><p class="reader-note">内容を最後に照合した日時：<time datetime="${e(event.verifiedAt)}">${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST</time>。主催者の告知を確認し、Deaf Naviで必要な情報を整理しています。</p><p><a href="/events.html">国内の手話イベント一覧へ戻る</a></p></article>`;
 return renderReaderPage({path,title:event.title,description:[event.prefecture,date,event.description].filter(Boolean).join('。'),current:'events',section:'手話イベント',sectionPath:'/events.html',body,schemas:schema?[schema]:[],robots:state.period==='review'?'noindex,follow':'index,follow,max-image-preview:large',scripts:'<script src="/event-detail.js?v=20261017recovery" defer></script>'});
}
export function renderRetiredEvent(path) {
 return renderReaderPage({path,title:'このイベントの掲載情報について',description:'現在の掲載対象から外れている情報です。開催の終了や中止を意味するものではありません。',current:'events',section:'手話イベント',sectionPath:'/events.html',body:'<p>開催予定はイベント一覧からお探しください。</p><p><a href="/events.html">国内の手話イベント一覧へ</a></p>',robots:'noindex,follow'});
}
