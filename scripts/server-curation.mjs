import {runOverseasCafeReview} from './overseas-cafe-review.mjs';
import {collectOverseasCafeThumbnails} from './overseas-cafe-thumbnails.mjs';
import {reviewEventTips} from './event-tip-review.mjs';
import {readFile,writeFile,rename,open,unlink,mkdir} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {reviewRecords,runDailyReview} from './daily-curation-review.mjs';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {prepareReviewItem,evidenceHash} from './curation-review-contract.mjs';
import {createComplimentaryClient,publicTextFingerprint,validateStoredAllowance,summarizeComplimentaryUsage} from './complimentary-text-client.mjs';
import {runSourceDiscovery} from './source-discovery.mjs';
import {runDiscoveryReview} from './discovery-review.mjs';
import {runLodgingReview} from './lodging-review.mjs';
import {planCurationAttention} from './curation-attention.mjs';
import {refreshWorkStatus} from './curation-work-status.mjs';

export const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
export async function optionalJson(path){try{return await readJson(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function privateJson(path,value){const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,path);}
export async function refreshCurationAttention({stateDir,records,now=Date.now()}){
  const path=join(stateDir,'curation-attention.json');
  const queue=planCurationAttention(records,await optionalJson(path),now);
  await privateJson(path,queue);
  return queue;
}

// Inspect a recorded account check; never manufacture one from local usage or renew it.
export async function accountGate({stateDir,key,project,now=Date.now()}){
  let lease;
  try{lease=await readJson(join(stateDir,'allowance.json'));await validateStoredAllowance(lease,{key,project,now,stateDir});}
  catch{return {ready:false,reason:'account-verification-required',automaticAccountVerification:false};}
  for(const name of ['inflight.json','request.lock']){
    try{await readFile(join(stateDir,name));return {ready:false,reason:'request-reconciliation-required',automaticAccountVerification:false};}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const day=new Date(now).toISOString().slice(0,10);
  const ledger=await optionalJson(join(stateDir,'usage-'+day+'.json'));
  let usage=null;
  if(ledger){try{usage=summarizeComplimentaryUsage(ledger,{day,project});}catch{return {ready:false,reason:'usage-reconciliation-required',automaticAccountVerification:false};}}
  if(usage?.unresolved)return {ready:false,reason:'request-reconciliation-required',automaticAccountVerification:false};
  return {ready:true,reason:null,automaticAccountVerification:false,checkedAt:lease.checkedAt,expiresAt:lease.expiresAt,
    settingsCheckedAt:lease.accountReview?.checkedAt??null,nextSettingsReviewAt:lease.accountReview?.expiresAt??null,
    utcDay:day,dailyBudget:lease.dailyBudget,usage,approvalSignature:evidenceHash(JSON.stringify([lease.checkedAt,lease.expiresAt,lease.accountReview,lease.approvedTextHashes]))};
}

// Reuse only an actually reviewed exact title/excerpt on an unchanged fetched page.
// Preserve the original sharingReviewedAt; this is NOT a new human review.
export async function reuseReviewedText(tasks,targets,{stateDir,key,project,now=Date.now()}){
  const byId=new Map(targets.map(t=>[t.kind+':'+t.recordId,t]));
  const verified=[];
  for(const task of tasks){
    const target=byId.get(task.kind+':'+task.recordId),reviewed=Date.parse(target?.sharingReviewedAt);
    if(!target||target.officialVerified!==true||target.sourceMode!=='html'||task.sourceMode!=='html'
      ||!Number.isFinite(reviewed)||reviewed>now||!Number.isFinite(Date.parse(task.retrievedAt))
      ||Date.parse(task.retrievedAt)>now||now-Date.parse(task.retrievedAt)>5*60_000
      ||!/^[a-f0-9]{64}$/.test(target.approvedDocumentHash??'')||target.approvedDocumentHash!==task.sourceDocumentHash
      ||target.sourceUrl!==task.sourceUrl)continue;
    const original=prepareReviewItem({...target,text:target.fragments.join(' ')}),item=prepareReviewItem(task);
    if(JSON.stringify(original)!==JSON.stringify(item))continue;
    verified.push({hash:publicTextFingerprint(item),kind:task.kind,recordId:task.recordId,
      documentHash:task.sourceDocumentHash,sharingReviewedAt:target.sharingReviewedAt});
  }
  if(!verified.length)return new Set();
  const lockPath=join(stateDir,'request.lock');let lock;
  try{lock=await open(lockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST')return new Set();throw e;}
  try{
    const path=join(stateDir,'allowance.json'),lease=await readJson(path);await validateStoredAllowance(lease,{key,project,now,stateDir});
    if(await optionalJson(join(stateDir,'inflight.json')))return new Set();
    const allowed=new Set(lease.approvedTextHashes??[]),added=verified.filter(x=>!allowed.has(x.hash));
    if(added.length){
      for(const item of added)allowed.add(item.hash);
      lease.approvedTextHashes=[...allowed];
      lease.reusedSharingReviews=[...(lease.reusedSharingReviews??[]),...added];
      // checkedAt, eligibility, expiresAt, budget and source review times are untouched.
      await privateJson(path,lease);
    }
    return new Set(verified.map(x=>x.hash));
  }finally{await lock.close();await unlink(lockPath);}
}

export function updateExceptionQueue(previous,entries,now){
  const stamp=new Date(now).toISOString(),old=new Map((previous?.items??[]).map(x=>[x.key,x]));
  const items=entries.map(entry=>{
    const key=entry.kind+':'+entry.recordId;
    const fingerprint=evidenceHash(JSON.stringify([entry.reasons,entry.differences??[],entry.sourceUrl??null]));
    const prior=old.get(key);old.delete(key);
    return {key,kind:entry.kind,recordId:entry.recordId,sourceUrl:entry.sourceUrl??null,reasons:entry.reasons,
      differences:entry.differences??[],fingerprint,firstSeenAt:prior?.firstSeenAt??stamp,
      changedAt:prior?.fingerprint===fingerprint?prior.changedAt:stamp,lastSeenAt:stamp};
  });
  return {version:1,generatedAt:stamp,items,newOrChanged:items.filter(x=>x.changedAt===stamp).map(x=>x.key),
    resolved:[...(previous?.resolved??[]),...[...old.values()].map(x=>({...x,resolvedAt:stamp}))].slice(-500)};
}

export async function runServerCuration({stateDir,key,project,records,catalog,discoverySources=[],lodgingSources=[],lodgingSnapshot={version:1,records:[]},now=Date.now(),
  overseasSnapshot={version:1,records:[]},overseasSources=[],comparisonOnly=false,generate,prepare=prepareCurationReview,discover=runSourceDiscovery,collectThumbnails=collectOverseasCafeThumbnails,eventTips=null}){
  // The outer lock serializes timer, allowance-change and operator execution.
  const lockPath=join(stateDir,'server-curation.lock');let lock;
  try{lock=await open(lockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST')return {status:'busy',submittedThisRun:0};throw e;}
  try{
    const attention=await refreshCurationAttention({stateDir,records,now});
    const gate=await accountGate({stateDir,key,project,now});
    let allowed=new Set();
    if(gate.ready){const lease=await readJson(join(stateDir,'allowance.json'));allowed=new Set(lease.approvedTextHashes??[]);}
    const wrappedPrepare=async(targets,options)=>{
      const result=await prepare(targets,options);
      if(gate.ready&&!comparisonOnly){
        const reused=await reuseReviewedText(result.tasks,targets,{stateDir,key,project,now});
        for(const hash of reused)allowed.add(hash);
      }
      return result;
    };
    const before=await optionalJson(join(stateDir,'daily-curation-review.json'));
    const report=await runDailyReview({records,catalog,stateDir,now,prepare:wrappedPrepare,
      generate:generate??createComplimentaryClient({key,project,stateDir}),
      canSubmit:item=>!comparisonOnly&&gate.ready&&allowed.has(publicTextFingerprint(item)),
      approvalSignature:evidenceHash(JSON.stringify([comparisonOnly?'comparison':'server-v1',gate.approvalSignature??gate.reason]))});
    const beforeEntries=new Map((before?.entries??[]).map(x=>[x.kind+':'+x.recordId,x]));
    const comparison={previousGeneratedAt:before?.generatedAt??null,previousSelected:before?.selected??null,
      currentSelected:report.selected,matched:0,changed:[],added:[],removed:[]};
    for(const entry of report.entries){const id=entry.kind+':'+entry.recordId,prior=beforeEntries.get(id);beforeEntries.delete(id);
      if(!prior)comparison.added.push(id);
      else if(JSON.stringify([entry.status,entry.reasons,entry.differences])===JSON.stringify([prior.status,prior.reasons,prior.differences]))comparison.matched++;
      else comparison.changed.push({id,before:prior.status,after:entry.status,reasons:entry.reasons});}
    comparison.removed=[...beforeEntries.keys()];
    const queuePath=join(stateDir,'curation-exceptions.json');
    const previousQueue=await optionalJson(queuePath)??(before?.generatedAt
      ?updateExceptionQueue(null,(before.entries??[]).filter(x=>x.status==='exception'),Date.parse(before.generatedAt)):null);
    const queue=updateExceptionQueue(previousQueue,report.entries.filter(x=>x.status==='exception'),now);
    await privateJson(queuePath,queue);
    const discovery=await discover({stateDir,sources:discoverySources,knownUrls:records.map(x=>x.sourceUrl),now});
    const lodgingDiscovery=await discover({stateDir,sources:lodgingSources,knownUrls:lodgingSnapshot.records.flatMap(r=>[...r.sourceUrls,...(r.referenceUrls??[])]),now,weeklyLodging:true});
    const candidateReview=await runDiscoveryReview({stateDir,catalog,knownUrls:records.map(x=>x.sourceUrl),publishedRecords:records,now,prepare:wrappedPrepare,
      generate:generate??createComplimentaryClient({key,project,stateDir}),
      canSubmit:item=>!comparisonOnly&&gate.ready&&report.submittedThisRun!==null&&allowed.has(publicTextFingerprint(item)),
      stopAfterError:report.submittedThisRun===null,
      approvalSignature:evidenceHash(JSON.stringify([comparisonOnly?'comparison':'server-v1',gate.approvalSignature??gate.reason]))});
    const lodging=await runLodgingReview({stateDir,snapshot:lodgingSnapshot,catalog,now,prepare:wrappedPrepare,
      generate:generate??createComplimentaryClient({key,project,stateDir}),
      canSubmit:item=>!comparisonOnly&&gate.ready&&report.submittedThisRun!==null&&candidateReview.submittedThisRun!==null&&allowed.has(publicTextFingerprint(item)),
      stopAfterError:report.submittedThisRun===null||candidateReview.submittedThisRun===null,
      approvalSignature:evidenceHash(JSON.stringify([comparisonOnly?'comparison':'server-v1',gate.approvalSignature??gate.reason]))});
    const overseasDiscovery=await discover({stateDir,sources:overseasSources,knownUrls:overseasSnapshot.records.flatMap(r=>r.sourceUrls),now,weeklyOverseas:true});
    const overseas=await runOverseasCafeReview({stateDir,snapshot:overseasSnapshot,catalog,now,prepare:wrappedPrepare,
      generate:generate??createComplimentaryClient({key,project,stateDir}),
      canSubmit:item=>!comparisonOnly&&gate.ready&&![report,candidateReview,lodging].some(r=>r.submittedThisRun===null)&&allowed.has(publicTextFingerprint(item)),
      stopAfterError:[report,candidateReview,lodging].some(r=>r.submittedThisRun===null),
      approvalSignature:evidenceHash(JSON.stringify([comparisonOnly?'comparison':'server-v1',gate.approvalSignature??gate.reason]))});
    // Independent bounded metadata lookup; not shared with any AI service.
    let overseasThumbnails=null;
    if(!comparisonOnly){
      try{overseasThumbnails=await collectThumbnails({snapshot:overseasSnapshot,stateDir,now});}
      catch{overseasThumbnails={status:'metadata-check-failed',selected:null,fetched:null,cached:null,deferred:null,candidates:null,newOrChanged:[],pendingReview:[]};}
    }
    let eventTipReport=null;
    if(eventTips&&!comparisonOnly){
      eventTipReport=await reviewEventTips({queue:eventTips.queue,stateDir,now:Date.now(),gateReady:gate.ready,
        stopAfterError:[report,candidateReview,lodging,overseas].some(r=>r.submittedThisRun===null),
        generate:generate??createComplimentaryClient({key,project,stateDir}),publish:eventTips.publish,
        prepareSharing:async(tasks,targets)=>{
          const hashes=await reuseReviewedText(tasks,targets,{stateDir,key,project,now:Date.now()});
          return item=>hashes.has(publicTextFingerprint(item));
        }});
      await privateJson(join(stateDir,'event-tip-review.json'),eventTipReport);
    }
    const submittedThisRun=[report,candidateReview,lodging,overseas,...(eventTipReport?[eventTipReport]:[])].some(r=>r.submittedThisRun===null)?null:report.submittedThisRun+candidateReview.submittedThisRun+lodging.submittedThisRun+overseas.submittedThisRun+(eventTipReport?.submittedThisRun??0);
    const result={version:1,generatedAt:new Date(now).toISOString(),status:submittedThisRun===null?'needs-attention':gate.ready?'completed':'account-check-required',
      mode:comparisonOnly?'comparison':'routine',account:gate,selected:report.selected,cached:report.cached,
      corroborated:report.corroborated,reviewedUnchanged:report.reviewedUnchanged,exceptions:report.exceptions,
      submittedThisRun,reusedRun:report.reusedRun,comparison,
      overseasThumbnails:overseasThumbnails?{status:overseasThumbnails.status??'checked',selected:overseasThumbnails.selected,fetched:overseasThumbnails.fetched,cached:overseasThumbnails.cached,deferred:overseasThumbnails.deferred,candidates:overseasThumbnails.candidates,newOrChanged:overseasThumbnails.newOrChanged,pendingReview:overseasThumbnails.pendingReview,apiRequests:0}:null,
      overseasDiscovery,overseas:{selected:overseas.selected,cached:overseas.cached,submittedThisRun:overseas.submittedThisRun,
        corroborated:overseas.corroborated,exceptions:overseas.exceptions,candidates:overseas.candidates,deferred:overseas.deferred.length,newOrChanged:overseas.newOrChanged,coverage:overseas.coverage,capacity:overseas.capacity??null},
      eventTips:eventTipReport,newOrChangedExceptions:queue.newOrChanged,attention:attention.counts,discovery,lodgingDiscovery,
      candidateReview:{selected:candidateReview.selected,cached:candidateReview.cached,submittedThisRun:candidateReview.submittedThisRun,
        reusedRun:candidateReview.reusedRun,deferred:candidateReview.deferred.length,newOrChanged:candidateReview.newOrChanged,
        dispositions:candidateReview.entries.reduce((counts,x)=>{const k=x.disposition??'needs-review';counts[k]=(counts[k]??0)+1;return counts;},{})},
      lodging:{selected:lodging.selected,cached:lodging.cached,submittedThisRun:lodging.submittedThisRun,
        corroborated:lodging.corroborated,evidenceReviewed:lodging.evidenceReviewed,exceptions:lodging.exceptions,candidates:lodging.candidates,
        deferred:lodging.deferred.length,newOrChanged:lodging.newOrChanged,reusedRun:lodging.reusedRun},
      publication:{changed:eventTipReport?.published??0,policy:'existing-verified-source-publishers-and-reviewed-user-tips',manualReviewTimestampsChanged:false}};
    if(!comparisonOnly){
      const work=await refreshWorkStatus({stateDir,now:Date.now(),executionStatus:result.status,attention});
      result.work={coverageStatus:work.coverageStatus,pending:work.pending,categoryCounts:work.categoryCounts,
        unknownModules:work.unknownModules,oldestPendingAt:work.oldestPendingAt,intake:work.intake,progress:work.progress,detailFile:'curation-work-status.json'};
    }
    await privateJson(join(stateDir,comparisonOnly?'server-curation-comparison.json':'server-curation.json'),result);
    await mkdir(join(stateDir,'server-curation-runs'),{recursive:true,mode:0o700});
    await privateJson(join(stateDir,'server-curation-runs',new Date(now).toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json'),result);
    return result;
  }finally{await lock.close();await unlink(lockPath);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(resolve(process.argv[1]))).href){
  try{
    const args=process.argv.slice(2);
    if(args.length>1||args.some(x=>!['--compare','--attention-only','--status-only'].includes(x)))throw new Error('Unsupported routine argument');
    const stateDir=process.env.DEAFNAVI_AI_STATE_DIR;
    if(!stateDir)throw new Error('Private state required');
    const events=await readJson('/srv/deafnavi/current/events.json');
    const cafes=JSON.parse(execFileSync('php',['/srv/deafnavi/current/_backend/curate-cafe-events.php','--review-export'],{encoding:'utf8',timeout:60000,maxBuffer:2_000_000}));
    if(args.includes('--attention-only')||args.includes('--status-only')){
      // No key/env loading, HTTP, API, source checks or publication mutation.
      const lockPath=join(stateDir,'server-curation.lock');let lock;
      try{lock=await open(lockPath,'wx',0o600);}catch(e){if(e.code!=='EEXIST')throw e;}
      if(!lock){console.log(JSON.stringify({status:'busy',submittedThisRun:0}));}
      else try{
        const queue=await refreshCurationAttention({stateDir,records:reviewRecords(events,cafes)});
        const work=args.includes('--status-only')?await refreshWorkStatus({stateDir,attention:queue,
          executionStatus:(await optionalJson(join(stateDir,'server-curation.json')))?.status??null}):null;
        console.log(JSON.stringify({status:work?'status-refreshed':'attention-refreshed',generatedAt:queue.generatedAt,...queue.counts,submittedThisRun:0,
          ...(work?{coverageStatus:work.coverageStatus,pending:work.pending,categoryCounts:work.categoryCounts,unknownModules:work.unknownModules,
          briefFile:'curation-operator-brief.json'}:{})}));
      }finally{await lock.close();await unlink(lockPath);}
    }else{
    const catalog=await readJson(join(stateDir,'curation-review-catalog.json'));
    const sources=await readJson(new URL('../config/curation-discovery.json',import.meta.url));
    const lodgingSnapshot=await readJson('/srv/deafnavi/current/guesthouses.json');
    const lodgingSources=await readJson(new URL('../config/lodging-discovery.json',import.meta.url));
    const overseasSnapshot=JSON.parse(execFileSync('php',['/srv/deafnavi/current/_backend/overseas-cafe-review-export.php'],{encoding:'utf8',timeout:30000,maxBuffer:2_000_000}));
    const overseasSources=await readJson(new URL('../config/overseas-cafe-discovery.json',import.meta.url));
    const tipQueue=JSON.parse(execFileSync('php',['/srv/deafnavi/current/_backend/event-tip-queue.php','--export'],{encoding:'utf8',timeout:30000,maxBuffer:2_000_000}));
    const publishTip=async decision=>{
      const run=(mode,input)=>JSON.parse(execFileSync('/usr/sbin/runuser',['-u','deafnavi-runtime','--','/usr/bin/php','/srv/deafnavi/current/_backend/event-tip-queue.php',mode],{input:JSON.stringify(input),encoding:'utf8',timeout:60000,maxBuffer:100000,stdio:['pipe','pipe','pipe']}));
      try{const plan=run('--dry-run',decision);return run('--apply',{...decision,planSha256:plan.planSha256});}
      catch(error){
        // A dry-run validation conflict is safe to route to the administrator.
        // If apply committed, its approved state rejects this pending update.
        const fallback={id:decision.id,revision:decision.revision,payloadHash:decision.payloadHash,status:'exception',reason:'掲載前の重複・更新競合・整合性チェックで停止しました。管理画面で確認してください。'};
        return run('--apply',fallback);
      }
    };
    const result=await runServerCuration({stateDir,eventTips:{queue:tipQueue,publish:publishTip},records:reviewRecords(events,cafes),catalog,discoverySources:sources.sources,lodgingSources:lodgingSources.sources,lodgingSnapshot,overseasSnapshot,overseasSources:overseasSources.sources,
      key:(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim(),project:process.env.DEAFNAVI_OPENAI_PROJECT_ID,
      comparisonOnly:process.argv.includes('--compare')});
    console.log(JSON.stringify({status:result.status,selected:result.selected,cached:result.cached,exceptions:result.exceptions,
      submittedThisRun:result.submittedThisRun,attention:result.attention,newOrChangedExceptions:result.newOrChangedExceptions?.length,
      discoveryCandidates:result.discovery?.candidates,lodging:result.lodging,overseas:result.overseas,publication:result.publication}));
    if(result.submittedThisRun===null)process.exitCode=1;
    }
  }catch{
    // No source text, secret paths, credentials, PHP output or API body in journal.
    console.error('SERVER_CURATION_FAILED: inspect private state; no automatic retry');process.exitCode=1;
  }
}
