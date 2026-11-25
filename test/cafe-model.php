<?php
declare(strict_types=1);
require __DIR__.'/../server/core.php';
require __DIR__.'/../server/views.php';
require __DIR__.'/../server/public-profile.php';
$checks=0;function ok($v,string $m):void{global $checks;if(!$v)throw new RuntimeException($m);$checks++;}
function rejects(callable $fn):bool{try{$fn();return false;}catch(DomainException){return true;}}
$today = new DateTimeImmutable('2026-11-25', new DateTimeZone('Asia/Tokyo'));
$base = ['kind'=>'cafe','shop_type'=>'public_recurring','country_code'=>'JP','status'=>'active_recurring',
    'event_schedule'=>'次回：2026年11月25日（水）13:30〜15:00','recurrence'=>'毎月第4水曜日',
    'business_hours'=>'11月25日（水）13:30〜15:00','notes'=>'次回は2026年11月25日です。',
    'reservation'=>'11月25日分は事前申込。'];
$dayOf = cafe_public_schedule($base, $today);
ok(str_contains($dayOf['event_schedule'], '11月25日'), 'same-day date stays visible');
$after = cafe_public_schedule($base, $today->modify('+1 day'));
ok($after['event_schedule'] === '日程確認中' && $after['business_hours'] === '', 'next day rolls over without a DB write');
ok($after['notes'] === '' && $after['reservation'] === '' && !empty($after['past_visit_information']), 'previous visit details are kept out of the current schedule');
ok(cafe_public_schedule(['event_schedule'=>'','business_hours'=>'']+$base, $today)['event_schedule'] === '日程確認中', 'cadence does not invent a confirmed date');
$mixed = cafe_public_schedule(['event_schedule'=>'次回：2026年10月23日（金）19:00〜20:30。以降11月27日、12月25日、2027年1月22日、2月26日。']+$base, $today);
ok(!str_contains($mixed['event_schedule'], '10月23日') && str_contains($mixed['event_schedule'], '2026年11月27日') && str_contains($mixed['event_schedule'], '2027年1月22日'), 'announced dates survive older dates and a year boundary');
$compact = cafe_public_schedule(['event_schedule'=>'2026年11月は4・25・26・28日、各13:00〜14:00。']+$base, $today);
ok(str_contains($compact['event_schedule'], '2026年11月25・26・28日'), 'only future days in a compact month list');
$range = '火・木（2026年9月1日〜12月17日）';
ok(cafe_public_schedule(['event_schedule'=>$range]+$base, $today)['event_schedule'] === $range, 'a published range stays through its last day');
ok(cafe_public_schedule(['event_schedule'=>$range]+$base, $today->modify('+24 days'))['event_schedule'] === '日程確認中', 'expired range no longer appears current');
foreach (['permanent','event'] as $type) {
    $entry = ['shop_type'=>$type]+$base;
    ok(cafe_public_schedule($entry, $today) === $entry, 'unrelated type unchanged: '.$type);
}
$p=cafe_model(['id'=>'x','name'=>'検証カフェ','kind'=>'cafe','country_code'=>'JP','prefecture'=>'奈良県','city'=>'奈良市','status'=>'open','type'=>'permanent','verification_level'=>'official','last_verified_at'=>'2026-09-07','created_at'=>'2024-01-01T00:00:00Z']);
ok($p['shop_type']==='permanent'&&$p['has_deaf_staff']===null,'unknown attributes preserved');
ok(domestic_matches(array_replace($p,['writing_support'=>true]),['q'=>'筆談']),'search includes confirmed writing support');
ok(!domestic_matches(array_replace($p,['writing_support'=>null]),['q'=>'筆談']),'unknown support is not a keyword match');
ok(domestic_matches(array_replace($p,['writing_support'=>true]),['writing_support'=>'1']),'confirmed writing support filter');
ok(!domestic_matches(array_replace($p,['writing_support'=>null]),['writing_support'=>'1']),'unknown support is excluded from confirmed filter');
ok($p['first_found_at']==='2024-01-01','first seen retains creation');
ok(cafe_model(['kind'=>'store','signing_store'=>true])['shop_type']==='chain_signing_store','Signing Store mapping');
ok(cafe_model(['type'=>'limited'])['shop_type']==='unknown','limited not guessed as permanent');
ok(cafe_model(['type'=>'recurring'])['shop_type']==='unknown','legacy recurring requires finer classification');
ok(cafe_model(['kind'=>'event','status'=>'scheduled'])===['kind'=>'event','status'=>'scheduled'],'Starbucks events unchanged');
$today=new DateTimeImmutable('2026-09-07');
foreach(['2026-03-08'=>'fresh','2026-03-07'=>'stale','2025-09-08'=>'stale','2025-09-07'=>'review_due',''=>'unverified'] as $d=>$expected)ok(cafe_freshness(['last_verified_at'=>$d],$today)===$expected,'freshness boundary '.$d);
ok(cafe_month_cutoff(6,new DateTimeImmutable('2026-08-31'))==='2026-02-28','month-end clamp');
ok(cafe_month_cutoff(12,new DateTimeImmutable('2024-02-29'))==='2023-02-28','leap year clamp');
ok(rejects(fn()=>cafe_validate(['has_deaf_staff'=>'true'],$p)),'public staff evidence required');
ok(rejects(fn()=>cafe_validate(['is_deaf_owned'=>'false'],$p)),'false ownership also needs evidence');
ok(cafe_validate(['has_deaf_staff'=>'unknown'],$p)['has_deaf_staff']===null,'unknown is nullable');
$v=cafe_validate(['has_deaf_staff'=>'true','attribute_sources'=>'https://example.org/about'],$p);ok($v['has_deaf_staff']===true,'evidenced attribute accepted');
foreach([['shop_type'=>'weekly_recurring'],['operator_type'=>'invented'],['has_deaf_staff'=>'maybe'],['moved_at'=>'2026-13'],['last_researched_at'=>'2099-01-01'],['venue_url'=>'javascript:alert(1)']] as $bad)ok(rejects(fn()=>cafe_validate($bad,$p)),'bad extension rejected');
ok(rejects(fn()=>cafe_validate(['confirmation_status'=>'needs_review'],$p)),'unverified cannot claim open');
ok(rejects(fn()=>cafe_validate(['shop_type'=>'permanent'],array_replace($p,['status'=>'active_recurring']))),'recurring state requires appropriate type');
ok(!domestic_matches(array_replace($p,['has_deaf_staff'=>null]),['has_deaf_staff'=>'1']),'unknown does not satisfy feature');
ok(!domestic_matches(array_replace($p,['has_deaf_staff'=>false]),['has_deaf_staff'=>'1']),'false does not satisfy feature');
ok(domestic_matches($v,['has_deaf_staff'=>'1']),'true satisfies feature');
ok(!domestic_matches(array_replace($p,['shop_type'=>'event']),[]),'single event off by default');
ok(!domestic_matches(array_replace($p,['shop_type'=>'event']),['events'=>'1']),'single event stays in separate event list');
ok(!domestic_matches(array_replace($p,['status'=>'permanently_closed']),[]),'closed off by default');
ok(domestic_matches(array_replace($p,['status'=>'temporarily_closed']),['status'=>'temporarily_closed']),'paused selectable');
ok(region('沖縄県','JP')==='沖縄'&&region('大分県','JP')==='九州','distinct Kyushu and Okinawa');
$html=domestic_empty(['prefecture'=>'奈良県','region'=>'近畿']);foreach(['大阪府','京都府','兵庫県','イベント'] as $text)ok(str_contains($html,$text),'empty guidance '.$text);
$p['notes']='<script>bad</script>';$p['review_notes']='PRIVATE_SENTINEL';$p['internal_note']='PRIVATE_SENTINEL';
$export=cafe_export($p);ok(!str_contains(json($export),'PRIVATE_SENTINEL'),'canonical export allowlist');
ok(array_key_exists('opening_days',$export)&&array_key_exists('source_urls',$export)&&$export['region']==='近畿','canonical aliases');
ok(!str_contains(cafe_schedule_html(array_replace($p,['status'=>'needs_review','event_schedule'=>'OLD_SCHEDULE','business_hours'=>'OLD_HOURS'])),'OLD_'),'unknown schedule not presented as current');
ok(cafe_identity_url('https://www.instagram.com/example.name/?utm_source=x')===cafe_identity_url('https://instagram.com/example.name'),'SNS tracking parameters ignored for identity');
ok(cafe_identity_url('https://instagram.com/example.name')!==cafe_identity_url('https://instagram.com/examplename'),'distinct Instagram handles retained');
foreach(['bar'=>'BarOrPub','restaurant'=>'Restaurant'] as $type=>$schema){
    $typed=cafe_validate(['shop_type'=>$type],$p);
    ok(cafe_schema_type($typed)===$schema&&domestic_matches($typed,['shop_type'=>$type]),'type filter and schema '.$type);
}
$activity=cafe_validate(['activity_date'=>'2099-09-13','shop_type'=>'event'],array_replace($p,['status'=>'unknown']));
ok(cafe_activity_state($activity,new DateTimeImmutable('2099-09-12'))==='scheduled','future activity dates allowed');
ok(cafe_activity_state($activity,new DateTimeImmutable('2099-09-13'))==='today','activity date boundary');
ok(cafe_activity_state($activity,new DateTimeImmutable('2099-09-14'))==='date_elapsed','past announcement expires without a DB write');
ok(cafe_status_label(array_replace($activity,['status'=>'permanently_closed']))==='活動終了','explicit end does not imply date elapsed');
ok(cafe_activity_state(array_replace($activity,['confirmation_status'=>'needs_review']))==='date_unknown','unconfirmed event is not scheduled');
ok(rejects(fn()=>cafe_validate(['activity_date'=>'2026-02-30'],$activity)),'invalid activity date rejected');
ok(cafe_validate(['activity_date'=>''],$activity)['activity_date']==='','admin can clear activity date');
$activity['business_hours']='10:00〜12:00';
ok(str_contains(cafe_table_schedule($activity),'2099-09-13')&&str_contains(cafe_schedule_html($activity),'開催日（告知情報）'),'known date visible without treating venue as open');
ok(!domestic_matches($activity,[])&&!domestic_matches($activity,['events'=>'1']),'dated activity never enters cafe list');
foreach(['community_space'=>'spots','related_organization'=>'organizations'] as $type=>$group){
    $place=cafe_validate(['shop_type'=>$type],$p);
    ok(!domestic_matches($place,[])&&domestic_matches($place,['listing'=>$group]),'related category is separately discoverable '.$type);
    ok(domestic_matches($place,['shop_type'=>$type])&&domestic_matches($place,['listing'=>'all']),'explicit category and all listing '.$type);
    ok(!domestic_matches($place,['listing'=>'cafes'])&&!domestic_matches($place,['listing'=>$group,'region'=>'四国']),'category respects group and region');
    ok(cafe_schema_type($place)!=='CafeOrCoffeeShop','related place is not a cafe in schema');
}
ok(domestic_matches(cafe_validate(['shop_type'=>'sign_friendly_cafe'],$p),[]),'sign friendly cafe remains in cafe list');
ok(cafe_listing_title(['listing'=>'organizations'])==='手話の関連団体・講座','organization listing title');
foreach(['spots','organizations','all'] as $group){
    $_GET=['listing'=>$group,'region'=>'四国'];
    preg_match_all('/href="([^"]+)" data-cafe-sort=/',cafe_table([]),$links);
    ok(count($links[1])===3,'three sort links');
    foreach($links[1] as $url){parse_str(substr(html_entity_decode($url),1),$params);ok(($params['listing']??'')===$group&&($params['region']??'')==='四国','sorting preserves listing and region');}
}
$_GET=[];
$priority=[
    ['slug'=>'unknown','status'=>'unknown','last_verified_at'=>'2026-10-16'],
    ['slug'=>'older','status'=>'open','last_verified_at'=>'2026-09-01'],
    ['slug'=>'recent','status'=>'active_recurring','last_verified_at'=>'2026-10-01'],
    ['slug'=>'undated','status'=>'open','last_verified_at'=>''],
];
usort($priority,'cafe_priority_compare');
ok(array_column($priority,'slug')===['recent','older','undated','unknown'],'published operating states precede unknown; newest confirmation first; missing date last within state');
ok(cafe_priority_compare(['slug'=>'a','status'=>'open'],['slug'=>'b','status'=>'open'])<0,'equal confirmation uses stable slug order');
echo json(['result'=>'CAFE_MODEL_TESTS_OK','checks'=>$checks])."\n";
