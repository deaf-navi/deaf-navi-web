import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {planDailyReview,runDailyReview,reviewRecords} from '../scripts/daily-curation-review.mjs';
import {prepareReviewItem,evidenceHash} from '../scripts/curation-review-contract.mjs';
const now=Date.parse('2026-10-18T12:00:00Z');
const text='手話交流会を開催します。開催日 2026年11月14日。会場 市民会館。';
const target={kind:'event',recordId:'fixture-event',title:'手話交流会',sourceUrl:'https://example.org/event',sourceMode:'html',officialVerified:true,sharingReviewedAt:new Date(now-60000).toISOString(),approvedDocumentHash:'a'.repeat(64),fragments:[text]};
const record={kind:'event',recordId:'fixture-event',title:target.title,sourceUrl:target.sourceUrl,sourceMode:'html',publication:'public',verification:'verified',verifiedAt:new Date(now-60000).toISOString(),baseline:{startDate:'2026-11-14',venue:'市民会館'}};
const catalog={version:1,targets:[target]};
test('publication comparison retains an explicitly published same-day end date without inventing missing dates',()=>{
 const event={id:'fixture-event',title:'手話交流会',startDate:'2026-11-14',endDate:'2026-11-14',venue:'市民会館'};
 const [record]=reviewRecords({events:[event]},{ready:true,records:[]});assert.equal(record.baseline.endDate,'2026-11-14');
 const [missing]=reviewRecords({events:[{...event,endDate:null}]},{ready:true,records:[]});assert.equal(missing.baseline.endDate,undefined);
});
test('CLI enters its guarded configuration check through the deployed directory link',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'dn-daily-entry-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const link=join(folder,'curation-batch');
 await symlink(dirname(dirname(fileURLToPath(import.meta.url))),link,process.platform==='win32'?'junction':'dir');
 const env={...process.env};delete env.DEAFNAVI_AI_STATE_DIR;
 const result=spawnSync(process.execPath,[join(link,'scripts','daily-curation-review.mjs')],{env,encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/DAILY_CURATION_REVIEW_UNAVAILABLE/);assert.equal(result.stdout,'');
});
const prepare=async targets=>({tasks:targets.map(t=>({...t,text:t.fragments.join(' '),sourceTextHash:evidenceHash(t.fragments.join(' ')),retrievedAt:new Date(now).toISOString()})),exceptions:[]});
const generate=async items=>({model:'gpt-6.1-sol',items:items.map(item=>({id:item.id,relevance:'yes',contentType:'announcement',evidence:'手話交流会を開催します。',facts:[{field:'startDate',value:'2026-11-14',evidence:'開催日 2026年11月14日。'},{field:'venue',value:'市民会館',evidence:'会場 市民会館。'}]}))});
test('planner holds visual, stale, revision-changed and unregistered evidence without sending it',()=>{
 for(const changed of [{sourceMode:'visual'},{verifiedAt:new Date(now-48*3600000).toISOString()},{sourceUrl:'https://example.org/changed'},{verification:'needs_review'},{kind:'cafe',revision:2,sourceRecordRevision:1}]){
   const p=planDailyReview([{...record,...changed}],catalog,{now});assert.equal(p.targets.length,0);assert.equal(p.exceptions.length,1);assert.equal(p.exceptions[0].reviewedAt,null);
 }
 const p=planDailyReview([record],catalog,{now});assert.equal(p.targets.length,1);assert.deepEqual(p.targets[0].baseline,record.baseline);
 assert.throws(()=>planDailyReview([record],{version:1,targets:[target,target]},{now}));
});
test('planner respects public-only, 6 weeks/6 months and shares the bound between services',()=>{
 const records=Array.from({length:10},(_,i)=>({...record,kind:i===9?'cafe':'event',recordId:'fixture-'+i,...(i===9?{revision:1,sourceRecordRevision:1}:{})}));
 const c={version:1,targets:records.map(r=>({...target,kind:r.kind,recordId:r.recordId}))};
 const p=planDailyReview(records,c,{now,limit:8});assert.equal(p.targets.length,8);assert.equal(p.targets[1].kind,'cafe');assert.equal(p.deferred.length,2);
 assert.equal(planDailyReview([{...record,publication:'draft'}],catalog,{now}).targets.length,0);
 for(const [eventKind,count] of [['exchange',0],['theater',1]])assert.equal(planDailyReview([{...record,eventKind,baseline:{...record.baseline,startDate:'2027-03-01'}}],catalog,{now}).targets.length,count);
});
test('registered sources beyond eight use bounded batches and stop after uncertain API results',async t=>{
 const records=Array.from({length:12},(_,i)=>({...record,recordId:'fixture-'+i,sourceUrl:record.sourceUrl+'/'+i}));
 const catalog={version:1,targets:records.map(r=>({...target,recordId:r.recordId,sourceUrl:r.sourceUrl}))};
 const stateDir=await mkdtemp(join(tmpdir(),'dn-daily-batches-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));
 const batches=[];let sharedCache;
 const options={records,catalog,stateDir,now,canSubmit:()=>true,prepare:async(targets,opts)=>{assert.ok(targets.length<=4);if(sharedCache)assert.equal(sharedCache,opts.sourceCache);sharedCache=opts.sourceCache;return prepare(targets);},generate:async items=>{batches.push(items.length);return generate(items);}};
 const first=await runDailyReview(options);assert.equal(first.selected,12);assert.equal(first.corroborated,12);assert.deepEqual(batches,[4,4,4]);
 assert.equal((await runDailyReview(options)).reusedRun,true);assert.equal(batches.length,3);
 const failedDir=await mkdtemp(join(tmpdir(),'dn-daily-failure-'));t.after(()=>rm(failedDir,{recursive:true,force:true}));let calls=0;sharedCache=null;
 const stopped=await runDailyReview({...options,stateDir:failedDir,generate:async()=>{calls++;throw new Error('unknown');}});
 assert.equal(calls,1);assert.equal(stopped.submittedThisRun,null);assert.equal(stopped.exceptions,12);
 assert.equal(stopped.entries.filter(x=>x.reasons.includes('batch-stopped-after-api-error')).length,8);
});
test('daily repetition does not refetch or submit, but changed baselines are compared against cached extraction',async t=>{
 const stateDir=await mkdtemp(join(tmpdir(),'dn-daily-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));let fetches=0,calls=0;
 const options={records:[record],catalog,stateDir,now,canSubmit:()=>true,prepare:async t=>{fetches++;return prepare(t);},generate:async items=>{calls++;return generate(items);}};
 const first=await runDailyReview(options);assert.equal(first.corroborated,1);assert.equal(first.submittedThisRun,1);assert.equal(first.publicationApproved,false);
 const same=await runDailyReview(options);assert.equal(same.reusedRun,true);assert.equal(same.submittedThisRun,0);assert.equal(fetches,1);assert.equal(calls,1);
 const changed=await runDailyReview({...options,records:[{...record,baseline:{...record.baseline,startDate:'2026-11-15'}}]});
 assert.equal(changed.cached,1);assert.equal(changed.exceptions,1);assert.equal(calls,1);assert.deepEqual(changed.entries[0].differences,['startDate']);
});
test('unapproved text and unavailable API become exceptions without fictional usage or review renewal',async t=>{
 const stateDir=await mkdtemp(join(tmpdir(),'dn-daily-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));let calls=0;
 const options={records:[record],catalog,stateDir,now,prepare,generate:async()=>{calls++;throw new Error('Provider result unknown');}};
 const held=await runDailyReview(options);assert.equal(held.entries[0].reasons[0],'sharing-approval-required');assert.equal(calls,0);
 const uncertain=await runDailyReview({...options,approvalSignature:'approved',canSubmit:()=>true});assert.equal(calls,1);assert.equal(uncertain.submittedThisRun,null);assert.equal(uncertain.entries[0].reviewedAt,null);
 assert.equal((await runDailyReview({...options,approvalSignature:'approved',canSubmit:()=>true})).reusedRun,true);assert.equal(calls,1);
 assert.equal(JSON.parse(await readFile(join(stateDir,'daily-curation-review.json'))).publicationApproved,false);
 await assert.rejects(runDailyReview({...options,force:true}),/research/);
});
test('same-day reuse cannot retain a match after the source reaches its 48-hour expiry',async t=>{
 const stateDir=await mkdtemp(join(tmpdir(),'dn-daily-expiry-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));
 let calls=0,fetches=0;
 const options={records:[{...record,verifiedAt:new Date(now-47*3600000).toISOString()}],catalog,stateDir,now,canSubmit:()=>true,
   prepare:async t=>{fetches++;return prepare(t);},generate:async items=>{calls++;return generate(items);}};
 assert.equal((await runDailyReview(options)).corroborated,1);
 const expired=await runDailyReview({...options,now:now+2*3600000});
 assert.equal(expired.reusedRun,false);assert.equal(expired.corroborated,0);assert.equal(expired.submittedThisRun,0);
 assert.deepEqual(expired.entries[0].reasons,['publication-review-required']);assert.equal(expired.reviewedAt,null);
 assert.equal(calls,1);assert.equal(fetches,1);
});
test('preparation changes become exceptions before the API and do not write published inputs',async t=>{
 const stateDir=await mkdtemp(join(tmpdir(),'dn-daily-'));t.after(()=>rm(stateDir,{recursive:true,force:true}));const before=JSON.stringify(record);
 const result=await runDailyReview({records:[record],catalog,stateDir,now,prepare:async()=>({tasks:[],exceptions:[{kind:'event',recordId:record.recordId,reason:'source-document-changed'}]}),generate:()=>{throw new Error('must not call');}});
 assert.equal(result.exceptions,1);assert.equal(result.submittedThisRun,0);assert.equal(JSON.stringify(record),before);
 assert.throws(()=>reviewRecords({events:[]},{ready:false,records:[]}));
});
