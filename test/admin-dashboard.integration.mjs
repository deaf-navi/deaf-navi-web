import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),env={...process.env,DEAFNAVI_DATA_DIR:mkdtempSync(join(tmpdir(),'deafnavi-admin-dash-')),DEAFNAVI_LOCAL_TEST:'1'},password=randomBytes(18).toString('hex');
const run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});const hash=run(['test/directory-hash.php'],password).stdout;
const qualityRelease=run(['test/quality-report-release.php']);assert.equal(qualityRelease.status,0,qualityRelease.stderr||qualityRelease.stdout);
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
ok(r.text.includes('品質集計は未取得'),'missing report is unknown, not zero');
const coverage=Object.fromEntries(['time','fee','signup','deadline','communication'].map(k=>[k,{confirmed:0,notApplicable:0,unknown:0,total:0}]));
writeFileSync(join(env.DEAFNAVI_DATA_DIR,'publication-quality-report.json'),JSON.stringify({schemaVersion:'deafnavi-quality-report.v1',generatedAt:new Date().toISOString(),range:{from:'2026-10-29',through:'2026-11-27'},coverage,events:[],holds:[{title:'<script>quality-fixture</script>',translatedTitle:'<b>訳文</b>',reason:'source-date-mismatch',sourcePublishedDate:'2001-02-13',sourceUpdatedDate:null,feedPublishedAt:'2026-02-11T20:46:09.000Z',articleUrl:'javascript:alert(1)',sourceUrl:'https://example.org/quality-source'}],recheckDue:0,classificationReview:[]}));
r=await admin('/admin/');ok(r.text.includes('今後30日のイベント情報充足')&&r.text.includes('&lt;script&gt;quality-fixture')&&!r.text.includes('<script>quality-fixture'),'private report renders escaped source evidence');
ok(r.text.includes('href="https://example.org/quality-source"')&&!r.text.includes('href="javascript:')&&r.text.includes('&lt;b&gt;訳文'),'held source links validate protocol and translation escapes');
ok(r.text.includes('原記事と配信日時が不一致')&&r.text.includes('原記事の公開日：2001-02-13')&&r.text.includes('配信日時：2026-02-11T20:46:09.000Z'),'source and feed dates remain distinct');
ok(!(await anon('/admin/')).text.includes('quality-fixture'),'report is behind existing admin authentication');
const reportPath=join(env.DEAFNAVI_DATA_DIR,'publication-quality-report.json');
writeFileSync(reportPath,JSON.stringify({schemaVersion:'deafnavi-quality-report.v1',generatedAt:new Date().toISOString(),range:{from:'2026-10-29',through:'2026-11-27'},coverage,events:[],holds:[],recheckDue:0,classificationReview:[],resolvedReviews:[
 {status:'archived',title:'<script>archive-fixture</script>',sourcePublishedDate:'2001-02-13',feedPublishedAt:'2026-02-11T20:46:09.000Z',articleUrl:'javascript:alert(1)',sourceUrl:'https://example.org/archive',reviewNote:'<img src=x onerror=alert(1)>'},
 {status:'excluded',title:'広告 fixture',reason:'advertisement',articleUrl:'https://example.org/ad'},
]}));
r=await admin('/admin/');ok(r.text.includes('公開保留：0件')&&r.text.includes('処理済みの確認記録（2件）')&&r.text.includes('過去記事として保管')&&r.text.includes('記事広告のため対象外'),'resolved records stay separate from holds');
ok(r.text.includes('&lt;script&gt;archive-fixture')&&r.text.includes('&lt;img src=x')&&!r.text.includes('<script>archive-fixture')&&!r.text.includes('href="javascript:'),'resolved notes and links are escaped and validated');
ok(r.text.includes('原記事の公開日：2001-02-13')&&r.text.includes('配信日時：2026-02-11T20:46:09.000Z'),'archive retains source and collected dates independently');
ok(!(await anon('/admin/')).text.includes('archive-fixture'),'resolved report remains private');
const detailed=JSON.parse(readFileSync(reportPath,'utf8'));
detailed.resolvedReviews[0].sourcePublication={editorialOriginalDate:'2020-08-27',originalPublishedDate:'2020-08-27',pageRepublishedDate:'2021-05-07',originalPublishedAtUtc:null};
detailed.resolvedReviews.push({status:'archived',title:'UTC date fixture',sourcePublication:{originalPublishedDate:'2001-02-13',originalPublishedAtUtc:'2001-02-14T03:58:44Z'},feedPublishedAt:'2026-02-11T20:46:09Z'});
detailed.holds=[{title:'Reopened fixture',reason:'source-changed-after-closure',reopenedFrom:{status:'archived'},previousSourcePublication:{originalPublishedDate:'2001-02-13'},articleUrl:'https://example.org/original'}];
detailed.integrityWarnings=[{id:'fixture',reason:'disposition-checksum-mismatch'}];writeFileSync(reportPath,JSON.stringify(detailed));r=await admin('/admin/');
ok(r.text.includes('初出（編集注記）：2020-08-27')&&r.text.includes('ページ再公開日：2021-05-07')&&!r.text.includes('原記事の更新日：2021-05-07'),'editorial first publication and republication are distinct');
ok(r.text.includes('公開日（媒体の表示）：2001-02-13')&&r.text.includes('公開日時（UTC）：2001-02-14T03:58:44Z'),'publisher date and UTC instant remain distinct');
ok(r.text.includes('処理済み記事の原文が変更')&&r.text.includes('前回確認した原記事の公開日：2001-02-13'),'reopened closure keeps prior date context');
ok(r.text.includes('role="alert">処理済みの確認記録に整合性の不一致が1件'),'checksum warning is visible to authenticated admin');
writeFileSync(reportPath,JSON.stringify({schemaVersion:'deafnavi-quality-report.v1',generatedAt:new Date().toISOString(),range:{from:'2026-10-29',through:'2026-11-27'},coverage:{},events:[],holds:[],recheckDue:0,classificationReview:[]}));
ok((await admin('/admin/')).text.includes('品質集計は未取得'),'incomplete coverage is unknown, not zero');
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
