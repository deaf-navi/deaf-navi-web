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
function client(search='',path='/connect/sign-cafe/'){
 const handlers={},requests=[];let observer;
 const context={location:{hostname:'deafnavi.com',origin:'https://deafnavi.com',pathname:path,href:'https://deafnavi.com'+path,search},navigator:{webdriver:false},URL,URLSearchParams,Set,window:{IntersectionObserver:true},document:{referrer:'',querySelector:()=>({}),addEventListener:(k,v)=>handlers[k]=v},fetch:async(...args)=>requests.push(args),IntersectionObserver:class{constructor(f){observer=f;}observe(){}disconnect(){}}};
 vm.runInNewContext(script,context);return {handlers,requests,show:()=>observer?.([{isIntersecting:true,intersectionRatio:.5}])};
}
test('observer and click counters deduplicate locally, send no title, URL or identity',()=>{
 const c=client();c.show();c.show();
 const link={href:'https://deafnavi.com/?q=private-search',closest:s=>s==='[data-cafe-related]'?{}:null};
 c.handlers.click({type:'click',button:0,target:{closest:()=>link}});c.handlers.click({type:'click',button:0,target:{closest:()=>link}});
 assert.equal(c.requests.length,2);assert.deepEqual(c.requests.map(x=>JSON.parse(x[1].body).event),['related_view','related_click']);
 for(const [,opts] of c.requests){assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');assert.deepEqual(Object.keys(JSON.parse(opts.body)).sort(),['event','source']);}
});
test('Codex is excluded, ordinary title and read links count once and source home links do not count',()=>{
 assert.equal(Object.keys(client('?dn_client=codex').handlers).length,0);
 const c=client('','/');const link={href:'https://example.com/article',matches:()=>true};
 c.handlers.click({type:'click',button:0,target:{closest:()=>link}});c.handlers.auxclick({type:'auxclick',button:1,target:{closest:()=>link}});
 assert.equal(c.requests.length,1);assert.equal(JSON.parse(c.requests[0][1].body).event,'article_click');
 c.handlers.click({type:'click',button:0,target:{closest:()=>({...link,matches:()=>false})}});assert.equal(c.requests.length,1);
});
