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
    ];
    return '<svg class="dn-cafe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'.($paths[$name]??$paths['cup']).'</svg>';
}

function cafe_welcome(string $scope,string $title):string {
    $area=match($scope){'domestic'=>'日本','overseas'=>'海外',default=>'交流の場'};
    $description=match($scope){
        'domestic'=>'手話で過ごせるお店と、定期開催のカフェ。地域・営業日・手話対応を調べて、訪問先を探せます。',
        'overseas'=>'世界の手話カフェとサイニングストア。国・都市・営業日と、それぞれのお店の手話対応をご案内します。',
        'community'=>'手話や筆談での交流を楽しめる場所をご案内します。',
    };
    return '<header class="dn-cafe-welcome dn-welcome--'.$scope.'"><div class="dn-welcome-copy"><p class="dn-welcome-eyebrow">手話カフェガイド <span>/ '.e($area).'</span></p><h1>'.e($title).'</h1></div><p class="dn-welcome-description">'.e($description).'</p></header>';
}

function cafe_filter_panel(string $form):string {
    return '<aside class="dn-filter-sidebar" aria-label="検索条件"><details class="dn-filter-panel" open><summary><span>条件で絞り込む</span><span class="dn-filter-panel-note">地域・お店の種類・手話対応</span></summary>'.$form.'</details></aside>';
}

function cafe_notice_link():string {
    return '<p class="dn-guide-note">'.cafe_icon('book').'<span>訪問前に、お店・主催者の公式情報をご確認ください。<a href="#cafe-information-heading">掲載情報について</a></span></p>';
}

function cafe_guide_link(string $url,string $label,string $icon):string {
    return '<a href="'.e($url).'">'.cafe_icon($icon).'<span>'.e($label).'</span></a>';
}
