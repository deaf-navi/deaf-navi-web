import {evidenceHash,validIsoDay} from './curation-review-contract.mjs';

const HOUR=3600000,DAY=24*HOUR;
const jstDay=now=>new Date(now+9*HOUR).toISOString().slice(0,10);

// A private work queue, never a publication or a new source verification.
// Recompute from current snapshots even when the API comparison is cached.
export function planCurationAttention(records,previous=null,now=Date.now()){
  const stamp=new Date(now).toISOString(),today=jstDay(now),soon=jstDay(now+14*DAY),sixWeeks=jstDay(now+42*DAY);
  const sixMonths=new Date(today+'T00:00:00Z');sixMonths.setUTCMonth(sixMonths.getUTCMonth()+6);
  const old=new Map((previous?.items??[]).map(x=>[x.key,x])),items=[],undated=[],outsideHorizon=[];
  for(const record of records){
    if(record.publication!=='public'||!['event','cafe'].includes(record.kind))continue;
    const key=record.kind+':'+record.recordId,day=record.baseline?.startDate;
    if(!validIsoDay(day??'')){undated.push({key,reason:'missing-date'});continue;}
    if(day<today||day>(record.eventKind==='theater'?sixMonths.toISOString().slice(0,10):sixWeeks)){
      outsideHorizon.push({key,reason:'outside-horizon'});continue;
    }
    const checked=Date.parse(record.verifiedAt),validCheck=Number.isFinite(checked)&&checked<=now;
    const expiresAt=validCheck?new Date(checked+48*HOUR).toISOString():null;
    const revisionMatches=record.kind!=='cafe'||record.revision===record.sourceRecordRevision;
    let reason;
    if(!['verified','retrying'].includes(record.verification)||!revisionMatches)reason='publication-review-required';
    else if(!validCheck)reason='verification-time-invalid';
    else if(checked+48*HOUR<=now)reason='freshness-expired';
    else if(record.sourceMode!=='html'&&checked+48*HOUR<=now+DAY)reason='visual-review-due-before-next-run';
    else continue;
    const action=record.sourceMode==='html'?'check-source-change-or-recovery':'read-official-visual-source';
    const priority=day<=soon?'within-two-weeks':'later';
    const fingerprint=evidenceHash(JSON.stringify([reason,priority,record.sourceUrl,record.sourceMode,record.revision,record.publicationContentHash,record.verifiedAt]));
    const prior=old.get(key);
    items.push({key,kind:record.kind,recordId:record.recordId,title:record.title,sourceUrl:record.sourceUrl??null,
      sourceMode:record.sourceMode??null,startDate:day,verifiedAt:record.verifiedAt??null,expiresAt,
      revision:record.revision??null,reason,priority,action,fingerprint,
      firstSeenAt:prior?.firstSeenAt??stamp,changedAt:prior?.fingerprint===fingerprint?prior.changedAt:stamp});
  }
  items.sort((a,b)=>(a.priority==='within-two-weeks'?0:1)-(b.priority==='within-two-weeks'?0:1)
    ||a.startDate.localeCompare(b.startDate)||(a.expiresAt??'').localeCompare(b.expiresAt??'')||a.key.localeCompare(b.key));
  const groups=new Map();
  for(const item of items){const key=item.sourceUrl??item.key;
    if(!groups.has(key))groups.set(key,{sourceUrl:item.sourceUrl,action:item.action,recordKeys:[],earliestDate:item.startDate});
    groups.get(key).recordKeys.push(item.key);
  }
  const active=new Set(items.map(x=>x.key));
  return {version:1,generatedAt:stamp,items,sourceGroups:[...groups.values()],
    // Due remains visible on every run; newOrChanged is not the work list.
    due:items.map(x=>x.key),newOrChanged:items.filter(x=>old.get(x.key)?.fingerprint!==x.fingerprint).map(x=>x.key),
    cleared:[...old.keys()].filter(x=>!active.has(x)),undated,outsideHorizon,
    counts:{due:items.length,cafe:items.filter(x=>x.kind==='cafe').length,event:items.filter(x=>x.kind==='event').length,
      expired:items.filter(x=>x.reason==='freshness-expired').length,
      expiringVisual:items.filter(x=>x.reason==='visual-review-due-before-next-run').length,sourceGroups:groups.size},
    publicationApproved:false,manualReviewTimestampsChanged:false};
}
