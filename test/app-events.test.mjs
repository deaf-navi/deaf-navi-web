import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appEventSnapshot} from '../src/lib/app-events.mjs';
import {publicEventSnapshot,validEvent} from '../src/lib/events.mjs';
const raw=JSON.parse(readFileSync(new URL('../docs/events.json',import.meta.url)));

test('web feed omits internal review notes without changing conditions or freshness',()=>{
  const item={...raw.events[0],reviewNote:'internal review',thumbnailReviewNote:'internal image decision',thumbnailNote:'internal fetch',futurePrivateMemo:'private',informationNotes:{signup:'主催者の案内をご確認ください'}};
  const source={checkedAt:raw.checkedAt,events:[item]};
  const result=publicEventSnapshot(source),event=result.events[0];
  for(const key of ['reviewNote','thumbnailReviewNote','thumbnailNote','futurePrivateMemo'])assert.equal(event[key],undefined);
  for(const key of ['id','status','verifiedAt','verification','evidenceHash','time','fee','target','sourceUrl','informationNotes'])assert.deepEqual(event[key],item[key]);
  assert.equal(result.checkedAt,source.checkedAt);assert.equal(source.events[0].reviewNote,'internal review');
  assert.ok(validEvent(event));assert.equal(appEventSnapshot(result).events.length,1);
});

test('generated web event feed contains no internal review notes',()=>{
  for(const e of raw.events)for(const key of ['reviewNote','thumbnailReviewNote','thumbnailNote'])assert.equal(e[key],undefined,`${e.id}: ${key}`);
});
test('app events project confirmed public fields without internal evidence',()=>{
  const result=appEventSnapshot(raw);
  assert.equal(result.generatedAt,raw.checkedAt);
  assert.ok(result.events.length>0);
  for(const e of result.events){assert.ok(e.validUntil&&e.webUrl);assert.equal(e.reviewNote,undefined);assert.equal(e.evidenceHash,undefined);}
});
test('empty and invalid event snapshots do not resurrect listings',()=>{
  assert.deepEqual(appEventSnapshot({checkedAt:'2026-10-28T00:00:00Z',events:[]}).events,[]);
  assert.deepEqual(appEventSnapshot({checkedAt:'2026-10-28T00:00:00Z',events:[{...raw.events[0],venue:''}]}).events,[]);
});
