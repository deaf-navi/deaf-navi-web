<?php
declare(strict_types=1);

const CAFE_DIRECTORY_NAME='全国の手話カフェ一覧';
const CAFE_REGION_PAGES=['tokyo'=>'東京都','kanagawa'=>'神奈川県'];
const CAFE_DIRECTORY_DESCRIPTION='全国の手話カフェ・筆談カフェを地域や会話方法から探せるDeaf Navi。常設店と定期交流の違い、予約・料金・参加条件の掲載情報、公式サイトと確認日を案内。初めての方にも、訪問先を選ぶための確認ポイントをまとめています。';

function cafe_record_seo(array $p):array {
    if(($p['country_code']??'')!=='JP'||($p['kind']??'')!=='cafe'||cafe_listing_group($p)!=='cafes')return [];
    $location=trim(($p['prefecture']??'').' '.($p['city']??''));
    return ['title'=>$p['name'].($location!==''?'（'.$location.'）':'').'｜手話カフェ | Deaf Navi'];
}

function cafe_record_area_link(array $p):string {
    if(($p['country_code']??'')!=='JP'||($p['kind']??'')!=='cafe'||cafe_listing_group($p)!=='cafes')return '';
    $slug=array_search($p['prefecture']??'',CAFE_REGION_PAGES,true);
    if($slug===false)return '';
    return '<p><a href="/connect/sign-cafe/area/'.$slug.'/">'.e($p['prefecture']).'の手話カフェ・定期交流の場所を見る</a></p>';
}

