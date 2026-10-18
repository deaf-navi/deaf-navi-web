import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {summarizeComplimentaryUsage,validateAllowance,COMPLIMENTARY_MODEL,COMPLIMENTARY_REQUEST_LIMIT} from './complimentary-text-client.mjs';

// Read-only operational report. Never calls the API, changes the allowance, or
// treats the local budget as the organization's current remaining free quota.
try {
  const stateDir=process.env.DEAFNAVI_AI_STATE_DIR;
  const project=process.env.DEAFNAVI_OPENAI_PROJECT_ID;
  const key=(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim();
  const lease=JSON.parse(await readFile(join(stateDir,'allowance.json'),'utf8'));
  const {day,budget}=validateAllowance(lease,{key,project});
  let ledger;
  try{ledger=JSON.parse(await readFile(join(stateDir,'usage-'+day+'.json'),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;ledger={version:1,day,projectId:project,reserved:0,records:[]};}
  const usage=summarizeComplimentaryUsage(ledger,{day,project});
  let inflight=false;
  try{await readFile(join(stateDir,'inflight.json'));inflight=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  process.stdout.write(JSON.stringify({day,model:COMPLIMENTARY_MODEL,accounting:'actual_usage_with_unsettled_reservations',dailyBudget:budget,...usage,
    remainingLocalBudget:Math.max(0,budget-usage.accountedTokens),requestLimit:COMPLIMENTARY_REQUEST_LIMIT,remainingRequests:Math.max(0,COMPLIMENTARY_REQUEST_LIMIT-usage.routineRequests),researchRequestLimit:null,
    fallback:lease.groups?.light?{model:lease.groups.light.model,eligible:lease.groups.light.eligible,accessVerified:lease.groups.light.modelAccessVerified}:null,
    reconciliationRequired:inflight||usage.unresolved>0,checkedAt:lease.checkedAt,expiresAt:lease.expiresAt})+'\n');
}catch(error){process.stderr.write('USAGE_UNAVAILABLE: '+(error.code==='complimentary_unavailable'?error.message:'Private usage record requires inspection')+'\n');process.exitCode=1;}
