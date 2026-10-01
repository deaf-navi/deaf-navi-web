<?php
declare(strict_types=1);

function cafe_icon(string $name):string {
    $paths=[
        'cup'=>'<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z M16 9h2a3 3 0 0 1 0 6h-2M3 22h15M8 2v3M12 2v3"/>',
        'globe'=>'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
        'chat'=>'<path d="M13 15H7l-4 3V5h14v5M11 11h10v11l-4-3h-6Z"/>',
        'search'=>'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
        'map'=>'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15M15 6v15"/>',
        'pin'=>'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        'book'=>'<path d="M12 5C9 2 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-2-9 1Z M12 5v15"/>',
        'calendar'=>'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 17h3"/>',
        'clock'=>'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
        'edit'=>'<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
        'grid'=>'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        'list'=>'<path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/>',
        'arrow'=>'<path d="M4 12h16M13 5l7 7-7 7"/>',
    ];
    return '<svg class="dn-cafe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'.($paths[$name]??$paths['cup']).'</svg>';
}

function cafe_welcome(string $scope,string $title):string {
    $area=match($scope){'domestic'=>'日本','overseas'=>'海外','events'=>'イベント',default=>'交流の場'};
    $description=match($scope){
        'domestic'=>'手話で過ごせるお店と、定期開催のカフェ。地域・営業日・手話対応を調べて、訪問先を探せます。',
        'overseas'=>'世界の手話カフェとサイニングストア。国・都市・営業日と、それぞれのお店の手話対応をご案内します。',
        'community'=>'手話や筆談での交流を楽しめる場所をご案内します。',
        'events'=>'一日だけ開く手話カフェや交流企画。開催日・会場・参加条件から、次のお出かけを探せます。',
    };
    $art='<svg viewBox="0 0 160 140" fill="none" aria-hidden="true" focusable="false"><path d="M26 118h106M42 64h66v30a24 24 0 0 1-24 24H66a24 24 0 0 1-24-24V64Z"/><path d="M109 69h8a15 15 0 0 1 0 30h-10M65 51c-12-14 12-17 0-31M85 51c-12-14 12-17 0-31"/><path class="dn-cup-chat" d="M114 14h30v22h-9l-10 8v-8h-11V14Z"/><path d="M122 22h14M122 28h9"/></svg>';
    return '<header class="dn-cafe-welcome dn-welcome--'.$scope.'"><div class="dn-welcome-copy"><p class="dn-welcome-eyebrow"><span lang="en">DEAF NAVI / SIGN CAFE GUIDE</span><span>'.e($area).'</span></p><h1>'.e($title).'</h1></div><div class="dn-welcome-aside"><div class="dn-welcome-illustration">'.$art.'</div><div><p class="dn-welcome-message">手話のある、ひと息を。</p><p class="dn-welcome-description">'.e($description).'</p></div></div></header>';
}

function cafe_filter_panel(string $form,bool $events=false):string {
    return '<aside class="dn-filter-sidebar" aria-label="検索条件"><details class="dn-filter-panel" open><summary><span class="dn-filter-heading">'.cafe_icon('search').'<span>条件で絞り込む</span></span><span class="dn-filter-panel-note">'.($events?'開催日・地域・キーワード':'地域・お店の種類・手話対応').'</span></summary>'.$form.'</details><p class="dn-filter-tip">'.cafe_icon('chat').'<span>'.($events?'開催告知と実施報告を区別して掲載します。':'手話対応が不明な項目は、推測で補わず「未確認」と表示します。').'</span></p></aside>';
}

function cafe_view_tools(bool $overseas,array $filters):string {
    $view=$overseas?world_view():($filters['view']??'table');
    if($overseas)$filters+=['sort'=>world_sort(),'dir'=>world_direction(),'per_page'=>(string)world_page_size()];
    $out='<nav class="dn-view-tools" aria-label="一覧の表示方法">';
    foreach(['table'=>['比較表','list'],'cards'=>['カード','grid']] as $key=>[$label,$icon]) {
        $params=array_filter($filters,fn($v)=>$v!=='');unset($params['page']);$params['view']=$key;
        $out.='<a href="?'.e(http_build_query($params)).'#cafes"'.($view===$key?' aria-current="true"':'').'>'.cafe_icon($icon).'<span>'.$label.'</span></a>';
    }
    return $out.'</nav>';
}

function cafe_result_bar(int $total,bool $overseas,array $filters):string {
    return '<div class="dn-result-bar"><p class="dn-result" role="status">該当 <strong>'.$total.'</strong>件</p><div class="dn-result-actions">'.($overseas?'<span class="dn-time-note">'.cafe_icon('clock').'現地時間</span>':'<a class="dn-result-map" href="/connect/sign-cafe/map/">'.cafe_icon('map').'地図から探す</a>').cafe_view_tools($overseas,$filters).'</div></div>';
}

