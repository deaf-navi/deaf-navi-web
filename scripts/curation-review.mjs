import {readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createComplimentaryClient,COMPLIMENTARY_MODEL} from './complimentary-text-client.mjs';
import {prepareReviewItem,validateReviewResult,compareReview,REVIEW_VERSION} from './curation-review-contract.mjs';

// Private comparison results only. No Git publication, database writes, or reviewedAt renewal.
export async function reviewCurationTasks(tasks,{generate,stateDir,now=Date.now(),modelOverride,runMode='routine',canSubmit=()=>true}={}) {
  if(!Array.isArray(tasks)||!tasks.length||tasks.length>20)throw new Error('One bounded review batch is required');
  const items=tasks.map(prepareReviewItem);
  if(new Set(items.map(x=>x.id)).size!==items.length)throw new Error('Duplicate review tasks');
  const lockPath=join(stateDir,'curation-review.lock');
  const lock=await open(lockPath,'wx',0o600);
  try {
    const path=join(stateDir,'curation-review-cache.json');let cache;
    try{cache=JSON.parse(await readFile(path,'utf8'));if(cache.version!==REVIEW_VERSION||!cache.entries)throw new Error('Invalid private review cache');}
    catch(error){if(error.code!=='ENOENT')throw error;cache={version:REVIEW_VERSION,entries:{}};}
    const desired=modelOverride??COMPLIMENTARY_MODEL;
    const keys=items.map(item=>desired+':'+item.id);
    const missing=items.filter((item,i)=>!cache.entries[keys[i]]&&canSubmit(item));
    if(missing.length){
      const result=await generate(missing,{purpose:'curation_review',runMode,modelOverride});
      validateReviewResult(missing,result);
      for(const decision of result.items)cache.entries[desired+':'+decision.id]={decision,model:result.model,checkedAt:new Date(now).toISOString()};
      const temp=path+'.tmp-'+randomUUID();await writeFile(temp,JSON.stringify(cache)+'\n',{mode:0o600});await rename(temp,path);
    }
    const entries=tasks.map((task,i)=>{
      const stored=cache.entries[keys[i]];
      if(!stored)return {id:items[i].id,recordId:task.recordId??null,kind:task.kind,sourceUrl:task.sourceUrl,
        status:'exception',reasons:['sharing-approval-required'],differences:[],publicationApproved:false,reviewedAt:null};
      validateReviewResult([items[i]],{items:[stored.decision]});
      return {id:items[i].id,recordId:task.recordId??null,kind:task.kind,sourceUrl:task.sourceUrl,
        model:stored.model,decision:stored.decision,...compareReview(task,stored.decision,{now})};
    });
    return {version:REVIEW_VERSION,generatedAt:new Date(now).toISOString(),submitted:missing.length,cached:entries.filter(x=>x.model).length-missing.length,
      corroborated:entries.filter(x=>x.status==='corroborated').length,exceptions:entries.filter(x=>x.status==='exception').length,entries};
  } finally {await lock.close();await unlink(lockPath);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const chunks=[];for await(const c of process.stdin)chunks.push(c);
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(input.publicDataReviewed!==true)throw new Error('Exact public excerpts need sharing review');
    const stateDir=process.env.DEAFNAVI_AI_STATE_DIR,research=process.argv.includes('--research');
    const generate=createComplimentaryClient({key:(await readFile(process.env.DEAFNAVI_OPENAI_KEY_FILE,'utf8')).trim(),project:process.env.DEAFNAVI_OPENAI_PROJECT_ID,stateDir,allowResearch:research});
    const result=await reviewCurationTasks(input.tasks,{generate,stateDir,runMode:research?'research':'routine',modelOverride:input.modelOverride});
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write('CURATION_REVIEW_UNAVAILABLE: '+(error.code==='complimentary_unavailable'?error.message:'Private input or evidence requires inspection')+'\n');process.exitCode=1;}
}
