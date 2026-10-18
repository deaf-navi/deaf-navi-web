import {readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareCurationReview} from './prepare-curation-review.mjs';
import {reviewCurationTasks} from './curation-review.mjs';
import {evidenceHash,prepareReviewItem,validIsoDay} from './curation-review-contract.mjs';
import {createComplimentaryClient,publicTextFingerprint,validateAllowance} from './complimentary-text-client.mjs';

const jstDay=now=>new Date(now+9*3600000).toISOString().slice(0,10);
const issue=(record,reason)=>({kind:record.kind,recordId:record.recordId,sourceUrl:record.sourceUrl??null,status:'exception',reasons:[reason],publicationApproved:false,reviewedAt:null});
export function reviewRecords(events,cafes){
  if(!Array.isArray(events?.events)||cafes?.ready!==true||!Array.isArray(cafes.records))throw new Error('Current publication snapshots required');
  return [...events.events.map(event=>({kind:'event',recordId:event.id,title:event.title,eventKind:event.kind,
    publication:'public',sourceUrl:event.sourceUrl,sourceMode:event.verificationMode??'html',
    verification:event.verification,verifiedAt:event.verifiedAt,
    baseline:{startDate:event.startDate,...(event.endDate!==event.startDate?{endDate:event.endDate}:{}),
      venue:event.venue,communication:(event.communication??[]).map(x=>x.method),
      status:event.status==='announced'?'scheduled':event.status}})),...cafes.records];
}

// The catalog contains deliberately selected, previously read public fragments.
// It never grants today's sharing allowance or approves a publication change.
export function planDailyReview(records,catalog,{now=Date.now(),limit=8}={}){
  if(catalog?.version!==1||!Array.isArray(catalog.targets)||catalog.targets.length>200||limit<1||limit>8)throw new Error('Invalid bounded review catalog');
  const targets=new Map();
  for(const target of catalog.targets){
    const key=target.kind+':'+target.recordId;
    if(targets.has(key)||!['event','cafe'].includes(target.kind)||!target.recordId)throw new Error('Duplicate or invalid catalog identity');
    targets.set(key,target);
  }
  const today=jstDay(now),sixWeeks=jstDay(now+42*86400000);
  const sixMonths=new Date(today+'T00:00:00Z');sixMonths.setUTCMonth(sixMonths.getUTCMonth()+6);
  const selected=[],exceptions=[],deferred=[],skipped=[];const seen=new Set();
  for(const record of records){
    const key=record.kind+':'+record.recordId;
    if(seen.has(key))throw new Error('Duplicate publication identity');seen.add(key);
    if(record.publication!=='public')continue;
    const day=record.baseline?.startDate;
    if(!validIsoDay(day??'')){exceptions.push(issue(record,'missing-date'));continue;}
    if(day<today||day>(record.eventKind==='theater'?sixMonths.toISOString().slice(0,10):sixWeeks)){skipped.push({kind:record.kind,recordId:record.recordId,reason:'outside-horizon'});continue;}
    if(record.sourceMode!=='html'){exceptions.push(issue(record,'visual-or-unverified-source'));continue;}
    const verified=Date.parse(record.verifiedAt);
    if(!['verified','retrying'].includes(record.verification)||!Number.isFinite(verified)||verified>now||now-verified>=48*3600000
      ||record.kind==='cafe'&&record.sourceRecordRevision!==record.revision){exceptions.push(issue(record,'publication-review-required'));continue;}
    const target=targets.get(key);
    if(!target||target.sourceUrl!==record.sourceUrl||target.officialVerified!==true||target.sourceMode!=='html'
      ||!Number.isFinite(Date.parse(target.sharingReviewedAt))||Date.parse(target.sharingReviewedAt)>now
      ||!/^[a-f0-9]{64}$/.test(target.approvedDocumentHash??'')){
      exceptions.push(issue(record,'review-catalog-required'));continue;
    }
    prepareReviewItem({...target,text:target.fragments?.join(' ')});
    selected.push({...target,baseline:record.baseline,publicationSnapshotHash:evidenceHash(JSON.stringify(record))});
  }
  selected.sort((a,b)=>a.baseline.startDate.localeCompare(b.baseline.startDate)||a.recordId.localeCompare(b.recordId));
  // Alternate both services so a busy event source cannot starve cafe comparisons.
  const groups=['event','cafe'].map(kind=>selected.filter(x=>x.kind===kind)),ordered=[];
  while(groups.some(x=>x.length))for(const group of groups)if(group.length)ordered.push(group.shift());
  for(const target of ordered.slice(limit))deferred.push({kind:target.kind,recordId:target.recordId,reason:'batch-limit'});
  return {targets:ordered.slice(0,limit),exceptions,deferred,skipped};
}

