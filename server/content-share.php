<?php
declare(strict_types=1);

// Reuse the public feed projection, without private notes or review data.
function cafe_event_share(array $p):string {
    require_once __DIR__.'/app-directory.php';
    $public=app_directory_event($p);
    $data=['kind'=>'cafe','title'=>$public['title'],'url'=>$public['webUrl']];
    foreach(['startDate','endDate','time','venue','prefecture','target','status','period','verification','verifiedAt','validUntil','timezone'] as $key)$data[$key]=$public[$key]??'';
    $payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $x='https://x.com/intent/tweet?'.http_build_query(['text'=>'【最新状況は公式案内へ】 '.$data['title'],'url'=>$data['url']],'','&',PHP_QUERY_RFC3986);
    return '<div class="dn-share" data-content-share="'.e($payload).'">'.content_share_icons($x).'<div class="dn-share-panel" hidden></div><p class="dn-share-status" role="status"></p><noscript><a href="'.e($data['url']).'">リンクを開いて共有</a></noscript></div>';
}
function content_share_icons(string $x):string {
    return str_replace('href=""','href="'.e($x).'"','<div class="dn-share-icons" role="group" aria-label="SNSで共有">
<a class="dn-share-icon" data-share-x href="" target="_blank" rel="noopener noreferrer" aria-label="Xで共有（新しいタブ）" title="Xで共有"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l8.2-9.4L.8 2h6.5l4.5 6.8L18.9 2ZM17.8 20h1.7L6.3 3.9H4.5L17.8 20Z"/></svg></a>
<button class="dn-share-icon" data-share-instagram type="button" aria-label="Instagramで紹介する" title="Instagramで紹介する" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/></svg></button>
<button class="dn-share-icon" data-share-copy type="button" aria-label="リンクをコピー" title="リンクをコピー"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m10 14 4-4M9 16l-2 2a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0M15 8l2-2a4.2 4.2 0 0 1 6 6l-4 4a4.2 4.2 0 0 1-6 0" transform="translate(1 0) scale(.92)"/></g></svg></button></div>');
}
