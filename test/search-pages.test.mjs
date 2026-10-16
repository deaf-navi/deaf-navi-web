import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eventDetailState,eventSchema,renderEventDetail,renderRetiredEvent} from '../src/templates/event-detail.mjs';
import {renderEventsPage} from '../src/templates/events.mjs';
import {renderSitemapXml} from '../src/templates/feeds.mjs';
import {ENTRY_REDIRECTS,renderEntryRedirect} from '../src/templates/entry-redirect.mjs';
import {renderGuideTopics} from '../src/templates/guide-topics.mjs';
const now=Date.parse('2026-10-17T02:00:00Z');
const event={id:'test-event-20261101',title:'手話の交流会',startDate:'2026-11-01',endDate:'2026-11-01',prefecture:'東京都',venue:'会場A',kind:'exchange',status:'announced',verification:'verified',verifiedAt:'2026-10-17T01:00:00Z',evidenceHash:'a'.repeat(64),sourceUrl:'https://example.org/notice',sourceName:'主催者',time:null,fee:null,organizer:null};
const files={oldIndex:'index-old.html',about:'about.html',guide:'guide.html',sitemapHtml:'sitemap.html'};
test('event detail preserves unknowns and links both local detail and original source',()=>{
 const html=renderEventDetail(event,{now});assert.match(html,/href="https:\/\/example.org\/notice"/);assert.match(html,/告知で未確認/);assert.match(html,/content="index,follow/);
 const schema=eventSchema(event,now);assert.equal(schema.startDate,'2026-11-01');assert.ok(!schema.offers&&!schema.organizer);assert.ok(!schema.location.address.streetAddress);
 assert.match(renderEventsPage({events:[event]},{}),/href="\/events\/test-event-20261101\/"/);
 assert.throws(()=>renderEventDetail({...event,id:'../private'}));
 assert.doesNotMatch(renderEventDetail({...event,title:'</script><img src=x onerror=alert(1)>'},{now}),/<img src=x/);
});
test('48-hour boundary, source change, future review time and cancellation fail closed',()=>{
 for(const candidate of [{...event,verifiedAt:new Date(now-48*3600000).toISOString()},{...event,verification:'needs_review'},{...event,verifiedAt:new Date(now+1).toISOString()}]){
  assert.equal(eventDetailState(candidate,now).period,'review');assert.equal(eventSchema(candidate,now),null);assert.match(renderEventDetail(candidate,{now}),/content="noindex,follow"/);
  assert.doesNotMatch(renderSitemapXml({generatedAt:new Date(now).toISOString(),isDev:false,files,events:[candidate],now}),/\/events\/test-event/);
 }
 assert.equal(eventSchema({...event,status:'cancelled'},now),null);assert.match(renderEventDetail({...event,status:'cancelled'},{now}),/中止の告知/);
 assert.equal(eventSchema({...event,startDate:'2026-10-01',endDate:'2026-10-01'},now),null);
 assert.match(renderRetiredEvent('/events/old-event/'),/noindex,follow/);
});
test('sitemap names preferred URLs, fresh detail and useful topic pages only',()=>{
 const xml=renderSitemapXml({generatedAt:new Date(now).toISOString(),isDev:false,files,events:[event],now});
 for(const entry of ENTRY_REDIRECTS){assert.ok(!xml.includes('<loc>https://deafnavi.com'+entry.from+'</loc>'));assert.ok(renderEntryRedirect(entry).includes('href="https://deafnavi.com'+entry.to+'"'));}
 assert.match(xml,/\/events\/test-event-20261101\//);
 for(const page of renderGuideTopics()){assert.match(page.html,/公式情報・相談先/);assert.match(page.html,/Deaf Navi編集/);assert.ok((page.html.match(/<h1>/g)||[]).length===1);}
});
test('published snapshot events all have generated and discoverable detail files',async()=>{
 const root=new URL('../',import.meta.url);const snapshot=JSON.parse(await readFile(new URL('.state/events.json',root),'utf8'));
 const list=await readFile(new URL('docs/events.html',root),'utf8');
 for(const event of snapshot.events){const html=await readFile(new URL(`docs/events/${event.id}/index.html`,root),'utf8');assert.ok(list.includes(`/events/${event.id}/`));assert.ok(html.includes(`https://deafnavi.com/events/${event.id}/`));}
});
