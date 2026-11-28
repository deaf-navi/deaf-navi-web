import test from 'node:test';import assert from 'node:assert/strict';
import {eventDeadline,eventDeadlines,deadlineLabel} from '../src/event-deadline.js';
import {eventShare,sharePresentation} from '../src/content-share.js';
import {appEventSnapshot} from '../src/lib/app-events.mjs';
import {publicEventSnapshot} from '../src/lib/events.mjs';
import {newsContextLabel} from '../src/lib/news-context.mjs';
import {renderEventDetail} from '../src/templates/event-detail.mjs';
import {renderEventsPage} from '../src/templates/events.mjs';
test('deadline uses JST calendar boundaries without inventing a cutoff time',()=>{
 const event={applicationDeadline:'2026-10-29',deadlineScope:'captions',status:'announced'};
 assert.equal(eventDeadline(event,Date.parse('2026-10-29T14:59:59Z')).passed,false);
 assert.equal(eventDeadline(event,Date.parse('2026-10-29T15:00:00Z')).passed,true);
 assert.match(deadlineLabel(eventDeadline(event,Date.parse('2026-10-29T15:00:00Z'))),/字幕利用申込締切日を過ぎ/);
 assert.equal(event.status,'announced');
});
test('only explicit unambiguous full dates in reviewed application text become deadlines',()=>{
 assert.equal(eventDeadline({target:'申込締切は2026年10月26日へ延長。'},Date.parse('2026-10-29')).date,'2026-10-26');
 for(const target of ['締切10月21日','開催日の一週間前','申込締切は2026年10月21日から2026年10月26日へ延長','公演日2026年11月1日','申込締切は2026年2月30日']) assert.equal(eventDeadline({target}),null,target);
});
test('official organisation-only headlines get section context without changing the title',()=>{
 const article={id:'https://www.nftrs.or.jp/sl-list/example',title:'福島県警察'};
 assert.equal(newsContextLabel(article),'手話リンクの導入法人情報');assert.equal(article.title,'福島県警察');
 assert.equal(newsContextLabel({...article,id:'https://other.example/sl-list/example'}),'');
});
test('list and detail distinguish the application deadline from event cancellation',()=>{
 const event={id:'deadline-fixture',title:'手話講座',startDate:'2026-11-01',prefecture:'東京都',venue:'検証会場',kind:'course',status:'announced',verification:'verified',sourceUrl:'https://example.org/event',sourceName:'検証主催者',verifiedAt:'2026-10-28T00:00:00Z',evidenceHash:'a'.repeat(64),applicationDeadline:'2026-10-26'};
 const detail=renderEventDetail(event,{now:Date.parse('2026-10-29T00:00:00Z')});
 assert.match(detail,/申込締切日を過ぎています/);assert.match(detail,/data-status="announced"/);assert.doesNotMatch(detail,/中止の告知/);
 assert.match(renderEventsPage({events:[event]}),/data-event-deadline="2026-10-26"/);
});
test('an accommodation deadline cannot become a general registration deadline',()=>{
 const now=Date.parse('2026-11-28T13:00:00Z');
 for(const target of [
  '手話通訳・要約筆記を希望する方の申込締切は2026年11月29日です。',
  '字幕機器の利用を希望される方へ。申込締切：2026年11月29日。',
  '託児を希望する場合は予約が必要です。申込み締切は2026年11月29日。',
 ]) assert.equal(eventDeadline({target},now),null,target);
 assert.equal(eventDeadline({applicationDeadline:'2026-11-29',deadlineScope:'other'},now),null);
 assert.equal(eventDeadline({target:'手話通訳を希望の方は要連絡。一般参加の申込締切は2026年11月30日。'},now).scope,'participation');

 const url='https://deafnavi.com/events/deadline-fixture/';
 const event={id:'deadline-fixture',title:'手話講座',startDate:'2026-12-05',prefecture:'東京都',venue:'検証会場',kind:'course',
  status:'announced',verification:'verified',sourceUrl:'https://example.org/event',sourceName:'検証主催者',
  verifiedAt:'2026-11-28T12:00:00Z',evidenceHash:'a'.repeat(64),applicationDeadline:'2026-11-29',deadlineScope:'captions'};
 for(const snapshot of [publicEventSnapshot({events:[event]}),appEventSnapshot({events:[event]})]){
  const [row]=snapshot.events;
  assert.equal(row.applicationDeadline,undefined);
  assert.equal(row.deadlineScope,undefined);
  assert.equal(row.supportDeadline,'2026-11-29');
  assert.equal(row.supportDeadlineScope,'captions');
 }
 const share=sharePresentation(eventShare(event,url),now).text;
 assert.match(share,/字幕利用申込締切日：2026-11-29/);
 assert.doesNotMatch(share,/^申込期限：/m);

 const withBoth={...event,deadlineScope:'participation',applicationDeadline:'2026-12-03',
  supportDeadline:'2026-11-29',supportDeadlineScope:'accessibility'};
 assert.deepEqual(eventDeadlines(withBoth,now).map(({scope,date})=>[scope,date]),[
  ['participation','2026-12-03'],['accessibility','2026-11-29'],
 ]);
 for(const html of [renderEventDetail(withBoth,{now}),renderEventsPage({events:[withBoth]})]){
  assert.match(html,/data-event-deadline="2026-11-29" data-deadline-scope="accessibility"/);
  assert.match(html,/data-event-deadline="2026-12-03" data-deadline-scope="participation"/);
 }
});
