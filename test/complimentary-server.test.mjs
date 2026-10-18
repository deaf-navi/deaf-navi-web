import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('HTTP integration: health never generates and missing allowance fails closed without Codex fallback',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'dn-server-free-'));
  const keyFile=join(dir,'key');await writeFile(keyFile,'sk-proj-fixture-not-a-secret');
  const child=spawn(process.execPath,['scripts/codex-app-server.mjs','--port','0'],{
    env:{...process.env,CODEX_APP_SERVER_TOKEN:'fixture-http-token',CODEX_APP_SERVER_HOST:'127.0.0.1',CODEX_BIN:join(dir,'nonexistent-codex'),
      DEAFNAVI_TEXT_BACKEND:'complimentary',DEAFNAVI_OPENAI_KEY_FILE:keyFile,DEAFNAVI_OPENAI_PROJECT_ID:'proj_fixture',DEAFNAVI_AI_STATE_DIR:dir},
    cwd:resolve('.'),stdio:['ignore','pipe','pipe'],
  });
  const closed=once(child,'close');
  t.after(async()=>{child.kill();await closed;await rm(dir,{recursive:true,force:true});});
  let output='';
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('server startup timeout')),5000);
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[0]);}});
    child.once('error',reject);
  });
  const headers={Authorization:'Bearer fixture-http-token','Content-Type':'application/json'};
  assert.equal((await fetch(base+'/health')).status,401);
  const health=await fetch(base+'/health',{headers});assert.equal(health.status,200);assert.equal((await health.json()).engine,'openai_complimentary');
  const request={type:'world_jp_post_edit',platform:'deaf-navi-world-jp',count:1,source_text:JSON.stringify({items:[{id:'0',title:'Captioned theatre',summary:'The city theatre offers captions.'}]})};
  const response=await fetch(base+'/generate',{method:'POST',headers,body:JSON.stringify(request)});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'complimentary_unavailable');
  assert.equal((await fetch(base+'/ready',{headers})).status,503);
  const malformed=await fetch(base+'/generate',{method:'POST',headers,body:JSON.stringify({...request,source_text:'not JSON'})});assert.equal(malformed.status,400);
});
