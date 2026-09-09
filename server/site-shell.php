<?php
declare(strict_types=1);

// Navigation data is copied from config/site-navigation.json by src/build.mjs.
function site_shell_header(string $current=''): string {
    $items=json_decode(file_get_contents(__DIR__.'/site-navigation.json'),true,512,JSON_THROW_ON_ERROR);
    $nav='';
    foreach($items as $item){
        $class='site-nav__link'.(in_array($item['key'],['world','worldOriginal','tool'],true)?' site-nav__link--'.($item['key']==='worldOriginal'?'world':$item['key']):'').($item['key']===$current?' is-current':'');
        $nav.='<a class="'.$class.'" href="/'.e($item['path']).'"'.($item['key']===$current?' aria-current="page"':'').'><span>'.e($item['ja']).'</span></a>';
    }
    return '<header class="dn-site-shell" role="banner"><div class="dn-shell-inner"><div class="dn-shell-top"><a class="dn-shell-brand" href="/" aria-label="Deaf Navi ホーム"><span class="dn-shell-mark" aria-hidden="true"><img src="/favicon.svg" alt="" width="36" height="36"></span><span class="dn-shell-wordmark"><span class="dn-shell-name"><strong>Deaf Navi</strong><span class="dn-shell-edition">'.($current==='connect'?'Cafe':'Web').'</span></span><small>ニュースと、つながりと、暮らし。</small></span></a><div class="display-controls" data-display-controls hidden><button type="button" class="display-controls__btn" id="theme-toggle" aria-pressed="false"><span class="display-controls__icon" data-theme-icon aria-hidden="true">◐</span><span data-theme-label>ダーク表示</span></button><button type="button" class="display-controls__btn" id="font-toggle" aria-pressed="false"><span class="display-controls__icon display-controls__icon--text" aria-hidden="true">あ</span><span data-font-label>文字を大きく</span></button></div></div><nav class="site-nav" aria-label="サイト内ページ">'.$nav.'</nav></div></header>';
}

function site_shell_head(): string {
    return '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap"><link rel="stylesheet" href="/site-shell.css?v=20260909ui3"><script>(function(){try{var t=localStorage.getItem("dn-theme"),f=localStorage.getItem("dn-font");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);if(f==="large"||f==="xlarge")document.documentElement.setAttribute("data-font",f);}catch(e){}})();</script><script src="/ui-controls.js?v=20260909ui" defer></script>';
}
