<?php
declare(strict_types=1);
// Versioned additive payload, shared by domestic and overseas places.
const SHOP_TYPES=['permanent'=>'常設店舗','restaurant'=>'レストラン・食堂','bar'=>'Bar','recurring_program'=>'定期開催（通常店舗内）','recurring_popup'=>'間借り・定期開催','public_recurring'=>'公共施設・定期開催','facility_cafe'=>'福祉施設内カフェ','chain_signing_store'=>'チェーン / Signing Store','event'=>'単発イベント','unknown'=>'形態確認中'];
const OPERATOR_TYPES=['individual'=>'個人店','organization'=>'NPO / 団体','municipality'=>'自治体','welfare'=>'福祉法人等','chain'=>'チェーン','other'=>'その他','unknown'=>'未確認'];
const SIGN_LEVELS=['primary'=>'手話・ろう文化が中心','full'=>'手話で接客可能','partial'=>'一部スタッフが対応','event_only'=>'特定日時のみ対応','unknown'=>'手話対応レベル未確認'];
const CAFE_FEATURES=['is_deaf_owned'=>'ろう者オーナー','has_deaf_staff'=>'ろう者スタッフ','sign_language_support'=>'手話で注文可能','beginner_welcome'=>'初心者歓迎','writing_support'=>'筆談対応','regular_events'=>'定期イベントあり'];
const CAFE_TRI_FIELDS=['is_deaf_owned','has_deaf_staff','sign_language_support','spoken_language_support','writing_support','reservation_required','beginner_welcome','regular_events'];
const CAFE_TEXT_FIELDS=['recurrence'=>'繰り返し日程（例 毎月第3月曜日）','venue_name'=>'開催会場（通常店舗・施設）','venue_address'=>'会場所在地','venue_url'=>'会場の公式URL','previous_address'=>'旧所在地','moved_at'=>'移転年月（YYYY-MM）','started_at'=>'開始年月（YYYY-MM）','first_found_at'=>'初回発見日','last_researched_at'=>'最終調査日（確認できなかった場合も記録）','schedule_verified_at'=>'現在の日程を確認した日','latest_source_date'=>'根拠資料の公開日','latest_sns_at'=>'確認できた最新SNS投稿日','notes'=>'利用前に確認したいこと','review_notes'=>'再確認が必要な項目（非公開）','attribute_sources'=>'属性の公表元URL（1行1件）'];
const JP_PREFECTURES='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県';
function cafe_model(array $p):array {
    if(($p['kind']??'cafe')==='event')return $p;
    $p['schema_version']=2;
    $defaultType=!empty($p['signing_store'])?'chain_signing_store':(($p['type']??'')==='permanent'?'permanent':'unknown');
    $p+=['schema_version'=>2,'shop_type'=>$defaultType,'operator_type'=>'unknown','sign_language_level'=>'unknown','confirmation_status'=>($p['verification_level']??'pending')==='pending'?'needs_review':'confirmed'];
    foreach(CAFE_TRI_FIELDS as $k)if(!array_key_exists($k,$p))$p[$k]=null;
    foreach(CAFE_TEXT_FIELDS as $k=>$label)if(!array_key_exists($k,$p))$p[$k]=$k==='attribute_sources'?[]:'';
    $p+=['activity_date'=>''];
    if($p['first_found_at']===''&&!empty($p['created_at']))$p['first_found_at']=substr($p['created_at'],0,10);
    return $p;
}
function cafe_validate(array $post,array $p):array {
    if(array_key_exists('activity_date',$post))$p['activity_date']=date_value(input($post,'activity_date',10));
    foreach(['shop_type'=>SHOP_TYPES,'operator_type'=>OPERATOR_TYPES,'sign_language_level'=>SIGN_LEVELS,'confirmation_status'=>['confirmed'=>1,'needs_review'=>1,'unknown'=>1]] as $k=>$choices)if(array_key_exists($k,$post))$p[$k]=choice(input($post,$k,40),$choices);
    foreach(CAFE_TEXT_FIELDS as $k=>$label)if(array_key_exists($k,$post)){
        $p[$k]=input($post,$k,in_array($k,['attribute_sources','review_notes','notes'],true)?6000:2000);
        if(str_ends_with($k,'_url'))$p[$k]=safe_url($p[$k]);
        if($k==='attribute_sources'){$p[$k]=array_values(array_unique(array_filter(array_map('trim',explode("\n",$p[$k])))));foreach($p[$k] as $url)safe_url($url);}
        elseif(in_array($k,['moved_at','started_at'],true)){if($p[$k]!==''){if(!preg_match('/^\d{4}-\d{2}$/D',$p[$k]))fail('年月はYYYY-MM形式です。');date_value($p[$k].'-01');}}
        elseif(str_ends_with($k,'_at')||$k==='latest_source_date'){$p[$k]=date_value($p[$k]);if($p[$k]>(new DateTimeImmutable('now',new DateTimeZone('Asia/Tokyo')))->format('Y-m-d'))fail('確認・発見日に未来の日付は指定できません。');}
    }
    foreach(CAFE_TRI_FIELDS as $k)if(array_key_exists($k,$post)){$v=$post[$k];if(!in_array($v,[true,false,null,'true','false','unknown','1','0',''],true))fail('属性の選択値が不正です。');$p[$k]=in_array($v,[true,'true','1'],true)?true:(in_array($v,[false,'false','0'],true)?false:null);}
    if(array_filter(CAFE_TRI_FIELDS,fn($k)=>in_array($k,['is_deaf_owned','has_deaf_staff'],true)&&isset($p[$k]))&&empty($p['attribute_sources']))fail('オーナー・スタッフ属性には本人・店舗が公表した根拠URLが必要です。');
    if(($p['shop_type']??'')==='chain_signing_store'&&empty($p['signing_store']))fail('Signing Storeは正式な店舗登録に合わせて指定してください。');
    if(($p['confirmation_status']??'')!=='confirmed'&&isset($p['confirmation_status'])&&in_array($p['status'],['open','active_recurring'],true))fail('営業中・定期開催中の登録には確認済みの根拠が必要です。');
    if(($p['status']??'')==='active_recurring'&&isset($p['shop_type'])&&!in_array($p['shop_type'],['recurring_program','recurring_popup','public_recurring','facility_cafe'],true))fail('定期開催中には定期開催の形態を指定してください。');
    return $p;
}
// A dated one-off activity is separate from its venue's operating status.
function cafe_activity_state(array $p,?DateTimeImmutable $today=null):?string {
    if(($p['shop_type']??'')!=='event')return null;
    if(in_array($p['status']??'',['closed','permanently_closed'],true))return 'ended';
    if(($p['confirmation_status']??'')!=='confirmed'||in_array($p['status']??'',['needs_review','temporarily_closed'],true)||empty($p['activity_date']))return 'date_unknown';
    $today??=new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));
    $date=$today->format('Y-m-d');
    return $p['activity_date']<$date?'date_elapsed':($p['activity_date']===$date?'today':'scheduled');
}
function cafe_schema_type(array $p):string {
    return match($p['shop_type']??''){'bar'=>'BarOrPub','restaurant'=>'Restaurant',default=>($p['type']??'')==='permanent'?'CafeOrCoffeeShop':'Place'};
}
function cafe_post(array $p):array {
    foreach($p as $k=>$v){if(is_array($v)&&in_array($k,['subtypes','verification_sources','attribute_sources','region_tags','deaf_relation'],true))$p[$k]=implode("\n",$v);elseif(is_bool($v))$p[$k]=$v?'1':'0';elseif($v===null)$p[$k]='';elseif(is_numeric($v))$p[$k]=(string)$v;}
    return $p;
}
function cafe_identity_url(string $url):string {
    if($url==='')return '';$p=parse_url($url);if(!$p)return '';
    return strtolower(preg_replace('/^www\./i','',$p['host']??'').rtrim(rawurldecode($p['path']??''),'/'));
}
// Canonical common schema. Explicit allowlist keeps admin notes out of exports.
function cafe_export(array $p):array {
    $p=cafe_model($p);$out=[];
    foreach(['id','name','name_kana','prefecture','city','address','latitude','longitude','shop_type','status','operator_type','is_deaf_owned','has_deaf_staff','sign_language_support','sign_language_level','spoken_language_support','writing_support','recurrence','reservation_required','last_verified_at','first_found_at','notes','previous_address','moved_at','venue_name','venue_address','venue_url','country_code','country_name','timezone'] as $k)$out[$k]=$p[$k]??null;
    foreach(['current_address'=>'address','operator_name'=>'operator','opening_days'=>'event_schedule','opening_hours'=>'business_hours','official_website'=>'official_url','instagram'=>'instagram_url','x'=>'x_url','facebook'=>'facebook_url','google_maps_url'=>'map_url','source_urls'=>'verification_sources'] as $k=>$source)$out[$k]=$p[$source]??null;
    $out['region']=region($p['prefecture'],$p['country_code']);return $out;
}
function cafe_month_cutoff(int $months,?DateTimeImmutable $today=null):string {
    $today??=new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));
    $month=$today->modify('first day of this month')->modify('-'.$months.' months');
    return $month->setDate((int)$month->format('Y'),(int)$month->format('m'),min((int)$today->format('d'),(int)$month->format('t')))->format('Y-m-d');
}
function cafe_freshness(array $p,?DateTimeImmutable $today=null):string {
    $d=$p['last_verified_at']??'';if($d==='')return 'unverified';
    try{date_value($d);}catch(Throwable){return 'unverified';}
    if($d<=cafe_month_cutoff(12,$today))return 'review_due';
    return $d<=cafe_month_cutoff(6,$today)?'stale':'fresh';
}
function cafe_review_sql(string $v):array {
    $date="json_extract(payload,'$.last_verified_at')";
    return match($v){'6'=>["($date IS NOT NULL AND $date!='' AND $date<=?)",[cafe_month_cutoff(6)]],'12'=>["($date IS NOT NULL AND $date!='' AND $date<=?)",[cafe_month_cutoff(12)]],'unverified'=>["($date IS NULL OR $date='')",[]],default=>['1=1',[]]};
}

function region(string $prefecture,string $country): string {
    if($country!=='JP') return '海外';
    $regions=['北海道'=>['北海道'],'東北'=>['青森県','岩手県','宮城県','秋田県','山形県','福島県'],'関東'=>['茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県'],'中部'=>['新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県'],'近畿'=>['三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県'],'中国'=>['鳥取県','島根県','岡山県','広島県','山口県'],'四国'=>['徳島県','香川県','愛媛県','高知県'],'九州'=>['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県'],'沖縄'=>['沖縄県']];
    foreach($regions as $name=>$prefs) if(in_array($prefecture,$prefs,true)) return $name;
    return '未分類';
}
