<?php
declare(strict_types=1);
function cafe_region_page(string $slug):string {
    $pref=CAFE_REGION_PAGES[$slug]??null;if($pref===null)fail('地域のページが見つかりません。',404);
    $path='/connect/sign-cafe/area/'.$slug.'/';
    $rows=array_values(array_filter(visible_records(),fn($p)=>$p['country_code']==='JP'&&($p['kind']==='cafe'||($p['kind']==='store'&&!empty($p['signing_store'])))&&domestic_matches($p,['prefecture'=>$pref])));
    usort($rows,fn($a,$b)=>strcmp($a['city'],$b['city'])?:cafe_priority_compare($a,$b));
    $label=$slug==='tokyo'?'東京':'神奈川';$title=$label.'の手話カフェ・定期交流の場所';
    $description=$pref.'の手話カフェや定期開催の場所を、市区町村・営業日・手話対応から確認できます。店舗ごとの公式情報と確認日を掲載しています。';
    $query=http_build_query(['prefecture'=>$pref]);$cities=[];foreach($rows as $p)if($p['city']!=='')$cities[$p['city']]=true;
    $body='<p class="dn-region-lead">'.e($description).'</p><div class="dn-links"><a href="/connect/sign-cafe/?'.e($query).'">この地域を条件で絞り込む</a><a href="/events.html?'.e($query).'">'.$label.'の手話イベントを見る</a><a href="/connect/sign-cafe/">全国の一覧へ</a></div>';
    $body.='<section class="dn-cafe-guide"><h2>訪問先を選ぶときに</h2><p>毎日利用できる常設店と、決まった日に開かれる定期開催は別です。営業形態と開催日を確認し、手話・筆談など希望する方法が利用できるか、店舗の個別ページから公式情報をご確認ください。</p>';
    if($cities)$body.='<p>現在の掲載地域：'.e(implode('、',array_keys($cities))).'。未掲載の場所があるため、地域内の全店舗を網羅する一覧ではありません。</p>';
    $body.='<p><a href="/guide/accessibility/">通訳・字幕・筆談の確認ポイント</a></p></section><section aria-labelledby="region-cafes"><h2 id="region-cafes">'.$label.'の掲載場所 <span class="dn-region-count">'.count($rows).'件</span></h2><p>営業状態や情報確認日もあわせてご確認ください。「確認中」は、現在の営業・開催を確認できていない情報です。</p><div class="dn-region-list">';
    foreach($rows as $p){
        $body.='<article class="dn-region-entry"><p class="dn-location">'.e($p['city']).'</p><h3><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h3>'.cafe_badges($p).cafe_schedule_html($p).cafe_freshness_html($p).'<div class="dn-links"><a href="'.e(record_path($p)).'">参加条件・公式情報を確認する</a></div></article>';
    }
    if(!$rows)$body.='<p>現在、この地域の掲載場所を確認中です。全国の一覧やイベントからお探しください。</p>';
    $body.='</div></section><section class="dn-cafe-guide"><h2>初めて参加する前に</h2><ul><li>営業日・開催日と、予約や事前申込の要否。</li><li>手話を学び始めた方の参加条件、筆談などの対応。</li><li>飲食代と参加費、場所までの行き方。</li></ul><p>掲載情報は全国の手話カフェ一覧と同じ情報から表示しています。最新の変更は主催者・店舗の公式案内を優先してください。</p></section>';
    $schema=['@context'=>'https://schema.org','@type'=>'CollectionPage','url'=>BASE.$path,'name'=>$title,'description'=>$description,'mainEntity'=>['@type'=>'ItemList','numberOfItems'=>count($rows),'itemListElement'=>array_map(fn($p,$i)=>['@type'=>'ListItem','position'=>$i+1,'name'=>$p['name'],'url'=>BASE.record_path($p)],$rows,array_keys($rows))]];
    return page($title,$body,$path,$description,[$schema],false,['title'=>$title.' | Deaf Navi','canonical'=>BASE.$path,'robots'=>($rows?'index':'noindex').',follow,max-image-preview:large']);
}
