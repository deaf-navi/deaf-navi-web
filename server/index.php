<?php
declare(strict_types=1);
require __DIR__.'/access-visitors.php';
require_once __DIR__.'/access-engagement.php';
if (parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)==='/_access/visit' && ($_GET['kind']??'')==='engagement') engagement_endpoint();
if (parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)==='/_access/visit') access_visit_endpoint();
require __DIR__.'/core.php';
require __DIR__.'/views.php';
require __DIR__.'/public-profile.php';
require __DIR__.'/admin.php';
require __DIR__.'/admin-dashboard.php';
require __DIR__.'/access-logs.php';
require __DIR__.'/ui-links.php';
require __DIR__.'/starbucks-community.php';
require __DIR__.'/cafe-regions.php';
require __DIR__.'/stories.php';
require __DIR__.'/event-tip-review.php';
require __DIR__.'/app-directory.php';

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
ini_set('display_errors','0');
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';
// Only the three public lists may load these exact reviewed image URLs.
// Admin, forms, detail pages and network/script permissions stay unchanged.
if(in_array($path,['/connect/sign-cafe/','/connect/sign-cafe/overseas/','/connect/sign-cafe/events/'],true)){
    // A literal comma separates CSP policies; URL-encode it in image paths.
    $imageSources=str_replace(',','%2C',implode(' ',array_unique(array_column(cafe_thumbnail_entries(),'url'))));
    $mapImages=$path==='/connect/sign-cafe/overseas/'?' data: https://tile.openstreetmap.org':'';
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' ".$imageSources.$mapImages."; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
}
try {
    if($path==='/connect/sign-cafe/app-v1.json')app_directory_endpoint();
    if($path==='/connect/sign-cafe/events/data.json')domestic_cafe_events_endpoint();
    if(($path==='/stories'||str_starts_with($path,'/stories/'))||$path==='/admin/stories/'){
        if((int)($_SERVER['CONTENT_LENGTH']??0)>8388608)fail('送信内容が大きすぎます。',413);
        if(stories_dispatch($path))exit;
    }
    if(in_array($path,['/connect/sign-cafe/starbucks','/connect/sign-cafe/starbucks/','/connect/sign-cafe/starbucks/index.html'],true)){
        http_response_code(410);header('X-Robots-Tag: noindex, follow');
        echo page('このページの掲載は終了しました','<p>スターバックス専用ページの掲載は終了しました。</p><p><a href="/connect/sign-cafe/">手話カフェ一覧へ</a></p>',$path,'',[],true);exit;
    }
    // The retired domestic map has an equivalent browse destination, not a new map.
    if(in_array($path,['/connect/sign-cafe/map','/connect/sign-cafe/map/','/connect/sign-cafe/map/index.html'],true)){
        if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true))fail('この操作は利用できません。',405);
        $marker=$_GET['dn_client']??null;
        header('Location: /connect/sign-cafe/'.(in_array($marker,['codex','automation'],true)?'?dn_client='.$marker:''),true,301);exit;
    }
    if($path==='/connect/sign-cafe/map/data.json'){
        http_response_code(410);header('Content-Type: application/json; charset=UTF-8');header('X-Robots-Tag: noindex');
        echo json(['error'=>'map-retired','browseUrl'=>'/connect/sign-cafe/']);exit;
    }
    if(str_ends_with($path,'/index.html') && preg_match('#^/(admin/|submit/|connect/sign-cafe/)#',$path)) {
        header('Location: '.substr($path,0,-10).(empty($_SERVER['QUERY_STRING'])?'':'?'.str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING'])),true,308);exit;
    }
    if((int)($_SERVER['CONTENT_LENGTH']??0)>(($path==='/submit/'&&($_GET['form']??'')==='event')?5242880:65536))fail('送信内容が大きすぎます。',413);
    if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD','POST'],true))fail('この操作は利用できません。',405);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        if($path==='/admin/') {
            admin_action();
            $marker=$_GET['dn_client']??null;
            header('Location: /admin/'.(in_array($marker,['codex','automation'],true)?'?dn_client='.$marker:''),true,303);exit;
        }
        if($path!=='/submit/')fail('情報が見つかりません。',404);
        check_csrf();rate_limit('submit',5,3600);
        if(input($_POST,'website_confirm',500)!=='' || time()-($_SESSION['form_issued']??time())<3)fail('フォームを確認してから送信してください。');
        if(input($_POST,'consent',1)!=='1')fail('保存と通知への同意が必要です。');
        if(input($_POST,'form_kind',20)==='event_tip')$p=event_tip_submission($_POST);
        elseif(input($_POST,'form_kind',20)==='cafe_contact')$p=cafe_contact_submission($_POST);
        elseif(input($_POST,'form_kind',20)==='starbucks')$p=starbucks_submission($_POST);
        else {
        $p=[];
        foreach(['name','country_code','country_name','prefecture','city','address','official_url','instagram_url','x_url','facebook_url','event_schedule','business_hours','description','source_url','notes','submitter','email'] as $k){$p[$k]=input($_POST,$k,in_array($k,['description','notes'])?6000:1000);if(str_ends_with($k,'_url'))$p[$k]=safe_url($p[$k]);}
        foreach(['name','city'] as $k)if($p[$k]===''||strlen($p[$k])>300)fail('店舗名・市区町村を300バイト以内で入力してください。');
        if(!preg_match('/^[A-Z]{2}$/D',$p['country_code']))fail('国コードはJPなどの英大文字2文字です。');
        if($p['email']!==''&&!filter_var($p['email'],FILTER_VALIDATE_EMAIL))fail('連絡先メールアドレスが不正です。');
        $p['category']=choice(input($_POST,'category',20),['cafe'=>1,'starbucks'=>1,'correction'=>1,'closure'=>1,'other'=>1]);
        $p['report_type']=choice(input($_POST,'report_type',20),REPORT_TYPES);
        }
        $p['url_screening']=contact_url_check($p);
        $duplicate=!is_cafe_contact($p)&&(bool)duplicate_records($p);$id=uid();$stamp=now();
        if(is_event_tip($p)){
            if((int)query("SELECT count(*) FROM submissions WHERE created_at>=? AND json_extract(payload,'$.form_kind')='event_tip'",[gmdate('Y-m-d H:i:s',time()-86400)])->fetchColumn()>=100||disk_free_space(data_dir())<1073741824)fail('本日の受付が混み合っています。時間をおいてお試しください。',503);
            $p['photos']=event_tip_uploads($id,$_FILES['event_photos']??[]);
            if(!$p['photos']&&$p['source_url']===''&&$p['description']==='')fail('告知URL・写真・内容のいずれかを添えてください。');
        }
        db()->exec('BEGIN IMMEDIATE');
        try {
            query('INSERT INTO submissions(id,payload,created_at,updated_at) VALUES(?,?,?,?)',[$id,json($p),$stamp,$stamp]);
            query('INSERT INTO outbox(submission_id,updated_at) VALUES(?,?)',[$id,$stamp]);db()->exec('COMMIT');
        }catch(Throwable $ex){db()->exec('ROLLBACK');if(is_event_tip($p))event_tip_cleanup_photos($id);throw $ex;}
        $_SESSION['csrf']=uid();$_SESSION['receipt']=true;$_SESSION['contact_receipt']=is_cafe_contact($p);$_SESSION['duplicate_notice']=$duplicate;unset($_SESSION['form_issued']);
        header('Location: /submit/?received=1',true,303);exit;
    }
    if($path==='/admin' || $path==='/submit' || $path==='/connect/sign-cafe' || $path==='/connect/sign-cafe/starbucks' || $path==='/connect/sign-cafe/overseas' || $path==='/connect/sign-cafe/events') {header('Location: '.$path.'/'.(empty($_SERVER['QUERY_STRING'])?'':'?'.str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING'])),true,308);exit;}
    if($path==='/admin/'&&($_GET['view']??'')==='event-photo')event_tip_photo();
    if($path==='/admin/') {header('X-Robots-Tag: noindex, nofollow');echo admin_page();}
    elseif($path==='/submit/') {
        start_session();$body='';
        if(isset($_GET['received']) && !empty($_SESSION['receipt'])) {
            $body='<div class="dn-notice" role="status"><h2>情報提供を受け付けました</h2><p>確認中として保存しました。管理者が内容を確認します。公開やメール通知の完了を意味するものではありません。</p>'.(!empty($_SESSION['duplicate_notice'])?'<p>すでに掲載されている可能性があります。修正・移転・閉店のご報告としても管理者が確認します。</p>':'').'</div>';
            if(!empty($_SESSION['contact_receipt']))$body='<div class="dn-notice" role="status"><h2>お問い合わせを受け付けました</h2><p>管理者が内容を確認し、対応いたします。お問い合わせ内容とご連絡先は公開されません。</p></div>';
            unset($_SESSION['receipt'],$_SESSION['duplicate_notice'],$_SESSION['contact_receipt']);
        } else {
            $values=['category'=>input($_GET,'category',20)?:'cafe']+(input($_GET,'scope',20)==='overseas'?['country_code'=>'']:[]);
            $rid=input($_GET,'record',64);if($rid!==''){ $place=expanded(record($rid));if(!publicly_visible($place))fail('情報が見つかりません。',404);foreach(['name','country_code','country_name','prefecture','city','address','official_url','instagram_url'] as $key)$values[$key]=$place[$key]??'';$values['notes']='対象ページ: '.BASE.record_path($place);$values['report_type']='other';}
            $body=input($_GET,'form',20)==='event'?event_tip_form():(input($_GET,'form',20)==='contact'?cafe_contact_form(input($_GET,'scope',20)==='overseas',true,input($_GET,'scope',20)==='site'):(input($_GET,'category',20)==='starbucks'?starbucks_form(input($_GET,'store',64)):submission_form($values)));
        }
        echo page(input($_GET,'form',20)==='contact'?'お問い合わせ':'情報提供',$body,'/submit/','情報提供・お問い合わせ。内容の確認後に対応します。',[],true,['siteContact'=>input($_GET,'form',20)==='contact'&&input($_GET,'scope',20)==='site']);
    } elseif($path==='/connect/sign-cafe/') {
        if(input($_GET,'events',1)==='1'||input($_GET,'shop_type',40)==='event'){
            $params=[];foreach(['q'=>200,'region'=>40,'prefecture'=>100,'dn_client'=>20] as $key=>$limit){$value=input($_GET,$key,$limit);if($value!=='')$params[$key]=$value;}
            header('Location: /connect/sign-cafe/events/'.($params?'?'.http_build_query($params):''),true,302);
        }else echo cafe_list();
    }
    elseif(preg_match('#^/connect/sign-cafe/area/([a-z-]+)$#D',$path,$m)){header('Location: '.$path.'/'.(empty($_SERVER['QUERY_STRING'])?'':'?'.str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING'])),true,308);exit;}
    elseif(preg_match('#^/connect/sign-cafe/area/([a-z-]+)/$#D',$path,$m))echo cafe_region_page($m[1]);
    elseif($path==='/connect/sign-cafe/events/')echo cafe_events_page();
    elseif($path==='/connect/sign-cafe/overseas/map.json'){header('Content-Type: application/json; charset=UTF-8');echo json(world_map_data());}
    elseif($path==='/connect/sign-cafe/overseas/')echo cafe_list(true);
    elseif(preg_match('#^/connect/sign-cafe/(starbucks/)?([a-z0-9-]+)/$#D',$path,$m))echo detail($m[2],$m[1]!=='');
    elseif($path==='/directory-sitemap.xml') {
        header('Content-Type: application/xml; charset=UTF-8');
        $all=visible_records();$stores=[];foreach($all as $p)if($p['kind']==='store')$stores[$p['id']]=true;
        echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        echo '<url><loc>'.BASE.'/connect/sign-cafe/</loc></url><url><loc>'.BASE.'/connect/sign-cafe/overseas/</loc></url><url><loc>'.BASE.'/connect/sign-cafe/events/</loc></url>';
        foreach($all as $p){
            if($p['kind']==='event'&&!isset($stores[$p['store_id']]))continue;
            // Match detail() robots: retain the page, but do not submit noindex events.
            if(($p['kind']==='event'||($p['shop_type']??'')==='event')&&cafe_event_period($p)==='unconfirmed')continue;
            echo '<url><loc>'.e(BASE.record_path($p)).'</loc><lastmod>'.e(substr($p['updated_at'],0,10)).'</lastmod></url>';
        }
        foreach(CAFE_REGION_PAGES as $slug=>$pref){foreach($all as $p)if($p['country_code']==='JP'&&($p['kind']==='cafe'||($p['kind']==='store'&&!empty($p['signing_store'])))&&domestic_matches($p,['prefecture'=>$pref])){echo '<url><loc>'.BASE.'/connect/sign-cafe/area/'.$slug.'/</loc></url>';break;}}
        echo '</urlset>';
    } else fail('情報が見つかりません。',404);
} catch(DomainException $ex) {
    http_response_code($ex->getCode()?:400);
    if($path==='/submit/'&&($_GET['form']??'')==='event'&&($_SERVER['REQUEST_METHOD']??'')==='POST'&&$ex->getCode()!==403){echo page('イベント情報を送る',event_tip_form($_POST,$ex->getMessage()),'/submit/','',[],true);exit;}
    echo page('入力・操作を確認してください','<div class="dn-error" role="alert">'.e($ex->getMessage()).'</div><p>戻る操作で入力内容を確認してください。競合がある場合は画面を再読み込みしてください。</p><p><a href="'.(str_starts_with($path,'/admin')?'/admin/':'/connect/sign-cafe/').'">画面へ戻る</a></p>',$path,'',[],true);
} catch(Throwable $ex) {
    // Do not log payloads, SQL values, mail addresses, passwords or exception messages.
    error_log('Deaf Navi directory error: '.get_class($ex));
    http_response_code(503);
    echo page('一時的に利用できません','<p class="dn-error">時間をおいて再度お試しください。連続して送信せず、管理者へ状況をご確認ください。</p>',$path,'',[],true);
}
