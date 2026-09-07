<?php
declare(strict_types=1);

const CAFE_DIRECTORY_NAME='全国の手話カフェ一覧';
const CAFE_DIRECTORY_DESCRIPTION='全国の手話カフェを地域・営業日・手話対応から探せるDeaf Navi。常設店舗、間借りや公共施設での定期開催、サイニングストアを一覧と地図で紹介。営業時間、公式サイト・SNS、情報確認日を掲載し、初めての訪問にも役立つ情報をまとめています。';

function cafe_directory_seo(array $filters,array $rows,int $total,int $page,int $size):array {
    $params=array_filter($filters,fn($v)=>$v!=='');
    unset($params['page'],$params['per_page'],$params['view'],$params['sort'],$params['dir']);
    $filtered=(bool)$params;
    $sort=in_array($filters['sort']??'',['name','type'],true)?$filters['sort']:'region';
    if($sort!=='region')$params['sort']=$sort;
    if(($filters['dir']??'')==='desc')$params['dir']='desc';
    if($size!==24)$params['per_page']=$size;
    $variant=(bool)$params;
    if($page>1)$params['page']=$page;
    $canonical=BASE.'/connect/sign-cafe/'.($params?'?'.http_build_query($params):'');
    $name=$filtered?'手話カフェの検索結果':CAFE_DIRECTORY_NAME;
    if($page>1)$name.='（'.$page.'ページ目）';
    $title=$name.($filtered?'':'｜地域・営業日から探す').' | Deaf Navi';
    $items=[];
    foreach($rows as $i=>$p)$items[]=['@type'=>'ListItem','position'=>($page-1)*$size+$i+1,'name'=>$p['name'],'url'=>BASE.record_path($p)];
    $schema=['@context'=>'https://schema.org','@type'=>'CollectionPage','@id'=>$canonical.'#webpage','url'=>$canonical,'name'=>$name,'description'=>CAFE_DIRECTORY_DESCRIPTION,'inLanguage'=>'ja','publisher'=>['@type'=>'Organization','name'=>'Deaf Navi','url'=>BASE.'/about/'],'mainEntity'=>['@type'=>'ItemList','name'=>'掲載中の手話カフェ','numberOfItems'=>$total,'itemListElement'=>$items]];
    return ['title'=>$title,'canonical'=>$canonical,'robots'=>($variant||!$total?'noindex,follow':'index,follow').',max-image-preview:large','structured'=>[$schema]];
}

function cafe_discovery_guide(array $all):string {
    $regions=[];
    foreach($all as $p){
        if(!domestic_matches($p,[]))continue;
        $pref=$p['prefecture'];if($pref==='')continue;
        $r=region($pref,'JP');$regions[$r][$pref]=($regions[$r][$pref]??0)+1;
    }
    $out='<section class="dn-cafe-guide" id="cafe-regions" aria-labelledby="cafe-regions-heading"><h2 id="cafe-regions-heading">'.cafe_icon('pin').'地域から手話カフェを探す</h2><p>お住まいの地域や、お出かけ先から探してみてください。掲載件数には、営業状況を確認中のお店も含みます。</p><div class="dn-region-links">';
    foreach(['北海道','東北','関東','中部','近畿','中国','四国','九州','沖縄'] as $r){
        if(empty($regions[$r]))continue;
        $out.='<div><h3><a href="?'.e(http_build_query(['region'=>$r])).'">'.e($r).'の手話カフェ</a></h3><ul>';
        foreach(explode(' ',JP_PREFECTURES) as $pref)if(isset($regions[$r][$pref]))$out.='<li><a href="?'.e(http_build_query(['prefecture'=>$pref])).'" aria-label="'.e($pref).'の手話カフェ '.$regions[$r][$pref].'件">'.e($pref).'（'.$regions[$r][$pref].'件）</a></li>';
        $out.='</ul></div>';
    }
    $out.='</div></section>';
    $out.='<section class="dn-cafe-guide" id="cafe-guide" aria-labelledby="cafe-guide-heading"><h2 id="cafe-guide-heading">'.cafe_icon('book').'手話カフェが初めての方へ</h2><p>手話カフェは、手話や筆談での会話、ろう文化との出会いを楽しめるお店や交流の場です。常設のお店もあれば、カフェの一角や公共施設などで、決まった日に開かれる場もあります。</p>';
    foreach([
        ['手話がまだできなくても利用できますか？','利用条件やコミュニケーションの方法は、お店・開催場所によって異なります。一覧の「詳しい条件」で「初心者歓迎」や「筆談対応」を選ぶと、公表・確認できた情報から探せます。対応が未確認のときは、個別ページの公式サイト・SNSをご確認ください。'],
        ['営業日と、手話カフェの開催日は同じですか？','通常営業のあるお店でも、手話カフェは特定の日だけという場合があります。「営業形態」と「営業時間・営業日」をあわせてご覧ください。定期開催は日程が変わることもあるため、訪問前に主催者の最新の案内を確認すると安心です。'],
        ['スターバックスの手話カフェも探せますか？','国内のサイニングストアはこの一覧に掲載しています。手話カフェの開催予定や開催実績は、<a href="/connect/sign-cafe/starbucks/">スターバックスの手話カフェ・イベント情報</a>にまとめています。'],
        ['海外の手話カフェはどこで探せますか？','<a href="/connect/sign-cafe/overseas/">海外の手話カフェ一覧</a>から、国・都市・手話との関わりで探せます。手話は国や地域によって異なり、営業時間は現地時間でご案内しています。']
    ] as [$question,$answer])$out.='<details><summary>'.e($question).'</summary><p>'.$answer.'</p></details>';
    $out.='</section><section class="dn-cafe-guide" id="cafe-policy" aria-labelledby="cafe-policy-heading"><h2 id="cafe-policy-heading">'.cafe_icon('edit').'掲載情報と更新について</h2><p>Deaf Naviでは、お店・主催者の公式サイトやSNSなど、確認に使った情報源を添えてご紹介しています。店舗名から個別ページを開くと、手話対応や公式リンク、情報確認日をご覧いただけます。</p><p>「営業中」「定期開催中」は掲載情報の確認状態を表し、今この時刻に利用できることを示すものではありません。確認中の情報はその状態を明記し、閉店・活動終了の記録は営業状態の絞り込みから確認できます。すべてのお店を網羅した一覧ではありません。</p><p>新しいお店や日程の変更など、お気づきの情報は<a href="#request">手話カフェの情報提供フォーム</a>からお知らせください。管理者が内容を確認・承認したうえで掲載します。</p><p>運営：<a href="/about/">Deaf Naviについて</a></p></section>';
    return $out;
}
