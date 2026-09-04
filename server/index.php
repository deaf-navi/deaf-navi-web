<?php
declare(strict_types=1);
require __DIR__.'/core.php';
require __DIR__.'/views.php';
require __DIR__.'/admin.php';

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
ini_set('display_errors','0');
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';
try {
    if(str_ends_with($path,'/index.html') && preg_match('#^/(admin/|submit/|connect/sign-cafe/)#',$path)) {
        header('Location: '.substr($path,0,-10).(empty($_SERVER['QUERY_STRING'])?'':'?'.str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING'])),true,308);exit;
    }
    if((int)($_SERVER['CONTENT_LENGTH']??0)>65536)fail('送信内容が大きすぎます。',413);
    if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD','POST'],true))fail('この操作は利用できません。',405);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        if($path==='/admin/') { admin_action();header('Location: /admin/',true,303);exit; }
        if($path!=='/submit/')fail('情報が見つかりません。',404);
        check_csrf();rate_limit('submit',5,3600);
        if(input($_POST,'website_confirm',500)!=='' || time()-($_SESSION['form_issued']??time())<3)fail('フォームを確認してから送信してください。');
        if(input($_POST,'consent',1)!=='1')fail('保存と通知への同意が必要です。');
        $p=[];
        foreach(['name','country_code','prefecture','city','address','official_url','instagram_url','x_url','facebook_url','event_schedule','business_hours','description','source_url','notes','submitter','email'] as $k){$p[$k]=input($_POST,$k,in_array($k,['description','notes'])?6000:1000);if(str_ends_with($k,'_url'))$p[$k]=safe_url($p[$k]);}
        foreach(['name','prefecture','city'] as $k)if($p[$k]===''||strlen($p[$k])>300)fail('店舗名・都道府県・市区町村を300バイト以内で入力してください。');
        if(!preg_match('/^[A-Z]{2}$/D',$p['country_code']))fail('国コードはJPなどの英大文字2文字です。');
        if($p['email']!==''&&!filter_var($p['email'],FILTER_VALIDATE_EMAIL))fail('連絡先メールアドレスが不正です。');
        $p['category']=choice(input($_POST,'category',20),['cafe'=>1,'starbucks'=>1,'correction'=>1,'closure'=>1,'other'=>1]);
        $p['report_type']=choice(input($_POST,'report_type',20),REPORT_TYPES);
        $duplicate=(bool)duplicate_records($p);$id=uid();$stamp=now();
        db()->exec('BEGIN IMMEDIATE');
        try {
            query('INSERT INTO submissions(id,payload,created_at,updated_at) VALUES(?,?,?,?)',[$id,json($p),$stamp,$stamp]);
            query('INSERT INTO outbox(submission_id,updated_at) VALUES(?,?)',[$id,$stamp]);db()->exec('COMMIT');
        }catch(Throwable $ex){db()->exec('ROLLBACK');throw $ex;}
        $_SESSION['csrf']=uid();$_SESSION['receipt']=true;$_SESSION['duplicate_notice']=$duplicate;unset($_SESSION['form_issued']);
        header('Location: /submit/?received=1',true,303);exit;
    }
    if($path==='/admin' || $path==='/submit' || $path==='/connect/sign-cafe' || $path==='/connect/sign-cafe/starbucks') {header('Location: '.$path.'/'.(empty($_SERVER['QUERY_STRING'])?'':'?'.str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING'])),true,308);exit;}
    if($path==='/admin/') {header('X-Robots-Tag: noindex, nofollow');echo admin_page();}
    elseif($path==='/submit/') {
        start_session();$body='';
        if(isset($_GET['received']) && !empty($_SESSION['receipt'])) {
            $body='<div class="dn-notice" role="status"><h2>情報提供を受け付けました</h2><p>確認中として保存しました。管理者が内容を確認します。公開やメール通知の完了を意味するものではありません。</p>'.(!empty($_SESSION['duplicate_notice'])?'<p>すでに掲載されている可能性があります。修正・移転・閉店のご報告としても管理者が確認します。</p>':'').'</div>';
            unset($_SESSION['receipt'],$_SESSION['duplicate_notice']);
        } else $body=submission_form(['category'=>input($_GET,'category',20)?:'cafe']);
        echo page('情報提供',$body,'/submit/','手話カフェ・スターバックスの情報提供。管理者の確認後に反映します。',[],true);
    } elseif($path==='/connect/sign-cafe/') echo cafe_list();
    elseif($path==='/connect/sign-cafe/starbucks/')echo starbucks_list();
    elseif(preg_match('#^/connect/sign-cafe/(starbucks/)?([a-z0-9-]+)/$#D',$path,$m))echo detail($m[2],$m[1]!=='');
    elseif($path==='/directory-sitemap.xml') {
        header('Content-Type: application/xml; charset=UTF-8');
        $all=visible_records();$stores=[];foreach($all as $p)if($p['kind']==='store')$stores[$p['id']]=true;
        echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach($all as $p)if($p['kind']!=='event'||isset($stores[$p['store_id']]))echo '<url><loc>'.e(BASE.record_path($p)).'</loc><lastmod>'.e(substr($p['updated_at'],0,10)).'</lastmod></url>';
        echo '</urlset>';
    } else fail('情報が見つかりません。',404);
} catch(DomainException $ex) {
    http_response_code($ex->getCode()?:400);
    echo page('入力・操作を確認してください','<div class="dn-error" role="alert">'.e($ex->getMessage()).'</div><p>戻る操作で入力内容を確認してください。競合がある場合は画面を再読み込みしてください。</p><p><a href="'.(str_starts_with($path,'/admin')?'/admin/':'/connect/sign-cafe/').'">画面へ戻る</a></p>',$path,'',[],true);
} catch(Throwable $ex) {
    // Do not log payloads, SQL values, mail addresses, passwords or exception messages.
    error_log('Deaf Navi directory error: '.get_class($ex));
    http_response_code(503);
    echo page('一時的に利用できません','<p class="dn-error">時間をおいて再度お試しください。連続して送信せず、管理者へ状況をご確認ください。</p>',$path,'',[],true);
}
