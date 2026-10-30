import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {qualityReport} from '../src/lib/quality-report.mjs';
import {PUBLICATION_REVIEW_STATUSES} from '../src/lib/publication-ledger.mjs';
const defaultRoot=resolve(import.meta.dirname,'..');
const inputs={events:'.state/events.json',domesticLedger:'.state/publication-review-domestic.json',worldLedger:'.state/publication-review-world.json',worldArticles:'docs/articles-world.json'};
export async function buildQualityReport({root=defaultRoot,now=Date.now(),releaseId,sourceCommit}={}) {
  if((releaseId||sourceCommit)&&(!/^[0-9a-f]{40}-[1-9]\d*-[1-9]\d*$/.test(releaseId||'')||!/^[0-9a-f]{40}$/.test(sourceCommit||'')||!releaseId.startsWith(sourceCommit+'-')))throw new Error('Invalid quality report release binding');
  const data={},inputSha256={};
  for(const [name,file] of Object.entries(inputs)) {
    const bytes=await readFile(join(root,file));data[name]=JSON.parse(bytes.toString('utf8'));
    inputSha256[name]=createHash('sha256').update(bytes).digest('hex');
  }
  if(!Array.isArray(data.events.events)||!Number.isFinite(Date.parse(data.events.checkedAt)))throw new Error('Invalid event snapshot for quality report');
  for(const name of ['domesticLedger','worldLedger']) {
    const ledger=data[name];
    if(ledger.version!==1||!Array.isArray(ledger.entries)||ledger.entries.some(x=>!x||typeof x.id!=='string'||!PUBLICATION_REVIEW_STATUSES.includes(x.status))||new Set(ledger.entries.map(x=>x.id)).size!==ledger.entries.length)throw new Error('Invalid publication ledger for quality report: '+name);
  }
  const world=data.worldArticles;
  if(!Array.isArray(world.articles)||world.count!==world.articles.length||!Number.isFinite(Date.parse(world.generatedAt)))throw new Error('Invalid World snapshot for quality report');
  const report=qualityReport(data.events,{domestic:data.domesticLedger,world:data.worldLedger},{now,worldArticles:world.articles});
  if(releaseId)report.deployment={releaseId,sourceCommit,inputSha256};
  return report;
}
export async function verifyCommittedQualityInputs(root,sourceCommit,report) {
  if(!/^[0-9a-f]{40}$/.test(sourceCommit||'')||report.deployment?.sourceCommit!==sourceCommit)throw new Error('Invalid committed report binding');
  const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:30*1024*1024});
  if(git(['rev-parse','HEAD']).toString('utf8').trim()!==sourceCommit)throw new Error('Quality report source is not checkout HEAD');
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  for(const [name,file] of Object.entries(inputs)) {
    const committed=hash(git(['cat-file','blob',sourceCommit+':'+file]));
    if(committed!==report.deployment.inputSha256?.[name]||committed!==hash(await readFile(join(root,file))))throw new Error('Quality report input differs from committed snapshot: '+name);
  }
}
export async function writeQualityReport({root=defaultRoot,output=join(root,'.state/publication-quality-report.json'),verifyCommit=false,...options}={}) {
  output=resolve(output);
  for(const published of ['docs','server']){const within=relative(join(root,published),output);if(within===''||(within!=='..'&&!within.startsWith('..'+sep)&&!isAbsolute(within)))throw new Error('Quality reports must remain outside the public document root');}
  const report=await buildQualityReport({root,...options});
  if(verifyCommit)await verifyCommittedQualityInputs(root,options.sourceCommit,report);
  await mkdir(dirname(output),{recursive:true});
  const temporary=output+'.'+randomUUID()+'.tmp';
  try {await writeFile(temporary,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temporary,output);}finally{await rm(temporary,{force:true});}
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const options={};
  for(let i=2;i<process.argv.length;i+=2){const key={'--output':'output','--release-id':'releaseId','--source-commit':'sourceCommit','--check':'check'}[process.argv[i]];if(!key||!process.argv[i+1])throw new Error('Unknown or incomplete quality report option');options[key]=process.argv[i+1];}
  if(options.check){await verifyCommittedQualityInputs(defaultRoot,options.sourceCommit,JSON.parse(await readFile(options.check,'utf8')));console.log('Quality report input hashes match checkout HEAD');}
  else {const report=await writeQualityReport({...options,verifyCommit:Boolean(options.releaseId)});console.log(JSON.stringify({events:report.events.length,holds:report.holds.length,regionUnknown:report.classificationReview.length,recheckDue:report.recheckDue,releaseId:report.deployment?.releaseId??null}));}
}
