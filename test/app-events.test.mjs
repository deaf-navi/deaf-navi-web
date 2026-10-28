import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appEventSnapshot} from '../src/lib/app-events.mjs';
const raw=JSON.parse(readFileSync(new URL('../docs/events.json',import.meta.url)));
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
