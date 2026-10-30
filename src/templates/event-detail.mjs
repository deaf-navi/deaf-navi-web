import {eventDeadline,deadlineLabel} from '../event-deadline.js';
import { SITE_URL } from '../../config/site.mjs';
import { EVENT_COMMUNICATION, EVENT_RECHECK_MS } from '../../config/events.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
import { publicUrl } from '../lib/thumbnail-metadata.mjs';
import { eventPeriod, eventDateLabel, validEvent } from '../lib/events.mjs';
import { renderReaderPage } from './reader.mjs';
export const eventDetailPath=event=>`/events/${event.id}/`;
export function eventDetailState(event,now=Date.now()) {
 const period=eventPeriod(event,now);
 if(event.status==='cancelled')return {period,label:'中止の告知',note:'主催者による中止の告知があります。最新の案内をご確認ください。'};
 if(period==='past')return {period,label:'過去の開催告知',note:'日程を過ぎた告知の記録です。開催の実施や次回の日程を示すものではありません。'};
 if(period==='review')return {period,label:'最新状況は公式案内へ',note:'以下は以前の告知をもとにした情報です。現在の開催・受付状況は、主催者の公式案内でご確認ください。'};
 return {period,label:event.status==='closed'?'受付終了の告知':'開催予定',note:event.status==='closed'?'申込受付が終了した旨の告知があります。追加募集などは公式案内をご確認ください。':'日時・参加条件は変更される場合があります。申込・お出かけ前に公式案内をご確認ください。'};
}
export function eventSchema(event,now=Date.now()) {
 if(!validEvent(event)||eventPeriod(event,now)!=='upcoming'||event.prefecture==='オンライン')return null;
 const image=event.thumbnailPolicy==='omit'?null:publicUrl(event.thumbnail?.url);
 const organizer=event.organizers
  ?event.organizers.map(item=>({'@type':item.type||'Organization',name:item.name,...(item.url?{url:publicUrl(item.url)}:{})}))
  :event.organizer?{'@type':'Organization',name:event.organizer}:null;
 const offers=event.offers?.map(item=>({'@type':'Offer',price:item.price,priceCurrency:item.priceCurrency,url:publicUrl(item.url),...(item.name?{name:item.name}:{}),...(item.validFrom?{validFrom:item.validFrom}:{})}));
 return {'@context':'https://schema.org','@type':'Event',name:event.title,url:new URL(eventDetailPath(event),SITE_URL).href,startDate:event.startDate,endDate:event.endDate||event.startDate,eventStatus:'https://schema.org/EventScheduled',location:{'@type':'Place',name:event.venue,address:{'@type':'PostalAddress',addressRegion:event.prefecture,addressCountry:'JP'}},...(image?.startsWith('https:')?{image}:{}),...(event.description?{description:event.description}:{}),...(organizer?{organizer}:{}),...(offers?{offers}:{})};
}
export function renderEventDetail(event,{now=Date.now()}={}) {
 if(!validEvent(event))throw new Error('Invalid event detail');
 const state=eventDetailState(event,now),schema=eventSchema(event,now),path=eventDetailPath(event);
 const date=eventDateLabel(event.startDate)+(event.endDate&&event.endDate!==event.startDate?' 〜 '+eventDateLabel(event.endDate):'');
 const deadline=eventDeadline(event,now);
 const deadlineNote=deadline?`<p class="reader-note" data-event-deadline="${e(deadline.date)}" data-deadline-scope="${e(deadline.scope)}">${e(deadlineLabel(deadline))}</p>`:'';
 const organizerHtml=event.organizers?.map(item=>item.url?`<a href="${e(publicUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.name)}</a>`:e(item.name)).join('・');
 const offerLinks=(event.offers||[]).filter(item=>publicUrl(item.url)!==publicUrl(event.detailUrl||event.sourceUrl))
  .map(item=>`<a href="${e(publicUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.name||'参加')}の申込案内（${e(item.price)} ${e(item.priceCurrency)}・新しいタブ）</a>`).join('');
 const facts=[['開催日',date],['時間',event.time||'主催者の案内をご確認ください。'],['会場',event.prefecture+' / '+event.venue],['参加費',event.fee||'主催者へご確認ください'],['対象・申込',event.target||'対象・申込方法は公式案内をご確認ください。'],['主催',event.organizer||'公式案内をご確認ください']];
 const body=`<article data-event-detail data-end="${e(event.endDate||event.startDate)}" data-status="${e(event.status)}" data-verification="${e(event.verification)}" data-verified="${e(event.verifiedAt)}" data-recheck-ms="${EVENT_RECHECK_MS}"><p class="reader-status" data-detail-status role="status">${e(state.label)}</p><p data-detail-notice>${e(state.note)}</p>${event.sourceStatus==='retrying'?`<p class="reader-note" data-source-retry>掲載内容は下記の情報確認日時点のものです。申込前に主催者の最新案内をご確認ください。</p>`:''}${deadlineNote}<dl class="reader-facts">${facts.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${k==='主催'&&organizerHtml?organizerHtml:e(v)}</dd></div>`).join('')}</dl><div class="reader-actions"><a href="${e(event.detailUrl||event.sourceUrl)}" target="_blank" rel="noopener noreferrer">公式案内・申込方法を見る（新しいタブ）</a>${offerLinks}<a href="/events.html?prefecture=${encodeURIComponent(event.prefecture)}">同じ地域のイベントを探す</a></div><h2>情報の受け取り方</h2>${event.communication?.length?`<ul>${event.communication.map(c=>`<li><strong>${e(EVENT_COMMUNICATION[c.method])}</strong>：${e(c.detail)}</li>`).join('')}</ul>`:'<p>通訳・字幕・要約筆記・筆談など、利用できる方法は主催者へお問い合わせください。</p>'}<p>必要な方法がある場合は主催者へご相談ください。手話の催しでも、すべての人に同じ方法が合うとは限りません。</p><p><a href="/guide/accessibility/">通訳・字幕・筆談の確認ポイント</a></p>${event.thumbnail?.url?`<img class="reader-poster" src="${e(event.thumbnail.url)}" alt="${e(event.title)}の公式告知画像" width="240" height="320" loading="lazy" referrerpolicy="no-referrer">`:''}<h2>情報源と確認日</h2><p><a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(event.sourceName)}の告知（新しいタブ）</a></p><p class="reader-note">情報確認：<time datetime="${e(event.verifiedAt)}">${e(new Date(Date.parse(event.verifiedAt)+9*3600000).toISOString().slice(0,16).replace('T',' '))} JST</time>。</p><p><a href="/events.html">国内の手話イベント一覧へ戻る</a></p></article>`;
 return renderReaderPage({path,title:event.title,searchTitle:`${event.title}｜${event.startDate}・${event.prefecture}`,description:[event.prefecture,date,event.description].filter(Boolean).join('。'),current:'events',section:'手話イベント',sectionPath:'/events.html',body,schemas:schema?[schema]:[],robots:state.period==='review'?'noindex,follow':'index,follow,max-image-preview:large',scripts:'<script type="module" src="/event-detail.js?v=20261029deadline"></script>'});
}
export function renderRetiredEvent(path) {
 return renderReaderPage({path,title:'このイベントの掲載情報について',description:'現在の掲載対象から外れている情報です。開催の終了や中止を意味するものではありません。',current:'events',section:'手話イベント',sectionPath:'/events.html',body:'<p>開催予定はイベント一覧からお探しください。</p><p><a href="/events.html">国内の手話イベント一覧へ</a></p>',robots:'noindex,follow'});
}