function cafe_listing_advice(bool $overseas=false):string {
    $text=$overseas?'手話は国や地域によって異なります。訪問前に公式サイト・SNSで営業日と手話対応をご確認ください。営業状況が不明なお店は「確認中」「営業状況未確認」と表示しています。':'「営業中」は掲載情報の確認状態です。今この時刻に開いていることを示しません。訪問前に公式サイト・SNSをご確認ください。';
    return '<details class="dn-listing-advice"><summary>'.cafe_icon('book').'<span>訪問前に公式情報を確認</span><span class="dn-advice-note">'.($overseas?'手話・営業時間について':'営業状態の見方').'</span></summary><p class="dn-muted dn-results-note">'.$text.'</p></details>';
}

function cafe_active_filters(array $filters,bool $overseas=false):string {
    if($overseas)$filters+=['sort'=>world_sort(),'dir'=>world_direction(),'view'=>world_view(),'per_page'=>(string)world_page_size()];
    $labels=['q'=>'キーワード','region'=>'地域','prefecture'=>'都道府県','country'=>'国','shop_type'=>'店舗タイプ','status'=>'営業状態','operator_type'=>'運営形態','sign_language_level'=>'手話対応','listing'=>'掲載区分','venue'=>'店舗タイプ','brand'=>'ブランド','operation'=>'営業形態','relation'=>'手話との関わり','tag'=>'地域','history'=>'履歴','events'=>'イベント']+CAFE_FEATURES;
    $options=['region'=>$overseas?WORLD_REGIONS:[],'shop_type'=>SHOP_TYPES,'status'=>STATUSES,'operator_type'=>OPERATOR_TYPES,'sign_language_level'=>SIGN_LEVELS,'listing'=>['spots'=>'手話交流スポット','organizations'=>'関連団体・講座','all'=>'すべての区分'],'venue'=>WORLD_VENUES,'operation'=>WORLD_OPERATIONS,'relation'=>WORLD_RELATIONS,'tag'=>WORLD_TAGS];
    if($overseas){$options['region']+=['eu'=>'EU','americas'=>'アメリカ大陸'];foreach(world_records() as $p)$options['country'][$p['country_code']]=$p['country_name']?:$p['country_code'];}
    $out='';
    foreach($labels as $key=>$label) {
        $value=$filters[$key]??'';if($value==='')continue;
        $params=array_filter($filters,fn($v)=>$v!=='');unset($params[$key],$params['page']);
        $display=($options[$key][$value]??$value);if($value==='1')$display=$label;
        if($key==='country')$display=$options['country'][$value]??($label.' '.$value);
        $out.='<a class="dn-filter-chip" href="?'.e(http_build_query($params)).'#cafes" aria-label="'.e($display.'の条件を解除').'">'.e($display).'<span aria-hidden="true">×</span></a>';
    }
    return $out!==''?'<nav class="dn-active-filters" aria-label="選択中の検索条件">'.$out.'</nav>':'';
}

function cafe_quick_places(array $all,bool $overseas=false):string {
    $places=$overseas?['FR'=>'フランス','US'=>'アメリカ','TH'=>'タイ','MY'=>'マレーシア']:['東京都'=>'東京','大阪府'=>'大阪','京都府'=>'京都','福岡県'=>'福岡'];
    $key=$overseas?'country':'prefecture';$out='';
    foreach($places as $value=>$label) {
        $count=count(array_filter($all,fn($p)=>$overseas?world_matches($p,[$key=>$value]):domestic_matches($p,[$key=>$value])));
        if(!$count)continue;
        $out.='<a href="?'.e(http_build_query([$key=>$value])).'#cafes">'.e($label).'<span>'.$count.'</span></a>';
    }
    return $out!==''?'<nav class="dn-quick-places" aria-label="'.($overseas?'国から探す':'都道府県から探す').'">'.cafe_icon('pin').'<span class="dn-quick-label">'.($overseas?'国から':'地域から').'</span>'.$out.'</nav>':'';
}

function cafe_notice_link():string {
    return '<p class="dn-guide-note">'.cafe_icon('book').'<span>訪問前に、お店・主催者の公式情報をご確認ください。<a href="#cafe-information-heading">掲載情報について</a></span></p>';
}

function cafe_guide_link(string $url,string $label,string $icon):string {
    return '<a href="'.e($url).'">'.cafe_icon($icon).'<span>'.e($label).'</span></a>';
}
