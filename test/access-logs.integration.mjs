import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, appendFileSync, renameSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomBytes} from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const preview = process.argv.includes('--preview');
const dir = mkdtempSync(join(tmpdir(), 'deafnavi-access-'));
const logsDir = join(dir, 'access-logs');
const env = {...process.env, DEAFNAVI_DATA_DIR:dir, DEAFNAVI_LOCAL_TEST:'1', DEAFNAVI_ACCESS_LOG_DIR:logsDir};
const password = preview ? 'Local-only-demo-2026' : randomBytes(18).toString('hex');
const run = (args, input) => spawnSync('php', args, {cwd:root, env, input, encoding:'utf8'});
const hash = run(['test/directory-hash.php'], password).stdout;
assert.equal(run(['server/cli.php','init'], JSON.stringify({username:'testadmin',password_hash:hash})).status, 0);
const core = join(root,'server/core.php').replaceAll('\\','/');
const access = join(root,'server/access-logs.php').replaceAll('\\','/');
const sql = code => run(['-r', `require '${core}';${code}`]);
assert.equal(sql("query('UPDATE users SET must_change=0');query('INSERT INTO users(username,password_hash,role,must_change,created_at) SELECT ?,password_hash,?,0,created_at FROM users WHERE id=1',['testeditor','editor']);").status, 0);
const port = preview ? 5199 : 5198;
const server = spawn('php',['-S',`127.0.0.1:${port}`,'-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let errors = '';
server.stderr.on('data', b => errors += b);
function client() {
    let cookie = '';
    return async (path, data) => {
        const r = await fetch(`http://127.0.0.1:${port}${path}`, {method:data?'POST':'GET', redirect:'manual', headers:{cookie,...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined});
        for (const c of r.headers.getSetCookie()) if (c.startsWith('deafnavi_directory=')) cookie = c.split(';')[0];
        return {status:r.status,text:await r.text(),headers:r.headers};
    };
}
const admin = client(), editor = client(), anon = client();
const csrf = text => text.match(/name="csrf" value="([a-f0-9]+)"/)[1];
let checks = 0;
const ok = (v,m) => {assert.ok(v,m); checks++;};
const entry = (uri, ts, extra={}) => ({ts,request:{host:'deafnavi.com',method:'GET',uri},status:200,duration:0.0123,size:1234,...extra});
const now = Math.floor(Date.now()/1000);
const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const start = Date.parse(`${day}T00:00:00+09:00`)/1000;
const query = `&from=${day}&to=${day}`;
const fixture = [entry('/previous-day/',start-1),entry('/midnight/',start),entry('/world/',start+1),entry('/connect/sign-cafe/overseas/',start+2),
    entry('/app/v1/index.json',start+3),entry('/directory.css',start+4),entry('/admin/?csrf=PRIVATE_MARKER',start+5),
    entry('/missing/',start+6,{status:404}),entry('/broken/',start+7,{status:503}),entry('/head/',start+8,{request:{host:'deafnavi.com',method:'HEAD',uri:'/head/'}}),
    entry('/%3Cscript%3E/',start+9),entry('/<img src=x onerror=alert(1)>/',start+10),entry('/next-day/',start+86400)];
const report = opts => {
    const result = run(['-r',`require '${core}';require '${access}';echo json(access_report(json_decode($argv[1],true)));`,JSON.stringify({start,end:start+86400,group:'all',status:'',q:'',page:1,limit:25,...opts})]);
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout);
};
try {
    for(let i=0;i<40;i++){try{await anon('/admin/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
    let r = await anon('/admin/?view=access');
    ok(r.status===200 && r.text.includes('管理画面にログイン') && !r.text.includes('URL別件数'),'anonymous sees login only');
    for (const [c,name] of [[admin,'testadmin'],[editor,'testeditor']]) {
        r = await c('/admin/');
        ok((await c('/admin/',{csrf:csrf(r.text),action:'login',username:name,password})).status===303,'login');
    }
    ok((await editor('/admin/?view=access')).status===403,'editor denied direct view');
    ok(!(await editor('/admin/')).text.includes('view=access'),'editor menu hidden');
    ok((await admin('/admin/')).text.includes('view=access'),'admin menu visible');
    r = await admin('/admin/?view=access');
    ok(r.status===200 && r.text.includes('アクセスログを読み取れません') && !r.text.includes('選択条件のリクエスト'),'missing is not zero');
    mkdirSync(logsDir);
    writeFileSync(join(logsDir,'access.log'),'');
    r = await admin('/admin/?view=access');
    ok(r.text.includes('一致するアクセスはありません') && !r.text.includes('読み取れません'),'empty valid log');
    writeFileSync(join(logsDir,'access-2026-09-08T00-00-00-time.log'),fixture.slice(0,4).map(JSON.stringify).join('\n')+'\n');
    writeFileSync(join(logsDir,'access.log'),fixture.slice(4).map(JSON.stringify).join('\n')+'\n');
    const before = readFileSync(join(logsDir,'access.log'),'utf8');
    const a = report({});
    ok(a.total===11 && a.pages===5 && a.not_found===1 && a.errors===1,'all files, JST boundaries, method and status counts');
    ok(a.days[day]===11 && a.rows[0].path==='/<img src=x onerror=alert(1)>/','daily and reverse order');
    ok(!JSON.stringify(a).includes('PRIVATE_MARKER'),'query removed again by reader');
    ok(report({group:'data'}).total===1 && report({group:'assets'}).total===1 && report({group:'management'}).total===1,'content classes');
    ok(report({status:'4xx'}).total===1 && report({status:'5xx'}).total===1,'status filter');
    ok(report({q:'sign-cafe'}).total===1,'path search');
    ok(report({page:2,limit:3}).rows[0].path===a.rows[3].path,'page slice');
    ok(report({q:"' OR 1=1 --"}).total===0,'search is literal');
    for (const tab of ['paths','days','requests','unique']) {
        r = await admin('/admin/?view=access'+query+'&tab='+tab);
        ok(r.status===200 && r.text.includes('アクセスログ'),'view '+tab);
        ok(!r.text.includes('PRIVATE_MARKER') && !r.text.includes('<img src=x onerror='),'secret and markup absent');
        ok(r.headers.get('cache-control').includes('no-store') && r.headers.get('x-robots-tag').includes('noindex'),'cache and index protection');
    }
    r = await admin('/admin/?view=access'+query+'&q=%3Cscript%3E');
    ok(r.text.includes('&lt;script&gt;') && !r.text.includes('<script>'),'filter escaped');
    for(const bad of ['&from=2026-02-30','&from=2025-01-01&to=2026-01-01','&from=2026-09-10&to=2026-09-01','&group=invalid','&status=BAD','&tab=invalid','&q[]=x'])
        ok((await admin('/admin/?view=access'+bad)).status===400,'reject invalid option '+bad);
    ok(readFileSync(join(logsDir,'access.log'),'utf8')===before,'viewer does not mutate logs');
    appendFileSync(join(logsDir,'access.log'),'{"ts":');
    ok(report({}).total===11 && report({}).invalid===0,'incomplete final write deferred');
    appendFileSync(join(logsDir,'access.log'),'broken}\n');
    ok(report({}).invalid===1,'malformed complete line reported');
    ok((await admin('/admin/?view=access'+query)).text.includes('一部のログを集計できていません'),'partial disclosure');
    // Chunk boundary, oversized rows and data shape errors must remain bounded.
    writeFileSync(join(logsDir,'access.log'),Array.from({length:700},(_,i)=>JSON.stringify(entry('/long-'+i+'/'+'a'.repeat(150),start+100+i))).join('\n')+'\n');
    ok(report({}).total===703 && report({}).rows[0].path.startsWith('/long-699/'),'reverse reader spans 64 KiB boundary');
    writeFileSync(join(logsDir,'access.log'),'x'.repeat(140000)+'\n');
    ok(report({}).partial,'oversized record bounded');
    writeFileSync(join(logsDir,'access.log'),JSON.stringify({ts:now,request:'wrong'})+'\n');
    ok(report({}).invalid===1,'invalid shape handled');
    ok(run(['server/cli.php','check']).status===0,'application DB intact');
    writeFileSync(join(logsDir,'access.log'),['human','ai','bot','automation','unknown'].map((client_kind,i)=>JSON.stringify(entry('/class-'+i+'/',start+100+i,{client_kind}))).join('\n')+'\n');
    ok(report({client:'ai'}).total===1 && report({client:'bot'}).total===1 && report({client:'human'}).total===1,'category filter');
    const rotated=join(logsDir,'access-v2-2026-09-08T00-00-00-time.log');
    writeFileSync(rotated,JSON.stringify(entry('/v2/',start+200,{client_kind:'automation'}))+'\n');
    ok(report({q:'/v2/'}).total===1,'new rotated filenames supported');
    ok((await admin('/admin/?view=access&client=untrusted')).status===400,'invalid category rejected');
    const from180=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(Date.now()-179*86400000));
    ok((await admin('/admin/?view=access&from='+from180+'&to='+day)).status===200,'full 180-day range accepted');
    const visitors=join(dir,'access-visitors');mkdirSync(visitors);
    ok(run(['-r',`require '${core}';require '${access}';access_visitor_init();access_record_visit('/','192.0.2.1','Mozilla/5.0 LocalTest');access_record_visit('/guide/','192.0.2.1','Mozilla/5.0 LocalTest');`]).status===0,'UU fixture initialized');
    r=await admin('/admin/?view=access&tab=unique'+query);
    ok(r.text.includes('1 人') && r.text.includes('Cookieや端末への識別子保存は使いません') && !r.text.includes('推定ユニーク数を取得できません'),'unique viewer and estimation explanation');
    ok(!/Fatal error|Warning:|Uncaught/.test(errors),'no PHP warnings');
    console.log(JSON.stringify({result:'ACCESS_LOGS_TESTS_OK',checks,productionWrites:false}));
    if(preview){
        writeFileSync(join(logsDir,'access.log'),fixture.slice(4).map(JSON.stringify).join('\n')+'\n');
        console.log(`PREVIEW_READY http://127.0.0.1:${port}/admin/?view=access`);
        await new Promise(()=>{});
    }
} finally {server.kill();}
