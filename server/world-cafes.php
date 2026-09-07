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
    if(($f['history']??'')!=='1'&&!in_array($p['status'],['open','unknown'],true))return false;
    $q=normalized($f['q']??'');
    return $q===''||str_contains(normalized(implode(' ',array_map(fn($k)=>(string)($p[$k]??''),['name','local_name','brand','chain_name','country_code','country_name','country_name_en','city','prefecture','description']))),$q);
}
function world_filter_values():array {$f=[];foreach(['region','tag','country','brand','operation','relation','venue','history','q'] as $k)$f[$k]=input($_GET,$k,200);return $f;}
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
function world_page():string {
    $all=world_records();$f=world_filter_values();$list=array_values(array_filter($all,fn($p)=>world_matches($p,$f)));
    $regions=[''=>'すべて']+WORLD_REGIONS+['eu'=>'EU','americas'=>'アメリカ大陸'];$brands=[''=>'すべて','starbucks'=>'Starbucks','Sign Language Coffee Bar'=>'Sign Language Coffee Bar','other_chain'=>'その他チェーン','independent'=>'独立店・非チェーン'];
    foreach($all as $p)if(!empty($p['brand'])&&!in_array($p['brand'],$brands,true))$brands[$p['brand']]=$p['brand'];
    foreach($regions as $k=>$v)if($k!=='')$regions[$k]=$v.'（'.count(array_filter($all,fn($p)=>world_matches($p,['region'=>$k,'history'=>'1']))).'）';
    foreach($brands as $k=>$v)if($k!=='')$brands[$k]=$v.'（'.count(array_filter($all,fn($p)=>world_matches($p,['brand'=>$k,'history'=>'1']))).'）';
    $countries=[''=>'すべての国・地域'];foreach($all as $p)if(world_matches($p,['region'=>$f['region'],'tag'=>$f['tag'],'history'=>'1']))$countries[$p['country_code']]=$p['country_name'];
    if($f['country']!==''&&!isset($countries[$f['country']]))$countries[$f['country']]=$f['country'].'（この地域では0件）';
    $body='<link rel="stylesheet" href="/world-cafes.css?v=1"><script src="/world-cafes.js?v=1" defer></script>'.tabs(false,true).'<p class="dn-lead">世界の、手話でつながるカフェを探す。</p><p>地域・ブランド・手話との関わりから、お店や定期開催の場を探せます。営業時間は現地時間です。</p>';
    $body.='<details class="dn-world-filters"'.(array_filter($f)?' open':'').'><summary>絞り込み条件'.(array_filter($f)?'（適用中）':'').'</summary><form method="get" class="dn-filter" aria-label="海外カフェの絞り込み">'.field('q','店舗名・ブランド・国・都市', $f['q'],'search').select_field('region','世界地域',$regions,$f['region']).select_field('tag','補助地域',[''=>'すべて']+WORLD_TAGS,$f['tag']).select_field('country','国・地域',$countries,$f['country']).select_field('brand','ブランド・チェーン',$brands,$f['brand']).select_field('operation','常設・定期',[''=>'すべて']+WORLD_OPERATIONS,$f['operation']).select_field('venue','店舗・活動形態',[''=>'すべて']+WORLD_VENUES,$f['venue']).select_field('relation','ろう者・手話との関係',[''=>'すべて']+WORLD_RELATIONS,$f['relation']).select_field('history','営業状態',[''=>'休業・閉店を除く','1'=>'休業・閉店の履歴も表示'],$f['history']).'<button>絞り込む</button><a href="/connect/sign-cafe/overseas/">すべて解除</a></form></details>';
    $body.='<p class="dn-result">'.count($all).'件中 <strong>'.count($list).'</strong>件を表示</p>';
    $mapped=count(array_filter($list,'world_located'));
    $body.='<section class="dn-world-map-panel"><h2>世界地図から探す</h2><p>住所付近の位置を確認できた'.$mapped.'件を表示できます。位置確認待ちの店舗も下の一覧に掲載しています。位置は建物付近の概略で、入口や階を示すものではありません。</p><button type="button" id="world-map-start" hidden>世界地図を開く</button><p class="dn-muted">開いたときだけOpenStreetMapの地図画像を読み込みます。現在地は取得しません。座標照合・地図：<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>。</p><div id="world-map" hidden aria-label="海外の手話カフェ地図"></div><p id="world-map-status" role="status"></p></section>';
    $groups=[];foreach($list as $p)$groups[$p['world_region']??''][$p['country_name']?:$p['country_code']][]=$p;
    foreach(WORLD_REGIONS+[''=>'地域未設定'] as $region=>$label){if(empty($groups[$region]))continue;$body.='<section class="dn-world-region"><h2>'.e($label).'</h2>';ksort($groups[$region]);foreach($groups[$region] as $country=>$places){$body.='<h3>'.e($country).' <small>'.count($places).'件</small></h3><div class="dn-world-grid">';foreach($places as $p){$body.='<article class="dn-world-card" data-slug="'.e($p['slug']).'"><p class="dn-location">'.e($label.' / '.$country.' / '.$p['city']).'</p><h4><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h4>'.(!empty($p['local_name'])?'<p>'.e($p['local_name']).'</p>':'').world_badges($p).'<p>'.e(WORLD_VENUES[$p['venue_type']??'']??'形態未確認').' · '.e(STATUSES[$p['status']]).'</p><p>'.e(($p['business_hours']??'')?:'営業時間は公式情報をご確認ください。').'</p><a href="'.e(record_path($p)).'">詳細・情報源を見る</a></article>';}$body.='</div>';}$body.='</section>';}
    if(!$list)$body.='<section class="dn-empty"><h2>'.(!$all?'海外の手話カフェ情報は掲載準備中です':'条件に一致する店舗がありません').'</h2><a href="/connect/sign-cafe/overseas/">絞り込みを解除する</a></section>';
    return page('海外の手話カフェ',$body.'<p><a href="/submit/?scope=overseas#request">海外の手話カフェ情報を提供する</a></p>','/connect/sign-cafe/overseas/','世界の手話カフェを地域・国・ブランド・手話との関係から探す。');
}
