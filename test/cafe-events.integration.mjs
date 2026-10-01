// Isolated SQLite + HTTP: approved additions, history, navigation and privacy.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),dir=mkdtempSync(join(tmpdir(),'deafnavi-events-'));
const env={...process.env,DEAFNAVI_DATA_DIR:dir,DEAFNAVI_LOCAL_TEST:'1'};
const run=(args,input)=>spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});
const core=join(root,'server/core.php').replaceAll('\\','/');
const sql=code=>{const r=run(['-r',`require '${core}';${code}`]);assert.equal(r.status,0,r.stderr);return r.stdout;};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const hash=run(['test/directory-hash.php'],randomBytes(20).toString('hex'));
assert.equal(hash.status,0);assert.equal(run(['server/cli.php','init'],JSON.stringify({username:'eventfixture',password_hash:hash.stdout})).status,0);
const snapshot=()=>sql(`$out=[];foreach(['records','users','settings','submissions','outbox','audit'] as $t)$out[$t]=query('SELECT * FROM '.$t.' ORDER BY 1')->fetchAll();echo json($out);`);
const manifest=JSON.parse(readFileSync(join(root,'research/cafes-and-events-20261001.json'),'utf8'));
const file=join(dir,'manifest.json'),backup=join(dir,'backups');mkdirSync(backup);writeFileSync(file,JSON.stringify(manifest));
const before=JSON.parse(snapshot());let r=run(['server/import-cafe-listings.php','--dry-run',file]);assert.equal(r.status,0,r.stderr);
const plan=JSON.parse(r.stdout);ok(plan.added===7,'seven reviewed additions');ok(plan.records.filter(x=>x.classification==='event').length===4,'four dated events');
ok(snapshot()===JSON.stringify(before),'dry run changes no rows');
r=run(['server/import-cafe-listings.php','--apply',file,backup,'wrong']);ok(r.status!==0&&snapshot()===JSON.stringify(before),'unapproved plan changes nothing');
// Simulate a concurrent operator edit, then use a freshly reviewed plan.
sql(`query("UPDATE records SET revision=revision+1 WHERE id='knot'");`);
const concurrent=snapshot();r=run(['server/import-cafe-listings.php','--apply',file,backup,plan.plan_sha256]);ok(r.status!==0&&snapshot()===concurrent,'concurrent data change invalidates the plan');
r=run(['server/import-cafe-listings.php','--dry-run',file]);assert.equal(r.status,0,r.stderr);const latest=JSON.parse(r.stdout),current=JSON.parse(snapshot());
r=run(['server/import-cafe-listings.php','--apply',file,backup,latest.plan_sha256]);assert.equal(r.status,0,r.stderr);const applied=JSON.parse(r.stdout),after=JSON.parse(snapshot());
ok(applied.result==='CAFE_LISTINGS_APPLIED'&&applied.changed,'reviewed import succeeds');
ok(after.records.length===current.records.length+7,'only seven additions');
for(const row of current.records)ok(JSON.stringify(after.records.find(x=>x.id===row.id))===JSON.stringify(row),'old record retained '+row.id);
for(const table of ['users','settings','submissions','outbox'])ok(JSON.stringify(after[table])===JSON.stringify(current[table]),'protected table retained '+table);
ok(after.audit.length===current.audit.length+7,'audit records only the additions');
ok(readdirSync(backup).length===1,'one private consistent backup');
const backupCore=sql(`$b=new PDO('sqlite:'.${JSON.stringify(applied.backup)});echo json($b->query('SELECT * FROM records ORDER BY 1')->fetchAll(PDO::FETCH_ASSOC));`);
ok(backupCore===JSON.stringify(current.records),'backup contains exact pre-import rows');
ok(run(['server/cli.php','check']).status===0,'integrity and foreign keys');
const stable=snapshot();r=run(['server/import-cafe-listings.php','--apply',file,backup,latest.plan_sha256]);ok(r.status===0&&JSON.parse(r.stdout).result==='ALREADY_APPLIED'&&snapshot()===stable,'repeat is idempotent');
manifest.additions[0].data.notes='Changed after approval';writeFileSync(file,JSON.stringify(manifest));r=run(['server/import-cafe-listings.php','--dry-run',file]);ok(r.status!==0&&snapshot()===stable,'batch tampering blocked');
const conflict=structuredClone(manifest);conflict.batch='duplicate-event-test';conflict.additions=[{...conflict.additions[0],id:'duplicate-review-test',data:{...conflict.additions[0].data,slug:'duplicate-review-test'}}];
writeFileSync(file,JSON.stringify(conflict));r=run(['server/import-cafe-listings.php','--dry-run',file]);ok(r.status!==0&&snapshot()===stable,'existing venue duplicate rejected');
conflict.batch='pending-publication-test';conflict.additions[0].data.publication='pending';writeFileSync(file,JSON.stringify(conflict));r=run(['server/import-cafe-listings.php','--dry-run',file]);ok(r.status!==0&&snapshot()===stable,'publication must be explicit');
const p=JSON.parse(sql(`echo json(expanded(record('overdoughs-cafe-circuit')));`));ok(p.has_deaf_staff===null&&p.is_deaf_owned===null&&p.sign_language_support===null,'unverified overseas attributes stay unknown');
ok(JSON.parse(sql(`echo json(expanded(record('cafe-yourself-chubo-sign')));`)).address==='','incomplete event address stays unknown');
// Stable synthetic dates ensure history behavior remains testable after 2026.
sql(`$p=expanded(record('lacic-toyonaka-sign-cafe'));foreach(['future'=>'2099-10-18','past'=>'2001-09-21','undated'=>''] as $key=>$date){$p['slug']='event-fixture-'.$key;$p['name']='Event fixture '.$key;$p['activity_date']=$date;$p['event_reported']=false;$p['internal_note']='PRIVATE_EVENT_SENTINEL';save_record($p,'cafe','event-fixture-'.$key);}
$store=expanded(query("SELECT * FROM records WHERE kind='store' AND publication='public' LIMIT 1")->fetch());$legacy=['slug'=>'event-fixture-observation','name'=>'Legacy observation fixture','country_code'=>$store['country_code'],'prefecture'=>$store['prefecture'],'city'=>$store['city'],'publication'=>'public','status'=>'ended','store_id'=>$store['id'],'observation_only'=>'1','event_date'=>'','timezone'=>'Asia/Tokyo','verification_level'=>'official','verification_sources'=>['https://example.org/report'],'last_verified_at'=>'2026-09-01'];save_record($legacy,'event','event-fixture-observation');
$store['slug']='event-fixture-private-store';$store['name']='Hidden store fixture';$store['publication']='private';save_record($store,'store','event-fixture-private-store');$legacy['slug']='event-fixture-hidden';$legacy['name']='PRIVATE_EVENT_PARENT_SENTINEL';$legacy['store_id']='event-fixture-private-store';save_record($legacy,'event','event-fixture-hidden');`);
// Unit-level date boundary covers Japan / overseas and report vs announcement.
const eventFile=join(root,'server/cafe-events.php').replaceAll('\\','/');
ok(sql(`require '${eventFile}';$p=['kind'=>'cafe','shop_type'=>'event','status'=>'unknown','confirmation_status'=>'confirmed','activity_date'=>'2026-10-18'];echo cafe_event_period($p,new DateTimeImmutable('2026-10-18'));`) === 'upcoming','same-day event remains upcoming');
const server=spawn('php',['-S','127.0.0.1:5231','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);
const base='http://127.0.0.1:5231',route='/connect/sign-cafe/events/';
const request=async path=>{const response=await fetch(base+path,{redirect:'manual'});return {response,html:await response.text()};};
const ld=html=>[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
try{
 for(let i=0;i<50;i++){try{await request(route);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 let {response,html}=await request(route);ok(response.status===200,'event tab available');ok(html.includes('<h1>手話カフェイベント</h1>'),'descriptive event heading');
 const tabs=html.match(/<nav class="dn-tabs"[^>]*>([\s\S]*?)<\/nav>/)?.[1]??'';
 ok((tabs.match(/<a /g)||[]).length===3&&tabs.includes('href="'+route+'" aria-current="page"'),'three tabs, correct current state');
 ok(html.includes('data-event-id="event-fixture-future"')&&!html.includes('data-event-id="event-fixture-past"')&&!html.includes('data-event-id="event-fixture-undated"'),'default is upcoming only');
 ok(!html.includes('PRIVATE_EVENT_SENTINEL')&&!html.includes('PRIVATE_EVENT_PARENT_SENTINEL'),'private fields and hidden venues never exposed');
 const schema=ld(html).find(x=>x['@type']==='CollectionPage');ok(schema?.mainEntity.itemListElement.some(x=>x.url.endsWith('/event-fixture-future/')),'schema describes rendered events');
 ok(!ld(html).some(x=>x['@type']==='Event'),'no invented Event structured data');
 ({html}=await request(route+'?period=past'));ok(html.includes('data-event-id="event-fixture-past"')&&!html.includes('data-event-id="event-fixture-future"'),'past events separate');
 ok(html.includes('開催報告あり')&&html.includes('実施済み・次回開催を示すものではありません'),'report and announcement distinguished');
 ok(html.includes('Legacy observation fixture')&&html.includes('日時未確認の開催実績'),'legacy observation remains in history');
 ok(html.includes('name="robots" content="noindex,follow"'),'filtered historical list not indexed');
 ({html}=await request(route+'?period=unconfirmed'));ok(html.includes('data-event-id="event-fixture-undated"')&&!html.includes('Legacy observation fixture'),'undated plans separate from dated history');
 ({html}=await request(route+'?q=Event+fixture+future'));ok(html.includes('event-fixture-future')&&!html.includes('data-event-id="lacic-toyonaka-sign-cafe"'),'keyword filter');
 ({html}=await request(route+'?q='+encodeURIComponent('"><script>alert(1)</script>')));ok(!html.includes('<script>alert(1)'),'search escaped');
 ({response}=await request(route+'?period=invalid'));ok(response.status===400,'invalid period fails safely');
 ({response}=await request('/connect/sign-cafe/events?dn_client=codex'));ok(response.status===308&&response.headers.get('location')===route+'?dn_client=codex','slash redirect retains marker');
 ({response}=await request('/connect/sign-cafe/?events=1&q=test&dn_client=codex'));ok(response.status===302&&response.headers.get('location')===route+'?q=test&dn_client=codex','legacy single-event filter points to new tab');
 for(const query of ['','?listing=all&view=cards','?shop_type=unknown&status=all','?closed=1']){
   ({html}=await request('/connect/sign-cafe/'+query));ok(!html.includes('data-cafe-id="event-fixture-future"')&&!html.includes('>Event fixture future<'),'single events excluded from all domestic lists '+query);
 }
 ({html}=await request('/connect/sign-cafe/?q='+encodeURIComponent('世田谷区')));ok(html.includes('setagaya-jinzai-sign-cafe'),'recurring program remains in cafe list');
 ({html}=await request('/connect/sign-cafe/overseas/?q=Overdoughs'));ok(html.includes('overdoughs-cafe-circuit'),'constant overseas cafe in overseas tab');
 ({html}=await request('/connect/sign-cafe/cafe-yourself-chubo-sign/'));ok(html.includes('実際に開催されたか・次回の日程は未確認')&&!html.includes('手話や筆談で交流できるスポットです'),'historical event detail is unambiguous');
 ({html}=await request('/directory-sitemap.xml'));ok(html.includes('<loc>https://deafnavi.com'+route+'</loc>')&&!html.includes('event-fixture-hidden/'),'sitemap includes tab, protects hidden parent');
 ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no PHP runtime warnings');
 console.log(JSON.stringify({result:'CAFE_EVENTS_TESTS_OK',checks,productionWrites:false}));
}finally{server.kill();}
