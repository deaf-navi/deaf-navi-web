import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/assets/stories.js',import.meta.url),'utf8');
function setup(navigator={}){
  const handlers={};
  const status={textContent:''},help={open:false};
  const link={value:'https://deafnavi.com/stories/example/',focus(){this.focused=true;},select(){this.selected=true;}};
  const elements={'[data-share-status]':status,'[data-instagram-help]':help,'[data-share-link]':link};
  for(const type of ['copy','share'])elements[`[data-story-${type}]`]={addEventListener:(_,fn)=>handlers[type]=fn};
  const section={dataset:{title:'記事の見出し'},querySelector:s=>elements[s]};
  vm.runInNewContext(source,{navigator,document:{querySelectorAll:()=>[section]}});
  return {handlers,status,help,link};
}
test('Instagram copies the canonical article URL without posting or tracking parameters',async()=>{
  let copied;const s=setup({clipboard:{writeText:async v=>copied=v}});
  await s.handlers.copy();assert.equal(copied,s.link.value);assert.match(s.status.textContent,/コピーしました/);
});
test('clipboard unavailable or denied exposes a selected manual-copy field',async()=>{
  for(const nav of [{},{clipboard:{writeText:async()=>{throw Error('denied');}}}]){
    const s=setup(nav);await s.handlers.copy();assert.equal(s.help.open,true);assert.equal(s.link.selected,true);assert.equal(s.link.focused,true);assert.match(s.status.textContent,/手動/);
  }
});
test('native sharing stays available and cancellation does not trigger a second action',async()=>{
  let payload;const s=setup({share:async v=>payload=v});await s.handlers.share();assert.equal(payload.url,s.link.value);assert.equal(payload.title,'記事の見出し');
  const cancelled=setup({share:async()=>{throw {name:'AbortError'};}});await cancelled.handlers.share();assert.equal(cancelled.help.open,false);assert.equal(cancelled.status.textContent,'');
});
test('native share failure offers manual copying; unsupported sharing copies the URL',async()=>{
  const failed=setup({share:async()=>{throw Error('failed');}});await failed.handlers.share();assert.equal(failed.link.selected,true);
  let copied;const fallback=setup({clipboard:{writeText:async v=>copied=v}});await fallback.handlers.share();assert.equal(copied,fallback.link.value);
});
