<?php
declare(strict_types=1);
function cafe_status_label(array $p):string {return STATUSES[$p['status']]??'営業状況未確認';}
function cafe_badges(array $p):string {
    $p=cafe_model($p);$out='<div class="dn-badges"><span class="dn-badge">'.e(SHOP_TYPES[$p['shop_type']]).'</span><span class="dn-badge'.(in_array($p['status'],['open','active_recurring'],true)?'':' dn-warning').'">'.e(cafe_status_label($p)).'</span></div>';
    $out.='<p class="dn-support-level">'.e(SIGN_LEVELS[$p['sign_language_level']]).'</p><div class="dn-badges">';
    foreach(CAFE_FEATURES as $k=>$label)if(($p[$k]??null)===true)$out.='<span class="dn-tag">'.e($label).'</span>';
    return $out.'</div>';
}
function cafe_freshness_html(array $p):string {
    return match(cafe_freshness($p)){'stale'=>'<p class="dn-freshness dn-warning">情報が古い可能性があります（6か月以上未確認）</p>','review_due'=>'<p class="dn-freshness dn-warning">再確認が必要です（12か月以上未確認）</p>','unverified'=>'<p class="dn-freshness dn-warning">情報確認日：未確認</p>',default=>''};
}
function cafe_schedule_html(array $p):string {
    $p=cafe_model($p);$recurring=in_array($p['shop_type'],['recurring_program','recurring_popup','public_recurring','facility_cafe'],true);
    $days=$p['recurrence']?:($p['event_schedule']??'');
    // Old schedules remain stored, but are not presented as current after a review warning.
    if(in_array($p['status'],['needs_review','unknown'],true))$days='現在の開催日・営業時間は確認中';
    $out='<div class="dn-visit-time"><p>'.($recurring?'手話で利用できる日':'営業日').'</p><strong>'.nl2br(e($days?:'営業日未確認・公式情報をご確認ください')).'</strong>';
    if(!in_array($p['status'],['needs_review','unknown'],true))$out.='<span>'.nl2br(e(($p['business_hours']??'')?:'時間未確認')).'</span>';
    if($p['venue_name']!=='')$out.='<span>会場：'.e($p['venue_name']).'</span>';
    return $out.'</div>';
}
function cafe_correction_url(array $p):string {return '/submit/?'.http_build_query(['category'=>'correction','record'=>$p['id']]);}
function domestic_card(array $p):string {
    $out='<article class="dn-card dn-place-card" data-cafe-id="'.e($p['id']).'"><p class="dn-location">'.e($p['prefecture'].' '.$p['city']).'</p><h2><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h2>'.cafe_badges($p).cafe_schedule_html($p);
    if(!empty($p['notes']))$out.='<p class="dn-visit-note">'.nl2br(e($p['notes'])).'</p>';
    $out.=official_links($p,true).'<div class="dn-links">';
    $map=($p['map_url']??'')?:(!empty($p['address'])?'https://www.google.com/maps/search/?api=1&query='.rawurlencode($p['address'].' '.$p['name']):'');
    if($map)$out.=ext_link($map,'地図');
    return $out.'</div>'.sources_html($p).'<p><a href="'.e(cafe_correction_url($p)).'">情報を修正・追加する</a></p></article>';
}
function domestic_filter_values():array {
    $out=[];foreach(['q'=>200,'region'=>40,'prefecture'=>100,'shop_type'=>40,'status'=>30,'operator_type'=>40,'sign_language_level'=>40,'events'=>1,'history'=>1,'type'=>40,'sort'=>20,'dir'=>4,'view'=>10,'page'=>8,'per_page'=>3]+array_fill_keys(array_keys(CAFE_FEATURES),1) as $k=>$max)$out[$k]=input($_GET,$k,$max);
    foreach(CAFE_FEATURES as $k=>$label)if($out[$k]!==''&&$out[$k]!=='1')fail('特徴の選択値が不正です。');
    return $out;
}
function domestic_matches(array $p,array $f):bool {
    $p=cafe_model($p);
    foreach(['prefecture','shop_type','operator_type','sign_language_level'] as $k)if(($f[$k]??'')!==''&&$f[$k]!==$p[$k])return false;
    if(($f['region']??'')!==''&&$f['region']!==region($p['prefecture'],'JP'))return false;
    $status=$f['status']??'';
    if($status!==''&&($status==='needs_review'?!in_array($p['status'],['needs_review','unknown'],true):($status==='permanently_closed'?!in_array($p['status'],['permanently_closed','closed'],true):$status!==$p['status'])))return false;
    if($status===''&&($f['history']??'')!=='1'&&in_array($p['status'],['closed','permanently_closed'],true))return false;
    if($p['shop_type']==='event'&&($f['events']??'')!=='1'&&($f['shop_type']??'')!=='event')return false;
    if(($f['type']??'')!==''&&$f['type']!==($p['type']??''))return false;
    foreach(CAFE_FEATURES as $k=>$label)if(($f[$k]??'')==='1'&&$p[$k]!==true)return false;
    $q=normalized($f['q']??'');
    return $q===''||str_contains(normalized(implode(' ',array_map(fn($k)=>(string)($p[$k]??''),['name','name_kana','prefecture','city','address','venue_name','description','sign_support','operator','recurrence']))),$q);
}
function domestic_filters(array $f):string {
    $regions=['北海道','東北','関東','中部','近畿','中国','四国','九州','沖縄'];$prefs=explode(' ',JP_PREFECTURES);
    $out='<form method="get" class="dn-domestic-filter" aria-label="日本の手話カフェを絞り込む"><div class="dn-domestic-main">'.field('q','店舗名・地域・キーワード',$f['q'],'search').select_field('region','地域',[''=>'全国']+array_combine($regions,$regions),$f['region']).select_field('prefecture','都道府県',[''=>'すべて']+array_combine($prefs,$prefs),$f['prefecture']).select_field('shop_type','店舗タイプ',[''=>'すべて']+SHOP_TYPES,$f['shop_type']).select_field('status','営業状態',[''=>'閉店を除くすべて','open'=>'営業中','active_recurring'=>'定期開催中','temporarily_closed'=>'一時休業','needs_review'=>'確認中・未確認','permanently_closed'=>'閉店・活動終了'],$f['status']).'<button>この条件で探す</button></div>';
    $advanced=array_filter(array_intersect_key($f,array_flip(['operator_type','sign_language_level','events',...array_keys(CAFE_FEATURES)])));
    $out.='<details class="dn-filter-more"'.($advanced?' open':'').'><summary>詳しい条件：運営・手話対応・特徴'.($advanced?'（選択中）':'').'</summary><div class="dn-domestic-main">'.select_field('operator_type','運営形態',[''=>'すべて']+OPERATOR_TYPES,$f['operator_type']).select_field('sign_language_level','手話対応レベル',[''=>'すべて']+SIGN_LEVELS,$f['sign_language_level']).'</div><fieldset class="dn-feature-checks"><legend>特徴（公表・確認できた情報のみ）</legend>';
    foreach(CAFE_FEATURES+['events'=>'単発イベントも表示'] as $k=>$label)$out.='<label class="dn-check"><input type="checkbox" name="'.$k.'" value="1"'.($f[$k]==='1'?' checked':'').'>'.e($label).'</label>';
    $out.='</fieldset><button>詳しい条件で探す</button></details><div class="dn-filter-bottom">'.select_field('sort','並べ替え',['region'=>'所在地','name'=>'店舗名','type'=>'店舗タイプ'],$f['sort']?:'region').select_field('dir','順序',['asc'=>'昇順','desc'=>'降順'],$f['dir']?:'asc').select_field('view','表示方法',['cards'=>'カード','table'=>'比較表'],$f['view']?:'cards').'<button>表示を更新</button><a href="/connect/sign-cafe/">条件をクリア</a></div></form>';
    return $out;
}
function domestic_empty(array $f):string {
    $prefs=explode(' ',JP_PREFECTURES);$reg=($f['prefecture']??'')!==''?region($f['prefecture'],'JP'):($f['region']??'');
    $neighbors=$f['prefecture']==='奈良県'?['大阪府','京都府','兵庫県']:array_values(array_filter($prefs,fn($p)=>$p!==$f['prefecture']&&region($p,'JP')===$reg));
    $out='<section class="dn-empty"><h2>条件に一致する掲載情報はまだありません</h2><p>未調査・確認待ちの店舗もあります。お店が存在しないという意味ではありません。</p><div class="dn-links">';
    foreach($neighbors as $pref)$out.='<a href="?'.e(http_build_query(['prefecture'=>$pref])).'">'.e($pref).'を見る</a>';
    return $out.'<a href="?'.e(http_build_query(['region'=>$reg,'shop_type'=>'recurring_program','events'=>'1'])).'">地域の定期開催を見る</a><a href="?events=1">イベントも含め全国を見る</a><a href="/submit/">新しい情報を提供する</a></div></section>';
}
function domestic_cafe_page():string {
    $all=array_values(array_filter(visible_records(),fn($p)=>$p['country_code']==='JP'&&($p['kind']==='cafe'||($p['kind']==='store'&&!empty($p['signing_store'])))));
    $f=domestic_filter_values();$list=array_values(array_filter($all,fn($p)=>domestic_matches($p,$f)));$sort=in_array($f['sort'],['name','type','region'],true)?$f['sort']:'region';
    usort($list,fn($a,$b)=>($f['dir']==='desc'?-1:1)*(strcmp(cafe_sort_key($a,$sort),cafe_sort_key($b,$sort))?:strcmp($a['slug'],$b['slug'])));
    $total=count($list);$size=in_array($f['per_page'],['24','48','96'],true)?(int)$f['per_page']:24;$page=min(max(1,(int)$f['page']),max(1,(int)ceil($total/$size)));$list=array_slice($list,($page-1)*$size,$size);
    $body='<p class="dn-eyebrow" lang="en">Deaf Navi – Sign Cafe</p><p class="dn-lead">手話で過ごせる場所と、行ける日を探す。</p>'.tabs().'<p>常設のカフェから、間借り・公共施設での定期開催まで。営業状態と手話で利用できる日程を分けてご案内します。</p>'.domestic_filters($f).'<div class="dn-result-bar"><p class="dn-result" role="status">該当 <strong>'.$total.'</strong>件</p><a href="/connect/sign-cafe/map/">地図から探す</a></div><p class="dn-muted">「営業中」は掲載情報の確認状態です。今この時刻に開いていることを示しません。訪問前に公式サイト・SNSをご確認ください。</p>';
    if(!$list)$body.=domestic_empty($f);
    elseif($f['view']==='table')$body.=cafe_table($list);
    else{$body.='<div class="dn-place-grid">'.implode('',array_map('domestic_card',$list)).'</div><details class="dn-compare"><summary>同じ結果を表で比較する</summary>'.cafe_table($list).'</details>';}
    $params=array_filter($f,fn($v)=>$v!=='');unset($params['page']);$body.='<nav class="dn-pagination" aria-label="日本の手話カフェのページ">';
    if($page>1)$body.='<a href="?'.e(http_build_query($params+['page'=>$page-1])).'">← 前のページ</a>';
    $body.='<span>全'.$total.'件中 '.($total?($page-1)*$size+1:0).'〜'.min($page*$size,$total).'件</span>';
    if($page*$size<$total)$body.='<a href="?'.e(http_build_query($params+['page'=>$page+1])).'">次のページ →</a>';
    $body.='</nav>';
    return page('Deaf Navi｜手話カフェ',$body.submission_form(),'/connect/sign-cafe/','日本の手話カフェを地域・営業形態・手話対応と開催日程から探せます。');
}
function cafe_admin_fields(array $p):string {
    $p=cafe_model($p);$out='<fieldset class="admin-fieldset"><legend>店舗タイプ・手話対応と再確認</legend><p>不明な属性は未確認。オーナー・スタッフ属性は本人・店舗の公表元URLが必要です。調査しただけの日を情報確認日にしないでください。</p><div class="dn-form-grid">';
    foreach(['shop_type'=>['店舗タイプ',SHOP_TYPES],'operator_type'=>['運営形態',OPERATOR_TYPES],'sign_language_level'=>['手話対応レベル',SIGN_LEVELS],'confirmation_status'=>['内容の確認状態',['confirmed'=>'確認済み','needs_review'=>'要確認','unknown'=>'不明']]] as $k=>[$label,$choices])$out.=select_field($k,$label,$choices,$p[$k]);
    foreach(CAFE_TRI_FIELDS as $k)$out.=select_field($k,CAFE_FEATURES[$k]??['spoken_language_support'=>'音声対応','reservation_required'=>'予約必須'][$k],['unknown'=>'未確認','true'=>'はい（確認済み）','false'=>'いいえ（確認済み）'],$p[$k]===null?'unknown':($p[$k]?'true':'false'));
    foreach(CAFE_TEXT_FIELDS as $k=>$label)$out.=field($k,$label,$p[$k],in_array($k,['attribute_sources','notes','review_notes'],true)?'textarea':(str_ends_with($k,'_url')?'url':(str_ends_with($k,'_at')&&!in_array($k,['moved_at','started_at'],true)||$k==='latest_source_date'?'date':'text')));
    return $out.'</div></fieldset>';
}
function cafe_admin_metrics():string {
    $rows=array_values(array_filter(array_map('expanded',query("SELECT * FROM records WHERE country_code='JP' AND publication!='deleted' AND (kind='cafe' OR (kind='store' AND json_extract(payload,'$.signing_store')=1))")->fetchAll())));
    $base='/admin/?view=records&kind=cafe&scope=domestic';$out='<h2>日本の手話カフェ・再確認</h2><div class="admin-metrics"><a href="'.$base.'"><span>総登録数</span><strong>'.count($rows).'</strong></a>';
    foreach(['open'=>'営業中','active_recurring'=>'定期開催中','needs_review'=>'確認待ち・営業未確認','temporarily_closed'=>'一時休業','permanently_closed'=>'閉店'] as $status=>$label){$n=count(array_filter($rows,fn($p)=>$status==='needs_review'?in_array($p['status'],['needs_review','unknown'],true):($status==='permanently_closed'?in_array($p['status'],['closed','permanently_closed'],true):$p['status']===$status)));$out.='<a href="'.$base.'&status='.$status.'"><span>'.$label.'</span><strong>'.$n.'</strong></a>';}
    foreach(['6'=>'6か月以上未確認','12'=>'12か月以上未確認','unverified'=>'確認日なし'] as $v=>$label){$n=count(array_filter($rows,fn($p)=>$v==='unverified'?cafe_freshness($p)==='unverified':(!empty($p['last_verified_at'])&&$p['last_verified_at']<=cafe_month_cutoff((int)$v))));$out.='<a href="'.$base.'&freshness='.$v.'"><span>'.$label.'</span><strong>'.$n.'</strong></a>';}
    return $out.'</div>';
}
