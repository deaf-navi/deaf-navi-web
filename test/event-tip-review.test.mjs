import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {reviewEventTips,tipPrivacyRisk} from '../scripts/event-tip-review.mjs';
const now=Date.parse('2026-10-26T03:00:00Z');
const excerpt='手話カフェを開催します。開催日 2026年11月14日。会場 市民会館。申込不要。手話で交流。';
const text='<main>'+excerpt+' 市民会館 東京都テスト市1丁目。公共施設です。</main>';
const hash=createHash('sha256').update(text).digest('hex');
const review={reviewedAt:new Date(now-1000).toISOString(),sourceUrl:'https://example.org/event',sourceRawHash:hash,venueRawHash:hash,venueQuote:'市民会館 東京都テスト市1丁目',excerpt,application:'申込不要',communication:'sign',photos:[],record:{name:'手話カフェ',activity_date:'2026-11-14',venue_name:'市民会館',address:'東京都テスト市1丁目',venue_url:'https://example.org/event'}};
const row={id:'a'.repeat(32),revision:2,payloadHash:'b'.repeat(64),review,photoHashes:[]};
const decision=id=>({id,relevance:'yes',contentType:'announcement',evidence:'手話カフェを開催します。',facts:[{field:'startDate',value:'2026-11-14',evidence:'2026年11月14日'},{field:'venue',value:'市民会館',evidence:'会場 市民会館'},{field:'application',value:'申込不要',evidence:'申込不要'},{field:'communication',value:'sign',evidence:'手話で交流'},{field:'status',value:'scheduled',evidence:'手話カフェを開催します'}]});
const base=async()=>({queue:{items:[structuredClone(row)]},stateDir:await mkdtemp(join(tmpdir(),'dn-tip-review-')),now,gateReady:true,prepareSharing:async()=>()=>true,fetchResource:async()=>({status:200,headers:{'content-type':'text/html'},text}),generate:async items=>({model:'gpt-6.1-sol',items:items.map(x=>decision(x.id))}),publish:async d=>({status:d.status==='ready'?'published':'exception',id:d.id})});
test('reviewed exact official evidence publishes; repeat uses cache and never sends photo/submission text',async()=>{
 const options=await base();let calls=0;options.generate=async items=>{calls++;assert.equal(items.length,1);assert.equal(JSON.parse(items[0].summary).text,excerpt);assert.ok(!JSON.stringify(items).includes('photo'));return {model:'gpt-6.1-sol',items:items.map(x=>decision(x.id))};};
 const first=await reviewEventTips(options);assert.equal(first.published,1);assert.equal(first.submittedThisRun,1);
 const second=await reviewEventTips(options);assert.equal(second.published,1);assert.equal(second.cached,1);assert.equal(second.submittedThisRun,0);assert.equal(calls,1);
});
test('new material, expired review, account unknown, changed source and photo mismatch never generate',async()=>{
 for(const change of [o=>o.queue.items[0].review=null,o=>o.queue.items[0].review.reviewedAt=new Date(now-172800000).toISOString(),o=>o.gateReady=false,o=>o.queue.items[0].review.sourceRawHash='c'.repeat(64),o=>o.queue.items[0].photoHashes=['changed'],o=>o.queue.items[0].review.excerpt+=' 個人名義の口座番号']){
  const o=await base();change(o);o.generate=async()=>assert.fail('must not send');const r=await reviewEventTips(o);assert.equal(r.published,0);assert.equal(r.submittedThisRun,0);
 }
});
test('facts conflict and evidence invalid never publish; invalid response stops remainder',async()=>{
 const o=await base();o.generate=async items=>({model:'gpt-6.1-sol',items:items.map(x=>({...decision(x.id),facts:decision(x.id).facts.filter(f=>f.field!=='application')}))});assert.equal((await reviewEventTips(o)).published,0);
 const bad=await base();bad.queue.items.push({...row,id:'c'.repeat(32)});bad.generate=async()=>{throw Error('transport unknown');};const r=await reviewEventTips(bad);assert.equal(r.submittedThisRun,null);assert.equal(r.deferred,1);assert.equal(r.published,0);
});
test('new review scope stays bounded and exact allowlist is required even when account ready',async()=>{
 const o=await base();o.prepareSharing=async()=>()=>false;o.generate=async()=>assert.fail('unapproved text');assert.equal((await reviewEventTips(o)).published,0);
 assert.ok(tipPrivacyRisk('連絡先 test@example.org'));assert.ok(tipPrivacyRisk('開催延期'));assert.equal(tipPrivacyRisk(excerpt),false);
 const more=await base();more.queue.items=Array.from({length:7},(_,i)=>({...row,id:String(i).repeat(32)}));const r=await reviewEventTips(more);assert.equal(r.selected,4);assert.equal(r.deferred,3);
});
