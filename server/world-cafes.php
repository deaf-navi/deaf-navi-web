<?php
declare(strict_types=1);
const WORLD_REGIONS=['asia'=>'アジア','middle_east'=>'中東','europe'=>'ヨーロッパ','africa'=>'アフリカ','north_america'=>'北米','latin_america_caribbean'=>'中南米・カリブ','oceania'=>'オセアニア'];
const WORLD_TAGS=['eu'=>'EU','americas'=>'アメリカ大陸','mena'=>'中東・北アフリカ','east_asia'=>'東アジア','southeast_asia'=>'東南アジア','south_asia'=>'南アジア','western_europe'=>'西ヨーロッパ','northern_europe'=>'北ヨーロッパ','southern_europe'=>'南ヨーロッパ','eastern_europe'=>'東ヨーロッパ','central_america'=>'中米','south_america'=>'南米','caribbean'=>'カリブ','north_africa'=>'北アフリカ','sub_saharan_africa'=>'サハラ以南アフリカ'];
const WORLD_VENUES=['permanent_store'=>'常設店舗','recurring_cafe'=>'定期開催カフェ','community_space'=>'交流スペース','restaurant'=>'レストラン','bar'=>'バー','other'=>'その他'];
const WORLD_OPERATIONS=['permanent'=>'常設','recurring'=>'定期開催','unknown'=>'未確認'];
const WORLD_RELATIONS=['official_signing_store'=>'Signing Store（公式）','deaf_owned'=>'ろう者所有','deaf_operated'=>'ろう者運営','deaf_staffed'=>'ろう・難聴スタッフ','sign_language_service'=>'手話での接客','sign_language_community'=>'手話コミュニティ','recurring_sign_cafe'=>'定期手話カフェ','inclusive_disability_store'=>'障害者雇用・交流','unknown'=>'関係未確認'];
const WORLD_VERIFICATIONS=['verified'=>'確認済み','pending'=>'要確認','stale'=>'再確認が必要','rejected'=>'掲載根拠なし'];
function world_verification(array $p):string {return $p['verification_status']??(($p['verification_level']??'pending')==='pending'?'pending':'verified');}
function world_validate(array $post,array $p):array {
    foreach(['world_region','subregion','local_name','country_name_en','chain_name','brand'] as $k)$p[$k]=input($post,$k,300);
    if($p['world_region']!=='')choice($p['world_region'],WORLD_REGIONS);
    foreach(['region_tags'=>WORLD_TAGS,'deaf_relation'=>WORLD_RELATIONS] as $k=>$choices){$p[$k]=array_values(array_unique(array_filter(array_map('trim',explode("\n",input($post,$k,2000))))));foreach($p[$k] as $v)choice($v,$choices);}
    foreach(['venue_type'=>WORLD_VENUES,'operation_type'=>WORLD_OPERATIONS] as $k=>$choices){$p[$k]=input($post,$k,40);if($p[$k]!=='')choice($p[$k],$choices);}
    $chain=choice(input($post,'is_chain',1),[''=>1,'0'=>1,'1'=>1]);$p['is_chain']=$chain===''?null:$chain==='1';
    $p['verification_status']=choice(input($post,'verification_status',20)?:world_verification($p),WORLD_VERIFICATIONS);
    if($p['is_chain']===false&&$p['chain_name']!=='')fail('独立店にチェーン名は設定できません。');
    if(in_array('official_signing_store',$p['deaf_relation'],true)!==!empty($p['signing_store'])){
        // Legacy submissions can omit the new classification, but cannot assert an unconfirmed official store.
        if(in_array('official_signing_store',$p['deaf_relation'],true))fail('公式Signing Storeの指定と店舗種別を確認してください。');
    }
    if($p['publication']==='public'&&$p['verification_status']!=='verified')fail('公開には確認状態を「確認済み」にしてください。');
    if($p['publication']==='public'&&array_key_exists('verification_status',$post)&&!array_diff($p['deaf_relation'],['unknown']))fail('公開前に、店舗と手話・ろう者との関係を情報源で確認してください。');
    return $p;
}
function world_admin_fields(array $p):string {
    $out='<fieldset class="dn-world-fields"><legend>海外の地域・ブランド・確認状態</legend><p>営業状態・確認状態・公開状態は別々に管理します。未確認の分類は空欄のまま保存してください。非表示は「非公開」を選び、履歴を保持します。</p><div class="dn-form-grid">';
    foreach(['world_region'=>['世界地域',[''=>'未設定']+WORLD_REGIONS],'venue_type'=>['店舗・活動形態',[''=>'未確認']+WORLD_VENUES],'operation_type'=>['常設・定期開催',[''=>'未確認']+WORLD_OPERATIONS],'verification_status'=>['情報確認状態',WORLD_VERIFICATIONS]] as $k=>[$label,$values])$out.=select_field($k,$label,$values,$p[$k]??($k==='verification_status'?world_verification($p):''));
    $out.=select_field('is_chain','チェーン区分',[''=>'未確認','1'=>'チェーン','0'=>'独立店・非チェーン'],isset($p['is_chain'])?($p['is_chain']?'1':'0'):'');
    foreach(['local_name'=>'現地語名称','country_name_en'=>'国名（英語・検索用）','subregion'=>'補助地域名','chain_name'=>'チェーン名','brand'=>'ブランド'] as $k=>$label)$out.=field($k,$label,$p[$k]??'');
    foreach(['region_tags'=>['地域タグ',WORLD_TAGS],'deaf_relation'=>['ろう者・手話との関係',WORLD_RELATIONS]] as $k=>[$label,$values])$out.=field($k,$label.'（1行1コード）',$p[$k]??[],'textarea').'<p class="dn-muted">'.e(implode(' / ',array_map(fn($key,$value)=>$key.'：'.$value,array_keys($values),$values))).'</p>';
    return $out.'</div></fieldset>';
}
function world_records():array {return array_values(array_filter(visible_records(),fn($p)=>$p['country_code']!=='JP'&&in_array($p['kind'],['cafe','store'],true)));}
function world_matches(array $p,array $f):bool {
    $tags=$p['region_tags']??[];$r=$f['region']??'';
    if($r!==''&&$r!==($p['world_region']??'')&&!in_array($r,$tags,true))return false;
    if(($f['tag']??'')!==''&&!in_array($f['tag'],$tags,true))return false;
    foreach(['country'=>'country_code','operation'=>'operation_type','relation'=>'deaf_relation','venue'=>'venue_type'] as $key=>$field){$value=$f[$key]??'';if($value!==''&&!(is_array($p[$field]??null)?in_array($value,$p[$field],true):$value===($p[$field]??'')))return false;}
    $brand=$f['brand']??'';$actual=$p['brand']??'';
    if($brand==='independent'&&($p['is_chain']??null)!==false)return false;
    if($brand==='other_chain'&&(($p['is_chain']??null)!==true||in_array($actual,['Starbucks','Sign Language Coffee Bar'],true)))return false;
    if($brand!==''&&!in_array($brand,['independent','other_chain'],true)&&normalized($brand)!==normalized($actual))return false;
    $status=$f['status']??'';
    if($status!==''&&($status==='needs_review'?!in_array($p['status'],['needs_review','unknown'],true):($status==='permanently_closed'?!in_array($p['status'],['closed','permanently_closed'],true):$status!==$p['status'])))return false;
    if($status===''&&($f['history']??'')!=='1'&&!in_array($p['status'],['open','active_recurring','unknown','needs_review'],true))return false;
    $q=normalized($f['q']??'');
    return $q===''||str_contains(normalized(implode(' ',array_map(fn($k)=>(string)($p[$k]??''),['name','local_name','brand','chain_name','country_code','country_name','country_name_en','city','prefecture','description']))),$q);
}
function world_filter_values():array {$f=[];foreach(['region','tag','country','brand','operation','relation','venue','status','history','q'] as $k)$f[$k]=input($_GET,$k,200);return $f;}
function world_located(array $p):bool {return ($p['coordinate_accuracy']??'')==='address_vicinity'&&!empty($p['coordinate_source_url'])&&!empty($p['address'])&&is_numeric($p['latitude']??null)&&is_numeric($p['longitude']??null)&&abs((float)$p['latitude'])<=85&&abs((float)$p['longitude'])<=180;}
function world_map_data():array {
    $spots=[];$f=world_filter_values();foreach(world_records() as $p)if(world_matches($p,$f)&&world_located($p))$spots[]=['name'=>$p['name'],'path'=>record_path($p),'latitude'=>(float)$p['latitude'],'longitude'=>(float)$p['longitude'],'country'=>$p['country_name'],'city'=>$p['city']];
    return ['spots'=>$spots];
}
function world_badges(array $p):string {
    $labels=[];if(!empty($p['brand']))$labels[]=$p['brand'];
    if(!empty($p['signing_store']))$labels[]='Signing Store';
    if(!empty($p['operation_type']))$labels[]=WORLD_OPERATIONS[$p['operation_type']]??'未確認';
    foreach($p['deaf_relation']??[] as $v)if($v!=='official_signing_store')$labels[]=WORLD_RELATIONS[$v]??$v;
    return '<div class="dn-world-badges">'.implode('',array_map(fn($v)=>'<span>'.e($v).'</span>',$labels)).'</div>';
}
function world_filters(array $all,array $f):string {
    $regions=[''=>'すべての地域']+WORLD_REGIONS+['eu'=>'EU','americas'=>'アメリカ大陸'];
    $brands=[''=>'すべて','starbucks'=>'Starbucks','Sign Language Coffee Bar'=>'Sign Language Coffee Bar','other_chain'=>'その他チェーン','independent'=>'独立店・非チェーン'];
    $countries=[];$countryRegions=[];
    foreach($all as $p){
        if(!empty($p['brand'])&&!in_array($p['brand'],$brands,true))$brands[$p['brand']]=$p['brand'];
        $code=$p['country_code'];$countries[$code]=$p['country_name']?:$code;
        $countryRegions[$code]=array_values(array_unique([...($countryRegions[$code]??[]),$p['world_region']??'',...($p['region_tags']??[])]));
    }
    if($f['country']!==''&&!isset($countries[$f['country']]))$countries[$f['country']]=$f['country'].'（掲載情報なし）';
    $country='<label class="dn-field"><span>国・地域</span><select name="country"><option value="">すべての国・地域</option>';
    foreach($countries as $code=>$label)$country.='<option value="'.e($code).'"'.($f['country']===$code?' selected':'').' data-regions="'.e(json($countryRegions[$code]??[])).'">'.e($label).'</option>';
    $country.='</select></label>';
    $out='<form method="get" class="dn-domestic-filter dn-world-search" aria-label="海外の手話カフェを絞り込む"><div class="dn-domestic-main">'
        .field('q','店舗名・ブランド・国・都市',$f['q'],'search').select_field('region','世界の地域',$regions,$f['region']).$country
        .select_field('venue','店舗タイプ',[''=>'すべて']+WORLD_VENUES,$f['venue'])
        .select_field('status','営業状態',[''=>'休業・閉店を除く','open'=>'営業中','active_recurring'=>'定期開催中','temporarily_closed'=>'一時休業','needs_review'=>'確認中・未確認','permanently_closed'=>'閉店・活動終了'],$f['status'])
        .'<button>この条件で探す</button></div>';
    $advanced=array_filter(array_intersect_key($f,array_flip(['brand','tag','operation','relation','history'])));
    $out.='<details class="dn-filter-more"'.($advanced?' open':'').'><summary>詳しい条件：ブランド・手話との関わり'.($advanced?'（選択中）':'').'</summary><div class="dn-more-fields">'
        .select_field('brand','ブランド・チェーン',$brands,$f['brand']).select_field('operation','常設・定期開催',[''=>'すべて']+WORLD_OPERATIONS,$f['operation'])
        .select_field('relation','ろう者・手話との関わり',[''=>'すべて']+WORLD_RELATIONS,$f['relation']).select_field('tag','補助地域',[''=>'すべて']+WORLD_TAGS,$f['tag'])
        .select_field('history','休業・閉店の履歴',[''=>'営業状態の条件に従う','1'=>'履歴も含める'],$f['history']).'<button>詳しい条件で探す</button></div></details>';
    $out.='<div class="dn-filter-bottom">'.select_field('sort','並べ替え',['location'=>'所在地','name'=>'店舗名','type'=>'店舗タイプ','brand'=>'ブランド'],world_sort())
        .select_field('dir','順序',['asc'=>'昇順','desc'=>'降順'],world_direction())
        .select_field('view','表示方法',['table'=>'比較表','cards'=>'カード'],world_view())
        .'<input type="hidden" name="per_page" value="'.world_page_size().'"><button>表示を更新</button><a href="/connect/sign-cafe/overseas/">条件をクリア</a></div></form>';
    return $out;
}
function world_page():string {
    $all=world_records();$f=world_filter_values();$list=array_values(array_filter($all,fn($p)=>world_matches($p,$f)));
    $body='<link rel="stylesheet" href="/world-cafes.css?v=20260908ui"><script src="/world-cafes.js?v=20260908ui" defer></script>'
        .'<p class="dn-eyebrow" lang="en">Deaf Navi – Sign Cafe</p><p class="dn-lead">世界の、手話でつながるカフェを探す。</p>'.tabs(false,true)
        .'<p>国や都市、お店のタイプから、気になるカフェを探してみませんか。手話との関わりや、定期開催の情報もご案内しています。</p>'
        .world_filters($all,$f).'<div class="dn-result-bar"><p class="dn-result" role="status">該当 <strong>'.count($list).'</strong>件</p><a href="#world-map-panel">世界地図から探す</a></div>'
        .'<p class="dn-muted">営業時間・開催日は現地時間です。手話は国や地域によって異なります。お出かけ前に、お店の公式サイトやSNSで営業日・手話対応をご確認ください。営業状況が分からないお店は「確認中」「営業状況未確認」と表示しています。</p>';
    $mapped=count(array_filter($list,'world_located'));
    $body.='<details class="dn-world-map-panel" id="world-map-panel"><summary>世界地図から探す（'.$mapped.'件）</summary><p>住所付近の位置を確認できた'.$mapped.'件を表示できます。位置確認待ちの店舗も下の一覧に掲載しています。位置は建物付近の概略で、入口や階を示すものではありません。</p><button type="button" id="world-map-start" hidden>世界地図を開く</button><p class="dn-muted">開いたときだけOpenStreetMapの地図画像を読み込みます。現在地は取得しません。位置は店舗・施設の案内と地図資料を照合しています。地図：<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>。</p><div id="world-map" hidden aria-label="海外の手話カフェ地図"></div><p id="world-map-status" role="status"></p></details>';
    if($list)$body.=world_table($list,$f);
    else $body.='<section class="dn-empty"><h2>'.(!$all?'海外の手話カフェ情報は掲載準備中です':'条件に合うカフェは、まだ掲載されていません').'</h2><p>確認できたお店から順にご紹介しています。地域を広げたり、条件を少し変えたりして探してみてください。</p><a href="/connect/sign-cafe/overseas/">条件をクリアして探す</a></section>';
    return page('海外の手話カフェ',$body.'<p><a href="/submit/?scope=overseas#request">海外の手話カフェの情報を教えてください</a></p>','/connect/sign-cafe/overseas/','世界の手話カフェを地域・国・ブランド・手話との関係から探す。');
}
function world_sort():string {$v=input($_GET,'sort',20);return in_array($v,['name','location','type','brand'],true)?$v:'location';}
function world_direction():string {$v=input($_GET,'dir',4);return in_array($v,['asc','desc'],true)?$v:(world_sort()==='location'?'desc':'asc');}
function world_view():string {return input($_GET,'view',10)==='cards'?'cards':'table';}
function world_page_size():int {return input($_GET,'per_page',3)==='100'?100:50;}
function world_type_label(array $p):string {
    if(!empty($p['signing_store']))return 'Signing Store';
    return WORLD_VENUES[$p['venue_type']??'']??WORLD_OPERATIONS[$p['operation_type']??'']??'形態未確認';
}
function world_details(array $p):string {
    $out='<h2>'.e($p['name']).'</h2>'.world_badges($p).'<dl class="dn-facts">';
    $facts=['local_name'=>'現地語の名称','address'=>'住所','sign_support'=>'手話対応','holidays'=>'定休日','reservation'=>'予約','timezone'=>'タイムゾーン'];
    foreach($facts as $k=>$label)if(!empty($p[$k]))$out.='<dt>'.$label.'</dt><dd>'.nl2br(e($p[$k])).'</dd>';
    $out.='<dt>世界の地域</dt><dd>'.e(WORLD_REGIONS[$p['world_region']??'']??'地域未確認').'</dd></dl>';
    foreach(['description','notes'] as $k)if(!empty($p[$k]))$out.='<p>'.nl2br(e($p[$k])).'</p>';
    $out.=official_links($p).'<div class="dn-links">';
    if(!empty($p['map_url']))$out.=ext_link($p['map_url'],'地図・行き方');
    $out.=action_link(record_path($p),'お店について詳しく見る','page');
    if(!empty($p['id']))$out.='<a href="'.e(cafe_correction_url($p)).'">情報を修正・追加する</a>';
    return $out.'</div>'.sources_html($p);
}
function world_table(array $list,array $filters):string {
    $sort=world_sort();$direction=world_direction();$view=world_view();
    $key=fn($p)=>$sort==='location'?sprintf('%02d',array_search($p['world_region']??'',array_keys(WORLD_REGIONS),true)).' '.$p['country_code'].' '.$p['city']:($sort==='type'?world_type_label($p):($p[$sort]??''));
    $collator=class_exists('Collator')?new Collator('ja_JP'):null;
    usort($list,fn($a,$b)=>($direction==='desc'?-1:1)*(($collator?$collator->compare($key($a),$key($b)):strcmp($key($a),$key($b)))?:strcmp($a['slug'],$b['slug'])));
    $size=world_page_size();$total=count($list);$pages=max(1,(int)ceil($total/$size));$current=min($pages,max(1,(int)input($_GET,'page',8)));
    $params=array_filter($filters,fn($v)=>$v!=='')+['sort'=>$sort,'dir'=>$direction,'view'=>$view,'per_page'=>$size];
    $out='<p class="dn-table-hint" id="world-table-help">'.($view==='cards'?'店舗名から、お店の詳しい情報をご覧いただけます。':'列名で並べ替えできます。店舗名から個別ページへ移動できます。<span class="dn-mobile-hint">表は横にスクロールできます。</span>').'</p>';
    if($view==='table'){
        $out.='<div class="dn-table-scroll" role="region" aria-label="海外手話カフェの比較表" tabindex="0"><table class="dn-cafe-table dn-world-table" data-server-sort="1" aria-describedby="world-table-help"><caption class="dn-visually-hidden">海外の手話カフェ一覧・所在地・営業形態・営業時間</caption><thead><tr>';
        foreach(['name'=>'店舗名','location'=>'国・都市','type'=>'営業形態'] as $k=>$label){
            $url='?'.http_build_query(array_replace($params,['sort'=>$k,'dir'=>$sort===$k&&$direction==='asc'?'desc':'asc'])).'#world-table-help';
            $out.='<th scope="col" aria-sort="'.($sort===$k?($direction==='asc'?'ascending':'descending'):'none').'"><a href="'.e($url).'">'.$label.' <span aria-hidden="true">'.($sort===$k?($direction==='asc'?'↑':'↓'):'↕').'</span></a></th>';
        }
        $out.='<th scope="col">営業時間・開催日<span class="dn-cell-secondary">現地時間</span></th></tr></thead><tbody>';
    }else $out.='<div class="dn-place-grid dn-world-cards">';
    foreach(array_slice($list,($current-1)*$size,$size) as $p){
        $location=e(($p['country_name']?:$p['country_code']));$city=e($p['city']);$status=e(cafe_status_label($p));$type=e(world_type_label($p));
        if($view==='cards'){
            $out.='<article class="dn-place-card" data-slug="'.e($p['slug']).'"><p class="dn-location">'.$location.' / '.$city.'</p><h2><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h2><div class="dn-badges"><span class="dn-badge">'.$type.'</span><span class="dn-badge">'.$status.'</span></div><div class="dn-visit-time"><p>営業時間・開催日（現地時間）</p>'.cafe_table_schedule($p).'</div><p class="dn-muted">情報確認日：'.e(($p['last_verified_at']??'')?:'未確認').'</p><details><summary>お店の詳細・情報源</summary>'.world_details($p).'</details></article>';
            continue;
        }
        $id='world-detail-'.$p['slug'];
        $out.='<tr class="dn-cafe-row" data-slug="'.e($p['slug']).'"><th scope="row"><a class="dn-cafe-name" href="'.e(record_path($p)).'">'.e($p['name']).'</a><div class="dn-row-meta"><button type="button" class="dn-expand" data-cafe-expand="'.e($id).'" aria-expanded="false" aria-controls="'.e($id).'" hidden>詳細 ＋</button><span>確認 '.e(($p['last_verified_at']??'')?:'未確認').'</span></div></th><td>'.$location.'<span class="dn-cell-secondary">'.$city.'</span></td><td><span class="dn-badge">'.$type.'</span><span class="dn-cell-secondary dn-operating-state">'.$status.'</span></td><td class="dn-hours">'.cafe_table_schedule($p).'</td></tr>';
        $out.='<tr class="dn-cafe-expanded" id="'.e($id).'" hidden><td colspan="4"><div class="dn-expanded-inner">'.world_details($p).'</div></td></tr>';
    }
    $out.=($view==='table'?'</tbody></table></div>':'</div>').'<nav class="dn-pagination" aria-label="海外一覧のページ">';
    if($current>1)$out.='<a href="?'.e(http_build_query($params+['page'=>$current-1])).'#world-table-help">← 前のページ</a>';
    $out.='<span>全'.$total.'件中 '.(($current-1)*$size+1).'〜'.min($current*$size,$total).'件</span>';
    if($current<$pages)$out.='<a href="?'.e(http_build_query($params+['page'=>$current+1])).'#world-table-help">次のページ →</a>';
    foreach([50,100] as $n)$out.=$n===$size?'<strong>'.$n.'件ずつ</strong>':'<a href="?'.e(http_build_query(array_replace($params,['per_page'=>$n]))).'#world-table-help">'.$n.'件ずつ</a>';
    return $out.'</nav>';
}
