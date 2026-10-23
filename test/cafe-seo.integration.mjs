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
const areaCases=[
 ['kanagawa','cafe','JP','神奈川県','permanent','public','kanagawa'],
 ['no-page','cafe','JP','大阪府','permanent','public',null],
 ['foreign','cafe','US','東京都','permanent','public',null],
 ['community','cafe','JP','東京都','community_space','public',null],
 ['organization','cafe','JP','東京都','related_organization','public',null],
 ['one-off','cafe','JP','東京都','event','public',null],
 ['store','store','JP','東京都','permanent','public',null],
 ['private','cafe','JP','東京都','permanent','private',null],
];
run(['-r',`require '${core}';$base=expanded(query("SELECT * FROM records WHERE slug='knot'")->fetch());foreach(json_decode(stream_get_contents(STDIN),true) as [$slug,$kind,$country,$pref,$type,$publication]){$p=$base;$p['slug']='seo-area-'.$slug;$p['name']='Area fixture '.$slug;$p['country_code']=$country;$p['prefecture']=$pref;$p['shop_type']=$type;$p['publication']=$publication;save_record($p,$kind);}`],JSON.stringify(areaCases));
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
 ok((html.match(/class="dn-visit-summary"/g)||[]).length===24,'visit decisions available in every listed cafe');
 ok(html.includes('料金はどこまで確認すればよいですか？')&&html.includes('Deaf Naviのお問い合わせは掲載情報の窓口'),'practical pricing and booking guidance');
 ok(html.includes('id="cafe-guide"')&&html.includes('id="cafe-policy"'),'visible helpful content');ok(html.includes('手話カフェの情報をお待ちしています'),'approved copy retained');
 ({html}=await request(route+'?page=2'));collection=ld(html).find(x=>x['@type']==='CollectionPage');ok(canonical(html).endsWith('?page=2'),'page two self canonical');ok(meta(html,'robots').startsWith('index,follow'),'page two indexable');ok(collection.mainEntity.itemListElement[0].position===25,'page positions continue');ok(html.includes('2ページ目'),'page title distinct');
 for(const q of ['q=SEO','prefecture='+encodeURIComponent('兵庫県'),'beginner_welcome=1','sort=name','per_page=48']){({html}=await request(route+'?'+q));ok(meta(html,'robots').startsWith('noindex,follow'),'filtered/display variant excluded '+q);}
 ({html}=await request(route+'?view=cards&utm_source=test'));ok(canonical(html)==='https://deafnavi.com'+route,'same items in cards consolidate to root');
 ({html}=await request(route+'?page=1'));ok(canonical(html)==='https://deafnavi.com'+route,'page one consolidates');
 ({html}=await request(route+'?q='+encodeURIComponent('"></script><script>alert(1)</script>')));ok(!html.includes('</script><script>alert(1)'),'query safely encoded');ok(meta(html,'robots').startsWith('noindex'),'empty search excluded');ld(html);
 ({html}=await request('/admin/'));ok(meta(html,'robots')==='noindex,nofollow','private robots unchanged');
 for(const [slug,name,location] of [['very-you','サインカフェ ベリーユー','東京都 小平市'],['rendeaf','Rendeaf Coffee','東京都 文京区']]){
  const expected=name+'（'+location+'）｜手話カフェ | Deaf Navi';
  for(const suffix of ['', '?dn_client=codex']){
   const result=await request(route+slug+'/'+suffix);html=result.html;
   ok(html.includes('<title>'+expected+'</title>'),'real cafe fixture locality title '+slug+suffix);
   ok(html.includes('<meta property="og:title" content="'+expected+'">'),'OG title matches real cafe '+slug+suffix);
   ok(html.includes('<h1>'+name+'</h1>'),'real cafe visible name retained '+slug+suffix);
   ok(canonical(html)==='https://deafnavi.com'+route+slug+'/','real cafe canonical retained '+slug+suffix);
   ok(result.response.headers.get('x-deafnavi-cafe-seo')==='locality-20261012-2; mode=applied','current code path proven '+slug+suffix);
   ok(html.includes('href="'+route+'area/tokyo/"')&&html.includes('東京都の手話カフェ・定期交流の場所を見る'),'real cafe links to its existing region '+slug+suffix);
  }
 }
 for(const [slug,,,,,publication,area] of areaCases){
  const result=await request(route+'seo-area-'+slug+'/');
  ok(result.response.status===(publication==='private'?404:200),'area-link fixture visibility '+slug);
  if(area)ok(result.html.includes('href="'+route+'area/'+area+'/"')&&result.html.includes('神奈川県の手話カフェ・定期交流の場所を見る'),'same-region link for '+slug);
  else ok(!result.html.includes('の手話カフェ・定期交流の場所を見る</a>'),'no unrelated region link for '+slug);
 }
 const location=JSON.parse(run(['-r',`require '${core}';$p=expanded(query("SELECT * FROM records WHERE slug='seo-fixture-0'")->fetch());echo json(['prefecture'=>$p['prefecture'],'city'=>$p['city']]);`]));
 ({html}=await request(route+'seo-fixture-0/'));
 ok(html.includes('<title>SEO fixture 0（'+location.prefecture+' '+location.city+'）｜手話カフェ | Deaf Navi</title>'),'domestic detail title identifies the published place');
 ok(html.includes('<h1>SEO fixture 0</h1>'),'visible place name retained');ok(canonical(html)==='https://deafnavi.com'+route+'seo-fixture-0/','detail URL retained');
 ok(html.includes('id="visit-info"')&&html.includes('予約・料金・会話の方法'),'visit link resolves to real detail section');
 ok(html.includes('name="twitter:title"'),'social title follows the same metadata');
 const titleBefore=html.match(/<title>([^<]+)<\/title>/)?.[1];
 run(['-r',`require '${core}';$r=query("SELECT * FROM records WHERE slug='seo-fixture-0'")->fetch();$p=expanded($r);$p['status']='permanently_closed';save_record($p,'cafe',$r['id'],(int)$r['revision']);`]);
 ({html}=await request(route+'seo-fixture-0/'));ok(html.match(/<title>([^<]+)<\/title>/)?.[1]===titleBefore,'historical record keeps its identity');ok(!ld(html).some(x=>x['@type']==='CafeOrCoffeeShop'),'closed place does not acquire active business schema');
 const privateResult=await request(route+'seo-fixture-29/');html=privateResult.html;ok(html.includes('noindex,nofollow')&&!html.includes('PRIVATE_SEO_SENTINEL'),'private detail cannot expose metadata or private fields');ok(!privateResult.response.headers.has('x-deafnavi-cafe-seo'),'no private response diagnostics');
 ({html}=await request('/connect/sign-cafe/overseas/'));ok(!ld(html).some(x=>x['@type']==='CollectionPage'),'domestic schema not applied overseas');
 assert.deepEqual(ld(html).find(x=>x['@type']==='BreadcrumbList').itemListElement.map(x=>[x.position,x.item]),[[1,'https://deafnavi.com/'],[2,'https://deafnavi.com/connect/sign-cafe/'],[3,'https://deafnavi.com/connect/sign-cafe/overseas/']]);checks++;
 ({html}=await request('/directory-sitemap.xml'));ok(html.includes('<loc>https://deafnavi.com/connect/sign-cafe/</loc>'),'directory sitemap contains hub');ok(!html.includes('seo-fixture-29/'),'private record absent from sitemap');
 for(const [slug,pref] of [['tokyo','東京都'],['kanagawa','神奈川県']]){
  const regional=await request(route+'area/'+slug+'/');ok(regional.response.status===200,'region available');
  const schema=ld(regional.html).find(x=>x['@type']==='CollectionPage');
  const expected=JSON.parse(run(['-r',`require '${core}';require '${resolve(root,'server/views.php').replaceAll('\\','/')}';echo json(array_values(array_map(fn($p)=>BASE.record_path($p),array_filter(visible_records(),fn($p)=>$p['country_code']==='JP'&&($p['kind']==='cafe'||($p['kind']==='store'&&!empty($p['signing_store'])))&&domestic_matches($p,['prefecture'=>'${pref}'])))));`]));
  assert.deepEqual(schema.mainEntity.itemListElement.map(p=>p.url).sort(),expected.sort());checks++;
  ok(canonical(regional.html)==='https://deafnavi.com'+route+'area/'+slug+'/','region canonical');
  ok(!regional.html.includes('PRIVATE_SEO_SENTINEL')&&!regional.html.includes('SEO fixture 29'),'private data excluded');
 }
 ok((await request(route+'area/unknown/')).response.status===404,'unknown area is a real 404');
 const redirects=JSON.parse(await (await import('node:fs/promises')).readFile(resolve(root,'config/entry-redirects.json'),'utf8'));
 for(const entry of redirects)for(const path of [entry.from.slice(0,-1),entry.from,entry.from+'index.html']){
  const r=await request(path+'?dn_client=codex&q=a%20b');ok(r.response.status===301,'permanent old entry');ok(r.response.headers.get('location')===entry.to+'?dn_client=codex&q=a%20b','query preserved');
 }
 ok(!/Fatal error|Warning:|Uncaught/.test(logs),'no PHP warnings');console.log(JSON.stringify({result:'CAFE_SEO_TESTS_OK',checks,productionWrites:false}));
}finally{server.kill();}
