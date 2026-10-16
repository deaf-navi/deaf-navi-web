import test from 'node:test';import assert from 'node:assert/strict';
import {parseOioiSchedule,verifyReviewedEvent,reviewedVisualEvent,eventSourceText,eventHash,eventPeriod,mergeEventSnapshot,validEvent,eventDateLabel} from '../src/lib/events.mjs';
import {renderEventsPage} from '../src/templates/events.mjs';
import {eventDateWindow} from '../src/events.js';
import {eventSearchText} from '../src/lib/events.mjs';

test('search covers participation conditions; communication is explicit and separately validated',()=>{
 const event={...base,fee:'小学生のみ無料',target:'きこえにくい方、事前申込',communication:[{method:'captions',detail:'第2部のみ日本語字幕。'}]};
 for(const word of ['無料','きこえにくい','事前申込','字幕'])assert.ok(eventSearchText(event).includes(word));
 assert.ok(validEvent(event));
 for(const communication of [[null],[{method:'unknown',detail:'あり'}],[{method:'captions',detail:''}],[{method:'captions',detail:'あり'},{method:'captions',detail:'あり'}]])assert.equal(Boolean(validEvent({...base,communication})),false);
 const unknown=renderEventsPage({events:[{...base,title:'手話通訳士と学ぶ字幕講座'}]},{files:{styles:'styles.css'}});
 assert.ok(unknown.includes('data-communication=""'));
 const html=renderEventsPage({events:[event]},{files:{styles:'styles.css'}});
 assert.ok(html.includes('data-communication="captions"'));
 assert.ok(html.includes('第2部のみ日本語字幕。'));
 assert.equal(eventPeriod({...event,verifiedAt:new Date(now-48*3600000).toISOString()},now),'review');
});
const now=Date.parse('2026-10-16T01:00:00Z');
const base={id:'reviewed-event',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',prefecture:'岩手県',venue:'公式会場',kind:'exchange',sourceUrl:'https://example.org/event',sourceName:'主催者',verifiedAt:new Date(now).toISOString(),verification:'verified',evidenceHash:'a'.repeat(64),status:'announced'};
const source={id:'test',url:'https://example.org/schedule',name:'出演団体'};
test('quick windows use Japan time and include only the remaining weekend/month',()=>{
 assert.deepEqual(eventDateWindow('weekend',Date.parse('2026-10-16T06:00:00Z')),['2026-10-17','2026-10-18']);
 assert.deepEqual(eventDateWindow('weekend',Date.parse('2026-10-17T15:00:00Z')),['2026-10-18','2026-10-18']);
 assert.deepEqual(eventDateWindow('weekend',Date.parse('2026-10-18T15:00:00Z')),['2026-10-24','2026-10-25']);
 assert.deepEqual(eventDateWindow('month',Date.parse('2026-12-31T15:00:00Z')),['2027-01-01','2027-01-31']);
 assert.deepEqual(eventDateWindow('month',Date.parse('2028-02-15T00:00:00Z')),['2028-02-15','2028-02-29']);
 assert.equal(eventDateWindow('',now),null);
});
test('known participation terms are visible outside disclosure and official links remain specific',()=>{
 const html=renderEventsPage({events:[{...base,fee:'無料',target:'市内在住者。10月20日までに申込。',detailUrl:'https://example.org/apply'}]});
 const row=html.slice(html.indexOf('<article'),html.indexOf('</article>'));
 assert.ok(row.indexOf('無料')<row.indexOf('<details>'));
 assert.ok(row.indexOf('10月20日まで')<row.indexOf('<details>'));
 assert.match(row,/href="https:\/\/example.org\/apply"[^>]+aria-label="手話交流会の公式案内/);
 assert.match(html,/data-range="weekend"/);assert.match(html,/type="module" src="\.\/events.js/);
});
const row=(date='11月14日(土)',pref='京都')=>`<li class="p-postList__item"><a href=https://example.org/detail><span class="c-postThumb__cat">${pref}</span><h4 class="event-date">${date}</h4><h5><time datetime="2026年10月1日"></time>手話交流会</h5><div class="p-postList__times">公式会場</div></a></li>`;
test('publisher year and event-date determine occurrence, never post timestamp',()=>{const {events}=parseOioiSchedule('<h3>2026年</h3>'+row(),source,now);assert.equal(events[0].startDate,'2026-11-14');assert.equal(events[0].prefecture,'京都府');assert.equal(events[0].organizer,null)});
test('publisher layout/date failure holds data, including missing year and impossible dates',()=>{for(const html of [row(),'<h3>2026年</h3>'+row('2月30日(月)'),'<h3>2026年</h3>'+row('近日開催'),'<h3>2026年</h3>'+row('11月14日(土)','架空')])assert.throws(()=>parseOioiSchedule(html,source,now))});
test('review expires at 48 hours and date boundary uses Japan timezone',()=>{assert.equal(eventPeriod(base,now),'upcoming');assert.equal(eventPeriod(base,now+48*3600000),'review');assert.equal(eventPeriod({...base,startDate:'2026-10-15',endDate:'2026-10-15'},Date.parse('2026-10-15T15:00:00Z')),'past');assert.equal(eventPeriod({...base,verification:'needs_review'},now),'review');assert.equal(eventPeriod({...base,status:'cancelled'},now),'cancelled')});
test('date/URL/category validation rejects invalid publication inputs',()=>{for(const change of [{startDate:'2026-02-30'},{detailUrl:'javascript:alert(1)'},{sourceUrl:'http://127.0.0.1'},{prefecture:'架空県'},{kind:'unknown'}])assert.equal(Boolean(validEvent({...base,...change})),false)});
test('content changes require fresh review even if old date remains',()=>{const html='<main>手話交流会 2026年11月14日 公式会場</main>';const entry={...base,reviewedAt:base.verifiedAt,sourceHash:eventHash(eventSourceText(html)),evidence:['手話交流会','2026年11月14日','公式会場']};assert.equal(verifyReviewedEvent(entry,html,now).verification,'verified');assert.equal(verifyReviewedEvent(entry,html+'<p>開催中止</p>',now).verification,'needs_review')});
test('visual review does not extend itself on an automatic update',()=>{const entry={...base,verificationMode:'visual',reviewedAt:base.verifiedAt,sourceHash:base.evidenceHash,evidence:['title','date','venue']};assert.equal(reviewedVisualEvent(entry,now).verification,'verified');assert.equal(reviewedVisualEvent(entry,now+48*3600000).verification,'needs_review');assert.equal(reviewedVisualEvent(entry,now+1000).verifiedAt,base.verifiedAt)});
test('missing or failed source preserves prior event for review, never assumes cancellation',()=>{const events=mergeEventSnapshot([base],[],[],now);assert.equal(events.length,1);assert.equal(events[0].verification,'needs_review');assert.equal(events[0].status,'announced');assert.equal(mergeEventSnapshot([base],[base],[],now).length,1)});
test('temporary transport failure retains only a fresh verified event without renewing its evidence',()=>{
 const checks=[{sourceUrl:base.sourceUrl,result:'unavailable',retryable:true}];
 const [retained]=mergeEventSnapshot([base],[],checks,now+3600000);
 assert.equal(eventPeriod(retained,now+3600000),'upcoming');assert.equal(retained.sourceStatus,'retrying');
 assert.equal(retained.verifiedAt,base.verifiedAt);assert.equal(retained.evidenceHash,base.evidenceHash);
 const [again]=mergeEventSnapshot([retained],[],checks,now+47*3600000);assert.equal(again.verifiedAt,base.verifiedAt);
 const [expired]=mergeEventSnapshot([again],[],checks,now+48*3600000);assert.equal(eventPeriod(expired,now+48*3600000),'review');
 const [unconfirmed]=mergeEventSnapshot([{...base,verification:'needs_review'}],[],checks,now+1000);assert.equal(unconfirmed.verification,'needs_review');
 const [visual]=mergeEventSnapshot([{...base,verificationMode:'visual'}],[],checks,now+1000);assert.equal(visual.verification,'needs_review');
 const [changed]=mergeEventSnapshot([base],[{...base,verification:'needs_review'}],[{sourceUrl:base.sourceUrl,id:base.id,result:'needs_review'}],now+1000);assert.equal(changed.verification,'needs_review');
 const [denied]=mergeEventSnapshot([base],[],[{sourceUrl:base.sourceUrl,result:'unavailable',retryable:false}],now+1000);assert.equal(denied.verification,'needs_review');
});
test('a failed reviewed detail cannot be replaced by the less specific schedule',()=>{
 const prior={...base,status:'closed',target:'受付終了',communication:[{method:'captions',detail:'字幕付き。'}]};
 const schedule={...base,sourceId:'schedule',sourceUrl:source.url,target:null};
 const checks=[{sourceUrl:source.url,result:'verified'},{sourceUrl:base.sourceUrl,id:base.id,result:'unavailable'}];
 const [held]=mergeEventSnapshot([prior],[schedule],checks,now);
 assert.equal(held.verification,'needs_review');assert.equal(held.status,'closed');assert.equal(held.target,'受付終了');assert.deepEqual(held.communication,prior.communication);
 assert.equal(mergeEventSnapshot([], [schedule],checks,now).length,0);
 const [restored]=mergeEventSnapshot([prior],[schedule,prior],[{id:base.id,sourceUrl:base.sourceUrl,result:'verified'}],now);
 assert.equal(restored.verification,'verified');assert.equal(restored.status,'closed');
});
test('same occurrence from multiple sources is deduplicated without collapsing separate dates',()=>{assert.equal(mergeEventSnapshot([],[base,{...base,id:'second-source'}],[],now).length,1);assert.equal(mergeEventSnapshot([],[base,{...base,id:'next-date',startDate:'2026-11-15',endDate:'2026-11-15'}],[],now).length,2)});
test('an unverified manual duplicate cannot replace a freshly checked occurrence',()=>{const events=mergeEventSnapshot([],[{...base,sourceId:'schedule'},{...base,id:'manual-copy',verification:'needs_review'}],[],now);assert.equal(events.length,1);assert.equal(events[0].verification,'verified')});
test('event output escapes source text and provides source/dates without pretending unknown fees',()=>{const html=renderEventsPage({events:[{...base,title:'<script>bad</script>'}]},{files:{styles:'styles.css'}});assert.ok(html.includes('&lt;script&gt;bad'));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('主催・情報源'));assert.ok(html.includes('告知をご確認ください'));assert.ok(html.includes('events.html'));assert.ok(!html.includes('class="event-participation"'))});
test('theater announcements retain sold-out status and can be found separately',()=>{
 const html='<h3>2026年</h3>'+row().replace('手話交流会','【満員御礼】手話新喜劇３');
 const event=parseOioiSchedule(html,source,now).events[0];
 assert.equal(event.kind,'theater');assert.equal(event.status,'closed');assert.ok(validEvent(event));
 assert.equal(parseOioiSchedule('<h3>2026年</h3>'+row().replace('手話交流会','手話講演会'),source,now).events[0].kind,'course');
});
test('event dates show correct weekdays across year and leap-day boundaries',()=>{
 for(const [date,label] of [['2026-10-23','2026.10.23（金）'],['2026-11-01','2026.11.01（日）'],['2027-01-01','2027.01.01（金）'],['2028-02-29','2028.02.29（火）'],['2026-02-29','']])assert.equal(eventDateLabel(date),label);
});
