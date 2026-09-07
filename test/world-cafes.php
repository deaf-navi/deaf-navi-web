<?php
require __DIR__.'/../server/core.php';
$checks=0;function check($v){global $checks;if(!$v)throw new RuntimeException('Check failed '.($checks+1));$checks++;}
$base=['country_code'=>'MY','country_name'=>'マレーシア','country_name_en'=>'Malaysia','city'=>'Kuala Lumpur','name'=>'Synthetic Coffee','local_name'=>'合成','world_region'=>'asia','region_tags'=>['southeast_asia'],'brand'=>'Starbucks','chain_name'=>'Starbucks','is_chain'=>true,'status'=>'open','publication'=>'public','verification_status'=>'verified','verification_level'=>'official','verification_sources'=>['https://example.org/store'],'last_verified_at'=>'2026-09-07','deaf_relation'=>['official_signing_store'],'operation_type'=>'permanent','signing_store'=>true];
foreach(WORLD_REGIONS as $k=>$label)check(world_matches(array_replace($base,['world_region'=>$k]),['region'=>$k]));
check(world_matches($base,['region'=>'asia','brand'=>'starbucks']));check(!world_matches($base,['region'=>'europe']));
$eu=array_replace($base,['world_region'=>'europe','country_name_en'=>'Netherlands','city'=>'Amsterdam','region_tags'=>['eu'],'brand'=>'Sign Language Coffee Bar']);
check(world_matches($eu,['region'=>'europe','tag'=>'eu']));check(world_matches($eu,['region'=>'eu','brand'=>'Sign Language Coffee Bar']));check(world_matches($eu,['q'=>'Netherlands']));check(world_matches($eu,['q'=>'Amsterdam']));check(world_matches($eu,['q'=>'合成']));
$independent=array_replace($base,['world_region'=>'north_america','region_tags'=>['americas'],'brand'=>'','chain_name'=>'','is_chain'=>false]);check(world_matches($independent,['region'=>'americas','brand'=>'independent']));check(!world_matches(array_replace($independent,['is_chain'=>null]),['brand'=>'independent']));
check(world_matches(array_replace($base,['brand'=>'I Love Coffee']),['brand'=>'other_chain']));check(!world_matches($base,['brand'=>'other_chain']));
foreach(['pending','private','deleted'] as $s)check(!publicly_visible(array_replace($base,['publication'=>$s])));
foreach(['pending','stale','rejected'] as $s)check(!publicly_visible(array_replace($base,['verification_status'=>$s])));
check(publicly_visible(array_replace($base,['status'=>'unknown'])));check(!world_located($base));
$p=array_replace($base,['latitude'=>null,'longitude'=>null,'coordinate_accuracy'=>'unknown']);check(!world_located($p));
$p=array_replace($base,['latitude'=>1.0,'longitude'=>2.0,'coordinate_accuracy'=>'address_vicinity','coordinate_source_url'=>'https://example.org/point','address'=>'Confirmed address']);check(world_located($p));check(!world_located(array_replace($p,['latitude'=>91])));
$post=['world_region'=>'asia','region_tags'=>"southeast_asia",'deaf_relation'=>'official_signing_store','verification_status'=>'verified','is_chain'=>'1'];check(world_validate($post,$base)['is_chain']===true);
foreach([['is_chain'=>'maybe'],['world_region'=>'invalid'],['deaf_relation'=>'fake'],['verification_status'=>'stale'],['deaf_relation'=>'unknown']] as $patch){try{world_validate(array_replace($post,$patch),$base);check(false);}catch(DomainException){check(true);}}
for($i=0;$i<500;$i++)check(world_matches(array_replace($base,['name'=>'Store '.$i]),['region'=>'asia','brand'=>'starbucks']));
require __DIR__.'/../server/views.php';
require __DIR__.'/../server/public-profile.php';
require __DIR__.'/../server/map-2d.php';
$rows=[];for($i=0;$i<105;$i++)$rows[]=array_replace($base,['kind'=>'store','slug'=>'fixture-'.$i,'name'=>'Fixture '.sprintf('%03d',$i)]);
$_GET=['sort'=>'name'];$html=world_table($rows,['country'=>'MY']);check(substr_count($html,'data-slug=')===50);check(str_contains($html,'country=MY'));check(str_contains($html,'page=2'));check(str_contains($html,'aria-sort="ascending"'));
$_GET=['sort'=>'name','page'=>'3'];$html=world_table($rows,['country'=>'MY']);check(substr_count($html,'data-slug=')===5);check(str_contains($html,'全105件中 101〜105件'));check(str_contains($html,'fixture-104'));
$_GET=['sort'=>'name','dir'=>'desc','per_page'=>'100','page'=>'2'];$html=world_table($rows,[]);check(substr_count($html,'data-slug=')===5);check(str_contains($html,'fixture-0'));check(!str_contains($html,'fixture-104'));check(str_contains($html,'aria-sort="descending"'));
$_GET=['page'=>'999999','per_page'=>'999'];$html=world_table($rows,[]);check(substr_count($html,'data-slug=')===5);
$_GET=[];$html=world_table([array_replace($rows[0],['name'=>'<script>alert(1)</script>'])],[]);check(!str_contains($html,'<script>'));check(str_contains($html,'&lt;script&gt;'));
$_GET=[];
// Explicit status choices include paused/closed records without silently broadening other queries.
check(world_matches(array_replace($base,['status'=>'temporarily_closed']),['status'=>'temporarily_closed']));
check(!world_matches($base,['status'=>'temporarily_closed']));
foreach(['unknown','needs_review'] as $status)check(world_matches(array_replace($base,['status'=>$status]),['status'=>'needs_review']));
foreach(['closed','permanently_closed'] as $status){check(!world_matches(array_replace($base,['status'=>$status]),[]));check(world_matches(array_replace($base,['status'=>$status]),['status'=>'permanently_closed']));}
// Old deep links keep working, and unsafe attributes remain escaped in expanded content.
check(world_matches(array_replace($base,['status'=>'closed']),['history'=>'1','country'=>'MY']));
$_GET=['sort'=>'name','page'=>'2','view'=>'cards'];$html=world_table($rows,['country'=>'MY','relation'=>'official_signing_store','status'=>'open']);
check(substr_count($html,'data-slug=')===50);check(str_contains($html,'view=cards'));check(str_contains($html,'relation=official_signing_store'));check(str_contains($html,'status=open'));check(str_contains($html,'data-slug="fixture-50"'));
$_GET=[];$p=array_replace($rows[0],['local_name'=>'<img src=x onerror=alert(1)>','status'=>'unknown','business_hours'=>'OLD SCHEDULE']);$html=world_table([$p],[]);
check(str_contains($html,'aria-controls="world-detail-fixture-0"'));check(str_contains($html,'id="world-detail-fixture-0" hidden'));
check(!str_contains($html,'OLD SCHEDULE'));check(!str_contains($html,'<img src=x'));check(str_contains($html,'&lt;img'));
$f=world_filter_values();$f['brand']='starbucks';$html=world_filters([$base,$eu],$f);check(str_contains($html,'class="dn-filter-more" open'));check(str_contains($html,'value="starbucks" selected'));check(str_contains($html,'data-regions='));
$_GET=[];
echo json(['result'=>'WORLD_CAFES_TESTS_OK','checks'=>$checks])."\n";
