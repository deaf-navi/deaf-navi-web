import {readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {keyFingerprint,publicTextFingerprint,validateAllowance,validateStoredAllowance,validateAccountReview,invalidateAccountReview,ACCOUNT_REVIEW_MAX_AGE,COMPLIMENTARY_MODEL} from './complimentary-text-client.mjs';

// This records an operator's current account inspection. It never discovers or
// renews eligibility by itself, and never erases the separate usage ledger.
let lock,lockPath;
try {
  const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const key=(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim();
  const project=process.env.DEAFNAVI_OPENAI_PROJECT_ID;
  const stateDir=process.env.DEAFNAVI_AI_STATE_DIR;
  if(!stateDir)throw new Error('Private state directory required');
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),context={key,project,stateDir,now};
  const recent=stamp=>{const time=Date.parse(stamp);if(!Number.isFinite(time)||time>now||now-time>30*60_000)throw new Error('Inspection must be recent');};
  const save=async(path,value)=>{const tmp=path+'.tmp-'+randomUUID();await writeFile(tmp,JSON.stringify(value)+'\n',{mode:0o600});await rename(tmp,path);};
  lockPath=join(stateDir,'request.lock');lock=await open(lockPath,'wx',0o600);
  const target=join(stateDir,'allowance.json');
  const settingsPath=join(stateDir,'account-review.json');
  if(input.mode==='require-account-recheck'){
    if(!['settings-changed','billing-anomaly','usage-anomaly','account-unavailable'].includes(input.reason))throw new Error('Known incident reason required');
    await invalidateAccountReview(stateDir,input.reason,now);
    process.stdout.write(JSON.stringify({status:'requires-review',apiAllowed:false})+'\n');
  }else if(input.mode==='weekly-account-check'){
    recent(input.checkedAt);
    if(!['iab','chrome-fallback'].includes(input.browser)||!input.evidenceReference||typeof input.evidenceReference!=='string'||input.evidenceReference.length>500)throw new Error('Inspection evidence required');
    const groups={};
    for(const name of ['high','light'])if(input.groups?.[name]){
      const {model,eligible,modelAccessVerified,groupDailyLimit}=input.groups[name];
      groups[name]={model,eligible,modelAccessVerified,groupDailyLimit};
    }
    const review={version:1,status:'verified',projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),
      model:input.model,checkedAt:input.checkedAt,expiresAt:new Date(Date.parse(input.checkedAt)+ACCOUNT_REVIEW_MAX_AGE).toISOString(),
      keyProjectVerified:input.keyProjectVerified,enrolled:input.enrolled,sharingEnabled:input.sharingEnabled,balancePositive:input.balancePositive,
      groups,browser:input.browser,evidenceReference:input.evidenceReference};
    validateAccountReview(review,context);
    // Keep the previous evidence, including invalidations; never rewrite its time.
    let previous;try{previous=await readFile(settingsPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(previous)await writeFile(join(stateDir,'account-review-history-'+randomUUID()+'.json'),previous,{mode:0o600,flag:'wx'});
    await save(settingsPath,review);
    process.stdout.write(JSON.stringify({status:'settings-verified',checkedAt:review.checkedAt,nextReviewAt:review.expiresAt,dailyUsageRequired:true})+'\n');
  }else{
  if(input.publicDataReviewed!==true||!Array.isArray(input.reviewedPublicItems))throw new Error('Reviewed public input is required');
  const hashes=input.reviewedPublicItems.map(publicTextFingerprint);
  let lease;
  if(input.mode==='approve-text'){
    lease=JSON.parse(await readFile(target,'utf8'));
    await validateStoredAllowance(lease,context);
    lease.approvedTextHashes=[...new Set([...(lease.approvedTextHashes||[]),...hashes])];
  }else if(input.mode==='daily-usage-check'){
    if(input.settingsChanged===true||input.anomaliesDetected===true){
      await invalidateAccountReview(stateDir,input.settingsChanged?'settings-changed':'billing-or-usage-anomaly',now);
      throw new Error('Account change or anomaly needs inspection');
    }
    recent(input.checkedAt);
    const review=JSON.parse(await readFile(settingsPath,'utf8'));validateAccountReview(review,context);
    const groups={};
    for(const name of ['high','light'])if(review.groups[name])groups[name]={...review.groups[name],observedGroupTokens:input.observedGroupTokens?.[name]};
    lease={version:2,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:COMPLIMENTARY_MODEL,utcDay:day,
      checkedAt:input.checkedAt,expiresAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),
      enrolled:review.enrolled,sharingEnabled:review.sharingEnabled,balancePositive:review.balancePositive,publicDataOnly:true,
      accountReview:review,dailyReview:{otherUsageReviewed:input.otherUsageReviewed,billingReviewed:input.billingReviewed,
        billingUtcDay:input.billingUtcDay,billingStatus:input.billingStatus,settingsChanged:input.settingsChanged,anomaliesDetected:input.anomaliesDetected},
      groupDailyLimit:groups.high.groupDailyLimit,observedGroupTokens:groups.high.observedGroupTokens,dailyBudget:input.dailyBudget,groups,
      approvedTextHashes:[...new Set(hashes)]};
    await validateStoredAllowance(lease,context);
  }else if(input.mode==='daily-account-check'){
    // Compatibility for not-yet-migrated installations. A weekly record may not
    // be bypassed by replaying the old combined workflow.
    try{await readFile(settingsPath);throw new Error('Use weekly settings and daily usage modes');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(input.keyProjectVerified!==true||input.otherUsageReviewed!==true||input.model!==COMPLIMENTARY_MODEL)throw new Error('Project ownership, current model eligibility and other usage need inspection');
    lease={version:1,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:COMPLIMENTARY_MODEL,utcDay:day,
      checkedAt:input.checkedAt,expiresAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),
      enrolled:input.enrolled,sharingEnabled:input.sharingEnabled,balancePositive:input.balancePositive,publicDataOnly:true,
      groupDailyLimit:input.groupDailyLimit,observedGroupTokens:input.observedGroupTokens,dailyBudget:input.dailyBudget,
      ...(input.groups?{groups:input.groups}:{}),
      approvedTextHashes:[...new Set(hashes)]};
    recent(input.checkedAt);
    validateAllowance(lease,{key,project,now});
  }else throw new Error('Unsupported inspection mode');
  if(input.mode!=='approve-text'){
    // A same-day account refresh must not discard already reviewed exact text.
    try{
      const previous=JSON.parse(await readFile(target,'utf8'));
      validateAllowance(previous,{key,project,now});
      lease.approvedTextHashes=[...new Set([...previous.approvedTextHashes??[],...hashes])];
      if(previous.reusedSharingReviews)lease.reusedSharingReviews=previous.reusedSharingReviews;
    }catch(error){if(error.code!=='ENOENT'&&error.code!=='complimentary_unavailable')throw error;}
  }
  await save(target,lease);
  process.stdout.write(JSON.stringify({day:lease.utcDay,model:lease.model,expiresAt:lease.expiresAt,settingsCheckedAt:lease.accountReview?.checkedAt,nextSettingsReviewAt:lease.accountReview?.expiresAt,dailyBudget:lease.dailyBudget,approvedTexts:lease.approvedTextHashes.length})+'\n');
  }
}catch(error){
  process.stderr.write('ALLOWANCE_NOT_UPDATED: '+(error.code==='complimentary_unavailable'?error.message:'Configuration or verified inspection is incomplete')+'\n');process.exitCode=1;
}finally{
  if(lock){await lock.close();await unlink(lockPath);}
}
