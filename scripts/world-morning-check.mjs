import {readFile,appendFile} from 'node:fs/promises';
import {approvedWorldTargets} from '../src/lib/world-approved-targets.mjs';
// Morning replaces the regular manual workflow start, not the normal 3 updates.
// No generation, no account renewal, and no public source text in logs.
let proceed=false;
try{
  const pending=JSON.parse(await readFile('.state/world-translation.json','utf8')).pending;
  const endpoint=(process.env.CODEX_APP_SERVER_URL??'').replace(/\/+$/,'')+'/generate';
  if(!endpoint.startsWith('https://'))throw new Error('Configured HTTPS service required');
  const targets=await approvedWorldTargets(pending.map(x=>x.article),{endpoint,limit:50,
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.CODEX_APP_SERVER_TOKEN},
    request:(url,options)=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)})});
  proceed=targets.length>0;
  console.log(JSON.stringify({pending:pending.length,approved:targets.length,generationRequests:0}));
}catch{console.log('Morning translation held: account or exact-text verification is unavailable.');}
if(!process.env.GITHUB_OUTPUT)throw new Error('Workflow output required');
await appendFile(process.env.GITHUB_OUTPUT,'proceed='+proceed+'\n');
