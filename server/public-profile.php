<?php
declare(strict_types=1);
// Public presentation is an allowlist, deliberately separate from admin fields.
function official_links(array $p,bool $compact=false):string {
    $links=[];$seen=[];
    foreach(['official_url'=>$compact?'HP':'公式サイト（HP）','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook','line_url'=>'LINE','youtube_url'=>'YouTube'] as $key=>$label){
        $url=$p[$key]??'';if($url===''||isset($seen[rtrim($url,'/')]))continue;
        $seen[rtrim($url,'/')]=true;
        $links[]='<a href="'.e(safe_url($url)).'" target="_blank" rel="noopener noreferrer" aria-label="'.e($p['name'].'の'.$label).'（別タブで開きます）">'.e($label).'</a>';
    }
    if(!$links)return '';
    return '<div class="dn-official-links'.($compact?' is-compact':'').'">'.($compact?'':'<p class="dn-link-heading">公式サイト・SNS</p><p class="dn-muted">最新のお知らせは、お店や運営元の発信をご確認ください。</p>').'<nav aria-label="'.e($p['name']).'の公式サイト・SNS">'.implode('',$links).'</nav></div>';
}
function visitor_facts(array $p,array $fields):string {
    $out='';foreach($fields as $key=>$label)if(isset($p[$key])&&$p[$key]!=='')$out.='<dt>'.e($label).'</dt><dd>'.nl2br(e($p[$key])).'</dd>';
    return $out===''?'':'<dl class="dn-visitor-facts">'.$out.'</dl>';
}
function visitor_profile(array $p):string {
    $out='<article class="dn-visitor-profile"><p class="dn-location">'.e(($p['country_code']!=='JP'?($p['country_name']?:'海外').' / ':'').$p['prefecture'].' / '.$p['city']).'</p>';
    if(!empty($p['name_kana']))$out.='<p class="dn-muted">'.e($p['name_kana']).'</p>';
    if($p['status']!=='open')$out.='<p class="dn-notice">'.e(STATUSES[$p['status']]).'。訪問前にお店の最新の案内をご確認ください。</p>';
    $out.='<p class="dn-profile-intro">'.nl2br(e($p['description']??'')).'</p>'.official_links($p);
    $out.='<section class="dn-visitor-section"><h2>営業時間・ご利用案内</h2>';
    $facts=visitor_facts($p,['business_hours'=>'営業時間','event_schedule'=>'営業日','holidays'=>'お休み','reservation'=>'予約について']);
    $out.=($facts?:'<p>営業時間・営業日は、お店の最新の案内をご確認ください。</p>').'</section>';
    if(!empty($p['sign_support']))$out.='<section class="dn-visitor-section"><h2>手話でのコミュニケーション</h2><p>'.nl2br(e($p['sign_support'])).'</p></section>';
    $out.='<section class="dn-visitor-section"><h2>アクセス</h2>'.visitor_facts($p,['address'=>'住所']);
    if(!empty($p['map_url'])||!empty($p['address'])){
        $map=($p['map_url']??'')?:'https://www.google.com/maps/search/?api=1&query='.rawurlencode($p['address'].' '.$p['name']);
        $out.='<p><a class="dn-action-link" href="'.e(safe_url($map)).'" target="_blank" rel="noopener noreferrer">'.ui_icon('map').'<span>地図・行き方を確認する</span></a></p>';
    }else $out.='<p>詳しい場所は、お店の案内をご確認ください。</p>';
    $out.='</section>';
    if(!empty($p['operator']))$out.='<section class="dn-visitor-section"><h2>運営について</h2><p>'.e($p['operator']).'</p></section>';
    return $out.'<section class="dn-visitor-section"><h2>掲載情報について</h2><p>営業日や内容は変更される場合があります。訪問前に公式サイト・SNSの最新情報をご確認ください。</p>'.sources_html($p).'</section></article>';
}
function visitor_event_details(array $p):string {
    return '<section class="dn-visitor-section"><h2>参加について</h2>'.visitor_facts($p,['end_time'=>'終了時刻','event_schedule'=>'開催日程','conditions'=>'参加条件','application'=>'参加・申込方法','organizer'=>'主催','partners'=>'協力']).(!empty($p['official_url'])?'<p>'.ext_link($p['official_url'],'開催案内を見る').'</p>':'').'</section>';
}
