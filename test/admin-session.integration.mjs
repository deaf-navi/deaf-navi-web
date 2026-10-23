// Synthetic accounts and private temporary storage only. Never print credentials/cookies.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'), dir=mkdtempSync(join(tmpdir(),'deafnavi-login-'));
// The explicit test cookie jar can exercise Secure cookies over isolated loopback.
const env={...process.env,DEAFNAVI_DATA_DIR:dir,DEAFNAVI_LOCAL_TEST:''};
const password=randomBytes(20).toString('hex'), next=randomBytes(20).toString('hex');
const run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});
const sql=code=>{const r=run(['-r',`require '${join(root,'server/core.php').replaceAll('\\','/')}';${code}`]);assert.equal(r.status,0,r.stderr);return r.stdout;};
const hash=run(['test/directory-hash.php'],password).stdout;
assert.equal(run(['server/cli.php','init'],JSON.stringify({username:'sessiontest',password_hash:hash})).status,0);
sql("query('UPDATE users SET must_change=0');");
const server=spawn('php',['-d','session.gc_probability=1','-d','session.gc_divisor=1','-S','127.0.0.1:5217','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let logs='',checks=0;server.stderr.on('data',b=>logs+=b);
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const csrf=t=>{const m=t.match(/name="csrf" value="([a-f0-9]+)"/);assert.ok(m,'CSRF exists');return m[1];};
function client(seed){
 const jar=new Map(seed);
 const request=async(path='/admin/?view=access',data)=>{
  const r=await fetch('http://127.0.0.1:5217'+path,{method:data?'POST':'GET',redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});
  const cookies=r.headers.getSetCookie();for(const c of cookies){const pair=c.split(';')[0],i=pair.indexOf('=');if(/Max-Age=0\b/i.test(c))jar.delete(pair.slice(0,i));else jar.set(pair.slice(0,i),pair.slice(i+1));}
  return {status:r.status,text:await r.text(),cookies};
 };
 return {jar,request};
}
const logged=r=>r.status===200&&!r.text.includes('<section class="dn-login">');
const file=c=>join(dir,'sessions','sess_'+c.jar.get('deafnavi_directory'));
const age=c=>writeFileSync(file(c),readFileSync(file(c),'utf8').replace(/issued\|i:\d+;/,`issued|i:${Math.floor(Date.now()/1000)-13*3600};`).replace(/last_active\|i:\d+;/,`last_active|i:${Math.floor(Date.now()/1000)-3*3600};`));
const login=async c=>{sql("query('DELETE FROM limits');");const page=await c.request();const r=await c.request('/admin/',{action:'login',csrf:csrf(page.text),username:'sessiontest',password});ok(r.status===303,'password login succeeds');return r;};
try{
 for(let i=0;i<40;i++){try{await fetch('http://127.0.0.1:5217/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const a=client(), b=client();
 const response=await login(a);await a.request();age(a);
 ok(logged(await a.request()),'login survives 3h inactivity and 13h since login');
 const persistent=response.cookies.findLast(c=>c.startsWith('deafnavi_admin_login='));
 ok(!!persistent&&/Max-Age=34560000\b/.test(persistent)&&/HttpOnly/i.test(persistent)&&/SameSite=Lax/i.test(persistent)&&/path=\//i.test(persistent),'400-day persistent HttpOnly same-site host-only cookie');
 ok(!/domain=/i.test(persistent),'no parent-domain cookie');
 ok(/; secure(?:;|$)/i.test(persistent),'production cookies require HTTPS');
 const stored=sql("echo json(query('SELECT * FROM admin_login_sessions')->fetchAll());");
 ok(!stored.includes(a.jar.get('deafnavi_admin_login')),'database stores a hash, not the bearer token');
 sql("query('UPDATE admin_login_sessions SET expires_at=?',[time()+100*86400]);");
 const renewal=await a.request();
 ok(renewal.cookies.some(c=>c.startsWith('deafnavi_admin_login=')&&/Max-Age=34560000\b/.test(c)),'authenticated visit renews browser expiration');
 ok(Number(sql("echo query('SELECT expires_at FROM admin_login_sessions')->fetchColumn();"))>Date.now()/1000+399*86400,'durable expiration renews with browser');
 const before=await a.request(), formCsrf=csrf(before.text);
 unlinkSync(file(a));
 ok(logged(await a.request()),'login survives PHP session garbage collection');
 ok(csrf((await a.request()).text)===formCsrf,'open form CSRF survives short session cleanup');
 const restarted=client([...a.jar].filter(([name])=>name==='deafnavi_admin_login'));
 ok(logged(await restarted.request()),'browser restart restores login with persistent cookie alone');
 ok((await restarted.request('/admin/',{csrf:'wrong',action:'logout'})).status===403,'persistent login never bypasses CSRF');
 ok(logged(await restarted.request()),'bad CSRF does not log out user');
 const replay=client(a.jar), logoutCsrf=csrf((await a.request()).text);
 ok((await a.request('/admin/',{action:'logout',csrf:logoutCsrf})).status===303,'explicit logout succeeds');
 ok(!a.jar.has('deafnavi_admin_login'),'logout clears persistent cookie');
 ok(!logged(await replay.request()),'saved cookie and another restored PHP session cannot replay after logout');
 ok(!logged(await restarted.request()),'logout invalidates all PHP sessions restored from same login');
 await login(a);await login(b);
 sql("query('UPDATE admin_login_sessions SET expires_at=?',[time()-1]);");
 ok(!logged(await a.request()),'expired durable login rejected even with PHP session');
 await login(a);await login(b);
 sql("query('UPDATE users SET active=0,version=version+1');");
 ok(!logged(await a.request()),'disabled account invalidates persistent login');
 sql("query('UPDATE users SET active=1');");
 ok(!logged(await b.request()),'reactivation cannot resurrect old version');
 await login(a);await login(b);
 sql("query('UPDATE users SET role=?,version=version+1',['editor']);");
 ok(!logged(await a.request()),'role change invalidates durable login');
 sql("query('UPDATE users SET role=?',['admin']);");
 await login(a);await login(b);
 const old=client(b.jar);const page=await a.request();
 ok((await a.request('/admin/',{action:'password',csrf:csrf(page.text),current_password:password,new_password:next,confirm_password:next})).status===303,'password change succeeds');
 ok(logged(await a.request()),'password changer keeps current device signed in');
 ok(!logged(await old.request()),'password change revokes other device');
 const forged=client([['deafnavi_admin_login',randomBytes(32).toString('hex')]]);
 ok(!logged(await forged.request()),'unknown token rejected');
 const malformed=client([['deafnavi_admin_login','../bad']]);
 ok(!logged(await malformed.request()),'malformed token rejected');
 // Upgrade an already valid session, while keeping expired legacy sessions signed out.
 const legacy=client(a.jar);legacy.jar.delete('deafnavi_admin_login');
 writeFileSync(file(legacy),readFileSync(file(legacy),'utf8').replace(/admin_login_hash\|s:64:"[a-f0-9]+";/,''));
 ok(logged(await legacy.request())&&legacy.jar.has('deafnavi_admin_login'),'valid pre-deploy session upgrades without re-login');
 const expired=client(legacy.jar);expired.jar.delete('deafnavi_admin_login');
 writeFileSync(file(expired),readFileSync(file(expired),'utf8').replace(/admin_login_hash\|s:64:"[a-f0-9]+";/,''));age(expired);
 ok(!logged(await expired.request()),'already expired legacy session is not resurrected');
 const anon=client();const contact=await anon.request('/submit/?form=contact&scope=site');
 ok(contact.status===200&&!anon.jar.has('deafnavi_admin_login'),'public contact gets no persistent login');
 ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no PHP warnings');
 ok(run(['server/cli.php','check']).status===0,'database integrity');
 console.log(JSON.stringify({result:'ADMIN_SESSION_TESTS_OK',checks,productionWrites:false}));
} finally {server.kill();}
