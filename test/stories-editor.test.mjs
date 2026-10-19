import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/assets/stories-editor.js',import.meta.url),'utf8');
function editor({stored=null,revision='1',storageBlocked=false}={}){
  class Element{
    constructor(value='',type='text'){this.value=value;this.type=type;this.events={};this.children=[];this.textContent='';this.hidden=false;this.dataset={};}
    addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
    async fire(type,event={}){for(const fn of this.events[type]||[])await fn(event);}
    setCustomValidity(value){this.validationMessage=value;}
    removeAttribute(){}
    replaceChildren(){this.children=[];}
    append(child){this.children.push(child);}
  }
  const names=['title','slug','summary','body','category','tags','author','cover','alt','sources','related','checked_at','status','featured','published_at','csrf','id','revision'];
  const elements=Object.fromEntries(names.map(n=>[n,new Element()]));Object.assign(elements.revision,{value:revision});elements.id.value='fixture';elements.featured.type='checkbox';elements.featured.checked=false;
  elements.title.value='保存済みタイトル';elements.slug.value='fixture';elements.category.value='culture';elements.status.value='draft';
  const controls=new Map(),control=selector=>{if(!controls.has(selector))controls.set(selector,new Element());return controls.get(selector);};
  for(const [name,limit] of Object.entries({title:300,summary:1500,body:50000})){elements[name].name=name;elements[name].maxLength=limit;}
  const form=new Element();form.elements=elements;form.dataset.storageKey='deafnavi:story:v1:user:fixture';form.querySelector=control;form.querySelectorAll=selector=>selector==='[name][maxlength]'?[elements.title,elements.summary,elements.body]:[];
  const storage=new Map(stored?[[form.dataset.storageKey,JSON.stringify(stored)]]:[]),timers=new Map();let next=0,redirect=null,failSave=false;
  const context={document:{querySelector:()=>form,createElement:()=>new Element()},window:{addEventListener(){}},localStorage:{getItem:k=>{if(storageBlocked)throw Error('blocked');return storage.get(k);},setItem:(k,v)=>{if(storageBlocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)},location:{assign:v=>{redirect=v;}},
    FormData:class{constructor(f){this.values=f?new Map(Object.entries(f.elements).map(([k,v])=>[k,v.value])):new Map();}set(k,v){this.values.set(k,v);}},
    fetch:async(url,options)=>{const action=options.body.values.get('action');if(failSave&&action!=='preview'&&action!=='slug')return {ok:false,text:async()=>'<p>競合</p>'};return {ok:true,json:async()=>action==='slug'?{used:true}:action==='preview'?{html:'<p>安全なプレビュー</p>',invalid_links:['非公開 (/stories/draft/)']}:{redirect:'/admin/?view=stories&mode=edit&id=fixture'}};},
    DOMParser:class{parseFromString(){return {querySelector:()=>({textContent:'別の保存が先に行われました。'})};}},
    setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),console};
  vm.runInNewContext(source,context);
  return {elements,form,control,storage,key:form.dataset.storageKey,async input(name,value){elements[name].value=value;await elements[name].fire('input');await form.fire('input');},async flush(){const callbacks=[...timers.values()];timers.clear();for(const fn of callbacks)await fn();},get redirect(){return redirect;},set failSave(v){failSave=v;}};
}
test('Unicode counters accept 300 supplementary characters and flag 301',async()=>{
  const e=editor();await e.input('title','𠮷'.repeat(300));assert.equal(e.elements.title.validationMessage,'');assert.match(e.control('[data-count="title"]').textContent,/残り 0文字/);
  await e.input('title','𠮷'.repeat(301));assert.match(e.elements.title.validationMessage,/300/);
});
test('draft is stored by editor key and recovery is explicit across server revisions',async()=>{
  const e=editor();await e.input('title','退避タイトル');await e.flush();const saved=JSON.parse(e.storage.get(e.key));assert.equal(saved.values.title,'退避タイトル');assert.equal(saved.values.csrf,undefined);
  const reopened=editor({stored:saved,revision:'2'});assert.equal(reopened.elements.title.value,'保存済みタイトル');assert.match(reopened.control('[data-recovery-message]').textContent,/版が変わっています/);
  reopened.control('[data-restore]').onclick();assert.equal(reopened.elements.title.value,'退避タイトル');assert.equal(reopened.elements.revision.value,'2');
});
test('successful save clears the recovery; failed save preserves it',async()=>{
  const e=editor();await e.input('title','変更');await e.flush();e.failSave=true;await e.form.fire('submit',{preventDefault(){}});assert.ok(e.storage.has(e.key));assert.match(e.control('[data-save-status]').textContent,/別の保存/);
  e.failSave=false;await e.form.fire('submit',{preventDefault(){}});assert.equal(e.storage.has(e.key),false);assert.equal(e.redirect,'/admin/?view=stories&mode=edit&id=fixture');
});
test('pre-save warnings respond to content and server link validation without blocking save',async()=>{
  const e=editor();await e.input('body','あ'.repeat(3001));await e.flush();const warnings=()=>e.control('[data-check-list]').children.map(e=>e.textContent).join('\n');assert.match(warnings(),/見出しがありません/);assert.match(warnings(),/カバー画像/);assert.match(warnings(),/無効なリンク/);assert.match(warnings(),/目安は40〜160文字/);
  await e.input('summary','あ'.repeat(40));await e.input('body','## 見出し\n'+'あ'.repeat(3001));assert.doesNotMatch(warnings(),/見出しがありません|目安は40〜160文字/);
});
test('storage unavailable does not prevent editing or saving',async()=>{
  const e=editor({storageBlocked:true});await e.input('title','変更');await e.flush();assert.match(e.control('[data-storage-status]').textContent,/退避できません/);await e.form.fire('submit',{preventDefault(){}});assert.ok(e.redirect);
});
test('slug preflight displays server conflict',async()=>{const e=editor();await e.input('slug','used');await e.flush();assert.match(e.control('[data-slug-status]').textContent,/使用済み/);});
