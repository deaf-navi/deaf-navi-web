import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicCopyIssues,assertPublicCopy} from '../src/lib/public-copy.mjs';
import {htmlCopyIssues} from '../scripts/verify-public-copy.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./public-copy-fixtures.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
for(const f of fixtures)test('public copy: '+f.text,()=>{
 assert.equal(publicCopyIssues({text:f.text},'text').length>0,f.blocked);
});
test('only public fields and nested lodging facts are checked; input never changes',()=>{
 const row={description:'予約が必要です。',review_notes:'本文hashが変わった',evidence:{text:'内部向けの調査メモ'}};
 const before=structuredClone(row);assert.deepEqual(publicCopyIssues(row,'cafe'),[]);assert.deepEqual(row,before);
 assert.throws(()=>assertPublicCopy([{facts:[['注意','無料APIの照合待ち']]}],'lodging'),/facts.0.1:workflow-state/);
 for(const kind of ['event','news','cafe','lodging'])assert.throws(()=>assertPublicCopy([{title:'内部向けの調査メモ',name:'内部向けの調査メモ'}],kind),/PUBLIC_COPY_REVIEW_REQUIRED/);
});
test('HTML guard ignores script metadata but catches visible split and encoded text',()=>{
 assert.deepEqual(htmlCopyIssues('<script>const reviewedAt=1;</script><style>.reviewedAt{}</style><p>料金は要確認</p>'),[]);
 assert.ok(htmlCopyIssues('<p>内部向けの<b>調査メモ</b></p>').length);
 assert.ok(htmlCopyIssues('<p>本文&#104;ash</p>').length);
});
