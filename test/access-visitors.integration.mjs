import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(import.meta.dirname,'..'), dir=mkdtempSync(join(tmpdir(),'dn-visitors-'));
const env={...process.env,DEAFNAVI_LOCAL_TEST:'1',DEAFNAVI_VISITOR_DIR:dir};
const run=code=>spawnSync('php',['-r',`require 'server/access-visitors.php';${code}`],{cwd:root,env,encoding:'utf8'});
assert.equal(run('access_visitor_init();').status,0);
let checks=0; const ok=(value,label)=>{assert.ok(value,label);checks++;};
const ua='Mozilla/5.0 TestBrowser';
const fixture=run(`$at=new DateTimeImmutable('2026-09-08T00:00:00+09:00');
    for($i=0;$i<20;$i++) access_record_visit('/','192.0.2.1','${ua}',$at);
    access_record_visit('/guide/','192.0.2.1','${ua}',$at);
    access_record_visit('/','192.0.2.2','${ua}',$at);
    access_record_visit('/','192.0.2.1','${ua} Other',$at);
    access_record_visit('/','192.0.2.1','${ua}',$at->modify('-1 second'));
    echo json_encode(access_visitor_db()->query('SELECT * FROM visits')->fetchAll());`);
assert.equal(fixture.status,0,fixture.stderr);
const rows=JSON.parse(fixture.stdout);
ok(rows.length===5,'daily per-page dedup and different connections');
ok(new Set(rows.map(r=>r.visitor)).size===4,'no cross-day identifier');
ok(rows.every(r=>/^[0-9a-f]{64}$/.test(r.visitor)),'HMAC only');
const report=JSON.parse(run(`echo json_encode(access_unique_report(['from'=>'2026-09-07','to'=>'2026-09-08','q'=>'']));`).stdout);
ok(report.days['2026-09-08']===3 && report.total===4,'same visitor across pages counted once per day');
ok(!readFileSync(join(dir,'visitors.sqlite')).includes(Buffer.from('192.0.2.')) && !readFileSync(join(dir,'visitors.sqlite')).includes(Buffer.from(ua)),'raw IP and UA absent from DB');
for(const [agent,marker,expected] of [[ua,'','human'],['Googlebot','','bot'],['GPTBot','','ai'],['curl/8','','automation'],[ua,'codex','ai'],['','','unknown']])
    ok(run(`echo access_client(${JSON.stringify(agent)},${JSON.stringify(marker)});`).stdout===expected,'class '+expected);
// Concurrent retries resolve through the unique database key.
await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{
    const p=spawn('php',['-r',`require 'server/access-visitors.php';access_record_visit('/guide/','192.0.2.3','${ua}',new DateTimeImmutable('2026-09-08'));`],{cwd:root,env,stdio:'ignore'});
    p.on('exit',code=>code===0?resolve():reject(new Error('parallel insert '+code)));
})));
ok(run("echo access_visitor_db()->query('SELECT COUNT(*) FROM visits')->fetchColumn();").stdout==='6','concurrent requests dedup');
const port=5201,origin=`http://127.0.0.1:${port}`;
const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t','docs','server/local-router.php'],{cwd:root,env,stdio:'ignore'});
try {
    for(let i=0;i<40;i++){try{await fetch(origin);break;}catch{await new Promise(r=>setTimeout(r,100));}}
    const post=(data,headers={})=>fetch(origin+'/_access/visit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':ua,...headers},body:JSON.stringify(data)});
    const before=Number(run("echo access_visitor_db()->query('SELECT COUNT(*) FROM visits')->fetchColumn();").stdout);
    let r=await post({path:'/'});ok(r.status===204 && !r.headers.has('set-cookie'),'beacon success with no cookie');
    await post({path:'/'});
    const count=()=>Number(run("echo access_visitor_db()->query('SELECT COUNT(*) FROM visits')->fetchColumn();").stdout);
    ok(count()===before+1,'same browser repeated beacon adds one row');
    for(const data of [{path:'/guide/',automated:true},{path:'/guide/'}]) {
        const headers=data.automated?{}:{'User-Agent':'Googlebot'};
        ok((await post(data,headers)).status===204,'bot acknowledged');
    }
    await post({path:'/guide/'},{'X-DeafNavi-Client':'codex'});
    ok(count()===before+1,'bot, webdriver and Codex excluded');
    ok((await post({path:'/'},{Origin:'https://elsewhere.invalid'})).status===403,'cross-origin rejected');
    for(const path of ['/admin/','/submit/','/../../secret','/app/v1/index.json','/?q=PRIVATE','/unknown-not-a-page/'])
        ok((await post({path})).status===400,'reject non-public page '+path);
    ok((await fetch(origin+'/_access/visit')).status===405,'GET cannot record');
    ok((await post({path:'/',unused:'x'.repeat(1100)})).status===413,'body bounded');
} finally {server.kill();}
// Browser script payload never includes search values, cookies, referrer or page text.
const calls=[]; const context={window:{},location:{hostname:'deafnavi.com',pathname:'/',search:'?q=PRIVATE&dn_client=codex'},navigator:{webdriver:false},URLSearchParams,fetch:(...args)=>{calls.push(args);return Promise.resolve();}};
vm.runInNewContext(readFileSync(join(root,'src/access-visit.js'),'utf8'),context);
vm.runInNewContext(readFileSync(join(root,'src/access-visit.js'),'utf8'),context);
ok(calls.length===1 && calls[0][1].credentials==='omit' && !JSON.stringify(calls).includes('PRIVATE'),'one beacon and no cookie/query data');
ok(calls[0][1].headers['X-DeafNavi-Client']==='codex','explicit Codex marker retained as category');
console.log(JSON.stringify({result:'ACCESS_VISITORS_TESTS_OK',checks}));
