import test from 'node:test';import assert from 'node:assert/strict';
import {eventDeadline,deadlineLabel} from '../src/event-deadline.js';
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
