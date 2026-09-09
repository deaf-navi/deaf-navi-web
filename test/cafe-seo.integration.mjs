import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),env={...process.env,DEAFNAVI_DATA_DIR:mkdtempSync(join(tmpdir(),'deafnavi-seo-')),DEAFNAVI_LOCAL_TEST:'1'};
function run(args,input){const r=spawnSync('php',args,{cwd:root,env,input,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
const hash=run(['test/directory-hash.php'],randomBytes(20).toString('hex'));run(['server/cli.php','init'],JSON.stringify({username:'seofixture',password_hash:hash}));
const core=resolve(root,'server/core.php').replaceAll('\\','/');
run(['-r',`require '${core}';$p=expanded(query("SELECT * FROM records WHERE slug='knot'")->fetch());for($i=0;$i<30;$i++){$p['slug']='seo-fixture-'.$i;$p['name']='SEO fixture '.$i;$p['publication']=$i===29?'private':'public';$p['internal_note']='PRIVATE_SEO_SENTINEL';save_record($p,'cafe');}`]);
const server=spawn('php',['-S','127.0.0.1:5221','-t','docs','server/local-router.php'],{cwd:root,env,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);
const base='http://127.0.0.1:5221',route='/connect/sign-cafe/';let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const request=async p=>{const r=await fetch(base+p,{redirect:'manual'});return {response:r,html:await r.text()};};
const ld=html=>[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const meta=(html,name)=>html.match(new RegExp(`<meta name="${name}" content="([^"]+)"`))?.[1];
const canonical=html=>html.match(/<link rel="canonical" href="([^"]+)"/)?.[1].replaceAll('&amp;','&');
try{
 for(let i=0;i<50;i++){try{await request(route);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 let {html}=await request(route);ok(html.includes('<title>全国の手話カフェ一覧｜地域・営業日から探す | Deaf Navi</title>'),'clear title');ok(html.includes('<h1>全国の手話カフェ一覧</h1>'),'one descriptive H1');
 ok(meta(html,'robots').startsWith('index,follow'),'directory indexable');ok(canonical(html)==='https://deafnavi.com'+route,'clean root canonical');
 let graph=ld(html),collection=graph.find(x=>x['@type']==='CollectionPage');ok(graph.some(x=>x['@type']==='BreadcrumbList'),'breadcrumb retained');
 assert.deepEqual(graph.find(x=>x['@type']==='BreadcrumbList').itemListElement.map(x=>[x.position,x.name,x.item]),[[1,'ホーム','https://deafnavi.com/'],[2,'手話カフェ','https://deafnavi.com/connect/sign-cafe/']]);checks++;
 const siteNav=html.match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]??'';
 const navLinks=[...siteNav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
 ok(navLinks.some(([,attrs,label])=>attrs.includes('href="/connect/sign-cafe/"')&&attrs.includes('aria-current="page"')&&label.replace(/<[^>]+>/g,'').trim()==='手話カフェ')&&!html.includes('href="/connect/"'),'navigation bypasses retained connect hub');
 let paths=[...html.matchAll(/class="dn-cafe-name" href="([^"]+)"/g)].map(m=>'https://deafnavi.com'+m[1]);assert.deepEqual(collection.mainEntity.itemListElement.map(x=>x.url),paths);checks++;
 ok(paths.length===24,'paginated schema describes rendered 24 rows');ok(!html.includes('PRIVATE_SEO_SENTINEL')&&!html.includes('>SEO fixture 29<'),'private details not exposed');
 ok(html.includes('id="cafe-guide"')&&html.includes('id="cafe-policy"'),'visible helpful content');ok(html.includes('手話カフェの情報をお待ちしています'),'approved copy retained');
 ({html}=await request(route+'?page=2'));collection=ld(html).find(x=>x['@type']==='CollectionPage');ok(canonical(html).endsWith('?page=2'),'page two self canonical');ok(meta(html,'robots').startsWith('index,follow'),'page two indexable');ok(collection.mainEntity.itemListElement[0].position===25,'page positions continue');ok(html.includes('2ページ目'),'page title distinct');
 for(const q of ['q=SEO','prefecture='+encodeURIComponent('兵庫県'),'beginner_welcome=1','sort=name','per_page=48']){({html}=await request(route+'?'+q));ok(meta(html,'robots').startsWith('noindex,follow'),'filtered/display variant excluded '+q);}
 ({html}=await request(route+'?view=cards&utm_source=test'));ok(canonical(html)==='https://deafnavi.com'+route,'same items in cards consolidate to root');
 ({html}=await request(route+'?page=1'));ok(canonical(html)==='https://deafnavi.com'+route,'page one consolidates');
 ({html}=await request(route+'?q='+encodeURIComponent('"></script><script>alert(1)</script>')));ok(!html.includes('</script><script>alert(1)'),'query safely encoded');ok(meta(html,'robots').startsWith('noindex'),'empty search excluded');ld(html);
 ({html}=await request('/admin/'));ok(meta(html,'robots')==='noindex,nofollow','private robots unchanged');
 ({html}=await request('/connect/sign-cafe/overseas/'));ok(!ld(html).some(x=>x['@type']==='CollectionPage'),'domestic schema not applied overseas');
 assert.deepEqual(ld(html).find(x=>x['@type']==='BreadcrumbList').itemListElement.map(x=>[x.position,x.item]),[[1,'https://deafnavi.com/'],[2,'https://deafnavi.com/connect/sign-cafe/'],[3,'https://deafnavi.com/connect/sign-cafe/overseas/']]);checks++;
 ({html}=await request('/directory-sitemap.xml'));ok(html.includes('<loc>https://deafnavi.com/connect/sign-cafe/</loc>'),'directory sitemap contains hub');ok(!html.includes('seo-fixture-29/'),'private record absent from sitemap');
 ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no PHP warnings');console.log(JSON.stringify({result:'CAFE_SEO_TESTS_OK',checks,productionWrites:false}));
}finally{server.kill();}
