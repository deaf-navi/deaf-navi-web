import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {cafeRelated} from '../src/lib/cafe-related.mjs';
const now=Date.parse('2026-10-19T12:00:00Z');
const article=(title,day='2026-10-18',id='https://example.com/a')=>({title,publishedAt:day+'T00:00:00Z',id,sourceName:'公式',category:'culture'});
test('related selection drops unrelated, stale, future and duplicate topics, caps at two',()=>{
 const a=article('手話カフェで交流を楽しむ');
 const result=cafeRelated([article('一般の喫茶店オープン'),article('手話劇の交流','2026-09-01'),article('手話劇の交流','2027-01-01'),a,{...a,id:'https://example.com/b'},article('ろう文化アート展','2026-10-17','https://example.com/c'),article('筆談カフェの文化','2026-10-16','https://example.com/d')],now);
 assert.equal(result.length,2);assert.equal(result[0].title,a.title);assert.ok(result.every(x=>!('id' in x)));
 assert.deepEqual(cafeRelated([article('一般のニュース')],now),[]);
});
const script=readFileSync(new URL('../src/access-engagement.js',import.meta.url),'utf8');
function client(search='',path='/connect/sign-cafe/',referrer=''){
 const handlers={},requests=[];let observer;
 const context={location:{hostname:'deafnavi.com',origin:'https://deafnavi.com',pathname:path,href:'https://deafnavi.com'+path,search},navigator:{webdriver:false},URL,URLSearchParams,Set,window:{IntersectionObserver:true},document:{referrer,querySelector:()=>null,addEventListener:(k,v)=>handlers[k]=v},fetch:async(...args)=>{requests.push(args);return {text:async()=>''};},IntersectionObserver:class{constructor(f){observer=f;}observe(){}disconnect(){}}};
 if(path==='/connect/sign-cafe/')context.document.querySelector=()=>({});
 vm.runInNewContext(script,context);return {handlers,requests,context,show:()=>observer?.([{isIntersecting:true,intersectionRatio:.5}])};
}
test('observer and click counters deduplicate locally, send no title, URL or identity',()=>{
 const c=client();c.show();c.show();
 const link={href:'https://deafnavi.com/?q=private-search',closest:s=>s==='[data-cafe-related]'?{}:null};
 c.handlers.click({type:'click',button:0,target:{closest:()=>link}});c.handlers.click({type:'click',button:0,target:{closest:()=>link}});
 assert.equal(c.requests.length,2);assert.deepEqual(c.requests.map(x=>JSON.parse(x[1].body).event),['related_view','related_click']);
 for(const [,opts] of c.requests){assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');assert.deepEqual(Object.keys(JSON.parse(opts.body)).sort(),['event','source']);}
});

test('story list counts image/title once, excludes non-article and external links',()=>{
 const c=client('','/stories/');const click=(url,card=true,type='click',button=0)=>c.handlers[type]({type,button,target:{closest:()=>({href:url,closest:s=>card&&s==='.story-card'?{}:null})}});
 click('https://deafnavi.com/stories/example/');click('https://deafnavi.com/stories/example/','yes','auxclick',1);
 click('https://deafnavi.com/stories/');click('https://example.org/stories/example/');click('https://deafnavi.com/stories/other/',false);click('https://deafnavi.com/stories/third/',true,'auxclick',2);
 assert.equal(c.requests.length,1);assert.deepEqual(JSON.parse(c.requests[0][1].body),{source:'stories',event:'story_open'});
});

test('lodging counts only explicitly marked official booking links without sending the URL',()=>{
 const c=client('','/guide/guesthouses/');const click=(href,marked)=>c.handlers.click({type:'click',button:0,target:{closest:()=>({href,matches:s=>marked&&s==='[data-guesthouse-booking]'})}});
 click('https://example.org/book',true);click('https://example.org/book',true);click('https://example.org/media',false);click('https://deafnavi.com/guide.html',true);
 assert.equal(c.requests.length,1);assert.deepEqual(JSON.parse(c.requests[0][1].body),{source:'guesthouses',event:'booking_click'});
});

test('verification exclusion survives unknown query markers and is rechecked before every event',()=>{
 assert.equal(Object.keys(client('?dn_client=other','/stories/','https://deafnavi.com/?dn_client=codex').handlers).length,0);
 const c=client('','/');c.context.location.search='?dn_client=automation';
 c.handlers.click({type:'click',button:0,target:{closest:()=>({href:'https://example.org/article',matches:()=>true})}});assert.equal(c.requests.length,0);
});
test('Codex is excluded, ordinary title and read links count once and source home links do not count',()=>{
 assert.equal(Object.keys(client('?dn_client=codex').handlers).length,0);
 const c=client('','/');const link={href:'https://example.com/article',matches:()=>true};
 c.handlers.click({type:'click',button:0,target:{closest:()=>link}});c.handlers.auxclick({type:'auxclick',button:1,target:{closest:()=>link}});
 assert.equal(c.requests.length,1);assert.equal(JSON.parse(c.requests[0][1].body).event,'article_click');
 c.handlers.click({type:'click',button:0,target:{closest:()=>({...link,matches:()=>false})}});assert.equal(c.requests.length,1);
});
