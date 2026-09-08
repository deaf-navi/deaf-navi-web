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
$review=array_replace($p,['status'=>'needs_review','business_hours'=>'OLD_HOURS_SENTINEL','event_schedule'=>'OLD_DAYS_SENTINEL']);
expect(!str_contains(visitor_profile($review),'OLD_'),'Unconfirmed old schedule suppressed throughout profile');
$p['name']='<script>attack</script>';$p['description']='<img src=x onerror=attack()>';
expect(!str_contains(visitor_profile($p),'<script>attack'),'XSS escaped');
$p=['name'=>'空欄のお店','kind'=>'cafe','country_code'=>'JP','prefecture'=>'東京都','city'=>'','status'=>'unknown'];
expect(!str_contains(visitor_profile($p),'<dt>'),'Missing values omitted');expect(official_links($p)==='','Missing social links omitted');
$ev=['conditions'=>'ドリンク注文','timezone'=>'Asia/Tokyo','observation_only'=>'1','internal_note'=>'PRIVATE_SENTINEL'];
expect(!str_contains(visitor_event_details($ev),'Asia/Tokyo'),'Event internal fields hidden');
$activity=array_replace($p,['shop_type'=>'event','confirmation_status'=>'confirmed','activity_date'=>'2099-09-13','business_hours'=>'10:00〜12:00','venue_name'=>'公民館']);
$html=visitor_profile($activity);
foreach(['開催予定','2099-09-13','開催・参加の案内','単発イベントの告知情報','10:00〜12:00'] as $term)expect(str_contains($html,$term),'Activity presentation '.$term);
expect(!str_contains($html,'営業状況未確認')&&!str_contains($html,'<dt>営業時間</dt>'),'Activity is not venue business hours');
$html=visitor_profile(array_replace($activity,['confirmation_status'=>'needs_review']));
expect(!str_contains($html,'2099-09-13')&&!str_contains($html,'10:00〜12:00'),'Unconfirmed activity date is suppressed throughout profile');
echo "PUBLIC_PROFILE_TESTS_OK\n";
