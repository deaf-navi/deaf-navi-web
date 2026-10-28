<?php
declare(strict_types=1);

// This is a public projection, never a database/payload export.
function app_directory_link(array $p,string $key,string $label):?array {
    $url=$p[$key]??'';
    return $url!==''?['label'=>$label,'url'=>safe_url($url)]:null;
}
function app_directory_place(array $p):array {
    $p=cafe_model($p);
    $item=['id'=>$p['id'],'name'=>$p['name'],'webURL'=>BASE.record_path($p),
        'countryCode'=>$p['country_code'],'countryName'=>$p['country_name']??'',
        'prefecture'=>$p['prefecture'],'city'=>$p['city'],'address'=>$p['address']??'',
        'summary'=>$p['description']??'','shopType'=>$p['shop_type'],'shopTypeLabel'=>SHOP_TYPES[$p['shop_type']],
        'status'=>$p['status'],'statusLabel'=>cafe_status_label($p),'group'=>cafe_listing_group($p),
        'verifiedAt'=>$p['last_verified_at']??null,'notes'=>$p['notes']??'',
        'hours'=>$p['business_hours']??'','days'=>$p['event_schedule']??'',
        'recurrence'=>$p['recurrence']??'','reservation'=>$p['reservation']??'',
        'signSupport'=>$p['sign_support']??'',
        'signLanguageSupport'=>$p['sign_language_support']??null,
        'writingSupport'=>$p['writing_support']??null,'beginnerWelcome'=>$p['beginner_welcome']??null,
        'sources'=>array_values($p['verification_sources']??[])];
    // Match Web: uncertain operating schedules must not look current in the app.
    if(in_array($p['status'],['needs_review','unknown'],true)) {
        $item['hours']='';$item['days']='';$item['recurrence']='';
    }
    $links=[];
    foreach(['official_url'=>'公式サイト','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook','line_url'=>'LINE','youtube_url'=>'YouTube'] as $key=>$label) {
        $link=app_directory_link($p,$key,$label);if($link)$links[]=$link;
    }
    $item['links']=$links;
    return $item;
}
function app_directory_event(array $p):array {
    $fresh=cafe_event_freshness($p);$verified=$fresh['verified_at']??null;
    $date=cafe_event_date($p);$isStore=($p['kind']??'')==='event';
    $communication=[];
    foreach(['sign_language_support'=>['sign','手話対応あり'],'writing_support'=>['writing','筆談対応あり']] as $key=>[$method,$label]) {
        if(($p[$key]??null)===true)$communication[]=['method'=>$method,'detail'=>$label];
    }
    $sources=array_values($p['verification_sources']??[]);
    return ['origin'=>'cafe','id'=>$p['id'],'title'=>$p['name'],'startDate'=>$date?:null,'endDate'=>$date?:null,
        'prefecture'=>$p['prefecture'],'venue'=>($p['venue_name']??'')?:($p['address']??''),'kind'=>'cafe',
        'sourceName'=>($p['organizer']??'')?:$p['name'],'sourceUrl'=>$sources[0]??BASE.record_path($p),
        'detailUrl'=>($p['official_url']??'')?:BASE.record_path($p),'webUrl'=>BASE.record_path($p),
        'organizer'=>$p['organizer']??null,
        'time'=>$isStore?trim(($p['start_time']??'').'〜'.($p['end_time']??''),'〜'):($p['business_hours']??''),
        'target'=>implode("\n",array_filter([$p['conditions']??'',$p['application']??'',$p['reservation']??''])),
        'description'=>implode("\n\n",array_filter([$p['description']??'',$p['notes']??''])),
        'status'=>in_array($p['status'],['cancelled','closed','permanently_closed'],true)?'cancelled':'announced',
        'period'=>cafe_event_period($p),'verification'=>$fresh['status']==='review'?'needs_review':'verified',
        'verifiedAt'=>$verified,'validUntil'=>$verified?gmdate('c',strtotime($verified)+CAFE_EVENT_FRESH_SECONDS):null,
        'communication'=>$communication,'timezone'=>($p['timezone']??'')?:'Asia/Tokyo'];
}
function app_directory_snapshot():array {
    $cafes=[];
    foreach(visible_records() as $p) {
        if(($p['kind']==='cafe'||($p['kind']==='store'&&!empty($p['signing_store'])))&&cafe_listing_group($p)!=='events')$cafes[]=app_directory_place($p);
    }
    $events=array_map('app_directory_event',cafe_event_records());
    return ['schemaVersion'=>'deaf-navi-directory.v1','generatedAt'=>gmdate('c'),'cafes'=>$cafes,'events'=>$events];
}
function app_directory_endpoint():never {
    if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){header('Allow: GET, HEAD');http_response_code(405);exit;}
    $data=app_directory_snapshot();
    // generatedAt is response time, not a source verification date or ETag input.
    $etag='"'.hash('sha256',json(['cafes'=>$data['cafes'],'events'=>$data['events']])).'"';
    header('Content-Type: application/json; charset=UTF-8');header('Cache-Control: private, no-cache, must-revalidate');
    header('ETag: '.$etag);header('X-Robots-Tag: noindex');
    if(trim($_SERVER['HTTP_IF_NONE_MATCH']??'')===$etag){http_response_code(304);exit;}
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='HEAD')echo json($data);
    exit;
}
