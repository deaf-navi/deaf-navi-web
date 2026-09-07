// Synthetic, isolated database only. No overseas production records are seeded.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const env={...process.env,DEAFNAVI_DATA_DIR:mkdtempSync(join(tmpdir(),'deafnavi-overseas-')),DEAFNAVI_LOCAL_TEST:'1'};
const password=randomBytes(18).toString('hex');
const run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});
const hash=run(['test/directory-hash.php'],password).stdout;
assert.equal(run(['server/cli.php','init'],JSON.stringify({username:'testadmin',password_hash:hash})).status,0);
const core=join(root,'server/core.php').replaceAll('\\','/');
const sql=code=>run(['-r',`require '${core}';${code}`]);
assert.equal(sql("query('UPDATE users SET must_change=0');").status,0);
const server=spawn('php',['-S','127.0.0.1:5198','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let logs='';server.stderr.on('data',b=>logs+=b);
function client(){let cookie='';return async(path,data)=>{const r=await fetch('http://127.0.0.1:5198'+path,{method:data?'POST':'GET',redirect:'manual',headers:{cookie,...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});for(const c of r.headers.getSetCookie())if(c.startsWith('deafnavi_directory='))cookie=c.split(';')[0];return {status:r.status,text:await r.text(),headers:r.headers};};}
const anon=client(),admin=client(),token=t=>t.match(/name="csrf" value="([a-f0-9]+)"/)[1];
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const path='/connect/sign-cafe/overseas/';
try{
 for(let i=0;i<40;i++){try{await anon('/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const domesticBefore=(await anon('/connect/sign-cafe/')).text.match(/<tbody>[\s\S]*?<\/tbody>/)[0];
 let r=await anon(path);ok(r.status===200&&r.text.includes('掲載準備中'),'empty overseas page');
 ok(r.text.includes('href="/connect/sign-cafe/overseas/" aria-current="page"'),'peer selected tab');
 ok(!r.text.includes('class="dn-cafe-row"'),'no domestic records in overseas');
 ok((await anon(path+'index.html?q=x')).headers.get('location')===path+'?q=x','index redirect preserves query');
 ok((await anon(path.slice(0,-1))).status===308,'slash redirect');
 ok((await anon('/directory-sitemap.xml')).text.includes(path),'sitemap entry');
 ok((await anon('/admin/?view=records&kind=cafe&scope=overseas')).text.includes('管理画面にログイン'),'admin protected');
 r=await admin('/admin/');ok((await admin('/admin/',{csrf:token(r.text),action:'login',username:'testadmin',password})).status===303,'login');
 r=await admin('/admin/');const csrf=token(r.text),post=async p=>admin('/admin/',{csrf,...p});
 r=await admin('/admin/?view=records&kind=cafe&scope=overseas');ok(r.text.includes('海外の手話カフェ一覧')&&!r.text.includes('>Knot</a>'),'separate admin list');
 ok(r.text.includes('view=edit&kind=cafe&scope=overseas'),'dedicated create link');
 r=await admin('/admin/?view=edit&kind=cafe&scope=overseas');
 ok(/name="country_code"[^>]*value=""/.test(r.text)&&!/name="timezone"[^>]*value="Asia\/Tokyo"/.test(r.text),'no guessed country or timezone');
 ok(r.text.includes('value="overseas" selected'),'overseas create selection');
 const fixture={action:'save_record',kind:'cafe',scope:'overseas',id:'',revision:'0',slug:'overseas-fixture',name:'海外検証カフェ <script>bad</script>',country_code:'US',country_name:'アメリカ',prefecture:'',city:'Test City',address:'',timezone:'America/New_York',publication:'pending',status:'open',type:'permanent',verification_level:'pending',verification_sources:'',last_verified_at:'',sign_support:'ASL・筆談（合成データ）'};
 ok((await post({...fixture,csrf:'invalid'})).status===403,'CSRF required');
 for(const patch of [{country_code:'JP'},{country_code:'USA'},{country_name:''},{city:''},{timezone:'invalid'},{slug:'overseas'},{publication:'public'}])ok((await post({...fixture,...patch})).status===400,'invalid overseas input rejected');
 ok((await post(fixture)).status===303,'save overseas draft with no state');
 const id=sql("echo query(\"SELECT id FROM records WHERE slug='overseas-fixture'\")->fetchColumn();").stdout.trim();
 ok((await anon('/connect/sign-cafe/overseas-fixture/')).status===404,'draft hidden');
 r=await admin('/admin/?view=edit&kind=cafe&id='+id);ok(r.text.includes('海外の手話カフェの編集')&&r.text.includes('value="US"'),'existing edit infers scope');
 const published={...fixture,id,revision:'1',publication:'public',verification_level:'official',verification_sources:'https://example.org/source',last_verified_at:new Date().toISOString().slice(0,10)};
 ok((await post(published)).status===303,'publish verified fixture');
 r=await anon(path+'?country=US&q='+encodeURIComponent('アメリカ'));
 ok(r.text.includes('data-slug="overseas-fixture"')&&r.text.includes('value="US" selected'),'country search and selected filter persist');
 ok(!r.text.includes('<script>bad</script>')&&r.text.includes('&lt;script&gt;'),'stored text escaped');
 ok(!(await anon(path+'?country=GB')).text.includes('data-slug="overseas-fixture"'),'country filter excludes other country');
 ok((await anon('/connect/sign-cafe/')).text.match(/<tbody>[\s\S]*?<\/tbody>/)[0]===domesticBefore,'domestic listing unchanged');
 ok(!(await anon('/connect/sign-cafe/map/')).text.includes('海外検証カフェ'),'Japan map does not show overseas as unlocated');
 r=await anon('/connect/sign-cafe/overseas-fixture/');ok(r.status===200&&r.text.includes('href="/connect/sign-cafe/overseas/">← 一覧へ'),'detail returns overseas');
 r=await admin('/admin/?view=records&kind=cafe&scope=overseas&q='+encodeURIComponent('アメリカ')+'&sort=name&dir=asc');
 ok(r.text.includes('海外検証カフェ')&&r.text.includes('scope=overseas')&&r.text.includes('アメリカ'),'admin country search and region');
 ok(!(await admin('/admin/?view=records&kind=cafe&scope=domestic')).text.includes('海外検証カフェ'),'admin domestic excludes overseas');
 ok((await post(published)).status===409,'concurrent stale save rejected');
 let revision=2;
 for(const publication of ['private','public','deleted','public']){
  ok((await post({...published,revision:String(revision++),publication})).status===303,'publication transition '+publication);
  ok((await anon('/connect/sign-cafe/overseas-fixture/')).status===(publication==='public'?200:404),'public visibility '+publication);
 }
 ok((await post({...published,revision:String(revision),status:'closed'})).status===303,'closed history saved');
 ok(!(await anon(path)).text.includes('data-slug="overseas-fixture"')&&(await anon(path+'?history=1')).text.includes('data-slug="overseas-fixture"'),'closed history opt in');
 ok((await post({...published,id:'',revision:'0',kind:'store',signing_store:'1',slug:'overseas-signing-fixture',name:'Overseas Signing Fixture'})).status===303,'foreign signing store created as store');
 ok((await anon(path)).text.includes('data-slug="overseas-signing-fixture"'),'signing store included in overseas public list');
 r=await admin('/admin/?view=records&kind=cafe&scope=overseas');ok(r.text.includes('Overseas Signing Fixture')&&r.text.includes('kind=store&id='),'overseas admin includes signing store with correct edit kind');
 ok(!(await anon('/connect/sign-cafe/starbucks/')).text.includes('Overseas Signing Fixture'),'Japan Starbucks list excludes overseas store');
 ok(!(await anon('/connect/sign-cafe/overseas-signing-fixture/')).text.includes('スターバックス コーヒー ジャパン株式会社'),'foreign detail does not imply Japan operator');
 ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no PHP runtime warnings');
 ok(run(['server/cli.php','check']).status===0,'database integrity');
 console.log(JSON.stringify({result:'OVERSEAS_CAFES_TESTS_OK',checks,productionWrites:false}));
}finally{server.kill();}
