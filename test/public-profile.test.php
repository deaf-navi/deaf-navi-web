<?php
declare(strict_types=1);
require __DIR__.'/../server/core.php';
require __DIR__.'/../server/views.php';
require __DIR__.'/../server/map-2d.php';
require __DIR__.'/../server/public-profile.php';
function expect(bool $v,string $message):void {if(!$v)throw new RuntimeException($message);}
$seed=json_decode(file_get_contents(__DIR__.'/../server/seed.json'),true);
$p=array_values(array_filter($seed,fn($p)=>$p['id']==='knot'))[0];
$p['internal_note']='PRIVATE_SENTINEL';$p['future_admin_field']='FUTURE_PRIVATE';$p['latitude']=34.123456;
$html=visitor_profile($p);
foreach(['国コード','タイムゾーン','座標','緯度','経度','address_vicinity','PRIVATE_SENTINEL','FUTURE_PRIVATE','34.123456'] as $term)expect(!str_contains($html,$term),'Internal detail leaked');
foreach(['営業時間・ご利用案内','アクセス','公式サイト（HP）','Instagram','Facebook','LINE','地図・行き方','掲載情報について'] as $term)expect(str_contains($html,$term),'Public information missing');
$p['name']='<script>attack</script>';$p['description']='<img src=x onerror=attack()>';
expect(!str_contains(visitor_profile($p),'<script>attack'),'XSS escaped');
$p=['name'=>'空欄のお店','kind'=>'cafe','country_code'=>'JP','prefecture'=>'東京都','city'=>'','status'=>'unknown'];
expect(!str_contains(visitor_profile($p),'<dt>'),'Missing values omitted');expect(official_links($p)==='','Missing social links omitted');
$ev=['conditions'=>'ドリンク注文','timezone'=>'Asia/Tokyo','observation_only'=>'1','internal_note'=>'PRIVATE_SENTINEL'];
expect(!str_contains(visitor_event_details($ev),'Asia/Tokyo'),'Event internal fields hidden');
echo "PUBLIC_PROFILE_TESTS_OK\n";
