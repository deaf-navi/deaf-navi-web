import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'dn-engagement-'));
const env={...process.env,DEAFNAVI_LOCAL_TEST:'1',DEAFNAVI_VISITOR_DIR:dir};
const run=code=>spawnSync('php',['-r',`require 'server/access-engagement.php';${code}`],{env,encoding:'utf8'});
for(const [path,want] of [['/news/support/','web'],['/news/accessibility/index.html','web'],['/guide/life/','guide'],['/connect/sign-cafe/area/tokyo/','cafe'],['/events/dream-begin-2026-11-01/','events'],['/events/not-a-real-event/',''],['/news/unknown/','']])assert.equal(run(`echo access_content('${path}');`).stdout,want);
const origin='http://127.0.0.1:5217';
const proc=spawn('php',['-S','127.0.0.1:5217','-t','docs','server/local-router.php'],{env,stdio:'ignore'});
try{
 for(let i=0;i<40;i++){try{await fetch(origin+'/access-engagement.js');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const post=(body,extra={})=>fetch(origin+'/_access/visit?kind=engagement',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0 LocalFixture',...extra},body:JSON.stringify(body)});
 assert.equal((await post({source:'cafe',event:'related_view'},{'X-DeafNavi-Client':'codex'})).status,204);
 assert.equal(existsSync(join(dir,'engagement.sqlite')),false);
 assert.equal((await post({source:'cafe',event:'related_view'},{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await post({source:'cafe',event:'article_click'})).status,400);
 assert.equal((await post({source:'news',event:'article_click',url:'https://private.example'})).status,400);
 assert.equal((await post({source:'news',event:'article_click'})).status,204);
 assert.equal((await post({source:'cafe',event:'related_view'})).status,204);
 assert.equal((await post({source:'cafe',event:'related_click'})).status,204);
 assert.equal((await post({source:'news',event:'article_click'},{'User-Agent':'Googlebot'})).status,204);
 const result=run("echo json_encode(engagement_db()->query('SELECT * FROM counts')->fetchAll());");assert.equal(result.status,0,result.stderr);
 const rows=JSON.parse(result.stdout);assert.equal(rows.length,3);assert.equal(rows.reduce((n,r)=>n+r.hits,0),3);assert.deepEqual(Object.keys(rows[0]).sort(),['day','event','hits','source']);
 assert.equal(run("echo engagement_db()->query('PRAGMA integrity_check')->fetchColumn();").stdout,'ok');
 console.log('Engagement HTTP, exclusions, privacy and classification checks passed');
}finally{proc.kill();}
