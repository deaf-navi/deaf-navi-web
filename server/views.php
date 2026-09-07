<?php
declare(strict_types=1);
require_once __DIR__.'/cafe-ui.php';
function page(string $title,string $body,string $path='',string $description='',array $structured=[],bool $private=false,array $meta=[]): string {
    $canonical=$meta['canonical']??BASE.($path?:'/connect/sign-cafe/');
    $documentTitle=$meta['title']??($title==='Deaf Navi｜手話カフェ'?$title:$title.' | Deaf Navi');
    $robots=$private?'noindex,nofollow':($meta['robots']??'index,follow');
    $ld='<link rel="stylesheet" href="/directory-community.css?v=20260907tables"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="/directory-safety.js" defer></script><script src="/directory-ui.js?v=20260907slim" defer></script>';
    if(!$private) {
        $ld.='<script src="/access-visit.js" defer></script>';
        if($meta)$ld.='<meta property="og:site_name" content="Deaf Navi"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'.e($documentTitle).'"><meta name="twitter:description" content="'.e($description).'"><meta name="twitter:image" content="'.BASE.'/og-image.png">';
        $crumbs=[['@type'=>'ListItem','position'=>1,'name'=>'ホーム','item'=>BASE.'/'],['@type'=>'ListItem','position'=>2,'name'=>'つながる','item'=>BASE.'/connect/'],['@type'=>'ListItem','position'=>3,'name'=>'手話カフェ','item'=>BASE.'/connect/sign-cafe/']];
        if($path!=='/connect/sign-cafe/') $crumbs[]=['@type'=>'ListItem','position'=>4,'name'=>$title,'item'=>$canonical];
        $structured[]=['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>$crumbs];
        foreach($structured as $schema) $ld.='<script type="application/ld+json">'.json_encode($schema,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE).'</script>';
    }
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.e($documentTitle).'</title><meta name="description" content="'.e($description).'"><meta name="robots" content="'.$robots.'"><link rel="canonical" href="'.e($canonical).'"><meta property="og:title" content="'.e($documentTitle).'"><meta property="og:description" content="'.e($description).'"><meta property="og:url" content="'.e($canonical).'"><meta property="og:type" content="website"><meta property="og:image" content="'.BASE.'/og-image.png"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/directory.css?v=20260908seo">'.$ld.'</head><body class="dn-directory'.(str_starts_with($path,'/connect/sign-cafe/')?' dn-cafe-theme':'').'"><a class="dn-skip" href="#main">本文へ</a><header class="dn-header"><a class="dn-brand" href="/">Deaf Navi<span>知る。つながる。自分らしく。</span></a><nav aria-label="メイン"><a href="/">ニュース</a><a href="/connect/" aria-current="page">つながる</a><a href="/guide/">暮らしのガイド</a></nav></header><main id="main" class="dn-main"><nav class="dn-breadcrumb" aria-label="パンくず"><a href="/">ホーム</a> / <a href="/connect/">つながる</a> / <a href="/connect/sign-cafe/">手話カフェ</a></nav><h1>'.e($title).'</h1>'.$body.'</main><footer class="dn-footer"><a href="/about/">Deaf Naviについて</a><a href="/submit/">情報提供</a><a href="/admin/">管理画面</a><p>営業・開催状況は変更される場合があります。訪問前に情報源をご確認ください。</p></footer></body></html>';
}
function tabs(bool $starbucks=false,bool $overseas=false): string { return '<nav class="dn-tabs" aria-label="手話カフェの分類"><a href="/connect/sign-cafe/"'.(!$starbucks&&!$overseas?' aria-current="page"':'').'>日本の手話カフェ</a><a href="/connect/sign-cafe/overseas/"'.($overseas?' aria-current="page"':'').'>海外の手話カフェ</a><a href="/connect/sign-cafe/starbucks/"'.($starbucks?' aria-current="page"':'').'>スターバックス</a></nav>'; }
function ext_link(string $url,string $label): string { if($url==='') return ''; return '<a href="'.e(safe_url($url)).'" target="_blank" rel="noopener noreferrer">'.e($label).' ↗</a>'; }
function field(string $name,string $label,mixed $value='',string $type='text',bool $required=false): string {
    $id='f-'.$name; $req=$required?' required':'';
    if(is_array($value)) $value=implode("\n",$value);
    $newPassword=$type==='password'&&in_array($name,['new_password','confirm_password'],true);
    $control=$type==='textarea'?'<textarea id="'.$id.'" name="'.$name.'" maxlength="6000" rows="3"'.$req.'>'.e($value).'</textarea>':'<input id="'.$id.'" name="'.$name.'" type="'.$type.'" value="'.e($value).'" maxlength="'.($newPassword?'128':'2000').'"'.($newPassword?' minlength="8" data-password-limit aria-describedby="'.$id.'-limit"':'').($type==='password'?' autocomplete="'.($newPassword?'new-password':'current-password').'"':'').$req.'>';
    if($newPassword)$control.='<span class="dn-password-limit" id="'.$id.'-limit">8文字以上・128バイト以内<span data-password-count></span></span>';
    return '<label class="dn-field" for="'.$id.'"><span>'.e($label).($required?' <small>必須</small>':'').'</span>'.$control.'</label>';
}
function select_field(string $name,string $label,array $options,string $selected=''): string {
    $html='<label class="dn-field"><span>'.e($label).'</span><select name="'.e($name).'">';
    foreach($options as $v=>$text) $html.='<option value="'.e($v).'"'.((string)$v===$selected?' selected':'').'>'.e($text).'</option>';
    return $html.'</select></label>';
}
function record_path(array $r): string { return '/connect/sign-cafe/'.($r['kind']==='event'?'starbucks/':'').$r['slug'].'/'; }
function sources_html(array $p): string {
    $out='<div class="dn-sources"><span>情報確認日：'.e(($p['last_verified_at']??'')?:'未確認').'</span><details><summary>情報源を確認する</summary><ul>';
    foreach($p['verification_sources']??[] as $i=>$url) $out.='<li>'.ext_link($url,'情報源 '.($i+1).' · '.(parse_url($url,PHP_URL_HOST)?:'')).'</li>';
    return $out.'</ul></details></div>'.cafe_freshness_html($p);
}
function cafe_card(array $p): string {
    $type=TYPES[$p['type']??'special']??'特殊';
    $out='<article class="dn-card"><div class="dn-badges"><span class="dn-badge">'.e($type).'</span>';
    if($p['status']!=='open') $out.='<span class="dn-badge dn-warning">'.e(STATUSES[$p['status']]).'</span>';
    foreach($p['subtypes']??[] as $tag) $out.='<span class="dn-tag">'.e($tag).'</span>';
    $out.='</div><p class="dn-location">'.e(($p['country_code']!=='JP'?($p['country_name']?:$p['country_code']).' / ':'').$p['prefecture'].' / '.$p['city']).'</p><h2><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h2><p>'.nl2br(e($p['description']??'')).'</p><dl class="dn-facts"><dt>営業・開催日</dt><dd>'.e(($p['event_schedule']??'')?:'未確認・公式情報をご確認ください').'</dd><dt>時間</dt><dd>'.e(($p['business_hours']??'')?:'未確認').'</dd></dl><div class="dn-links">';
    $out.=official_links($p);
    $out.='</div>'.sources_html($p);
    if($p['kind']==='store') $out.='<p>'.action_link('/connect/sign-cafe/starbucks/','スターバックスの手話関連情報','page').'</p>';
    return $out.'</article>';
}
function visible_records(): array { return array_values(array_filter(array_map('expanded',query("SELECT * FROM records WHERE publication='public' ORDER BY prefecture,name")->fetchAll()),'publicly_visible')); }
function filters(array $all,bool $overseas=false): string {
    $countries=[];foreach($all as $p)$countries[$p['country_code']]=($p['country_name']??'')?:$p['country_code'];asort($countries);
    $pref=[];foreach($all as $p) if($p['prefecture']!=='') $pref[$p['prefecture']]=$p['prefecture']; ksort($pref);
    return '<form method="get" class="dn-filter" aria-label="検索と絞り込み">'.'<input type="hidden" name="sort" value="'.e(input($_GET,'sort',20)).'"><input type="hidden" name="dir" value="'.e(input($_GET,'dir',4)).'">'.field('q','店舗名・地域・キーワード',input($_GET,'q',200),'search').($overseas?select_field('country','国・地域',[''=>'すべての国・地域']+$countries,input($_GET,'country',2)):select_field('region','地域',[''=>'すべての地域']+array_combine(['北海道','東北','関東','中部','近畿','中国','四国','九州・沖縄'],['北海道','東北','関東','中部','近畿','中国','四国','九州・沖縄']),input($_GET,'region',40))).select_field('prefecture','都道府県・州',[''=>'すべて']+$pref,input($_GET,'prefecture',100)).select_field('type','分類',[''=>'すべて']+TYPES,input($_GET,'type',40)).select_field('history','営業状態',[''=>'営業・活動確認済','1'=>'休業・閉店の履歴も表示'],input($_GET,'history',1)).'<div class="dn-actions"><button>絞り込む</button><a href="?">クリア</a></div></form>';
}
function filtered(array $all): array {
    $q=normalized(input($_GET,'q',200)); $reg=input($_GET,'region',40);$pref=input($_GET,'prefecture',100);$type=input($_GET,'type',40);$history=input($_GET,'history',1)==='1';$country=input($_GET,'country',2);
    return array_values(array_filter($all,function($p)use($q,$reg,$pref,$type,$history,$country){
        return ($country==='' || $p['country_code']===$country) && ($history || in_array($p['status'],['open','unknown'],true)) && ($reg==='' || region($p['prefecture'],$p['country_code'])===$reg) && ($pref==='' || $p['prefecture']===$pref) && ($type==='' || ($p['type']??'')===$type) && ($q==='' || str_contains(normalized(implode(' ',[$p['name'],$p['name_kana']??'',$p['country_name']??'',$p['country_code'],$p['prefecture'],$p['city'],$p['description']??'',implode(' ',$p['subtypes']??[])])),$q));
    }));
}
function submission_form(array $values=[]): string {
    start_session(); $_SESSION['form_issued']??=time();
    $out='<section class="dn-submit" id="request"><p class="dn-eyebrow">SHARE INFORMATION</p><h2>手話カフェの情報をお待ちしています</h2><p>まだDeaf-Naviに載っていない手話カフェや、閉店・移転・営業時間の変更など、お気づきの情報がありましたら、ぜひ教えてください。</p><p>お寄せいただいた情報は、まず確認中の情報としてお預かりし、管理者が内容を確認・承認したうえで掲載します。お名前やご連絡先は公開されませんので、どうぞご安心ください。</p><p>通知メールの設定にかかわらず、お送りいただいた情報は管理画面で受け付けています。</p><details'.($values?' open':'').'><summary class="dn-cta">手話カフェの情報を送る</summary><form action="/submit/" method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="submit"><div class="dn-honey" aria-hidden="true"><label>この欄には入力しないでください<input name="website_confirm" tabindex="-1" autocomplete="off"></label></div><div class="dn-form-grid">';
    $out.=select_field('category','提供する情報',['cafe'=>'手話カフェ情報','starbucks'=>'スターバックス開催情報','correction'=>'既存情報の修正','closure'=>'閉店・中止情報','other'=>'その他'],$values['category']??'cafe');
    $out.=select_field('report_type','情報種別',REPORT_TYPES,$values['report_type']??'new');
    foreach(['name'=>'店舗・活動名','country_code'=>'国コード（日本はJP）','country_name'=>'国・地域名','prefecture'=>'都道府県・州（該当しない場合は空欄）','city'=>'市区町村または所在地','address'=>'住所','official_url'=>'公式HP','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook','event_schedule'=>'営業曜日・開催曜日','business_hours'=>'営業時間','description'=>'店舗の特徴','source_url'=>'情報元URL','notes'=>'補足','submitter'=>'名前・ニックネーム（非公開・任意）','email'=>'連絡先メール（非公開・任意）'] as $k=>$label) $out.=field($k,$label,$values[$k]??($k==='country_code'?'JP':''),in_array($k,['description','notes'])?'textarea':($k==='email'?'email':(str_ends_with($k,'_url')?'url':'text')),in_array($k,['name','country_code','city']));
    return $out.'</div><label class="dn-check"><input type="checkbox" name="consent" value="1" required> 内容確認のための保存と管理者への通知に同意します。第三者の非公開の個人情報は記載しません。</label><p class="dn-muted">任意の連絡先は確認連絡のみに使用し、確認完了後の保管期間は最長1年を目安に管理者が削除します。情報提供は店舗への予約にはなりません。</p><button>確認待ちとして送信する</button></form></details></section>';
}
function cafe_list(bool $overseas=false): string {
    if(!$overseas)return domestic_cafe_page();
    if($overseas)return world_page();
    $all=array_values(array_filter(visible_records(),fn($p)=>(($p['country_code']!=='JP')===$overseas)&&($p['kind']==='cafe'||($p['kind']==='store'&&($p['signing_store']??false))))); $list=filtered($all);
    $body=($overseas?'':'<p class="dn-eyebrow" lang="en">Deaf Navi – Sign Cafe</p><p class="dn-lead">日本と世界の、手話でつながるカフェを探す。</p>').tabs(false,$overseas).'<section class="dn-cafe-intro"><p>手話・ろう文化・筆談での交流を継続して行う店舗や活動を掲載しています。常設・限定営業・定期開催・特殊の4分類で案内し、単発イベントは含みません。'.($overseas?'正式なSigning Storeも掲載対象です。':'正式なサイニングストアは「特殊」として掲載します。').'</p><a href="#request">情報を提供する ↓</a></section>'.($overseas?'<p class="dn-notice">海外の店舗・活動をご紹介します。手話は国や地域によって異なります。対応する手話や筆談の方法は店舗の案内をご確認ください。営業時間は現地時間です。</p>':'').filters($all,$overseas).'<p class="dn-result">該当 <strong>'.count($list).'</strong>件 <span>営業時間は変更される場合があります。訪問前に公式情報をご確認ください。</span></p>';
    $body=str_replace('>営業・活動確認済</option>','>休業・閉店を除く</option>',$body);
    $body.=($overseas?'':'<p>'.action_link('/connect/sign-cafe/map/','地図から手話カフェを探す','map').'</p>').'<p class="dn-muted">実在・活動実績は確認できても現在の営業が不明な場所は「営業状況未確認」と表示しています。営業中と断定するものではありません。</p>';
    $body.=$list?cafe_table($list):($overseas&&!$all?'<section class="dn-empty"><h2>海外の手話カフェ情報は掲載準備中です</h2><p>確認できた店舗・活動から順次ご紹介します。</p></section>':'<p class="dn-empty">条件に一致する掲載情報はありません。検索条件を変更してください。</p>');
    return page($overseas?'海外の手話カフェ':'Deaf Navi｜手話カフェ',$body.($overseas?'<p id="request"><a href="/submit/?scope=overseas#request">海外の手話カフェ情報を提供する</a></p>':submission_form()),$overseas?'/connect/sign-cafe/overseas/':'/connect/sign-cafe/',$overseas?'海外の手話カフェや手話・筆談で交流できる店舗・活動を国や地域別に紹介します。':'全国の手話カフェ、ろう者が運営するカフェ、手話・筆談で交流できる店舗、定期開催の手話カフェ、サイニングストアなどを地域別に紹介します。');
}
function cafe_sort_key(array $p,string $key): string {
    if($key==='name')return ($p['name_kana']??'')?:$p['name'];
    if($key==='type')return (string)(array_search(cafe_model($p)['shop_type'],array_keys(SHOP_TYPES),true)?:0);
    $prefs=explode(' ','北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県');
    $rank=array_search($p['prefecture'],$prefs,true);
    return $p['country_code']==='JP'?'0-'.sprintf('%02d',$rank===false?99:$rank).'-'.$p['city']:'1-'.$p['country_code'].'-'.$p['prefecture'].'-'.$p['city'];
}
function cafe_table(array $list): string {
    $sort=input($_GET,'sort',20);if(!in_array($sort,['region','name','type'],true))$sort='region';
    $dir=input($_GET,'dir',4)==='desc'?'desc':'asc';
    $collator=class_exists('Collator')?new Collator('ja_JP'):null;
    usort($list,function($a,$b)use($sort,$dir,$collator){$ka=cafe_sort_key($a,$sort);$kb=cafe_sort_key($b,$sort);$cmp=$collator?$collator->compare($ka,$kb):strcmp($ka,$kb);return ($dir==='desc'?-1:1)*($cmp?:strcmp($a['slug'],$b['slug']));});
    $params=[];foreach(['q'=>200,'country'=>2,'region'=>40,'prefecture'=>100,'type'=>40,'history'=>1,'shop_type'=>40,'status'=>30,'operator_type'=>40,'sign_language_level'=>40,'events'=>1,'view'=>10,'per_page'=>3]+array_fill_keys(array_keys(CAFE_FEATURES),1) as $k=>$max){$v=input($_GET,$k,$max);if($v!=='')$params[$k]=$v;}
    $out='<p class="dn-table-hint" id="cafe-table-help">列名で並べ替えできます。店舗名から個別ページへ移動できます。<span class="dn-mobile-hint">表は横にスクロールできます。</span></p><div class="dn-table-scroll" role="region" aria-label="手話カフェの比較表" tabindex="0"><table class="dn-cafe-table" data-server-sort="1" aria-describedby="cafe-table-help" data-sort="'.$sort.'" data-dir="'.$dir.'"><caption class="dn-visually-hidden">手話カフェ一覧・所在地・営業形態・営業時間</caption><thead><tr>';
    foreach(['name'=>'店舗名','region'=>'所在地','type'=>'営業形態'] as $key=>$label){$url='?'.http_build_query($params+['sort'=>$key,'dir'=>$sort===$key&&$dir==='asc'?'desc':'asc']);$out.='<th scope="col" aria-sort="'.($sort===$key?($dir==='asc'?'ascending':'descending'):'none').'"><a href="'.e($url).'" data-cafe-sort="'.$key.'">'.$label.' <span aria-hidden="true">'.($sort===$key?($dir==='asc'?'↑':'↓'):'↕').'</span></a></th>';}
    $out.='<th scope="col">営業時間・営業日</th></tr></thead><tbody>';
    foreach($list as $p){
        $id='cafe-detail-'.$p['slug'];
        $out.='<tr class="dn-cafe-row" data-slug="'.e($p['slug']).'"';foreach(['name','region','type'] as $k)$out.=' data-sort-'.$k.'="'.e(cafe_sort_key($p,$k)).'"';$out.='><th scope="row"><a class="dn-cafe-name" href="'.e(record_path($p)).'">'.e($p['name']).'</a><div class="dn-row-meta"><button type="button" class="dn-expand" data-cafe-expand="'.e($id).'" aria-expanded="false" aria-controls="'.e($id).'" hidden>詳細 ＋</button><span>確認 '.e(($p['last_verified_at']??'')?:'未確認').'</span></div></th><td><span>'.e(($p['country_code']!=='JP'?($p['country_name']?:$p['country_code']).' / ':'').$p['prefecture']).'</span><span class="dn-cell-secondary">'.e($p['city']).'</span></td><td><span class="dn-badge">'.e(SHOP_TYPES[cafe_model($p)['shop_type']]).'</span><span class="dn-cell-secondary dn-operating-state">'.e(cafe_status_label($p)).'</span>'.'</td><td class="dn-hours">'.cafe_table_schedule($p).'</td></tr>';
        $out.='<tr class="dn-cafe-expanded" id="'.e($id).'" hidden><td colspan="4"><div class="dn-expanded-inner"><h2>'.e($p['name']).'</h2><p>'.nl2br(e($p['description']??'')).'</p><dl class="dn-facts">';
        foreach(['address'=>'住所','holidays'=>'定休日','reservation'=>'予約','sign_support'=>'手話対応'] as $k=>$label)if(!empty($p[$k]))$out.='<dt>'.$label.'</dt><dd>'.nl2br(e($p[$k])).'</dd>';
        $out.='</dl>'.(!empty($p['notes'])?'<p>'.nl2br(e($p['notes'])).'</p>':'').official_links($p).'<div class="dn-links">';if(!empty($p['map_url']))$out.=ext_link($p['map_url'],'地図・行き方');
        $out.=action_link(record_path($p),'お店について詳しく見る','page').'<a href="'.e(cafe_correction_url($p)).'">情報を修正・追加する</a></div>'.sources_html($p).'</div></td></tr>';
    }
    return $out.'</tbody></table></div><p class="dn-visually-hidden" data-cafe-announcement role="status"></p>';
}
function event_state(array $p): string {
    $status=$p['status'];
    if(in_array($status,['scheduled','ongoing'],true) && !empty($p['event_date']) && $p['event_date']<(new DateTimeImmutable('now',new DateTimeZone($p['timezone']?:'Asia/Tokyo')))->format('Y-m-d')) return 'ended';
    return $status;
}
function event_card(array $p,array $store): string {
    return '<article class="dn-card"><span class="dn-badge">'.e((($p['observation_only']??'0')==='1'?'開催実績・個別日時未確認':EVENT_STATUSES[event_state($p)])).'</span><h3><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h3><p>'.e($store['name'].' / '.$store['prefecture'].' '.$store['city']).'</p><p>'.e(($p['event_date']?:'日程未確認').' '.($p['start_time']??'').' '.($p['event_schedule']??'')).'</p><p>'.nl2br(e($p['description']??'')).'</p><p>情報の確度：'.e(CONFIDENCE[$p['confidence']??'unverified']).'</p>'.sources_html($p).'</article>';
}
function disclaimer(): string { return '<aside class="dn-disclaimer">本ページはDeaf Naviによる非公式の情報ページです。スターバックス コーヒー ジャパン株式会社が運営・監修するものではありません。開催状況や参加方法は、掲載している情報源または各店舗・主催者へご確認ください。</aside>'; }
function event_table(array $events,array $stores):string {
    $out='<p class="dn-table-hint">店舗名・企画名から詳細へ。表は横にスクロールできます。</p><div class="dn-table-scroll" role="region" aria-label="手話イベント比較表" tabindex="0"><table class="dn-data-table"><caption class="dn-visually-hidden">手話イベントの日時・店舗・確認情報</caption><thead><tr><th scope="col">店舗・企画</th><th scope="col">所在地</th><th scope="col">開催日時・状態</th><th scope="col">確認情報</th></tr></thead><tbody>';
    foreach($events as $p){$store=$stores[$p['store_id']];$out.='<tr><th scope="row"><a href="'.e(record_path($p)).'">'.e($p['name']).'</a><span class="dn-cell-secondary">'.e($store['name']).'</span></th><td>'.e($store['prefecture'].' '.$store['city']).'</td><td>'.e(($p['event_date']?:'日程未確認').' '.($p['start_time']??'')).'<span class="dn-cell-secondary">'.e($p['event_schedule']??'').'</span><span class="dn-badge">'.e(($p['observation_only']??'0')==='1'?'開催実績・個別日時未確認':EVENT_STATUSES[event_state($p)]).'</span></td><td>'.e(CONFIDENCE[$p['confidence']??'unverified']).sources_html($p).'</td></tr>';}
    return $out.'</tbody></table></div>';
}
function starbucks_list(): string {
    $all=visible_records();$stores=[];$events=[];
    foreach($all as $p)if($p['kind']==='store'&&$p['country_code']==='JP')$stores[$p['id']]=$p;
    $pref=input($_GET,'prefecture',100);$selected=input($_GET,'store',64);$q=input($_GET,'q',200);
    $matched=array_filter($stores,fn($s)=>($pref===''||$s['prefecture']===$pref)&&($selected===''||$s['id']===$selected)&&($q===''||str_contains(normalized($s['name'].' '.$s['prefecture'].' '.$s['city']),normalized($q))));
    foreach($all as $p)if($p['kind']==='event'&&isset($matched[$p['store_id']]))$events[]=$p;
    usort($events,fn($a,$b)=>strcmp($a['event_date']??'',$b['event_date']??''));
    $prefs=[];$opts=[];foreach($stores as $s){$prefs[$s['prefecture']]=$s['prefecture'];$opts[$s['id']]=$s['name'];}ksort($prefs);
    $body=tabs(true).'<p class="dn-lead">国内の開催予定と、手話カフェの開催実績を探す。</p><p class="dn-cafe-intro">海外のSigning Storeは <a href="/connect/sign-cafe/overseas/?brand=starbucks">海外の手話カフェ一覧</a> に掲載しています。</p><form class="dn-filter" method="get" aria-label="スターバックスの検索と絞り込み">'.field('q','店舗名・地域',$q,'search').select_field('prefecture','都道府県',[''=>'すべて']+$prefs,$pref).select_field('store','店舗',[''=>'すべての店舗']+$opts,$selected).'<div class="dn-actions"><button>絞り込む</button><a href="/connect/sign-cafe/starbucks/">すべて解除</a></div></form><nav class="dn-section-links" aria-label="ページ内の案内"><a href="#upcoming">開催予定</a><a href="#regular">常設・定期開催</a><a href="#observed">開催実績のある店舗</a><a href="#past">過去の開催履歴</a><a href="#starbucks-post">情報を投稿</a></nav><p class="dn-result">対象 <strong>'.count($matched).'</strong>店舗 <span>開催予定と開催実績を分けて表示しています。</span></p>';
    foreach(['開催予定'=>['upcoming',['scheduled','ongoing']],'定期開催・常設的な取り組み'=>['regular',['recurring']]] as $heading=>[$anchor,$states]){
        $items=array_values(array_filter($events,fn($p)=>($p['observation_only']??'0')!=='1'&&in_array(event_state($p),$states,true)));
        $signing=$anchor==='regular'?array_values(array_filter($matched,fn($s)=>!empty($s['signing_store']))):[];
        $body.='<section class="dn-section" id="'.$anchor.'"><h2>'.$heading.' <small>'.(count($items)+count($signing)).'件</small></h2>';
        if($items)$body.=event_table($items,$stores);
        if($signing)$body.=cafe_table($signing);
        if(!$items&&!$signing)$body.='<p class="dn-empty">'.($anchor==='upcoming'?'現在確認できている開催予定はありません。':'現在掲載している確認済み情報はありません。').'</p>';
        $body.='</section>';
    }
    $body.=starbucks_observed($matched,$events,$pref,$selected);
    $past=array_values(array_filter(array_reverse($events),fn($p)=>in_array(event_state($p),['ended','cancelled'],true)&&($p['observation_only']??'0')!=='1'));
    $body.='<section class="dn-section" id="past"><h2>過去の開催履歴 <small>'.count($past).'件</small></h2>'.($past?event_table($past,$stores):'<p>現在掲載している開催履歴はありません。</p>').'</section>'.disclaimer().'<section class="dn-section" id="starbucks-post"><details><summary class="dn-post-summary">開催情報を投稿する</summary>'.starbucks_form($selected).'</details></section>';
    return page('スターバックスの手話カフェ・手話イベント情報',$body,'/connect/sign-cafe/starbucks/','スターバックスの手話カフェ・手話関連企画、サイニングストアと開催履歴。');
}
function detail(string $slug,bool $event): string {
    $r=query('SELECT * FROM records WHERE slug=? AND '.($event?"kind='event'":"kind IN ('cafe','store')"),[$slug])->fetch();
    if(!$r || !publicly_visible($p=expanded($r))) fail('情報が見つかりません。',404);
    $overseas=!$event&&$p['country_code']!=='JP';
    $body=tabs($event,$overseas).'<p><a href="'.($event?'/connect/sign-cafe/starbucks/':($overseas?'/connect/sign-cafe/overseas/':'/connect/sign-cafe/')).'">← 一覧へ</a></p>';$schema=[];
    $store=$event?expanded(record($p['store_id'])):$p;
    if($event&&!publicly_visible($store)) fail('情報が見つかりません。',404);
    $body.=$event?event_card($p,$store).visitor_event_details($p):visitor_profile($p);
    if($event) $body.='<h2>開催店舗</h2><p>'.e($store['name'].' / '.$store['address']).'</p>'.disclaimer();
    if(!$event && $p['kind']==='store'&&$p['country_code']==='JP') {
        $body.='<h2>この店舗の開催履歴</h2>';
        foreach(visible_records() as $ev) if($ev['kind']==='event'&&$ev['store_id']===$p['id']) $body.=event_card($ev,$p);
        $body.=disclaimer();
    }
    if(!$event&&$p['status']==='open'&&$p['type']!=='recurring'&&!empty($p['address'])) $schema[]=['@context'=>'https://schema.org','@type'=>$p['type']==='permanent'?'CafeOrCoffeeShop':'Place','name'=>$p['name'],'url'=>BASE.record_path($p),'address'=>['@type'=>'PostalAddress','streetAddress'=>$p['address'],'addressLocality'=>$p['city'],'addressRegion'=>$p['prefecture'],'addressCountry'=>$p['country_code']]];
    if($event && ($p['observation_only']??'0')!=='1' && in_array($p['confidence']??'',['official','organizer','store'],true) && $p['event_date'] && $p['start_time'] && $p['timezone'] && !empty($store['address']) && in_array(event_state($p),['scheduled','ongoing','ended','cancelled'],true)) {
        $schema[]=['@context'=>'https://schema.org','@type'=>'Event','name'=>$p['name'],'url'=>BASE.record_path($p),'startDate'=>(new DateTimeImmutable($p['event_date'].'T'.$p['start_time'],new DateTimeZone($p['timezone'])))->format('c'),'eventStatus'=>'https://schema.org/'.(event_state($p)==='cancelled'?'EventCancelled':'EventScheduled'),'location'=>['@type'=>'Place','name'=>$store['name'],'address'=>['@type'=>'PostalAddress','streetAddress'=>$store['address'],'addressCountry'=>$store['country_code']]]];
    }
    $body.='<p><a href="'.e(cafe_correction_url($p)).'">この情報の修正を知らせる</a></p>';
    return page($p['name'],$body,record_path($p),$p['description']??'',$schema);
}
