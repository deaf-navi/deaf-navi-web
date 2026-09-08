import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/assets/directory-safety.js',import.meta.url),'utf8');
function setup(options={}) {
  const calls=[],notices=[],attrs=new Map(),listeners={};
  const controls=[{disabled:false},{disabled:true},{disabled:false}];
  const form={querySelectorAll:()=>controls,addEventListener:(name,fn)=>listeners[name]=fn,getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name),append:n=>notices.push({target:'form',...n})};
  const main={prepend:n=>notices.push({target:'main-start',...n}),append:n=>notices.push({target:'main-end',...n})};
  const document={querySelectorAll:selector=>{assert.equal(selector,'form[method="post" i]');return options.noForms?[]:[form];},querySelector:()=>main,createElement:()=>({setAttribute(name,value){this[name]=value;}})};
  const requests=['/admin/','/submit/?form=contact','/connect/sign-cafe/knot/','/index.html','/otomado/'];
  const caches={keys:async()=>{if(options.cacheFailure)throw Error('cache unavailable');return ['deaf-navi-old','another-app'];},open:async name=>{calls.push(['open',name]);return {keys:async()=>requests.map(path=>({url:'https://deafnavi.com'+path})),delete:async request=>{if(options.deleteFailure)throw Error('delete failed');calls.push(['delete',new URL(request.url).pathname]);}};}};
  let checks=0;
  const controller={postMessage(message,ports){calls.push(['check',message]);const answer=(options.answers||['NO_DIRECTORY_CACHE'])[checks++]??'NO_DIRECTORY_CACHE';if(answer==='timeout')return;queueMicrotask(()=>ports[0].peer.onmessage({data:answer}));}};
  const serviceWorker={controller:options.noController?null:controller,getRegistrations:async()=>[
    {scope:'https://deafnavi.com/',update:async()=>{calls.push(['update','root']);if(options.updateFailure)throw Error('update failed');},unregister:async()=>{calls.push(['unregister','root']);if(options.unregisterFailure)throw Error('unregister failed');}},
    {scope:'https://deafnavi.com/otomado/',update:async()=>calls.push(['update','other']),unregister:async()=>calls.push(['unregister','other'])},
  ]};
  class MessageChannel {constructor(){this.port1={close(){}};this.port2={peer:this.port1};}}
  vm.runInNewContext(source,{navigator:options.noServiceWorker?{}:{serviceWorker},document,window:{caches},caches,MessageChannel,URL,location:{origin:'https://deafnavi.com',reload:()=>calls.push(['reload'])},setTimeout:fn=>setTimeout(fn,5),clearTimeout});
  return {calls,notices,controls,attrs,submit(){let prevented=false;listeners.submit?.({preventDefault(){prevented=true;}});return prevented;},settle:()=>new Promise(resolve=>setTimeout(resolve,35))};
}

test('checking blocks POST without adding visible content; success preserves existing disabled controls',async()=>{
  const state=setup();assert.equal(state.submit(),true);assert.ok(state.controls.every(x=>x.disabled));assert.equal(state.attrs.get('aria-busy'),'true');assert.equal(state.notices.length,0);
  await state.settle();assert.equal(state.submit(),false);assert.deepEqual(state.controls.map(x=>x.disabled),[false,true,false]);assert.equal(state.attrs.has('aria-busy'),false);assert.equal(state.notices.length,0);
  assert.deepEqual(state.calls.filter(x=>x[0]==='delete').map(x=>x[1]),['/admin/','/submit/','/connect/sign-cafe/knot/']);
  assert.deepEqual(state.calls.filter(x=>x[0]==='open').map(x=>x[1]),['deaf-navi-old']);
});
test('pages without a controller or service workers remain usable',async()=>{
  for(const option of ['noController','noServiceWorker']){const state=setup({[option]:true});await state.settle();assert.equal(state.submit(),false);assert.deepEqual(state.controls.map(x=>x.disabled),[false,true,false]);assert.equal(state.calls.length,0);assert.equal(state.notices.length,0);}
});
test('read-only pages have no startup notice',async()=>{
  const state=setup({noForms:true});await state.settle();assert.equal(state.notices.length,0);assert.ok(state.calls.some(x=>x[0]==='check'));
});
test('an old worker may update safely without reloading or submitting',async()=>{
  const state=setup({answers:['unexpected','NO_DIRECTORY_CACHE']});await state.settle();assert.equal(state.submit(),false);assert.equal(state.notices.length,0);assert.deepEqual(state.calls.filter(x=>x[0]==='update'),[['update','root']]);assert.ok(!state.calls.some(x=>x[0]==='reload'));
});
test('unresponsive or incompatible old workers are retired only at the site root; POST stays blocked until reload',async()=>{
  for(const answers of [['unexpected','unexpected'],['timeout','timeout']]){const state=setup({answers,updateFailure:true});await state.settle();assert.equal(state.submit(),true);assert.ok(state.controls.every(x=>x.disabled));assert.deepEqual(state.calls.filter(x=>x[0]==='unregister'),[['unregister','root']]);assert.equal(state.calls.filter(x=>x[0]==='reload').length,1);assert.equal(state.notices.length,0);}
});
test('cache and unregister failures keep POST blocked and show a persistent message at the form',async()=>{
  for(const option of ['cacheFailure','deleteFailure','unregisterFailure']){const state=setup({[option]:true,answers:['unexpected','unexpected']});await state.settle();assert.equal(state.submit(),true);assert.ok(state.controls.every(x=>x.disabled));assert.equal(state.notices.length,1);assert.equal(state.notices[0].target,'form');assert.equal(state.notices[0].role,'alert');assert.match(state.notices[0].textContent,/再読み込み/);assert.equal(state.attrs.has('aria-busy'),false);assert.ok(!state.calls.some(x=>x[0]==='reload'));}
});
test('public asset matches its source',()=>{
  assert.equal(readFileSync(new URL('../docs/directory-safety.js',import.meta.url),'utf8').replaceAll('\r\n','\n'),source.replaceAll('\r\n','\n'));
});
