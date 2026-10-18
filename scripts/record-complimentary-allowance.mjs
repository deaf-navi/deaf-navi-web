import {readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {keyFingerprint,publicTextFingerprint,validateAllowance} from './complimentary-text-client.mjs';

// This records an operator's current account inspection. It never discovers or
// renews eligibility by itself, and never erases the separate usage ledger.
let lock,lockPath;
try {
  const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const key=(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim();
  const project=process.env.DEAFNAVI_OPENAI_PROJECT_ID;
  const stateDir=process.env.DEAFNAVI_AI_STATE_DIR;
  if(!stateDir||input.publicDataReviewed!==true||!Array.isArray(input.reviewedPublicItems))throw new Error('Reviewed public input is required');
  const hashes=input.reviewedPublicItems.map(publicTextFingerprint);
  lockPath=join(stateDir,'request.lock');lock=await open(lockPath,'wx',0o600);
  const target=join(stateDir,'allowance.json');
  let lease;
  if(input.mode==='approve-text'){
    lease=JSON.parse(await readFile(target,'utf8'));
    validateAllowance(lease,{key,project});
    lease.approvedTextHashes=[...new Set([...(lease.approvedTextHashes||[]),...hashes])];
  }else if(input.mode==='daily-account-check'){
    if(input.keyProjectVerified!==true||input.otherUsageReviewed!==true)throw new Error('Project ownership and other usage need inspection');
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
    lease={version:1,projectName:'shared-free-tier',projectId:project,keySha256:keyFingerprint(key),model:'gpt-5.6-sol',utcDay:day,
      checkedAt:input.checkedAt,expiresAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),
      enrolled:input.enrolled,sharingEnabled:input.sharingEnabled,balancePositive:input.balancePositive,publicDataOnly:true,
      groupDailyLimit:input.groupDailyLimit,observedGroupTokens:input.observedGroupTokens,dailyBudget:input.dailyBudget,
      approvedTextHashes:[...new Set(hashes)]};
    if(now-Date.parse(input.checkedAt)>30*60_000)throw new Error('Account inspection must be recent');
    validateAllowance(lease,{key,project,now});
  }else throw new Error('Unsupported inspection mode');
  const temp=target+'.tmp-'+randomUUID();
  await writeFile(temp,JSON.stringify(lease)+'\n',{mode:0o600});await rename(temp,target);
  process.stdout.write(JSON.stringify({day:lease.utcDay,expiresAt:lease.expiresAt,dailyBudget:lease.dailyBudget,approvedTexts:lease.approvedTextHashes.length})+'\n');
}catch(error){
  process.stderr.write('ALLOWANCE_NOT_UPDATED: '+(error.code==='complimentary_unavailable'?error.message:'Configuration or verified inspection is incomplete')+'\n');process.exitCode=1;
}finally{
  if(lock){await lock.close();await unlink(lockPath);}
}
