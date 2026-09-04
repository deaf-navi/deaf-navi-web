<?php
declare(strict_types=1);
function page(string $title,string $body,string $path='',string $description='',array $structured=[],bool $private=false): string {
    $canonical=BASE.($path?:'/connect/sign-cafe/');
    $robots=$private?'noindex,nofollow':'index,follow';
    $ld='<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="/directory-safety.js" defer></script>';
    if(!$private) {
        $crumbs=[['@type'=>'ListItem','position'=>1,'name'=>'ホーム','item'=>BASE.'/'],['@type'=>'ListItem','position'=>2,'name'=>'つながる','item'=>BASE.'/connect/'],['@type'=>'ListItem','position'=>3,'name'=>'手話カフェ','item'=>BASE.'/connect/sign-cafe/']];
        if($path!=='/connect/sign-cafe/') $crumbs[]=['@type'=>'ListItem','position'=>4,'name'=>$title,'item'=>$canonical];
        $structured[]=['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>$crumbs];
        foreach($structured as $schema) $ld.='<script type="application/ld+json">'.json_encode($schema,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE).'</script>';
    }
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.e($title).' | Deaf Navi</title><meta name="description" content="'.e($description).'"><meta name="robots" content="'.$robots.'"><link rel="canonical" href="'.e($canonical).'"><meta property="og:title" content="'.e($title).' | Deaf Navi"><meta property="og:description" content="'.e($description).'"><meta property="og:url" content="'.e($canonical).'"><meta property="og:type" content="website"><meta property="og:image" content="'.BASE.'/og-image.png"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/directory.css">'.$ld.'</head><body class="dn-directory"><a class="dn-skip" href="#main">本文へ</a><header class="dn-header"><a class="dn-brand" href="/">Deaf Navi<span>知る。つながる。自分らしく。</span></a><nav aria-label="メイン"><a href="/">ニュース</a><a href="/connect/" aria-current="page">つながる</a><a href="/guide/">暮らしのガイド</a></nav></header><main id="main" class="dn-main"><nav class="dn-breadcrumb" aria-label="パンくず"><a href="/">ホーム</a> / <a href="/connect/">つながる</a> / <a href="/connect/sign-cafe/">手話カフェ</a></nav><h1>'.e($title).'</h1>'.$body.'</main><footer class="dn-footer"><a href="/about/">Deaf Naviについて</a><a href="/submit/">情報提供</a><a href="/admin/">管理画面</a><p>営業・開催状況は変更される場合があります。訪問前に情報源をご確認ください。</p></footer></body></html>';
}
function tabs(bool $starbucks=false): string { return '<nav class="dn-tabs" aria-label="手話カフェの分類"><a href="/connect/sign-cafe/"'.(!$starbucks?' aria-current="page"':'').'>手話カフェ一覧</a><a href="/connect/sign-cafe/starbucks/"'.($starbucks?' aria-current="page"':'').'>スターバックス</a></nav>'; }
function ext_link(string $url,string $label): string { if($url==='') return ''; return '<a href="'.e(safe_url($url)).'" target="_blank" rel="noopener noreferrer">'.e($label).' ↗</a>'; }
function field(string $name,string $label,mixed $value='',string $type='text',bool $required=false): string {
    $id='f-'.$name; $req=$required?' required':'';
    if(is_array($value)) $value=implode("\n",$value);
    $control=$type==='textarea'?'<textarea id="'.$id.'" name="'.$name.'" maxlength="6000" rows="3"'.$req.'>'.e($value).'</textarea>':'<input id="'.$id.'" name="'.$name.'" type="'.$type.'" value="'.e($value).'" maxlength="2000"'.($type==='password'?' autocomplete="new-password"':'').$req.'>';
    return '<label class="dn-field" for="'.$id.'"><span>'.e($label).($required?' <small>必須</small>':'').'</span>'.$control.'</label>';
}
function select_field(string $name,string $label,array $options,string $selected=''): string {
    $html='<label class="dn-field"><span>'.e($label).'</span><select name="'.e($name).'">';
    foreach($options as $v=>$text) $html.='<option value="'.e($v).'"'.((string)$v===$selected?' selected':'').'>'.e($text).'</option>';
    return $html.'</select></label>';
}
function record_path(array $r): string { return '/connect/sign-cafe/'.($r['kind']==='event'?'starbucks/':'').$r['slug'].'/'; }
function sources_html(array $p): string {
    $out='<div class="dn-sources"><span>情報確認日：'.e($p['last_verified_at']?:'未確認').'</span><details><summary>情報源を確認する</summary><ul>';
    foreach($p['verification_sources']??[] as $i=>$url) $out.='<li>'.ext_link($url,'情報源 '.($i+1).' · '.(parse_url($url,PHP_URL_HOST)?:'')).'</li>';
    return $out.'</ul></details></div>';
}
function cafe_card(array $p): string {
    $type=TYPES[$p['type']??'special']??'特殊';
    $out='<article class="dn-card"><div class="dn-badges"><span class="dn-badge">'.e($type).'</span>';
    if($p['status']!=='open') $out.='<span class="dn-badge dn-warning">'.e(STATUSES[$p['status']]).'</span>';
    foreach($p['subtypes']??[] as $tag) $out.='<span class="dn-tag">'.e($tag).'</span>';
    $out.='</div><p class="dn-location">'.e(($p['country_code']!=='JP'?($p['country_name']?:$p['country_code']).' / ':'').$p['prefecture'].' / '.$p['city']).'</p><h2><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h2><p>'.nl2br(e($p['description']??'')).'</p><dl class="dn-facts"><dt>営業・開催日</dt><dd>'.e(($p['event_schedule']??'')?:'未確認・公式情報をご確認ください').'</dd><dt>時間</dt><dd>'.e(($p['business_hours']??'')?:'未確認').'</dd></dl><div class="dn-links">';
    foreach(['official_url'=>'公式サイト','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook'] as $key=>$label) $out.=ext_link($p[$key]??'',$label);
    $out.='</div>'.sources_html($p);
    if($p['kind']==='store') $out.='<p><a href="/connect/sign-cafe/starbucks/">スターバックスの手話関連情報を見る →</a></p>';
    return $out.'</article>';
}
function region(string $prefecture,string $country): string {
    if($country!=='JP') return '海外';
    $regions=['北海道'=>['北海道'],'東北'=>['青森県','岩手県','宮城県','秋田県','山形県','福島県'],'関東'=>['茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県'],'中部'=>['新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県'],'近畿'=>['三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県'],'中国'=>['鳥取県','島根県','岡山県','広島県','山口県'],'四国'=>['徳島県','香川県','愛媛県','高知県'],'九州・沖縄'=>['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']];
    foreach($regions as $name=>$prefs) if(in_array($prefecture,$prefs,true)) return $name;
    return '未分類';
}
function visible_records(): array { return array_values(array_filter(array_map('expanded',query("SELECT * FROM records WHERE publication='public' ORDER BY prefecture,name")->fetchAll()),'publicly_visible')); }
function filters(array $all): string {
    $pref=[];foreach($all as $p) if($p['prefecture']!=='') $pref[$p['prefecture']]=$p['prefecture']; ksort($pref);
    return '<form method="get" class="dn-filter" aria-label="検索と絞り込み">'.field('q','店舗名・地域・キーワード',input($_GET,'q',200),'search').select_field('region','地域',[''=>'すべての地域']+array_combine(['北海道','東北','関東','中部','近畿','中国','四国','九州・沖縄','海外'],['北海道','東北','関東','中部','近畿','中国','四国','九州・沖縄','海外']),input($_GET,'region',40)).select_field('prefecture','都道府県・州',[''=>'すべて']+$pref,input($_GET,'prefecture',100)).select_field('type','分類',[''=>'すべて']+TYPES,input($_GET,'type',40)).select_field('history','営業状態',[''=>'営業・活動確認済','1'=>'休業・閉店の履歴も表示'],input($_GET,'history',1)).'<div class="dn-actions"><button>絞り込む</button><a href="?">クリア</a></div></form>';
}
function filtered(array $all): array {
    $q=normalized(input($_GET,'q',200)); $reg=input($_GET,'region',40);$pref=input($_GET,'prefecture',100);$type=input($_GET,'type',40);$history=input($_GET,'history',1)==='1';
    return array_values(array_filter($all,function($p)use($q,$reg,$pref,$type,$history){
        return ($history || $p['status']==='open') && ($reg==='' || region($p['prefecture'],$p['country_code'])===$reg) && ($pref==='' || $p['prefecture']===$pref) && ($type==='' || ($p['type']??'')===$type) && ($q==='' || str_contains(normalized(implode(' ',[$p['name'],$p['name_kana']??'',$p['prefecture'],$p['city'],$p['description']??'',implode(' ',$p['subtypes']??[])])),$q));
    }));
}
function submission_form(array $values=[]): string {
    start_session(); $_SESSION['form_issued']??=time();
    $out='<section class="dn-submit" id="request"><p class="dn-eyebrow">SHARE INFORMATION</p><h2>手話カフェ情報を教えてください</h2><p>Deaf-Naviに掲載されていない手話カフェや、閉店・移転・営業時間変更などの情報がありましたらお知らせください。</p><p>送信内容は確認中として保存され、管理者の確認・承認後に掲載します。投稿者名・連絡先は公開しません。通知メールの設定状況にかかわらず、管理画面で受け付けます。</p><details'.($values?' open':'').'><summary class="dn-cta">手話カフェ情報を送る</summary><form action="/submit/" method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="submit"><div class="dn-honey" aria-hidden="true"><label>この欄には入力しないでください<input name="website_confirm" tabindex="-1" autocomplete="off"></label></div><div class="dn-form-grid">';
    $out.=select_field('category','提供する情報',['cafe'=>'手話カフェ情報','starbucks'=>'スターバックス開催情報','correction'=>'既存情報の修正','closure'=>'閉店・中止情報','other'=>'その他'],$values['category']??'cafe');
    $out.=select_field('report_type','情報種別',REPORT_TYPES,$values['report_type']??'new');
    foreach(['name'=>'店舗・活動名','country_code'=>'国コード（日本はJP）','prefecture'=>'都道府県・州','city'=>'市区町村または所在地','address'=>'住所','official_url'=>'公式HP','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook','event_schedule'=>'営業曜日・開催曜日','business_hours'=>'営業時間','description'=>'店舗の特徴','source_url'=>'情報元URL','notes'=>'補足','submitter'=>'名前・ニックネーム（非公開・任意）','email'=>'連絡先メール（非公開・任意）'] as $k=>$label) $out.=field($k,$label,$values[$k]??($k==='country_code'?'JP':''),in_array($k,['description','notes'])?'textarea':($k==='email'?'email':(str_ends_with($k,'_url')?'url':'text')),in_array($k,['name','country_code','prefecture','city']));
    return $out.'</div><label class="dn-check"><input type="checkbox" name="consent" value="1" required> 内容確認のための保存と管理者への通知に同意します。第三者の非公開の個人情報は記載しません。</label><p class="dn-muted">任意の連絡先は確認連絡のみに使用し、確認完了後の保管期間は最長1年を目安に管理者が削除します。情報提供は店舗への予約にはなりません。</p><button>確認待ちとして送信する</button></form></details></section>';
}
function cafe_list(): string {
    $all=array_values(array_filter(visible_records(),fn($p)=>$p['kind']==='cafe'||($p['kind']==='store'&&($p['signing_store']??false)))); $list=filtered($all);
    $body=tabs().'<section class="dn-intro"><p class="dn-eyebrow">SIGN LANGUAGE / CAFE DIRECTORY</p><h2>手話でつながる場所を、探そう。</h2><p>手話・ろう文化・筆談での交流を継続して行う店舗や活動を掲載しています。常設・限定営業・定期開催・特殊の4分類で案内し、単発イベントは含みません。正式なサイニングストアは「特殊」として掲載します。</p><a href="#request">情報を提供する ↓</a></section>'.filters($all).'<p class="dn-result">該当 <strong>'.count($list).'</strong>件 <span>情報源を確認して掲載しています</span></p><div class="dn-grid">';
    foreach($list as $p) $body.=cafe_card($p);
    if(!$list) $body.='<p class="dn-empty">条件に一致する掲載情報はありません。検索条件を変更してください。</p>';
    return page('全国の手話カフェ一覧｜常設・定期開催・サイニングストア',$body.'</div>'.submission_form(),'/connect/sign-cafe/','全国の手話カフェ、ろう者が運営するカフェ、手話・筆談で交流できる店舗、定期開催の手話カフェ、サイニングストアなどを地域別に紹介します。');
}
function event_state(array $p): string {
    $status=$p['status'];
    if(in_array($status,['scheduled','ongoing'],true) && !empty($p['event_date']) && $p['event_date']<(new DateTimeImmutable('now',new DateTimeZone($p['timezone']?:'Asia/Tokyo')))->format('Y-m-d')) return 'ended';
    return $status;
}
function event_card(array $p,array $store): string {
    return '<article class="dn-card"><span class="dn-badge">'.e(EVENT_STATUSES[event_state($p)]).'</span><h3><a href="'.e(record_path($p)).'">'.e($p['name']).'</a></h3><p>'.e($store['name'].' / '.$store['prefecture'].' '.$store['city']).'</p><p>'.e(($p['event_date']?:'日程未確認').' '.($p['start_time']??'').' '.($p['event_schedule']??'')).'</p><p>'.nl2br(e($p['description']??'')).'</p><p>情報の確度：'.e(CONFIDENCE[$p['confidence']??'unverified']).'</p>'.sources_html($p).'</article>';
}
function disclaimer(): string { return '<aside class="dn-disclaimer">本ページはDeaf Naviによる非公式の情報ページです。スターバックス コーヒー ジャパン株式会社が運営・監修するものではありません。開催状況や参加方法は、掲載している情報源または各店舗・主催者へご確認ください。</aside>'; }
function starbucks_list(): string {
    $all=visible_records();$stores=[];$events=[];
    foreach($all as $p) if($p['kind']==='store') $stores[$p['id']]=$p;
    foreach($all as $p) if($p['kind']==='event'&&isset($stores[$p['store_id']])) $events[]=$p;
    usort($events,fn($a,$b)=>strcmp($a['event_date']??'',$b['event_date']??''));
    $pref=input($_GET,'prefecture',100); $selected=input($_GET,'store',64);
    $events=array_values(array_filter($events,fn($p)=>($pref===''||$stores[$p['store_id']]['prefecture']===$pref)&&($selected===''||$p['store_id']===$selected)));
    $body=tabs(true).'<p class="dn-lead">全国のスターバックス店舗で実施される手話カフェや手話関連企画の情報を、公開情報および情報提供をもとに掲載しています。</p>'.disclaimer();
    foreach(['開催予定'=>['scheduled','ongoing'],'定期開催・常設的な取り組み'=>['recurring']] as $heading=>$states) {
        $body.='<section class="dn-section"><h2>'.$heading.'</h2><div class="dn-grid">';$count=0;
        foreach($events as $p) if(in_array(event_state($p),$states,true)) { $body.=event_card($p,$stores[$p['store_id']]);$count++; }
        if($heading==='定期開催・常設的な取り組み') foreach($stores as $s) if(($s['signing_store']??false)&&($pref===''||$s['prefecture']===$pref)&&($selected===''||$s['id']===$selected)) {$body.=cafe_card($s);$count++;}
        if(!$count) $body.='<p class="dn-empty">'.($heading==='開催予定'?'現在確認できている開催予定はありません。':'現在掲載している確認済み情報はありません。').'</p>';
        $body.='</div></section>';
    }
    $prefs=[];$opts=[];foreach($stores as $s){$prefs[$s['prefecture']]=$s['prefecture'];$opts[$s['id']]=$s['name'];}
    $body.='<section class="dn-section"><h2>地域・都道府県から探す</h2><form class="dn-filter" method="get">'.select_field('prefecture','都道府県・州',[''=>'すべて']+$prefs,$pref).select_field('store','店舗',[''=>'すべての店舗']+$opts,$selected).'<button>絞り込む</button></form></section><section class="dn-section"><h2>過去の開催履歴</h2><div class="dn-grid">';$count=0;
    foreach(array_reverse($events) as $p) if(in_array(event_state($p),['ended','cancelled'],true)) {$body.=event_card($p,$stores[$p['store_id']]);$count++;}
    if(!$count)$body.='<p>現在掲載している開催履歴はありません。</p>';
    $body.='</div></section><section class="dn-section"><h2>情報提供</h2><a class="dn-cta" href="/submit/?category=starbucks">スターバックス開催情報を送る</a></section><section class="dn-section"><h2>このページについて</h2><p>開催情報と店舗情報を分け、確認した情報源・確認日・情報の確度を表示します。参加予定登録機能は現在提供していません。申込方法は各情報源をご確認ください。</p></section>';
    return page('スターバックスの手話カフェ・手話イベント情報',$body,'/connect/sign-cafe/starbucks/','スターバックスの手話カフェ・手話関連企画、サイニングストアと開催履歴。');
}
function detail(string $slug,bool $event): string {
    $r=query('SELECT * FROM records WHERE slug=? AND '.($event?"kind='event'":"kind IN ('cafe','store')"),[$slug])->fetch();
    if(!$r || !publicly_visible($p=expanded($r))) fail('情報が見つかりません。',404);
    $body=tabs($event).'<p><a href="'.($event?'/connect/sign-cafe/starbucks/':'/connect/sign-cafe/').'">← 一覧へ</a></p>';$schema=[];
    $store=$event?expanded(record($p['store_id'])):$p;
    if($event&&!publicly_visible($store)) fail('情報が見つかりません。',404);
    $body.=$event?event_card($p,$store):cafe_card($p);
    $body.='<dl class="dn-detail">';
    foreach(record_fields($p['kind']) as $k=>$label) {
        if(in_array($k,['name','internal_note','verification_sources','subtypes'])||!isset($p[$k])||$p[$k]===''||$p[$k]===null) continue;
        $body.='<dt>'.e($label).'</dt><dd>'.(str_ends_with($k,'_url')?ext_link($p[$k],$label):nl2br(e($p[$k]))).'</dd>';
    }
    $body.='</dl>';
    if($event) $body.='<h2>開催店舗</h2><p>'.e($store['name'].' / '.$store['address']).'</p>'.disclaimer();
    if(!$event && $p['kind']==='store') {
        $body.='<h2>この店舗の開催履歴</h2>';
        foreach(visible_records() as $ev) if($ev['kind']==='event'&&$ev['store_id']===$p['id']) $body.=event_card($ev,$p);
        $body.=disclaimer();
    }
    if(!$event&&$p['status']==='open'&&$p['type']!=='recurring'&&!empty($p['address'])) $schema[]=['@context'=>'https://schema.org','@type'=>$p['type']==='permanent'?'CafeOrCoffeeShop':'Place','name'=>$p['name'],'url'=>BASE.record_path($p),'address'=>['@type'=>'PostalAddress','streetAddress'=>$p['address'],'addressLocality'=>$p['city'],'addressRegion'=>$p['prefecture'],'addressCountry'=>$p['country_code']]];
    if($event && in_array($p['confidence']??'',['official','organizer','store'],true) && $p['event_date'] && $p['start_time'] && $p['timezone'] && !empty($store['address']) && in_array(event_state($p),['scheduled','ongoing','ended','cancelled'],true)) {
        $schema[]=['@context'=>'https://schema.org','@type'=>'Event','name'=>$p['name'],'url'=>BASE.record_path($p),'startDate'=>(new DateTimeImmutable($p['event_date'].'T'.$p['start_time'],new DateTimeZone($p['timezone'])))->format('c'),'eventStatus'=>'https://schema.org/'.(event_state($p)==='cancelled'?'EventCancelled':'EventScheduled'),'location'=>['@type'=>'Place','name'=>$store['name'],'address'=>['@type'=>'PostalAddress','streetAddress'=>$store['address'],'addressCountry'=>$store['country_code']]]];
    }
    $body.='<p><a href="/submit/?category=correction">この情報の修正を知らせる</a></p>';
    return page($p['name'],$body,record_path($p),$p['description']??'',$schema);
}
