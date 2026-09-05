import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),env={...process.env,DEAFNAVI_DATA_DIR:mkdtempSync(join(tmpdir(),'deafnavi-admin-dash-')),DEAFNAVI_LOCAL_TEST:'1'},password=randomBytes(18).toString('hex');
const run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});const hash=run(['test/directory-hash.php'],password).stdout;
assert.equal(run(['server/cli.php','init'],JSON.stringify({username:'testadmin',password_hash:hash})).status,0);
const core=join(root,'server/core.php').replaceAll('\\','/');
const sql=code=>run(['-r',`require '${core}';${code}`]);
assert.equal(sql("query('UPDATE users SET must_change=0');").status,0);
const server=spawn('php',['-S','127.0.0.1:5196','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);
function client(){let cookie='';return async(path,data)=>{const r=await fetch('http://127.0.0.1:5196'+path,{method:data?'POST':'GET',redirect:'manual',headers:{cookie,...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});for(const c of r.headers.getSetCookie())if(c.startsWith('deafnavi_directory='))cookie=c.split(';')[0];return {status:r.status,text:await r.text()};};}
const admin=client(),editor=client(),anon=client(),token=t=>t.match(/name="csrf" value="([a-f0-9]+)"/)[1];let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(let i=0;i<40;i++){try{await anon('/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
let r=await admin('/admin/');let csrf=token(r.text);ok((await admin('/admin/',{csrf,action:'login',username:'testadmin',password})).status===303,'login');
r=await admin('/admin/');csrf=token(r.text);ok(r.text.includes('admin-sidebar')&&r.text.includes('admin-metrics'),'dashboard shell');
const post=async data=>admin('/admin/',{csrf,...data});
for(const kind of ['cafe','store','event']){
 for(const sort of ['name','region','publication','status','updated','verified','date'])ok((await admin('/admin/?view=records&kind='+kind+'&sort='+sort)).status===200,'sort SQL valid');
 const names=html=>[...html.matchAll(/<th scope="row"><a[^>]*>(.*?)<\/a>/g)].map(m=>m[1]);
 const a=names((await admin('/admin/?view=records&kind='+kind+'&sort=name&dir=asc')).text),b=names((await admin('/admin/?view=records&kind='+kind+'&sort=name&dir=desc')).text);ok(JSON.stringify(a)===JSON.stringify(b.reverse()),'sort order reverses entire result');
}
r=await admin('/admin/?view=records&kind=cafe&q=%3Cscript%3E&sort=DROP%20TABLE');ok(r.status===200&&r.text.includes('&lt;script&gt;')&&!r.text.includes('<script>'),'escaped filters and SQL sort whitelist');
for(const v of ['users','submissions','audit','settings','preferences'])ok((await admin('/admin/?view='+v)).status===200,'view '+v);
r=await admin('/admin/?view=edit&kind=cafe&id=knot');ok(r.text.includes('admin-fieldset')&&r.text.includes('LINE')&&r.text.includes('詳細設定・管理用情報'),'grouped edit fields');
ok((await post({action:'create_user',username:'testeditor',role:'editor',new_password:password,confirm_password:'mismatch'})).status===400,'creation confirmation enforced when supplied');
ok((await post({action:'create_user',username:'testeditor',role:'editor',new_password:password,confirm_password:password})).status===303,'create synthetic editor');
assert.equal(sql("query('UPDATE users SET must_change=0 WHERE username=?',['testeditor']);").status,0);
r=await editor('/admin/');let ec=token(r.text);ok((await editor('/admin/',{csrf:ec,action:'login',username:'testeditor',password})).status===303,'editor login');r=await editor('/admin/');ec=token(r.text);
ok(!r.text.includes('view=users')&&!r.text.includes('view=preferences'),'admin menu hidden for editor');
for(const v of ['users','user&id=1','settings','preferences'])ok((await editor('/admin/?view='+v)).status===403,'editor denied privileged view');
const fixture={action:'update_user',id:'2',version:'1',role:'admin',active:'1',confirm:'1',current_password:password};
ok((await editor('/admin/',{...fixture,csrf:ec})).status===403,'editor cannot elevate');
ok((await post({...fixture,csrf:'invalid'})).status===403,'CSRF rejected');
ok((await post({...fixture,confirm:'0'})).status===400,'confirmation required');
ok((await post({...fixture,current_password:'wrong'})).status===403,'reauthentication required');
ok((await post({action:'toggle_user',id:'2',expected_active:'1'})).status===409,'legacy toggle cannot bypass confirmation');
ok((await post({...fixture,id:'1',active:'0'})).status===400,'cannot disable own account');
ok((await post({...fixture,role:'editor',active:'0'})).status===303,'disable other account');
ok((await editor('/admin/')).text.includes('管理画面にログイン'),'disabled session invalidated');
ok((await post(fixture)).status===409,'stale user edit rejected');
ok((await post({...fixture,version:'2'})).status===303,'role and activation update');
let info=JSON.parse(sql("echo json(query('SELECT role,active,version FROM users WHERE id=2')->fetch());").stdout);ok(info.role==='admin'&&info.active===1&&info.version===3,'new role persisted');
const pref={action:'admin_preferences',admin_page_size:'50',default_country_code:'US',default_country_name:'アメリカ',default_timezone:'America/New_York'};
ok((await post({...pref,default_timezone:'not-a-timezone'})).status===400,'invalid defaults rejected');
ok((await post(pref)).status===303,'defaults saved');
r=await admin('/admin/?view=edit&kind=cafe');ok(r.text.includes('value="US"')&&r.text.includes('value="America/New_York"'),'new record defaults applied');
r=await admin('/admin/?view=edit&kind=cafe&id=knot');ok(r.text.includes('value="JP"')&&r.text.includes('value="Asia/Tokyo"'),'existing record unchanged');
ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no runtime warnings');ok(run(['server/cli.php','check']).status===0,'integrity');
console.log(JSON.stringify({result:'ADMIN_DASHBOARD_TESTS_OK',checks,productionWrites:false}));
}finally{server.kill();}
