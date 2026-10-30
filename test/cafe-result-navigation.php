<?php
declare(strict_types=1);
// Domestic cafe search: the count and first place stay together after searching,
// paging and recovering from zero results, without JavaScript.
require __DIR__.'/../server/core.php';
require __DIR__.'/../server/views.php';
require __DIR__.'/../server/public-profile.php';
require __DIR__.'/../server/ui-links.php';
$checks=0;function ok($v,string $m):void{global $checks;if(!$v)throw new RuntimeException($m);$checks++;}
function offset_of(string $html,string $needle):int{$i=strpos($html,$needle);if($i===false)throw new RuntimeException('missing '.$needle);return $i;}
function filters_for(array $get):array{$_GET=$get;return domestic_filter_values();}
function hrefs(string $html):array{preg_match_all('/href="([^"]+)"/',$html,$m);return array_map(fn($href)=>html_entity_decode($href,ENT_QUOTES|ENT_HTML5,'UTF-8'),$m[1]);}
$place=fn(string $slug,string $prefecture,string $status)=>cafe_model(['id'=>$slug,'slug'=>$slug,'name'=>'検証カフェ'.$slug,'kind'=>'cafe','country_code'=>'JP','prefecture'=>$prefecture,'city'=>'検証市','status'=>$status,'type'=>'permanent','verification_level'=>'official','last_verified_at'=>'2026-10-01','created_at'=>'2026-01-01T00:00:00Z']);
$all=[$place('tokyo-open','東京都','open'),$place('tokyo-paused','東京都','temporarily_closed'),$place('osaka-unknown','大阪府','unknown')];

$form=domestic_filters(filters_for([]));
ok(preg_match('/<form method="get" action="\/connect\/sign-cafe\/#cafes"/',$form)===1,'search form lands on the results and stays a GET form');

$f=filters_for(['prefecture'=>'東京都']);
$list=array_values(array_filter($all,fn($p)=>domestic_matches($p,$f)));
ok(count($list)===2,'a temporarily closed place stays listed by default');
$html=domestic_results($all,$list,$f,count($list),1,24);
ok(offset_of($html,'class="dn-result"')<offset_of($html,'class="dn-active-filters"'),'count comes first');
ok(offset_of($html,'class="dn-active-filters"')<offset_of($html,'class="dn-cafe-row"'),'chosen conditions precede the first place');
ok(!str_contains(substr($html,0,offset_of($html,'class="dn-cafe-row"')),'dn-quick-places'),'no region shortcuts between the count and the first place');
ok(offset_of($html,'class="dn-quick-places dn-quick-places--after"')>offset_of($html,'class="dn-pagination"'),'region shortcuts follow filtered results');
ok(str_contains($html,'地域から探し直す'),'shortcuts say they start a new search');
preg_match('/<nav class="dn-quick-places[^"]*"[^>]*>.*?<\/nav>/su',$html,$places);
foreach(hrefs($places[0]) as $href)ok(str_ends_with($href,'#cafes'),'region shortcut lands on results');
preg_match('/<details class="dn-listing-advice"><summary>(.*?)<\/summary>/su',$html,$advice);
ok(str_contains($advice[1]??'','「営業中」でも今開いているとは限りません'),'open-now caveat is readable while folded');

$f=filters_for([]);
$list=array_values(array_filter($all,fn($p)=>domestic_matches($p,$f)));
$html=domestic_results($all,$list,$f,count($list),1,24);
ok(!str_contains($html,'dn-active-filters')&&offset_of($html,'class="dn-quick-places"')<offset_of($html,'class="dn-cafe-row"'),'without conditions, region shortcuts remain an entry above the list');

$table=cafe_table([$place('osaka-unknown','大阪府','unknown'),$place('tokyo-paused','東京都','temporarily_closed')]);
ok(str_contains($table,'営業状況未確認')&&str_contains($table,'日程確認中'),'unknown status remains explicit');
ok(str_contains($table,'一時休業')&&str_contains($table,'休業中'),'temporary closure remains explicit');
ok(!preg_match('/閉店|営業なし|営業していません/u',$table),'unknown or paused places are not presented as closed');
ok(str_contains(cafe_listing_advice(),'閉店・休業という意味ではありません'),'advice says unknown is not closed');

$f=filters_for(['prefecture'=>'奈良県','writing_support'=>'1']);
$html=domestic_results($all,[],$f,0,1,24);
ok(str_contains($html,'お店が存在しないという意味ではありません'),'zero results do not deny that places exist');
ok(!str_contains($html,'dn-cafe-row')&&offset_of($html,'class="dn-empty"')<offset_of($html,'class="dn-pagination"'),'recovery actions come before the paging summary');
preg_match('/<section class="dn-empty">.*?<\/section>/su',$html,$empty);
$links=hrefs($empty[0]);
foreach(['大阪府','京都府','兵庫県'] as $pref)ok(in_array('?'.http_build_query(['prefecture'=>$pref]).'#cafes',$links,true),'nearby prefecture lands on results '.$pref);
ok(in_array('/connect/sign-cafe/#cafes',$links,true),'clearing all conditions lands on results');
ok(in_array('/submit/',$links,true),'information form stays available');
foreach($links as $href)if(str_starts_with($href,'?'))ok(str_ends_with($href,'#cafes'),'zero-result query link lands on results');

$f=filters_for(['q'=>'手話','page'=>'2']);
$nav=domestic_pagination($f,2,24,60);
$links=hrefs($nav);
ok(count($links)===2,'previous and next page');
foreach($links as $href){
    ok(str_ends_with($href,'#cafes'),'page link lands on results');
    parse_str(substr((string)strstr($href,'#',true),1),$query);
    ok(($query['q']??'')==='手話','search words survive paging');
}
ok(str_contains($nav,'全60件中 25〜48件'),'range summary unchanged');
$_GET=[];
echo json(['result'=>'CAFE_RESULT_NAVIGATION_OK','checks'=>$checks])."\n";
