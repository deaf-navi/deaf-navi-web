<?php
declare(strict_types=1);

const CAFE_EVENTS_PATH='/connect/sign-cafe/events/';
const CAFE_EVENTS_DESCRIPTION='単発の手話カフェ・交流イベントを開催日と地域から探せます。今後の開催告知と過去の開催情報を分け、会場・参加条件・公式情報を紹介します。';

function cafe_event_date(array $p):string {return (string)(($p['kind']??'')==='event'?($p['event_date']??''):($p['activity_date']??''));}
function cafe_event_period(array $p,?DateTimeImmutable $today=null):string {
    $today??=new DateTimeImmutable('today',new DateTimeZone(($p['timezone']??'')?:'Asia/Tokyo'));
    $date=cafe_event_date($p);
    if(($p['observation_only']??'0')==='1'||in_array($p['status']??'',['ended','cancelled','closed','permanently_closed'],true)||($date!==''&&$date<$today->format('Y-m-d')))return 'past';
    if(($p['kind']??'')==='event')return $date!==''&&in_array($p['status'],['scheduled','ongoing'],true)?'upcoming':'unconfirmed';
    return in_array(cafe_activity_state($p,$today),['scheduled','today'],true)?'upcoming':'unconfirmed';
}
function cafe_event_label(array $p):string {
    if(($p['observation_only']??'0')==='1')return '日時未確認の開催実績';
    if($p['status']==='cancelled')return '中止の告知';
    if(in_array($p['status'],['closed','permanently_closed'],true))return '活動終了';
    return match(cafe_event_period($p)){'upcoming'=>'開催予定','past'=>!empty($p['event_reported'])?'開催報告あり':'過去の開催告知',default=>'開催情報を確認中'};
}
function cafe_event_records():array {
    $all=visible_records();$stores=[];foreach($all as $p)if($p['kind']==='store')$stores[$p['id']]=$p;
    $events=[];
    foreach($all as $p){
        if($p['kind']==='event'){
            if($p['status']==='recurring'||!isset($stores[$p['store_id']??'']))continue;
            $store=$stores[$p['store_id']];
            foreach(['country_name','address','venue_address'] as $key)$p[$key]=$store[$key]??'';
            $p['venue_name']=$store['name'];
        }elseif(($p['shop_type']??'')!=='event')continue;
        $events[]=$p;
    }
    return $events;
}
function cafe_event_filters():array {
    $f=[];foreach(['q'=>200,'country'=>2,'region'=>40,'prefecture'=>100,'period'=>20,'page'=>8] as $key=>$limit)$f[$key]=input($_GET,$key,$limit);
    $f['period']=choice($f['period']?:'upcoming',['upcoming'=>1,'past'=>1,'unconfirmed'=>1]);
    return $f;
}
function cafe_event_matches(array $p,array $f):bool {
    foreach(['country'=>'country_code','prefecture'=>'prefecture'] as $filter=>$key)if(($f[$filter]??'')!==''&&$f[$filter]!==$p[$key])return false;
    if(($f['region']??'')!==''&&region($p['prefecture'],$p['country_code'])!==$f['region'])return false;
    $q=normalized($f['q']??'');
    return $q===''||str_contains(normalized(implode(' ',array_map(fn($key)=>(string)($p[$key]??''),['name','prefecture','city','country_name','venue_name','description']))),$q);
}
function cafe_event_period_links(array $f,array $counts):string {
    $out='<nav class="dn-event-periods" aria-label="開催時期">';
    foreach(['upcoming'=>'今後の開催','past'=>'過去の開催情報','unconfirmed'=>'日付未確認'] as $key=>$label){
        $params=array_filter($f,fn($value)=>$value!=='');unset($params['page']);$params['period']=$key;
        $out.='<a href="?'.e(http_build_query($params)).'"'.($f['period']===$key?' aria-current="page"':'').'>'.e($label).'<span>'.$counts[$key].'</span></a>';
    }
    return $out.'</nav>';
}
function cafe_event_filter_form(array $f,array $all):string {
    $countries=[];foreach($all as $p)$countries[$p['country_code']]=($p['country_name']??'')?:$p['country_code'];asort($countries);
    $regions=['北海道','東北','関東','中部','近畿','中国','四国','九州','沖縄','海外'];
    return '<form method="get" class="dn-event-filter" aria-label="手話カフェイベントを絞り込む"><input type="hidden" name="period" value="'.e($f['period']).'"><div class="dn-search-primary">'.field('q','イベント名・会場・キーワード',$f['q'],'search').select_field('country','国・地域',[''=>'すべて']+$countries,$f['country']).select_field('region','開催地域',[''=>'すべて']+array_combine($regions,$regions),$f['region']).'<button class="dn-search-button">'.cafe_icon('search').'<span>この条件で探す</span></button></div><div class="dn-filter-bottom"><a href="'.CAFE_EVENTS_PATH.'">条件をクリア</a></div></form>';
}
function cafe_event_card(array $p):string {
    $date=cafe_event_date($p);$venue=($p['venue_name']??'')?:'会場未確認';
    $location=($p['country_code']==='JP'?'':(($p['country_name']??'')?:$p['country_code']).' / ').$p['prefecture'].' '.$p['city'];
    $time=($p['kind']==='event')?trim(($p['start_time']??'').'〜'.($p['end_time']??'')):($p['business_hours']??'');
    if($time==='〜')$time='';
    $out='<article class="dn-card dn-place-card dn-event-card" data-event-id="'.e($p['id']).'"><div class="dn-event-heading"><div class="dn-event-date">'.cafe_icon('calendar').($date!==''?'<time datetime="'.e($date).'">'.e(str_replace('-','.',$date)).'</time>':'<span>日付未確認</span>').'</div><span class="dn-badge">'.e(cafe_event_label($p)).'</span></div><p class="dn-location">'.e($location).'</p><h2><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h2><dl class="dn-facts"><dt>会場</dt><dd>'.e($venue).'</dd><dt>開催時間</dt><dd>'.e($time?:'未確認').'</dd></dl><p class="dn-card-intro">'.nl2br(e($p['description']??'')).'</p>';
    if(!empty($p['notes']))$out.='<p class="dn-visit-note">'.nl2br(e($p['notes'])).'</p>';
    if(cafe_event_period($p)==='past'&&empty($p['event_reported'])&&($p['observation_only']??'0')!=='1')$out.='<p class="dn-event-history-note">過去の日付の告知情報です。実施済み・次回開催を示すものではありません。</p>';
    return $out.official_links($p,true).sources_html($p).'</article>';
}
function cafe_events_page():string {
    $all=cafe_event_records();$f=cafe_event_filters();$matched=array_values(array_filter($all,fn($p)=>cafe_event_matches($p,$f)));
    $counts=['upcoming'=>0,'past'=>0,'unconfirmed'=>0];foreach($matched as $p)$counts[cafe_event_period($p)]++;
    $list=array_values(array_filter($matched,fn($p)=>cafe_event_period($p)===$f['period']));
    usort($list,function($a,$b)use($f){$comparison=strcmp(cafe_event_date($a),cafe_event_date($b));return ($f['period']==='past'?-$comparison:$comparison)?:strcmp($a['name'],$b['name']);});
    $total=count($list);$size=24;$page=min(max(1,(int)$f['page']),max(1,(int)ceil($total/$size)));$list=array_slice($list,($page-1)*$size,$size);
    $body='<div class="dn-cafe-navigation">'.tabs(false,false,false,true).'</div><div class="dn-directory-layout">'.cafe_filter_panel(cafe_event_filter_form($f,$all),true).'<section id="cafe-events" class="dn-directory-results" aria-labelledby="event-list-heading"><h2 id="event-list-heading" class="dn-visually-hidden">手話カフェイベントを探す</h2>'.cafe_event_period_links($f,$counts).'<div class="dn-result-bar"><p class="dn-result" role="status">該当 <strong>'.$total.'</strong>件</p></div>';
    $body.='<p class="dn-event-intro">単発開催を日付ごとに掲載しています。<a href="/connect/sign-cafe/">常設店・定期開催はカフェ一覧へ</a>。</p>';
    if($f['period']==='past')$body.='<p class="dn-event-history-note">過去の告知・開催報告を掲載しています。日付の経過だけで、実際に開催されたと判断していません。</p>';
    $body.=$list?'<div class="dn-place-grid dn-event-grid">'.implode('',array_map('cafe_event_card',$list)).'</div>':'<section class="dn-empty"><h2>この条件のイベント情報はまだありません</h2><p>開催時期や検索条件を変えると、ほかの掲載情報を確認できます。</p></section>';
    $params=array_filter($f,fn($value)=>$value!=='');unset($params['page']);$body.='<nav class="dn-pagination" aria-label="手話カフェイベントのページ">';
    if($page>1)$body.='<a href="?'.e(http_build_query($params+['page'=>$page-1])).'">← 前のページ</a>';
    $body.='<span>全'.$total.'件中 '.($total?($page-1)*$size+1:0).'〜'.min($page*$size,$total).'件</span>';
    if($page*$size<$total)$body.='<a href="?'.e(http_build_query($params+['page'=>$page+1])).'">次のページ →</a>';
    $body.='</nav></section></div><p class="dn-guide-note">'.cafe_icon('edit').'<span>新しい開催情報や変更は<a href="/submit/">情報提供フォーム</a>からお知らせください。</span></p>';
    $schema=['@context'=>'https://schema.org','@type'=>'CollectionPage','url'=>BASE.CAFE_EVENTS_PATH,'name'=>'手話カフェイベント','mainEntity'=>['@type'=>'ItemList','numberOfItems'=>$total,'itemListElement'=>array_map(fn($p,$i)=>['@type'=>'ListItem','position'=>($page-1)*$size+$i+1,'name'=>$p['name'],'url'=>BASE.record_path($p)],$list,array_keys($list))]];
    $filtered=$f['period']!=='upcoming'||$f['q']!==''||$f['country']!==''||$f['region']!==''||$f['prefecture']!=='';
    $canonical=BASE.CAFE_EVENTS_PATH.($page>1?'?page='.$page:'');
    return page('手話カフェイベント',$body,CAFE_EVENTS_PATH,CAFE_EVENTS_DESCRIPTION,[$schema],false,['canonical'=>$canonical,'robots'=>$filtered?'noindex,follow':'index,follow']);
}
