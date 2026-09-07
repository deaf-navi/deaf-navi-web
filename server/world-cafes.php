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
    $body='<link rel="stylesheet" href="/world-cafes.css?v=20260907tables"><script src="/world-cafes.js?v=1" defer></script>'.tabs(false,true).'<p class="dn-lead">世界の、手話でつながるカフェを探す。</p><p>地域・ブランド・手話との関わりから、お店や定期開催の場を探せます。営業時間は現地時間です。</p>';
    $advanced=array_filter(array_intersect_key($f,array_flip(['tag','operation','venue','relation','history'])));
    $body.='<details class="dn-world-filters" open><summary>検索・絞り込み'.(array_filter($f)?'（適用中）':'').'</summary><form method="get" class="dn-filter" aria-label="海外カフェの絞り込み"><input type="hidden" name="sort" value="'.e(input($_GET,'sort',20)).'"><input type="hidden" name="dir" value="'.e(input($_GET,'dir',4)).'"><input type="hidden" name="per_page" value="'.e(input($_GET,'per_page',3)).'">'.field('q','店舗名・ブランド・国・都市',$f['q'],'search').select_field('region','世界地域',$regions,$f['region']).select_field('country','国・地域',$countries,$f['country']).select_field('brand','ブランド・チェーン',$brands,$f['brand']).'<div class="dn-actions"><button>絞り込む</button><a href="/connect/sign-cafe/overseas/">すべて解除</a></div><details class="dn-filter-more"'.($advanced?' open':'').'><summary>詳しい条件：手話との関係・営業形態など'.($advanced?'（適用中）':'').'</summary><div class="dn-more-fields">'.select_field('tag','補助地域',[''=>'すべて']+WORLD_TAGS,$f['tag']).select_field('operation','常設・定期',[''=>'すべて']+WORLD_OPERATIONS,$f['operation']).select_field('venue','店舗・活動形態',[''=>'すべて']+WORLD_VENUES,$f['venue']).select_field('relation','ろう者・手話との関係',[''=>'すべて']+WORLD_RELATIONS,$f['relation']).select_field('history','営業状態',[''=>'休業・閉店を除く','1'=>'休業・閉店の履歴も表示'],$f['history']).'<button>この条件で絞り込む</button></div></details></form></details>';
    $body.='<p class="dn-result">'.count($all).'件中 <strong>'.count($list).'</strong>件を表示</p>';
    $mapped=count(array_filter($list,'world_located'));
    $body.='<details class="dn-world-map-panel"><summary>世界地図から探す（'.$mapped.'件）</summary><p>住所付近の位置を確認できた'.$mapped.'件を表示できます。位置確認待ちの店舗も下の一覧に掲載しています。位置は建物付近の概略で、入口や階を示すものではありません。</p><button type="button" id="world-map-start" hidden>世界地図を開く</button><p class="dn-muted">開いたときだけOpenStreetMapの地図画像を読み込みます。現在地は取得しません。座標照合・地図：<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>。</p><div id="world-map" hidden aria-label="海外の手話カフェ地図"></div><p id="world-map-status" role="status"></p></details>';
    if($list)$body.=world_table($list,$f);
    if(!$list)$body.='<section class="dn-empty"><h2>'.(!$all?'海外の手話カフェ情報は掲載準備中です':'条件に一致する店舗がありません').'</h2><a href="/connect/sign-cafe/overseas/">絞り込みを解除する</a></section>';
    return page('海外の手話カフェ',$body.'<p><a href="/submit/?scope=overseas#request">海外の手話カフェ情報を提供する</a></p>','/connect/sign-cafe/overseas/','世界の手話カフェを地域・国・ブランド・手話との関係から探す。');
}