function cafe_listing_title(array $f):string {
    return match($f['listing']??''){'spots'=>'手話交流スポット','organizations'=>'手話の関連団体・講座','all'=>'手話カフェ・交流スポット・関連団体',default=>match($f['shop_type']??''){'community_space'=>'手話交流スポット','related_organization'=>'手話の関連団体・講座',default=>CAFE_DIRECTORY_NAME}};
}
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
    $name=cafe_listing_title($filters);
    if($filtered&&$name===CAFE_DIRECTORY_NAME)$name='手話カフェの検索結果';
    if($page>1)$name.='（'.$page.'ページ目）';
    $title=$name.($filtered?'':'｜地域・営業日から探す').' | Deaf Navi';
    $items=[];
    foreach($rows as $i=>$p)$items[]=['@type'=>'ListItem','position'=>($page-1)*$size+$i+1,'name'=>$p['name'],'url'=>BASE.record_path($p)];
    $schema=['@context'=>'https://schema.org','@type'=>'CollectionPage','@id'=>$canonical.'#webpage','url'=>$canonical,'name'=>$name,'description'=>CAFE_DIRECTORY_DESCRIPTION,'inLanguage'=>'ja','publisher'=>['@type'=>'Organization','name'=>'Deaf Navi','url'=>BASE.'/about.html'],'mainEntity'=>['@type'=>'ItemList','name'=>cafe_listing_title($filters),'numberOfItems'=>$total,'itemListElement'=>$items]];
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
        foreach(explode(' ',JP_PREFECTURES) as $pref)if(isset($regions[$r][$pref])){
            $slug=array_search($pref,CAFE_REGION_PAGES,true);
            $href=$slug!==false?'/connect/sign-cafe/area/'.$slug.'/':'?'.http_build_query(['prefecture'=>$pref]);
            $out.='<li><a href="'.e($href).'" aria-label="'.e($pref).'の手話カフェ '.$regions[$r][$pref].'件">'.e($pref).'（'.$regions[$r][$pref].'件）</a></li>';
        }
        $out.='</ul></div>';
    }
    $out.='</div></section>';
    $out.='<section class="dn-cafe-guide" id="cafe-guide" aria-labelledby="cafe-guide-heading"><h2 id="cafe-guide-heading">'.cafe_icon('book').'手話カフェが初めての方へ</h2><p>手話カフェは、手話や筆談での会話、ろう文化との出会いを楽しめるお店や交流の場です。常設のお店もあれば、カフェの一角や公共施設などで、決まった日に開かれる場もあります。</p>';
    foreach([
        ['お茶を飲みたい、交流したい。どう選べばよいですか？','自分の都合に合わせて飲食を楽しみたいなら、常設店の営業日と利用条件を確認します。人と集まって会話をしたいなら、定期交流や<a href="/connect/sign-cafe/events/">開催日が決まったカフェイベント</a>から探せます。店舗の営業日と交流企画の開催日は同じとは限りません。手話を教わりたい場合も、交流の場に講師やレッスンがあるとは限らないため、企画の内容を確かめてください。'],
        ['料金はどこまで確認すればよいですか？','個別ページの「予約・料金・会話の方法」に、確認できた参加案内と利用条件をまとめています。飲食代だけか、参加費・席料・ワンドリンクの注文が別に必要か、時間制限や延長料金があるかを確認してください。「飲み放題」でも対象の飲み物や利用時間が決められている場合があります。料金が未掲載でも無料とは限りません。過去の開催回の金額は次回の料金として使わず、参加する回の公式案内で確認してください。'],
        ['予約や申込みはどうすればよいですか？','お店の来店予約と、交流会・講座の申込みは分けて確認します。人数や曜日によって予約条件が異なることもあります。行きたい日時・人数、利用したい企画、必要な会話方法を添えて、掲載先の公式フォームや連絡先から申し込んでください。返信や受付完了が必要か、変更・キャンセルの連絡期限も確認します。Deaf Naviのお問い合わせは掲載情報の窓口で、店舗の予約を受け付けるものではありません。'],
        ['手話がまだできなくても利用できますか？','利用条件やコミュニケーションの方法は、お店・開催場所によって異なります。一覧の「会話の方法・詳しい条件」を開き、「初心者歓迎」や「筆談対応」を選ぶと、公表・確認できた情報から探せます。複数選ぶと、すべての条件に合う掲載情報を表示します。対応が未確認のときは、個別ページの公式サイト・SNSをご確認ください。'],
        ['筆談や音声で話してもよいですか？','会話のルールは場所ごとに違います。「手話カフェ」という名前だけで、音声を使えるか、筆談に対応しているかは判断できません。例えば<a href="https://www.torinkan.com/" target="_blank" rel="noopener noreferrer">桐林館喫茶室の公式案内</a>は、音声を使わず筆談・ジェスチャー・手話で会話する場として紹介しています。対応スタッフがいる日や、注文と参加者同士の会話で使える方法も確認してください。筆談なら、紙やスマートフォンなど相手にも読みやすい方法を相談すると伝えやすくなります。'],
        ['営業日と、手話カフェの開催日は同じですか？','通常営業のあるお店でも、手話カフェは特定の日だけという場合があります。一覧の「会話の方法・詳しい条件」、続いて「詳しい条件を追加」を開くと、「店舗タイプ」を確認できます。各掲載情報の営業日・営業時間もあわせてご覧ください。定期開催は日程が変わることもあるため、訪問前に主催者の最新の案内を確認すると安心です。'],
        ['スターバックスの手話カフェも探せますか？','スターバックスで開かれる手話カフェも、公式案内で開催内容を確認できた回から<a href="/connect/sign-cafe/events/">手話カフェイベント</a>に掲載します。サイニングストア以外の店舗も対象です。参加できる日・申込方法・料金やドリンクの注文条件は、各回の公式案内をご確認ください。'],
        ['海外の手話カフェはどこで探せますか？','<a href="/connect/sign-cafe/overseas/">海外の手話カフェ一覧</a>から、国・都市・手話との関わりで探せます。手話は国や地域によって異なり、営業時間は現地時間でご案内しています。']
    ] as [$question,$answer])$out.='<details><summary>'.e($question).'</summary><p>'.$answer.'</p></details>';
    $out.='<div class="dn-visit-reading"><p>もう少し詳しく知りたい方へ</p><ul><li><a href="/stories/sign-cafe-types-revision/">常設店・交流会・筆談カフェの違いと選び方</a></li><li><a href="/stories/sign-cafe-guide/">初めての手話カフェ：事前の確認と会話のコツ</a></li><li><a href="/guide/guesthouses/">旅先の宿泊に：ろう者が営むゲストハウス</a></li></ul></div>';
    $out.='<p><a href="#cafes">手話カフェの一覧へ戻る</a></p></section><section class="dn-cafe-guide" id="cafe-policy" aria-labelledby="cafe-policy-heading"><h2 id="cafe-policy-heading">'.cafe_icon('edit').'掲載情報と更新について</h2><p>Deaf Naviでは、お店・主催者の公式サイトやSNSなど、確認に使った情報源を添えてご紹介しています。店舗名から個別ページを開くと、手話対応や公式リンク、情報確認日をご覧いただけます。</p><p>「営業中」「定期開催中」は掲載情報の確認状態を表し、今この時刻に利用できることを示すものではありません。確認中の情報はその状態を明記し、閉店・活動終了の記録は営業状態の絞り込みから確認できます。すべてのお店を網羅した一覧ではありません。</p><p>新しいお店や日程の変更など、お気づきの情報は<a href="#request">手話カフェの情報提供フォーム</a>からお知らせください。管理者が内容を確認・承認したうえで掲載します。</p><p>運営：<a href="/about.html">Deaf Naviについて</a></p></section>';
    return $out;
}
