import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDiscoveryReview,candidateDisposition} from '../scripts/discovery-review.mjs';
import {evidenceHash} from '../scripts/curation-review-contract.mjs';
import {discoverLinks} from '../scripts/source-discovery.mjs';
import {prepareCurationReview} from '../scripts/prepare-curation-review.mjs';
const now=Date.parse('2026-10-22T01:00:00Z');
const text='手話交流会を開催します。開催日 2026年11月14日。会場 市民会館。';
const target={kind:'event',recordId:'candidate-1',title:'地域の交流企画',sourceUrl:'https://example.org/events/1',officialVerified:true,sourceMode:'html',
  sharingReviewedAt:'2026-10-22T00:00:00Z',approvedDocumentHash:evidenceHash(text),fragments:[text]};
const prepare=async targets=>({tasks:targets.map(t=>({...t,text,sourceTextHash:evidenceHash(text),sourceDocumentHash:evidenceHash(text),retrievedAt:new Date(now).toISOString()})),exceptions:[]});
const generate=async items=>({model:'gpt-6.1-sol',items:items.map(item=>({id:item.id,relevance:'yes',contentType:'announcement',evidence:'手話交流会を開催します。',facts:[
  {field:'startDate',value:'2026-11-14',evidence:'開催日 2026年11月14日。'},{field:'venue',value:'市民会館',evidence:'会場 市民会館。'}]}))});
async function options(t){const stateDir=await mkdtemp(join(tmpdir(),'dn-candidates-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));return {stateDir,now,catalog:{version:1,discoveryTargets:[target]},prepare,generate};}

test('specialist section admits general activity titles without treating other domains as specialists',()=>{
 const html='<a href="/event/2026/welcome">10月例会 新入会員説明会＆歓迎会</a><a href="/shop/ad">一般商品の企画と販売について</a>';
 assert.equal(discoverLinks(html,{id:'x',url:'https://example.org/'}).length,0);
 const found=discoverLinks(html,{id:'x',url:'https://example.org/',topicScope:'hearing-specialist',candidatePathPrefixes:['/event/']});
 assert.equal(found.length,1);assert.equal(found[0].publicationApproved,false);assert.equal(found[0].reviewedAt,null);
});
test('commented obsolete application notices and links are never evidence or candidates',async()=>{
 const html='<p>手話交流会 2026年11月14日 市民会館 申込受付中</p><!--strong>※募集は終了しました。</strong--><!-- <a href="/event/old">手話交流イベントの募集</a> -->';
 const fetchResource=async()=>({status:200,headers:{'content-type':'text/html'},text:html});
 const invalid=await prepareCurationReview([{...target,approvedDocumentHash:undefined,fragments:['※募集は終了しました。']}],{now,fetchResource});
 assert.equal(invalid.tasks.length,0);assert.equal(invalid.exceptions[0].reason,'source-fragment-changed');
 const valid=await prepareCurationReview([{...target,approvedDocumentHash:undefined,fragments:['手話交流会 2026年11月14日 市民会館 申込受付中']}],{now,fetchResource});
 assert.equal(valid.tasks.length,1);assert.ok(!valid.tasks[0].text.includes('終了'));
 assert.equal(discoverLinks(html,{id:'x',url:'https://example.org/'}).length,0);
});
test('unapproved and unreviewed candidates never invoke API',async t=>{
 const opts=await options(t);let calls=0;
 const r=await runDiscoveryReview({...opts,generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.entries[0].reasons[0],'sharing-approval-required');
 const r2=await runDiscoveryReview({...opts,catalog:{discoveryTargets:[{...target,sharingReviewedAt:null}]},canSubmit:()=>true,generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r2.selected,0);
});
test('approved extraction is cached and requires publication review, never creates a verified event',async t=>{
 const opts=await options(t);let calls=0;const input=JSON.stringify(opts.catalog);
 const args={...opts,canSubmit:()=>true,generate:async items=>{calls++;return generate(items);}};
 const first=await runDiscoveryReview(args);assert.equal(first.submittedThisRun,1);assert.equal(calls,1);
 assert.equal(first.entries[0].disposition,'publication-review-required');assert.equal(first.entries[0].publicationApproved,false);assert.equal(first.entries[0].reviewedAt,null);
 assert.equal(JSON.stringify(opts.catalog),input);
 assert.equal((await runDiscoveryReview(args)).reusedRun,true);assert.equal(calls,1);
 const next=await runDiscoveryReview({...args,approvalSignature:'next-check'});assert.equal(next.cached,1);assert.equal(next.submittedThisRun,0);assert.equal(calls,1);assert.deepEqual(next.newOrChanged,[]);
});
test('changed document and already published URL cannot reuse candidate approval',async t=>{
 const opts=await options(t);let calls=0;
 const r=await runDiscoveryReview({...opts,canSubmit:()=>true,prepare:async targets=>({tasks:[],exceptions:targets.map(x=>({...x,reason:'source-document-changed'}))}),generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.entries[0].reasons[0],'source-document-changed');
 const p=await runDiscoveryReview({...opts,knownUrls:[target.sourceUrl],canSubmit:()=>true,generate:async()=>{calls++;}});
 assert.equal(p.selected,0);assert.equal(p.entries[0].disposition,'published-source');assert.equal(calls,0);
});
test('candidate date is never inferred and negative model output is only a proposal',()=>{
 const base={kind:'cafe',reasons:['missing-startDate','differs-from-current'],decision:{relevance:'yes',contentType:'announcement',facts:[{field:'venue',value:'市民会館'}]}};
 assert.equal(candidateDisposition(base,{now}).disposition,'needs-review');
 const no=candidateDisposition({...base,decision:{...base.decision,relevance:'no'}},{now});assert.equal(no.disposition,'not-relevant-proposed');assert.equal(no.publicationApproved,false);
 const past=candidateDisposition({...base,kind:'event',reasons:['differs-from-current'],decision:{...base.decision,facts:[{field:'startDate',value:'2026-10-01'},{field:'venue',value:'市民会館'}]}},{now});
 assert.equal(past.disposition,'outside-horizon');
});
test('bounded domain-fair selection stops after unknown API outcome and preserves deferred entries',async t=>{
 const opts=await options(t);let calls=0;const batches=[];
 const catalog={discoveryTargets:Array.from({length:10},(_,i)=>({...target,recordId:'candidate-'+i,sourceUrl:'https://'+(i===9?'other':'example')+'.org/event/'+i}))};
 const r=await runDiscoveryReview({...opts,catalog,canSubmit:()=>true,prepare:async targets=>{batches.push(targets);return prepare(targets);},generate:async()=>{calls++;throw new Error('unknown');}});
 assert.equal(calls,1);assert.equal(r.selected,8);assert.equal(r.deferred.length,2);assert.equal(batches[0][1].sourceUrl,'https://other.org/event/9');assert.equal(r.submittedThisRun,null);
 assert.equal(r.entries.filter(x=>x.reasons.includes('batch-stopped-after-api-error')).length,4);
 assert.equal(JSON.parse(await readFile(join(opts.stateDir,'discovery-review.json'))).publicationApproved,false);
 const stopped=await runDiscoveryReview({...opts,catalog,stopAfterError:true,canSubmit:()=>true,generate:async()=>{calls++;}});assert.equal(calls,1);assert.equal(stopped.submittedThisRun,0);
});
