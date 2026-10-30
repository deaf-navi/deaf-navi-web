import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {eventDeadline,deadlineLabel} from '../src/event-deadline.js';
import {eventDetailState,eventSchema,renderEventDetail,renderRetiredEvent} from '../src/templates/event-detail.mjs';
import {renderEventsPage} from '../src/templates/events.mjs';
import {renderSitemapXml} from '../src/templates/feeds.mjs';
import {ENTRY_REDIRECTS,renderEntryRedirect} from '../src/templates/entry-redirect.mjs';
import {renderGuideTopics} from '../src/templates/guide-topics.mjs';
import {NEWS_SECTIONS} from '../config/news-sections.mjs';
import {newsSectionArticles,renderNewsSections} from '../src/templates/news-sections.mjs';
const now=Date.parse('2026-10-17T02:00:00Z');
const event={id:'test-event-20261101',title:'手話の交流会',startDate:'2026-11-01',endDate:'2026-11-01',prefecture:'東京都',venue:'会場A',kind:'exchange',status:'announced',verification:'verified',verifiedAt:'2026-10-17T01:00:00Z',evidenceHash:'a'.repeat(64),sourceUrl:'https://example.org/notice',sourceName:'主催者',time:null,fee:null,organizer:null};
const files={oldIndex:'index-old.html',about:'about.html',guide:'guide.html',sitemapHtml:'sitemap.html'};
test('event detail preserves unknowns and links both local detail and original source',()=>{
 const html=renderEventDetail(event,{now});assert.match(html,/href="https:\/\/example.org\/notice"/);assert.match(html,/主催者へご確認ください/);assert.match(html,/content="index,follow/);
 const schema=eventSchema(event,now);assert.equal(schema.startDate,'2026-11-01');assert.ok(!schema.offers&&!schema.organizer);assert.ok(!schema.location.address.streetAddress);
 assert.match(renderEventsPage({events:[event]},{}),/href="\/events\/test-event-20261101\/"/);
 assert.throws(()=>renderEventDetail({...event,id:'../private'}));
 assert.doesNotMatch(renderEventDetail({...event,title:'</script><img src=x onerror=alert(1)>'},{now}),/<img src=x/);
});

test('visitor copy preserves expired-event warnings and client-side freshness without investigation prose',async()=>{
 const stale={...event,verifiedAt:new Date(now-48*3600000).toISOString(),sourceStatus:'retrying'};
 const html=renderEventDetail(stale,{now});
 assert.match(html,/最新状況は公式案内へ/);
 assert.match(html,/以前の告知をもとにした情報/);
 assert.match(html,/noindex,follow/);
 assert.doesNotMatch(html,/再確認中|再取得中|内容を最後に照合|開催予定としての案内を停止/);
 const list=renderEventsPage({events:[stale]});
 assert.doesNotMatch(list,/再確認中|再取得中|最長6時間|約30分後|順次調査/);
 const nodes={'[data-detail-status]':{},'[data-detail-notice]':{},'[data-source-retry]':{}};
 const article={dataset:{end:stale.endDate,status:stale.status,verification:stale.verification,verified:stale.verifiedAt,recheckMs:String(48*3600000)},querySelector:s=>nodes[s]};
 const robots={setAttribute:(k,v)=>{robots[k]=v;}};
 const schema={textContent:JSON.stringify([{'@type':'Event'},{'@type':'BreadcrumbList'}])};
 const document={querySelector:s=>s==='[data-event-detail]'?article:robots,querySelectorAll:()=>[schema],addEventListener:()=>{}};
 class Clock extends Date {static now(){return now;}}
 const detailScript=(await readFile(new URL('../src/assets/event-detail.js',import.meta.url),'utf8')).replace("import {eventDeadline,deadlineLabel} from './event-deadline.js';",'');
 vm.runInNewContext(detailScript,{document,Date:Clock,setInterval:()=>{},eventDeadline,deadlineLabel});
 assert.equal(nodes['[data-detail-status]'].textContent,eventDetailState(stale,now).label);
 assert.equal(nodes['[data-detail-notice]'].textContent,eventDetailState(stale,now).note);
 assert.equal(robots.content,'noindex,follow');
 assert.deepEqual(JSON.parse(schema.textContent),[{'@type':'BreadcrumbList'}]);
 assert.equal(stale.verifiedAt,new Date(now-48*3600000).toISOString());
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

test('topic pages distinguish access technology and education support from unrelated categories',()=>{
 const article=(id,category,title,summary='')=>({id:`https://example.org/${id}`,category,title,summary,sourceName:'公式団体',publishedAt:new Date(now).toISOString()});
 const articles=[article('caption','technology','字幕表示の新技術'),article('general','technology','新しいパソコン'),article('school','education','授業での合理的配慮'),article('generic','education','聴覚特別支援学校の文化祭の開催報告'),article('relay','relay','電話リレーの利用案内'),article('policy','policy','自治体の支援制度')];
 const [support,access]=NEWS_SECTIONS;
 assert.deepEqual(newsSectionArticles(support,articles).map(g=>g.lead.id),['https://example.org/school','https://example.org/policy']);
 assert.deepEqual(newsSectionArticles(access,articles).map(g=>g.lead.id),['https://example.org/caption','https://example.org/relay']);
});

test('topic pages are crawlable collections with safe text, source links and a useful empty state',()=>{
 const title='字幕サービスの提供開始についてのお知らせ';
 const articles=['a','b'].map(id=>({id:`https://example.org/${id}`,category:'accessibility',title,summary:'<img src=x onerror=alert(1)>',sourceName:'公式団体',publishedAt:new Date(now).toISOString()}));
 const pages=renderNewsSections({articles,generatedAt:new Date(now).toISOString()});
 const html=pages.find(p=>p.file.includes('accessibility')).html;
 const schemas=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 const collection=schemas.find(s=>s['@type']==='CollectionPage');
 assert.equal(collection.mainEntity.numberOfItems,1);
 assert.equal(collection.mainEntity.itemListElement[0].name,title);
 assert.equal(schemas.find(s=>s['@type']==='BreadcrumbList').itemListElement.length,2);
 assert.match(html,/同じ話題の出典 1件/);
 assert.match(html,/href="https:\/\/example.org\/b"/);
 assert.match(html,/rel="canonical" href="https:\/\/deafnavi.com\/news\/accessibility\/"/);
 assert.doesNotMatch(html,/<img src=x|"@type":"NewsArticle"/);
 assert.match(pages.find(p=>p.file.includes('support')).html,/現在、この分野の新着はありません/);
 const xml=renderSitemapXml({generatedAt:new Date(now).toISOString(),isDev:false,files,events:[],now});
 for(const section of NEWS_SECTIONS) assert.ok(xml.includes(`<loc>https://deafnavi.com/news/${section.slug}/</loc>`));
});

test('event search titles distinguish dates without changing the event name',()=>{
 const first=renderEventDetail(event,{now});
 const second=renderEventDetail({...event,startDate:'2026-11-02',endDate:'2026-11-02'},{now});
 assert.match(first,/<title>手話の交流会｜2026-11-01・東京都 \| Deaf Navi<\/title>/);
 assert.match(second,/<title>手話の交流会｜2026-11-02・東京都 \| Deaf Navi<\/title>/);
 assert.match(first,/<h1>手話の交流会<\/h1>/);
 assert.equal(eventSchema(event,now).name,event.title);
});
