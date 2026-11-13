import test from 'node:test';
import assert from 'node:assert/strict';
import {shareUrl,shareControl,newsShare,eventShare,sharePresentation,shareState} from '../src/content-share.js';
import {renderCafeEvent} from '../src/event-cafe-feed.js';
import {renderArticleCard} from '../src/templates/partials.mjs';
import {readFileSync} from 'node:fs';
const now=Date.parse('2026-11-13T03:00:00Z');
const event={title:'手話で交流',startDate:'2026-11-20',endDate:'2026-11-20',time:'10:00〜12:00',venue:'市民会館',prefecture:'大阪府',verification:'verified',verifiedAt:'2026-11-13T01:00:00Z',status:'announced',fee:'500円',target:'事前申込',reviewNote:'PRIVATE',phone:'SECRET'};
const url='https://deafnavi.com/events/example/';
test('only published presentation fields are shareable; source data is not mutated',()=>{
  const before=JSON.stringify(event),data=eventShare(event,url);
  assert.equal(JSON.stringify(event),before);assert.equal(data.reviewNote,undefined);assert.equal(data.phone,undefined);
  assert.equal(sharePresentation(data,now).url,url);
  const news=newsShare({id:'https://example.com/news?id=2&utm_source=test',title:'見出し',sourceName:'公式団体',reviewNote:'PRIVATE',imageUrl:'https://example.com/private.jpg'});
  assert.equal(news.url,'https://example.com/news?id=2');assert.equal(news.imageUrl,undefined);assert.equal(news.reviewNote,undefined);
});
test('freshness changes sharing text at the exact deadline without changing source review',()=>{
  const data=eventShare(event,url),expiry=Date.parse(event.verifiedAt)+48*3600000;
  assert.equal(shareState(data,expiry-1),'開催予定');assert.equal(shareState(data,expiry),'最新状況は公式案内へ');
  const p=sharePresentation(data,expiry);assert.match(p.text,/以前の告知/);assert.doesNotMatch(p.text,/時間：|市民会館|500円|事前申込/);
  assert.equal(data.verifiedAt,event.verifiedAt);
  for(const changes of [{verifiedAt:'invalid'},{verifiedAt:'2027-01-01'},{verification:'needs_review'},{validUntil:'invalid'},{period:'unconfirmed'},{startDate:''}])assert.equal(shareState({...data,...changes},now),'最新状況は公式案内へ');
});
test('closed, cancelled and past are distinct, including stale cafe occurrences',()=>{
  const data=eventShare(event,url);
  assert.equal(shareState({...data,status:'closed'},now),'受付終了の告知');
  assert.equal(shareState({...data,status:'cancelled'},now),'中止の告知');
  assert.equal(shareState({...data,startDate:'2026-11-01',endDate:'2026-11-01'},now),'過去の開催告知');
  assert.equal(shareState({...data,kind:'cafe',period:'past'},now),'過去の開催告知');
  assert.match(sharePresentation({...data,startDate:'2026-11-01',endDate:'2026-11-01'},now).text,/実施済み・次回開催を示すものではありません/);
});
test('unsafe URLs are rejected; verification markers never become public shared URLs',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,hi','https://u:p@example.com/','/relative'])assert.equal(shareUrl(value),'');
  assert.equal(shareUrl(url+'?dn_client=codex&utm_campaign=test#private'),url);
  assert.equal(shareControl({title:'bad',url:'javascript:alert(1)'}),'');
  assert.throws(()=>sharePresentation({kind:'news',title:'bad',url:'javascript:alert(1)'}));
});
test('share HTML escapes titles and payloads; X text preserves event status under its length limit',()=>{
  const data=eventShare({...event,title:'<img onerror="alert(1)">日本語'.repeat(40),status:'closed'},url);
  const html=shareControl(data);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
  const p=sharePresentation(data,now),x=new URL(p.xUrl),text=x.searchParams.get('text');
  assert.equal(x.origin,'https://x.com');assert.equal(x.searchParams.get('url'),url);assert.match(text,/^【受付終了の告知】/);
  assert.ok([...text].reduce((n,c)=>n+(c.codePointAt(0)>127?2:1),0)+24<=280);
});
test('dynamic cafe rows and news cards each expose the exact selected item, without private fields',()=>{
  const cafe={...event,id:'a-cafe',webUrl:'https://deafnavi.com/connect/sign-cafe/a-cafe/',period:'upcoming',origin:'cafe'};
  const html=renderCafeEvent(cafe);assert.match(html,/data-content-share=/);assert.match(html,/a-cafe\//);assert.doesNotMatch(html,/PRIVATE|SECRET/);
  const news=renderArticleCard({id:'https://example.com/story',title:'見出し',sourceName:'団体',sourceUrl:'https://example.com/',publishedAt:'2026-11-13T01:00:00Z',category:'general'});
  assert.match(news,/data-content-share=/);assert.match(news,/https:\/\/example.com\/story/);
});
test('browser sharing never fetches, posts or copies third-party pictures',()=>{
  const ui=readFileSync(new URL('../src/assets/content-share-ui.js',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|\.drawImage\(/);
  assert.match(ui,/Escape/);assert.match(ui,/text\.select\(\)/);
});

test('small named social icons are visible immediately, with Instagram tools initially hidden',()=>{
  const html=shareControl(newsShare({id:'https://example.com/story',title:'見出し'}));
  assert.doesNotMatch(html,/<details|<summary/);
  for(const name of ['data-share-x','data-share-instagram','data-share-copy'])assert.match(html,new RegExp(name));
  assert.match(html,/aria-label="Xで共有（新しいタブ）"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/class="dn-share-panel" hidden/);
  assert.equal((html.match(/aria-hidden="true"/g)||[]).length,3);
});
