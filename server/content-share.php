<?php
declare(strict_types=1);
require_once __DIR__.'/app-directory.php';

// Reuse the public feed projection, without private notes or review data.
function cafe_event_share(array $p):string {
    $public=app_directory_event($p);
    $data=['kind'=>'cafe','title'=>$public['title'],'url'=>$public['webUrl']];
    foreach(['startDate','endDate','time','venue','prefecture','target','status','period','verification','verifiedAt','validUntil','timezone'] as $key)$data[$key]=$public[$key]??'';
    $payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    return '<details class="dn-share" data-content-share="'.e($payload).'"><summary>共有<span class="dn-share-sr">：'.e($data['title']).'</span></summary><div class="dn-share-panel"><a href="'.e($data['url']).'" data-share-permalink>共有するリンクを開く</a><noscript><p>リンク先のURLをコピーしてSNSに貼り付けられます。</p></noscript></div></details>';
}
