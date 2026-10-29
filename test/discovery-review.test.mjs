import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDiscoveryReview,candidateDisposition,matchesPublishedCandidate} from '../scripts/discovery-review.mjs';
import {evidenceHash,prepareReviewItem} from '../scripts/curation-review-contract.mjs';
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
test('configured YYSystem event section admits experience sessions but not service pages or other origins',async()=>{
 const config=JSON.parse(await readFile(new URL('../config/curation-discovery.json',import.meta.url),'utf8'));
 const source=config.sources.find(x=>x.id==='yysystem-events');
 assert.ok(source);assert.equal(new URL(source.url).searchParams.get('category'),'イベント');
 const html='<a href="/information/information-1970-8-2/">AiLENS体験会のご案内</a>'
  +'<a href="/information/information-4689/">世界に字幕を添える展の開催</a>'
  +'<a href="/service/accessibility-support/">イベント向け情報保障サービス</a>'
  +'<a href="/information/information-product/">新製品の価格改定について</a>'
  +'<a href="https://other.example/information/information-1/">手話交流イベントの開催</a>';
 const found=discoverLinks(html,source);
 assert.deepEqual(found.map(x=>new URL(x.url).pathname),['/information/information-1970-8-2/','/information/information-4689/']);
 assert.ok(found.every(x=>x.status==='unverified-candidate'&&!x.publicationApproved&&x.reviewedAt===null));
 assert.equal(discoverLinks(html,{...source,candidatePathPrefixes:[]}).length,0);
 assert.equal(discoverLinks(html,source,[found[0].url]).length,1);
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
test('changed document remains blocked but a known event URL alone does not close a candidate',async t=>{
 const opts=await options(t);let calls=0;
 const r=await runDiscoveryReview({...opts,canSubmit:()=>true,prepare:async targets=>({tasks:[],exceptions:targets.map(x=>({...x,reason:'source-document-changed'}))}),generate:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.entries[0].reasons[0],'source-document-changed');
 const p=await runDiscoveryReview({...opts,knownUrls:[target.sourceUrl],canSubmit:()=>false,generate:async()=>{calls++;}});
 assert.equal(p.selected,1);assert.equal(p.entries[0].reasons[0],'sharing-approval-required');assert.equal(calls,0);
});
test('candidate date is never inferred and negative model output is only a proposal',()=>{
 const base={kind:'cafe',reasons:['missing-startDate','differs-from-current'],decision:{relevance:'yes',contentType:'announcement',facts:[{field:'venue',value:'市民会館'}]}};
 assert.equal(candidateDisposition(base,{now}).disposition,'needs-review');
 const no=candidateDisposition({...base,decision:{...base.decision,relevance:'no'}},{now});assert.equal(no.disposition,'not-relevant-proposed');assert.equal(no.publicationApproved,false);
 const past=candidateDisposition({...base,kind:'event',reasons:['differs-from-current'],decision:{...base.decision,facts:[{field:'startDate',value:'2026-10-01'},{field:'venue',value:'市民会館'}]}},{now});
 assert.equal(past.disposition,'outside-horizon');
});

test('candidate cafe horizon expands to four months without approving or extending other events',()=>{
 const n=Date.parse('2026-10-25T00:00:00Z');
 const entry=day=>({kind:'cafe',reasons:['differs-from-current'],decision:{relevance:'yes',contentType:'announcement',facts:[{field:'startDate',value:day},{field:'venue',value:'市民会館'}]}});
 for(const day of ['2027-01-22','2027-02-25']){
  const r=candidateDisposition(entry(day),{now:n});assert.equal(r.disposition,'publication-review-required');assert.equal(r.publicationApproved,false);assert.equal(r.reviewedAt,null);
 }
 assert.equal(candidateDisposition(entry('2027-02-26'),{now:n}).disposition,'outside-horizon');
 assert.equal(candidateDisposition({...entry('2027-01-22'),kind:'event'},{now:n}).disposition,'outside-horizon');
 assert.equal(candidateDisposition({...entry('2027-01-22'),kind:'event'},{now:n,eventKind:'theater'}).disposition,'publication-review-required');
});
test('old same-day six-week report is reclassified from extraction cache without resending',async t=>{
 const opts=await options(t),futureText=text.replaceAll('2026年11月14日','2027年1月22日');let calls=0;
 const cafe={...target,kind:'cafe',fragments:[futureText],approvedDocumentHash:evidenceHash(futureText)};
 const args={...opts,catalog:{version:1,discoveryTargets:[cafe]},canSubmit:()=>true,
  prepare:async targets=>({tasks:targets.map(t=>({...t,text:futureText,sourceTextHash:evidenceHash(futureText),sourceDocumentHash:evidenceHash(futureText),retrievedAt:new Date(now).toISOString()})),exceptions:[]}),
  generate:async items=>{calls++;const r=await generate(items);for(const x of r.items){x.facts[0].value='2027-01-22';x.facts[0].evidence='開催日 2027年1月22日。';}return r;}};
 const first=await runDiscoveryReview(args);assert.equal(calls,1);
 first.signature=evidenceHash(JSON.stringify({version:1,targets:[cafe],known:[],approvalSignature:'none'}));
 first.entries[0].disposition='outside-horizon';
 await writeFile(join(opts.stateDir,'discovery-review.json'),JSON.stringify(first));
 const after=await runDiscoveryReview(args);assert.equal(after.reusedRun,false);assert.equal(after.cached,1);assert.equal(after.submittedThisRun,0);assert.equal(calls,1);
 assert.equal(after.entries[0].disposition,'publication-review-required');assert.equal(after.entries[0].reviewedAt,null);
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


test('published receipt closes exact occurrence without fetching or resending; changed date, time, venue and input stay pending',async t=>{
 const opts=await options(t);
 const receipt={inputId:prepareReviewItem({...target,text}).id,startDate:'2026-11-14',endDate:null,venue:'市民会館',time:'14:00'};
 const bound={...target,publishedIdentity:receipt};
 const published={kind:target.kind,recordId:target.recordId,publication:'public',sourceUrl:target.sourceUrl,occurrence:receipt};
 const r=await runDiscoveryReview({...opts,catalog:{discoveryTargets:[bound]},publishedRecords:[published],prepare:async()=>{throw Error('already published: no fetch');},generate:async()=>{throw Error('no resend');}});
 assert.equal(r.entries[0].status,'already-published');assert.equal(r.selected,0);assert.equal(r.submittedThisRun,0);assert.equal(r.reviewedAt,null);
 for(const patch of [{startDate:'2026-11-15'},{venue:'別の会館'},{time:'15:00'}])assert.equal(matchesPublishedCandidate(bound,{...published,occurrence:{...receipt,...patch}}),false);
 assert.equal(matchesPublishedCandidate({...bound,fragments:[text+' Changed.']},published),false);
 assert.equal(matchesPublishedCandidate({...bound,recordId:'next-occurrence'},published),false);
 assert.equal(matchesPublishedCandidate(bound,{...published,publication:'private'}),false);
});
