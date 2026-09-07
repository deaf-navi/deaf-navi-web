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
echo json(['result'=>'WORLD_CAFES_TESTS_OK','checks'=>$checks])."\n";
