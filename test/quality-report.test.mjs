import test from 'node:test';import assert from 'node:assert/strict';
import {eventInformation,qualityReport} from '../src/lib/quality-report.mjs';
import {validEvent} from '../src/lib/events.mjs';
const now=Date.parse('2026-10-29T00:00:00Z');
const event={id:'test-event',title:'検証用手話講座',startDate:'2026-11-01',prefecture:'東京都',venue:'検証会場',kind:'course',status:'announced',verification:'verified',sourceUrl:'https://www.oioi-sign.com/events/test-fixture/',sourceName:'検証主催者',verifiedAt:'2026-10-28T00:00:00Z',evidenceHash:'a'.repeat(64),time:null,fee:'無料',target:'申込フォームで事前申込',communication:[]};
test('unknown, free, and explicitly not applicable remain distinct',()=>{
 assert.equal(eventInformation(event).time,'unknown');assert.equal(eventInformation(event).fee,'confirmed');assert.equal(eventInformation(event).communication,'unknown');
 const explicit={...event,informationStatus:{deadline:'not_applicable'},informationNotes:{deadline:'主催者の告知で申込不要と確認'}};
 assert.ok(validEvent(explicit));assert.equal(eventInformation(explicit).deadline,'not_applicable');
 assert.equal(validEvent({...explicit,informationNotes:{}}),false);
 assert.equal(eventInformation({...event,time:'時間未確認'}).time,'unknown');
 assert.equal(eventInformation({...event,fee:'詳細は公式案内へ'}).fee,'unknown');
 assert.equal(eventInformation({...event,target:'メールで申込。締切は要確認'}).signup,'confirmed');
 assert.equal(eventInformation({...event,time:'１３時〜１５時',fee:'５００円',target:'ＦＡＸで申込'}).time,'confirmed');
 assert.equal(eventInformation({...event,fee:'有料・金額未定'}).fee,'unknown');
 assert.equal(eventInformation({...event,target:'問合せ：電話 000。申込方法は未確認'}).signup,'unknown');
 assert.equal(eventInformation({...event,target:'申込不要'}).deadline,'not_applicable');
 assert.equal(eventInformation({...event,communication:[],communicationAvailability:'unavailable',informationNotes:{communication:'主催者の案内で字幕・通訳の提供なしを確認'}}).communication,'confirmed');
});
test('30-day coverage includes stale candidates with honest state and no invented conversions',()=>{
 const report=qualityReport({checkedAt:'2026-10-28T00:00:00Z',events:[event,{...event,id:'stale-event',verifiedAt:'2026-10-20T00:00:00Z'},{...event,id:'later-event',startDate:'2026-12-01'}]}, {world:{entries:[]}}, {now});
 assert.equal(report.events.length,2);assert.equal(report.recheckDue,1);assert.deepEqual(report.coverage.fee,{confirmed:2,notApplicable:0,unknown:0,total:2});assert.equal(report.metrics.confirmedAttendance,null);
});
