import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

test('no-op recovery gates cannot cancel an already running production deployment',async()=>{
 for(const name of ['deploy-xserver.yml','deploy-github-pages-compat.yml']){
  const workflow=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  assert.match(workflow,/concurrency:[\s\S]*?cancel-in-progress: false/);
  assert.ok(workflow.includes("needs.recovery-publication.outputs.publish == 'true'"));
 }
});

test('deployment gate distinguishes an actual recovery publication from a successful no-op run',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dn-event-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 git('init');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','chore(events): recover 123456');
 const script=fileURLToPath(new URL('../scripts/event-recovery-publication.mjs',import.meta.url));
 for(const [id,expected] of [['123456','publish=true'],['12345','publish=false'],['999999','publish=false']]){
  const output=join(dir,id+'.txt');execFileSync(process.execPath,[script],{cwd:dir,env:{...process.env,GITHUB_OUTPUT:output,RECOVERY_RUN_ID:id}});
  assert.equal((await readFile(output,'utf8')).trim(),expected);
 }
 assert.throws(()=>execFileSync(process.execPath,[script],{cwd:dir,env:{...process.env,GITHUB_OUTPUT:join(dir,'invalid'),RECOVERY_RUN_ID:'123.*'},stdio:'pipe'}));
});
