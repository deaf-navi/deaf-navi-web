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
$html=visitor_profile(array_replace($p,['shop_type'=>'related_organization']));
expect(str_contains($html,'店舗型のカフェではありません')&&str_contains($html,'活動・利用の案内'),'Related organization clearly separated from cafe');
$media=array_replace($p,['slug'=>'torinkan-writing-cafe-mie','official_url'=>'https://www.torinkan.com/']);
expect(str_contains(cafe_list_media($media),'<img '),'Reviewed official image displayed');
expect(!str_contains(cafe_list_media(array_replace($media,['official_url'=>'https://example.org/changed'])),'<img '),'Changed source drops old imagery');
expect(!str_contains(cafe_list_media(array_replace($media,['slug'=>'unknown-cafe','thumbnail'=>'https://example.org/unreviewed.jpg'])),'<img '),'Unreviewed record image is not published');
$eventMedia=array_replace($activity,['slug'=>'acoustic-cafe-sapporo-sign-20261027','official_url'=>'https://acousticcafe-sapporo.com/?p=1160','status'=>'cancelled']);
expect(!str_contains(cafe_list_media($eventMedia),'<img '),'Cancelled event does not keep announcement imagery');
expect(!str_contains(cafe_list_media(array_replace($eventMedia,['status'=>'unknown','activity_date'=>'2001-01-01'])),'<img '),'Past event does not keep announcement imagery');

$visit=array_replace($seed[0],['kind'=>'cafe','country_code'=>'JP','name'=>'訪問条件のテスト','slug'=>'visit-fixture','shop_type'=>'permanent','status'=>'open','confirmation_status'=>'confirmed','last_verified_at'=>gmdate('Y-m-d'),'reservation'=>'5名以上は平日のみ予約可。参加費500円＋飲食代。','notes'=>'11月の回は1,000円。次回の料金は未発表。','sign_support'=>'音声を使わず交流。','writing_support'=>true,'sign_language_support'=>false,'beginner_welcome'=>null,'reservation_required'=>null,'review_notes'=>'PRIVATE_VISIT_SENTINEL','internal_note'=>'PRIVATE_VISIT_SENTINEL']);
$html=visitor_profile($visit);
expect(str_contains($html,'id="visit-info"')&&str_contains($html,e($visit['reservation']))&&str_contains($html,e($visit['notes'])),'Full dated and conditional pricing retained');
expect(substr_count($html,e($visit['reservation']))===1&&substr_count($html,e($visit['notes']))===1,'Visit details not repeated in other sections');
expect(!str_contains($html,'PRIVATE_VISIT_SENTINEL'),'Private review fields stay private');
$summary=cafe_visit_summary($visit);
expect(str_contains($summary,'筆談対応')&&!str_contains($summary,'初心者歓迎')&&!str_contains($summary,'手話で注文可能'),'Only explicit true communication facts summarized');
expect(!str_contains($summary,'500円')&&str_contains($summary,'/visit-fixture/#visit-info'),'Pricing conditions are not shortened into misleading badges');
$empty=array_replace($visit,['reservation'=>'','notes'=>'','sign_support'=>'','writing_support'=>null]);
expect(!str_contains(cafe_visit_information($empty),'予約・事前申込は不要'),'Unknown is not no reservation');
expect(str_contains(cafe_visit_information(array_replace($empty,['reservation_required'=>false])),'予約・事前申込は不要'),'Explicit no-reservation flag retained');
expect(str_contains(cafe_visit_information(array_replace($empty,['reservation_required'=>true])),'事前予約・申込が必要'),'Explicit reservation requirement retained');
foreach([['status'=>'needs_review'],['status'=>'unknown'],['status'=>'temporarily_closed'],['status'=>'permanently_closed'],['confirmation_status'=>'needs_review'],['last_verified_at'=>'2000-01-01']] as $state){
 $old=array_replace($visit,$state);$html=cafe_visit_information($old);
 expect(str_contains($html,'これまでに掲載した利用情報')&&str_contains($html,e($visit['reservation'])),'Old details retained as historical information');
 expect(!str_contains(cafe_visit_summary($old),'筆談対応'),'Unconfirmed status cannot promote a communication promise');
}
foreach([['country_code'=>'US'],['shop_type'=>'event'],['shop_type'=>'related_organization'],['shop_type'=>'community_space'],['kind'=>'store','signing_store'=>false]] as $scope)expect(cafe_visit_summary(array_replace($visit,$scope))==='','Visit summary restricted to domestic cafes');
expect(domestic_matches($visit,['q'=>'500円 平日']),'Reservation terms included in keyword search');
expect(!domestic_matches($visit,['q'=>'PRIVATE_VISIT_SENTINEL']),'Private notes never searchable');
expect(!str_contains(cafe_visit_information(array_replace($visit,['reservation'=>'<script>visitAttack()</script>'])),'<script>'),'Visit prose escaped');
echo "PUBLIC_PROFILE_TESTS_OK\n";
