<?php
declare(strict_types=1);
function map_records(): array {
    return array_values(array_filter(visible_records(),fn($p)=>($p['kind']==='cafe'||($p['kind']==='store'&&($p['signing_store']??false)))&&in_array($p['status'],['open','unknown'],true)));
}
function map_located(array $p): bool {
    return $p['country_code']==='JP' && ($p['coordinate_accuracy']??'')==='address_vicinity' && !empty($p['coordinate_source_url']) && !empty($p['address']) && is_numeric($p['latitude']??null) && is_numeric($p['longitude']??null) && $p['latitude']>=24 && $p['latitude']<=46 && $p['longitude']>=122 && $p['longitude']<=146;
}
function map_data(): array {
    $spots=[];
    foreach(map_records() as $p) if(map_located($p)) {
        // Explicit public allowlist. Never return raw payloads, internal notes, users or submissions.
        $spots[]=['slug'=>$p['slug'],'name'=>$p['name'],'latitude'=>(float)$p['latitude'],'longitude'=>(float)$p['longitude'],'prefecture'=>$p['prefecture'],'city'=>$p['city'],'address'=>$p['address'],'type'=>TYPES[$p['type']],'status'=>STATUSES[$p['status']],'statusCode'=>$p['status'],'hours'=>($p['business_hours']??'')?:'営業時間未確認','description'=>$p['description']??'','path'=>record_path($p),'sources'=>$p['verification_sources'],'verifiedAt'=>$p['last_verified_at'],'coordinateSource'=>$p['coordinate_source_url']];
    }
    return ['version'=>1,'spots'=>$spots];
}
function map_page(): string {
    $all=map_records();$mapped=count(array_filter($all,'map_located'));
    $body='<link rel="stylesheet" href="/cafe-map/map.css?v=1"><script type="module" src="/cafe-map/start.js?v=1"></script><section class="dn-map-intro"><p class="dn-eyebrow">DEAF NAVI / SPOTS ATLAS · BETA</p><p>手話でつながる場所を、日本のかたちから探してみませんか。</p><p><strong>'.$mapped.'地点</strong>を地図に掲載。住所や現在の会場を特定できない情報も、下のHTML一覧から読めます。</p><a href="/connect/sign-cafe/">← 営業時間を比べる表へ</a></section>';
    $body.='<section class="dn-map-layout" aria-label="手話スポットの立体地図"><div class="dn-map-stage" id="map-stage"><div class="dn-map-cover" id="map-cover"><p class="dn-map-kicker">ことばが、出会いになる。</p><img src="/cafe-map/japan-poster.svg" alt="日本列島の概形" width="680" height="440"><button type="button" id="map-start" hidden>3Dマップを表示</button><noscript><p>JavaScriptは無効です。下の店舗一覧をご利用ください。</p></noscript><p>操作時に3Dデータを読み込みます。</p></div><div class="dn-map-toolbar" id="map-toolbar" hidden><button type="button" id="map-home">日本全体</button><button type="button" id="map-zoom-in" aria-label="地図を拡大">＋</button><button type="button" id="map-zoom-out" aria-label="地図を縮小">−</button></div><p id="map-status" role="status" class="dn-map-status">ドラッグで回転・ホイール／ピンチで拡大。光点を選ぶと店舗情報が表示されます。</p></div><aside id="map-card" class="dn-map-card" aria-live="polite"><p class="dn-eyebrow">EXPLORE</p><h2>気になる光点を選ぶ</h2><p>近い場所の光点は重なります。拡大するか、下の店舗名から選べます。</p><p>● 営業・活動確認済<br>○ 営業状況未確認</p><p>地図は道案内ではなく、出会いを探すための概略図です。</p></aside></section>';
    $body.='<p class="dn-map-note">位置は確認した住所付近の概略位置です。実際の入口とは異なります。立体の厚みは演出であり、標高ではありません。境界・離島は縮尺に応じて簡略化しています。</p><section class="dn-map-index"><h2>店舗・活動から探す <small>'.count($all).'件</small></h2><p>3Dを使わず、店舗名のリンクからも詳細・情報源を確認できます。営業状況未確認の場所は必ず事前にご確認ください。</p><ul>';
    foreach($all as $p){$located=map_located($p);$body.='<li><div><span class="dn-map-region">'.e($p['prefecture'].' / '.$p['city']).'</span><a href="'.e(record_path($p)).'">'.e($p['name']).'</a><span>'.e(TYPES[$p['type']].' · '.STATUSES[$p['status']]).'</span></div>'.($located?'<button type="button" data-map-select="'.e($p['slug']).'" hidden>地図で選ぶ</button>':'<span class="dn-map-unlocated">位置確認待ち</span>').'</li>';}
    $body.='</ul></section><details class="dn-map-credits"><summary>この地図について・データ出典</summary><p>掲載は網羅的なものではありません。掲載基準は手話カフェ一覧と共通です。海外の情報はHTML一覧で扱い、この試作地図は日本のみを表示します。</p><p>地形：<a href="https://www.naturalearthdata.com/about/terms-of-use/" rel="noopener noreferrer" target="_blank">Natural Earth</a> 1:50m / Public domain。座標：国土地理院の住所検索を照合。描画：Three.js 0.180.0 / <a href="/cafe-map/vendor/LICENSE">MIT License</a>。</p><p>3D関連データはこのサイトからのみ読み込みます。現在地の取得や外部地図サービスへのアクセスは行いません。</p></details><p><a href="/submit/?category=cafe">まだ載っていない場所を教える →</a></p>';
    return page('全国の手話スポット3Dマップ',$body,'/connect/sign-cafe/map/','全国の手話カフェや手話の交流拠点を立体の日本地図から探すDeaf Naviの試作マップ。HTML一覧でも情報を確認できます。');
}