export async function runDailyReview({records,catalog,stateDir,generate,canSubmit=()=>false,approvalSignature='none',now=Date.now(),runMode='routine',force=false,prepare=prepareCurationReview}={}){
  if(force&&runMode!=='research')throw new Error('Repeat runs require explicit research mode');
  const lockPath=join(stateDir,'daily-curation-review.lock'),lock=await open(lockPath,'wx',0o600);
  try{
    const plan=planDailyReview(records,catalog,{now});
    const signature=evidenceHash(JSON.stringify({catalog,records,approvalSignature}));
    const reportPath=join(stateDir,'daily-curation-review.json');
    let previous;try{previous=JSON.parse(await readFile(reportPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!force&&previous?.day===jstDay(now)&&previous.signature===signature&&Date.parse(previous.generatedAt)<=now)
      return {...previous,reusedRun:true,submittedThisRun:0};
    const prepared=plan.targets.length?await prepare(plan.targets,{now}):{tasks:[],exceptions:[]};
    const entries=[...plan.exceptions,...prepared.exceptions.map(x=>({...x,status:'exception',reasons:[x.reason],publicationApproved:false,reviewedAt:null}))];
    let submitted=0,cached=0;
    if(prepared.tasks.length){
      try{
        const result=await reviewCurationTasks(prepared.tasks,{generate,canSubmit,stateDir,now,runMode});
        submitted=result.submitted;cached=result.cached;entries.push(...result.entries);
      }catch{
        // Do not retry or switch providers on uncertain requests. The shared API
        // ledger retains reservations/inflight state for operator reconciliation.
        submitted=null;entries.push(...prepared.tasks.map(x=>issue(x,'api-or-cache-unavailable')));
      }
    }
    const report={version:1,day:jstDay(now),generatedAt:new Date(now).toISOString(),signature,reusedRun:false,
      submittedThisRun:submitted,cached,selected:plan.targets.length,corroborated:entries.filter(x=>x.status==='corroborated').length,
      exceptions:entries.filter(x=>x.status==='exception').length,deferred:plan.deferred,skipped:plan.skipped,entries,
      publicationApproved:false,reviewedAt:null};
    const temp=reportPath+'.tmp-'+randomUUID();await writeFile(temp,JSON.stringify(report,null,2)+'\n',{mode:0o600});await rename(temp,reportPath);
    return report;
  }finally{await lock.close();await unlink(lockPath);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const stateDir=process.env.DEAFNAVI_AI_STATE_DIR;
    if(!stateDir)throw new Error('Private state directory required');
    // Fixed existing application paths, no shell or user-supplied PHP command.
    const events=JSON.parse(await readFile('/srv/deafnavi/current/events.json','utf8'));
    const cafes=JSON.parse(execFileSync('php',['/srv/deafnavi/current/_backend/curate-cafe-events.php','--review-export'],{encoding:'utf8',maxBuffer:2_000_000}));
    const records=reviewRecords(events,cafes);
    const catalog=JSON.parse(await readFile(join(stateDir,'curation-review-catalog.json'),'utf8'));
    const key=(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim(),project=process.env.DEAFNAVI_OPENAI_PROJECT_ID;
    const lease=JSON.parse(await readFile(join(stateDir,'allowance.json'),'utf8'));
    let allowed=new Set();try{validateAllowance(lease,{key,project});allowed=new Set(lease.approvedTextHashes??[]);}catch{}
    const research=process.argv.includes('--research');
    const generate=createComplimentaryClient({key,project,stateDir,allowResearch:research});
    const report=await runDailyReview({records,catalog,stateDir,generate,canSubmit:item=>allowed.has(publicTextFingerprint(item)),
      approvalSignature:evidenceHash(JSON.stringify([...allowed].sort())),runMode:research?'research':'routine',force:process.argv.includes('--force')});
    console.log(JSON.stringify({day:report.day,generatedAt:report.generatedAt,reusedRun:report.reusedRun,submittedThisRun:report.submittedThisRun,
      cached:report.cached,selected:report.selected,corroborated:report.corroborated,exceptions:report.exceptions,deferred:report.deferred.length,
      exceptionRecords:report.entries.filter(x=>x.status==='exception').map(({kind,recordId,reasons,sourceUrl,differences})=>({kind,recordId,reasons,sourceUrl,differences})),
      reportPath:join(stateDir,'daily-curation-review.json'),publicationApproved:false,reviewedAt:null}));
  }catch{console.error('DAILY_CURATION_REVIEW_UNAVAILABLE: private configuration or publication snapshot requires inspection');process.exitCode=1;}
}
