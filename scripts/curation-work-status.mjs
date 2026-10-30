import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {buildIntakeQueue} from './curation-review-intake.mjs';
import {buildCurationProgress} from './curation-progress.mjs';

const files={daily:'daily-curation-review.json',candidates:'discovery-review.json',lodging:'lodging-review.json',overseas:'overseas-cafe-review.json',tips:'event-tip-review.json'};
const done=new Set(['corroborated','reviewed-unchanged','reviewed-evidence','published','already-published']);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp=value=>Number.isFinite(Date.parse(value))?Date.parse(value):null;
const countBy=(items,field)=>items.reduce((out,x)=>{out[x[field]]=(out[x[field]]??0)+1;return out;},{});
export function groupReviewSources(items){
 const groups=new Map();
 for(const item of items){
  let sourceUrl=null;try{const u=new URL(item.sourceUrl);u.hash='';if(['https:','http:'].includes(u.protocol))sourceUrl=u.href;}catch{}
  const key=sourceUrl??item.key;
  if(!groups.has(key))groups.set(key,{sourceUrl,priority:item.priority,members:[],activeItems:0});
  const group=groups.get(key);group.priority=Math.min(group.priority,item.priority);
  group.members.push({key:item.key,module:item.module,recordId:item.recordId,sourceUrl:item.sourceUrl,category:item.category,reasons:item.reasons,nextCheckAt:item.nextCheckAt});
  if(!['waiting-source','queued'].includes(item.category))group.activeItems++;
 }
 return [...groups.values()].sort((a,b)=>a.priority-b.priority).map(g=>({...g,itemCount:g.members.length,
  perRecordReviewRequired:true,publicationApproved:false,reviewedAt:null}));
}
export function buildWorkStatus({reports={},previous={},decisions=[],attention=null,now=Date.now(),executionStatus=null}={}){
 const old=new Map((previous.items??[]).map(x=>[x.key,x])),modules={},items=[],unknown=[];
 const due=new Set((attention?.items??[]).filter(x=>x.priority==='within-two-weeks').map(x=>String(x.recordId)));
 const add=(module,e,reasonOverride)=>{
  const id=String(e.recordId??e.id??e.sourceUrl??e.url??'');if(!id)return;
  const key=module+':'+id;if(items.some(x=>x.key===key))return;
  const reasons=[...new Set(reasonOverride??e.reasons??(e.reason?[e.reason]:[]))];
  if(done.has(e.status))return;
  let category=reasons.some(x=>/publication-baseline|structured-baseline|api-or-cache|batch-stopped|account-verification|request-reconciliation/.test(x))?'blocked':
   reasons.some(x=>/sharing-|review-catalog|official-html/.test(x))?'initial-review':
   reasons.some(x=>/unavailable|timeout|fetch-failed/.test(x))?'source-unavailable':
   reasons.every(x=>/^(daily-source-limit|daily-travel-limit|daily-request-limit|daily-token-budget|verified-free-headroom|batch-limit|outside-horizon|source-retry-after|waiting-source-until)$/.test(x))&&reasons.length?'queued':'review-required';
  const fingerprint=e.fingerprint??hash([e.status,e.disposition,reasons,e.sourceUrl,e.documentHash,e.publicationHash,e.differences??[],...(e.sourceChange?[e.sourceChange.fingerprint]:[])]);
  const prior=old.get(key),initial=prior?.firstSeenAt??e.firstSeenAt??e.changedAt??e.machineCheckedAt??new Date(now).toISOString();
  const firstSeenAt=stamp(initial)!==null&&stamp(initial)<=now?initial:new Date(now).toISOString();
  const decision=decisions.find(x=>x.key===key&&x.fingerprint===fingerprint&&x.disposition==='waiting-source'
    &&stamp(x.reviewedAt)!==null&&stamp(x.reviewedAt)<=now&&stamp(x.nextCheckAt)>now&&stamp(x.nextCheckAt)-stamp(x.reviewedAt)<=7*86400000);
  if(decision&&category!=='blocked')category='waiting-source';
  const ageDays=Math.max(0,Math.floor((now-Date.parse(firstSeenAt))/86400000));
  items.push({key,module,recordId:id,sourceUrl:e.sourceUrl??e.url??null,category,reasons,fingerprint,firstSeenAt,
   changedAt:prior?.fingerprint===fingerprint?prior.changedAt:new Date(now).toISOString(),ageDays,
   due:due.has(id),nextCheckAt:decision?.nextCheckAt??e.nextCheckAt??null,...(e.sourceChange?{sourceChange:e.sourceChange}:{}),
   priority:category==='blocked'?0:due.has(id)?1:category==='initial-review'?2:category==='queued'||category==='waiting-source'?5:3});
 };
 for(const [module,file] of Object.entries(files)){
  const r=reports[module];if(!r||!Array.isArray(r.entries)){unknown.push(module);modules[module]={state:'unknown',file,reason:'missing-or-invalid-report',pending:null};continue;}
  const stale=stamp(r.generatedAt)===null||now-stamp(r.generatedAt)>36*3600000||stamp(r.generatedAt)>now;
  if(stale)unknown.push(module);
  r.entries.forEach(e=>add(module,e));
  // Already attempted today is not an additional unprocessed record.
  for(const e of Array.isArray(r.deferred)?r.deferred:[])if(e.reason!=='already-attempted-today'&&!r.entries.some(x=>String(x.recordId??x.id)===String(e.recordId??e.id)&&done.has(x.status)))add(module,e,[e.reason??'batch-limit']);
  modules[module]={state:stale?'stale':'observed',generatedAt:r.generatedAt??null,file,records:r.entries.length,
   confirmed:r.entries.filter(e=>done.has(e.status)).length,
   pending:items.filter(x=>x.module===module).length,selected:r.selected??null,cached:r.cached??null,
   submittedItems:r.submittedThisRun??null,coverage:r.coverage??null,capacity:r.capacity??null};
  if(module==='tips'){
   modules[module].unreviewed=r.unreviewed??null;modules[module].deferred=r.deferred??null;
   if((r.unreviewed??0)+(typeof r.deferred==='number'?r.deferred:0)>0){unknown.push('tip-identities');modules[module].state='pending-in-admin';}
  }
 }
 for(const e of attention?.items??[])if(!items.some(x=>x.recordId===String(e.recordId)))add('attention',e,[e.reason??'publication-review-required']);
 if(attention)modules.attention={state:'observed',generatedAt:attention.generatedAt??null,due:attention.items?.length??null,pending:items.filter(x=>x.module==='attention').length};
 for(const [module,r] of Object.entries(reports).filter(([key])=>key.endsWith('Discovery'))){
  if(!r||!Array.isArray(r.reviewQueue)){unknown.push(module);modules[module]={state:'unknown',pending:null};continue;}
  for(const e of r.reviewQueue)add(module,typeof e==='string'?{url:e}:e,['official-body-and-sharing-review-required']);
  const stale=stamp(r.generatedAt)===null||now-stamp(r.generatedAt)>9*86400000||stamp(r.generatedAt)>now;
  if(stale)unknown.push(module);
  modules[module]={state:stale?'stale':'observed',generatedAt:r.generatedAt??null,pending:items.filter(x=>x.module===module).length};
 }
 items.sort((a,b)=>a.priority-b.priority||b.ageDays-a.ageDays||a.key.localeCompare(b.key));
 const reasonCounts={};for(const x of items)for(const reason of x.reasons)reasonCounts[reason]=(reasonCounts[reason]??0)+1;
 const unidentifiedTips=(reports.tips?.unreviewed??0)+(typeof reports.tips?.deferred==='number'?reports.tips.deferred:0);
 const pending=items.length+unidentifiedTips,categoryCounts=countBy(items,'category');
 if(unidentifiedTips)categoryCounts['initial-review']=(categoryCounts['initial-review']??0)+unidentifiedTips;
 const sourceGroups=groupReviewSources(items),activeGroups=sourceGroups.filter(g=>g.activeItems>0);
 const result={version:1,generatedAt:new Date(now).toISOString(),executionStatus,
  coverageStatus:unknown.length?'unknown':pending?'incomplete':'complete',
  unit:'review-items-not-unique-facilities-or-api-requests',pending,unknownModules:unknown,categoryCounts,reasonCounts,
  oldestPendingAt:items.map(x=>x.firstSeenAt).sort()[0]??null,modules,items,sourceGroups,
  sourceGroupCounts:{all:sourceGroups.length,active:activeGroups.length,shared:sourceGroups.filter(g=>g.sourceUrl&&g.itemCount>1).length},
  operatorSourceGroups:activeGroups.slice(0,12),
  operatorQueue:items.filter(x=>!['queued','waiting-source'].includes(x.category)).slice(0,12),
  publicationApproved:false,reviewedAt:null};
 return result;
}
async function optional(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function save(path,data){const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(tmp,path);}
export async function refreshWorkStatus({stateDir,now=Date.now(),executionStatus=null,attention=null}={}){
 const reports={};for(const [key,file] of Object.entries(files)){
  const r=await optional(join(stateDir,file));
  // The tip queue uses results and counts; an absent queue is never assumed empty.
  reports[key]=key==='tips'&&r&&!Array.isArray(r.entries)&&Array.isArray(r.results)?{...r,entries:r.results}:r;
 }
 for(const [key,file] of [['eventDiscovery','curation-discovery.json'],['lodgingDiscovery','lodging-discovery.json'],['overseasDiscovery','overseas-cafe-discovery.json']])reports[key]=await optional(join(stateDir,file));
 const result=buildWorkStatus({reports,previous:await optional(join(stateDir,'curation-work-status.json'))??{},
  decisions:(await optional(join(stateDir,'curation-work-decisions.json')))?.items??[],
  attention:attention??await optional(join(stateDir,'curation-attention.json')),now,executionStatus});
 await save(join(stateDir,'curation-work-status.json'),result);
 const intake=buildIntakeQueue(result,await optional(join(stateDir,'curation-review-catalog.json'))??{},{now});
 await save(join(stateDir,'curation-intake.json'),intake);
 const progress=buildCurationProgress({report:reports.overseas,previous:await optional(join(stateDir,'curation-progress.json'))??{},executionStatus,now});
 await save(join(stateDir,'curation-progress.json'),progress);
 const {items,sourceGroups,...brief}=result;
 brief.intake={count:intake.count,detailFile:'curation-intake.json'};
 brief.progress={state:progress.state,alerts:progress.alerts??[],newAlerts:progress.newAlerts,resolved:progress.resolved,detailFile:'curation-progress.json'};
 brief.overseasFieldCoverage=Array.isArray(reports.overseas?.fieldCoverage)?{
  facilities:reports.overseas.fieldCoverage.length,detailFile:'overseas-cafe-review.json',
  fields:reports.overseas.fieldCoverage.reduce((out,r)=>{for(const [key,f] of Object.entries(r.fields)){
   out[key]??={registered:0,apiCorroborated:0,evidenceReviewed:0,notConfigured:0,sourceOnly:0};
   out[key].registered+=Number(f.state!=='not-configured');out[key].apiCorroborated+=Number(f.state==='api-corroborated');
   out[key].evidenceReviewed+=Number(f.state==='reviewed-evidence');
   out[key].notConfigured+=Number(f.state==='not-configured');out[key].sourceOnly+=Number(f.scope==='source-only');
  }return out;},{})}:null;
 await save(join(stateDir,'curation-operator-brief.json'),{...brief,detailFile:'curation-work-status.json',apiRequests:0});
 return brief;
}