function world_table(array $list,array $filters):string {
    $sort=input($_GET,'sort',20);if(!in_array($sort,['name','location','brand'],true))$sort='location';
    $direction=input($_GET,'dir',4)==='desc'?'desc':'asc';
    $key=fn($p)=>$sort==='location'?sprintf('%02d',array_search($p['world_region']??'',array_keys(WORLD_REGIONS),true)).' '.$p['country_code'].' '.$p['city']:($p[$sort]??'');
    $collator=class_exists('Collator')?new Collator('ja_JP'):null;
    usort($list,fn($a,$b)=>($direction==='desc'?-1:1)*(($collator?$collator->compare($key($a),$key($b)):strcmp($key($a),$key($b)))?:strcmp($a['slug'],$b['slug'])));
    $size=input($_GET,'per_page',3)==='100'?100:50;$total=count($list);$pages=max(1,(int)ceil($total/$size));$current=min($pages,max(1,(int)input($_GET,'page',8)));
    $params=array_filter($filters,fn($v)=>$v!=='')+['sort'=>$sort,'dir'=>$direction,'per_page'=>$size];
    $out='<p class="dn-table-hint" id="world-table-help">列名で並べ替え・店舗名から詳細へ。表は横にスクロールできます。<br>実在・手話との関係を確認した情報を掲載しています。現在の営業が不明な場合は「営業状況未確認」と表示します。</p><div class="dn-table-scroll" role="region" aria-label="海外手話カフェの比較表" tabindex="0"><table class="dn-data-table dn-world-table" aria-describedby="world-table-help"><caption class="dn-visually-hidden">海外の手話カフェ一覧</caption><thead><tr>';
    foreach(['name'=>'店舗名','location'=>'地域・国・都市','brand'=>'ブランド・手話との関わり'] as $k=>$label){$url='?'.http_build_query(array_replace($params,['sort'=>$k,'dir'=>$sort===$k&&$direction==='asc'?'desc':'asc'])).'#world-table-help';$out.='<th scope="col" aria-sort="'.($sort===$k?($direction==='asc'?'ascending':'descending'):'none').'"><a href="'.e($url).'">'.$label.' '.($sort===$k?($direction==='asc'?'↑':'↓'):'↕').'</a></th>';}
    $out.='<th scope="col">営業・開催／確認情報</th></tr></thead><tbody>';
    foreach(array_slice($list,($current-1)*$size,$size) as $p){$out.='<tr data-slug="'.e($p['slug']).'"><th scope="row"><a href="'.e(record_path($p)).'">'.e($p['name']).'</a>'.(!empty($p['local_name'])?'<span class="dn-cell-secondary">'.e($p['local_name']).'</span>':'').'</th><td>'.e($p['country_name']?:$p['country_code']).'<span class="dn-cell-secondary">'.e($p['city']).'</span><span class="dn-cell-secondary">'.e(WORLD_REGIONS[$p['world_region']??'']??'地域未設定').'</span></td><td>'.world_badges($p).'</td><td><span class="dn-badge">'.e(STATUSES[$p['status']]).'</span><span class="dn-cell-secondary">'.e(($p['business_hours']??'')?:'営業時間未確認').'</span>'.(!empty($p['event_schedule'])?'<span class="dn-cell-secondary">'.e($p['event_schedule']).'</span>':'').sources_html($p).'</td></tr>';}
    $out.='</tbody></table></div><nav class="dn-pagination" aria-label="海外一覧のページ">';
    if($current>1)$out.='<a href="?'.e(http_build_query($params+['page'=>$current-1])).'#world-table-help">← 前のページ</a>';
    $out.='<span>'.(($current-1)*$size+1).'–'.min($current*$size,$total).' / '.$total.'件</span>';
    if($current<$pages)$out.='<a href="?'.e(http_build_query($params+['page'=>$current+1])).'#world-table-help">次のページ →</a>';
    foreach([50,100] as $n)$out.=$n===$size?'<strong>'.$n.'件ずつ</strong>':'<a href="?'.e(http_build_query(array_replace($params,['per_page'=>$n]))).'#world-table-help">'.$n.'件ずつ</a>';
    return $out.'</nav>';
}
