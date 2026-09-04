<?php
declare(strict_types=1);
function admin_nav(): string { return '<nav class="dn-admin-nav"><a href="/admin/">概要・投稿確認</a><a href="/admin/?view=records&kind=cafe">手話カフェ</a><a href="/admin/?view=records&kind=store">スターバックス店舗</a><a href="/admin/?view=records&kind=event">スターバックス開催情報</a><a href="/admin/?view=password">パスワード変更</a><a href="/admin/?view=users">ID管理</a><a href="/admin/?view=settings">通知設定</a></nav><form method="post">'.csrf().'<input type="hidden" name="action" value="logout"><button class="secondary">ログアウト</button></form>'; }
function admin_page(): string {
    $user=current_user();
    if(!$user) return page('管理画面にログイン','<section class="dn-login"><p>Deaf Navi Webの管理者専用画面です。</p><form method="post">'.csrf().'<input type="hidden" name="action" value="login">'.field('username','ログインID','','text',true).field('password','パスワード','','password',true).'<button>ログイン</button></form></section>','/admin/','管理者専用',[],true);
    $body=admin_nav();
    if(isset($_SESSION['flash'])) {$body.='<p class="dn-notice" role="status">'.e($_SESSION['flash']).'</p>';unset($_SESSION['flash']);}
    $view=input($_GET,'view',30)?:'dashboard';
    if($user['must_change']) { $view='password';$body.='<p class="dn-error">初期パスワードを変更してください。変更が完了するまで他の管理操作は利用できません。</p>'; }
    if($view==='password') {
        $body.='<h2>パスワード変更</h2><p>12〜128バイトの、他で使っていないパスワードを設定してください。変更後は他の端末のログインも無効になります。</p><form method="post" class="dn-login">'.csrf().'<input type="hidden" name="action" value="password">'.field('current_password','現在のパスワード','','password',true).field('new_password','新しいパスワード','','password',true).field('confirm_password','新しいパスワード（確認）','','password',true).'<button>パスワードを変更</button></form>';
    } elseif($view==='users') {
        require_user(true);$body.='<h2>ログインIDの管理</h2><p>管理者はID作成・通知設定が可能です。編集者は掲載情報の編集と投稿の確認が可能です。新しいIDは初回ログイン時にパスワード変更が必要です。</p><div class="dn-admin-list">';
        foreach(query('SELECT id,username,role,active FROM users ORDER BY id')->fetchAll() as $u) {
            $body.='<div class="dn-admin-row"><span>'.e($u['username']).' / '.($u['role']==='admin'?'管理者':'編集者').' / '.($u['active']?'有効':'停止中').'</span>';
            if($u['id']!==$user['id']) $body.='<form method="post">'.csrf().'<input type="hidden" name="action" value="toggle_user"><input type="hidden" name="id" value="'.e($u['id']).'"><input type="hidden" name="expected_active" value="'.e($u['active']).'"><button class="secondary">'.($u['active']?'このIDを停止':'このIDを有効化').'</button></form>';
            $body.='</div>';
        }
        $body.='</div><h3>IDを作成</h3><form method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="create_user"><div class="dn-form-grid">'.field('username','ID（英数字・ハイフン・アンダースコア、3〜40文字）','','text',true).field('new_password','初期パスワード（12文字以上）','','password',true).select_field('role','権限',['editor'=>'編集者','admin'=>'管理者'],'editor').'</div><p><button>IDを作成</button></p></form>';
    } elseif($view==='settings') {
        require_user(true);$configured=is_file(data_dir().'/mail.php');
        $counts=query('SELECT status,count(*) AS count FROM outbox GROUP BY status')->fetchAll();
        $body.='<h2>情報提供の通知先</h2><p>投稿は通知メールの成否にかかわらず保存されます。送信先メールアドレスは公開されません。</p><p class="dn-notice">メール送信設定：'.($configured?'サーバー設定ファイルあり（到達確認は別途必要）':'未設定 — 投稿は管理画面で確認できます。通知は未送信で保管されます。').'</p><form method="post">'.csrf().'<input type="hidden" name="action" value="settings">'.field('notification_email','転送先メールアドレス',setting('notification_email'),'email').'<p><button>通知先を保存</button></p></form><h3>通知状況</h3><ul>';
        foreach($counts as $c)$body.='<li>'.e(['pending'=>'未送信','sending'=>'送信処理中','sent'=>'メールサーバー受付済み','failed'=>'送信失敗','uncertain'=>'結果不明・再送前に確認'][$c['status']]??$c['status']).'：'.(int)$c['count'].'件</li>';
        $body.='</ul><p>送信先・送信方式の設定後、未送信通知は送信処理で処理されます。結果不明の通知は自動再送しません。</p>';
        foreach(query("SELECT id,status FROM outbox WHERE status IN ('failed','uncertain') ORDER BY id DESC LIMIT 50")->fetchAll() as $mail) {
            $body.='<form method="post" class="dn-notice">'.csrf().'<input type="hidden" name="action" value="retry_mail"><input type="hidden" name="id" value="'.(int)$mail['id'].'"><p>通知 #'.(int)$mail['id'].'：'.($mail['status']==='uncertain'?'送達結果不明':'送信失敗').'</p><label><input type="checkbox" name="confirm" value="1" required> 設定と受信状況を確認し、重複送信の可能性を理解しました。</label><p><button class="secondary">この通知を再送待ちに戻す</button></p></form>';
        }
    } elseif($view==='records') {
        $kind=choice(input($_GET,'kind',10),['cafe'=>1,'store'=>1,'event'=>1]);
        $body.='<h2>'.e(['cafe'=>'手話カフェ','store'=>'スターバックス店舗','event'=>'スターバックス開催情報'][$kind]).'</h2><a class="dn-cta" href="/admin/?view=edit&kind='.$kind.'">新しく追加</a><div class="dn-admin-list">';
        $pg=max(1,(int)input($_GET,'page',8));$rows=query('SELECT * FROM records WHERE kind=? ORDER BY updated_at DESC LIMIT 51 OFFSET ?',[$kind,($pg-1)*50])->fetchAll();$more=count($rows)>50;
        foreach(array_slice($rows,0,50) as $r) $body.='<article class="dn-admin-row"><div><strong>'.e($r['name']).'</strong><small>'.e($r['prefecture'].' '.$r['city'].' / '.PUBLICATIONS[$r['publication']]).'</small></div><a href="/admin/?view=edit&kind='.$kind.'&id='.e($r['id']).'">確認・編集</a></article>';
        if(!$rows)$body.='<p>まだ登録情報はありません。</p>';
        $body.='</div>'.pagination($pg,$more,'view=records&kind='.$kind);
    } elseif($view==='edit') {
        $kind=choice(input($_GET,'kind',10),['cafe'=>1,'store'=>1,'event'=>1]);$id=input($_GET,'id',64);
        $p=$id?expanded(record($id)):['country_code'=>'JP','country_name'=>'日本','timezone'=>'Asia/Tokyo','publication'=>'pending','type'=>'permanent','verification_level'=>'pending'];
        if($id && $p['kind']!==$kind) fail('情報の種別が一致しません。');
        $submission=input($_GET,'submission',64);$sub=null;
        if($submission) {
            $sub=query('SELECT * FROM submissions WHERE id=?',[$submission])->fetch();if(!$sub)fail('投稿が見つかりません。',404);
            if(!$id) { $p=array_merge($p,json_decode($sub['payload'],true)); $p['verification_sources']=array_filter([$p['source_url']??'']); $p['slug']='cafe-'.substr($submission,0,12); }
            $body.='<p class="dn-notice">投稿内容を確認し、情報源と営業状態を検証してから保存してください。修正報告は既存の店舗を選び、重複を作らずに反映してください。</p>';
            $choices=[''=>'新しい情報として登録'];foreach(query("SELECT id,name FROM records WHERE kind=? AND publication!='deleted'",[$kind])->fetchAll() as $r)$choices[$r['id']]=$r['name'];
            $body.='<form method="get"><input type="hidden" name="view" value="edit"><input type="hidden" name="kind" value="'.e($kind).'"><input type="hidden" name="submission" value="'.e($submission).'">'.select_field('id','反映先の既存情報',$choices,$id).'<button class="secondary">反映先を選択</button></form>';
        }
        $body.='<h2>掲載情報の編集</h2><p>公開・非公開・保留は営業状態と別に管理します。未確認の値は空欄にしてください。削除は履歴を残す非表示処理です。</p><form method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="save_record"><input type="hidden" name="kind" value="'.$kind.'"><input type="hidden" name="id" value="'.e($id).'"><input type="hidden" name="revision" value="'.e($p['revision']??0).'"><input type="hidden" name="submission" value="'.e($submission).'"><input type="hidden" name="submission_revision" value="'.e($sub['revision']??0).'"><div class="dn-form-grid">';
        $body.=field('slug','個別URL名（公開後は原則変更しない）',$p['slug']??'','text',true).select_field('publication','公開状態',PUBLICATIONS,$p['publication']??'pending').select_field('status',$kind==='event'?'開催状態':'営業状態',$kind==='event'?EVENT_STATUSES:STATUSES,$p['status']??($kind==='event'?'date_unknown':'unknown')).select_field('verification_level','情報の確認状況',LEVELS,$p['verification_level']??'pending');
        if($kind!=='event') $body.=select_field('type','分類',TYPES,$p['type']??'permanent');
        if($kind==='store') $body.=select_field('signing_store','正式な常設サイニングストア（一般一覧にも掲載）',['0'=>'いいえ','1'=>'はい'],!empty($p['signing_store'])?'1':'0');
        if($kind==='event') {
            $stores=[];foreach(query("SELECT id,name FROM records WHERE kind='store' AND publication!='deleted'")->fetchAll() as $s)$stores[$s['id']]=$s['name'];
            $body.=select_field('store_id','開催店舗（先に店舗を登録）',$stores,$p['store_id']??'').select_field('confidence','情報の確度',CONFIDENCE,$p['confidence']??'unverified');
        }
        foreach(record_fields($kind) as $k=>$label) {
            $type=in_array($k,['description','internal_note','verification_sources','subtypes','sign_support','event_schedule','business_hours','conditions','application','partners'])?'textarea':(in_array($k,['last_verified_at','event_date','published_at'])?'date':(str_ends_with($k,'_url')?'url':'text'));
            $body.=field($k,$label,$p[$k]??'',$type,$k==='name');
        }
        $body.='</div>';
        if($sub)$body.=select_field('submission_status','投稿の確認結果',['pending'=>'確認中のまま','approved'=>'承認（正式データへ反映）','rejected'=>'不採用'],$sub['status']);
        $body.='<p><button>変更を保存</button></p></form>';
        if($id)$body.='<aside class="dn-danger"><h3>削除・復元について</h3><p>「公開状態」を「削除済み」にして保存すると、公開画面から除外されます。閉店情報は「閉店・活動終了」で残してください。復元は公開状態を変更します。</p></aside>';
    } elseif($view==='submission') {
        $id=input($_GET,'id',64);$s=query('SELECT * FROM submissions WHERE id=?',[$id])->fetch();if(!$s)fail('投稿が見つかりません。',404);$p=json_decode($s['payload'],true);
        $body.='<h2>情報提供の確認</h2><p>状態：'.e($s['status']).' / '.e($s['created_at']).'</p><dl class="dn-detail">';
        $labels=record_fields('cafe')+['category'=>'情報カテゴリ','report_type'=>'情報種別','source_url'=>'情報元URL','notes'=>'補足','submitter'=>'投稿者（非公開）','email'=>'連絡先メール（非公開）'];
        foreach($p as $k=>$v) if(is_string($v)&&$v!=='')$body.='<dt>'.e($labels[$k]??$k).'</dt><dd>'.nl2br(e($v)).'</dd>';
        $body.='</dl><h3>重複候補（名称・住所・公式URL・Instagramで比較）</h3><ul>';
        foreach(duplicate_records($p) as $r)$body.='<li>'.e($r['name']).' — <a href="/admin/?view=edit&kind='.e($r['kind']).'&id='.e($r['id']).'&submission='.e($id).'">この情報に反映</a></li>';
        $body.='</ul><div class="dn-actions"><a class="dn-cta" href="/admin/?view=edit&kind='.($p['category']==='starbucks'?'event':'cafe').'&submission='.e($id).'">確認して正式データへ反映</a></div><form method="post">'.csrf().'<input type="hidden" name="action" value="review"><input type="hidden" name="id" value="'.e($id).'"><input type="hidden" name="revision" value="'.(int)$s['revision'].'">'.select_field('status','投稿状態',['pending'=>'確認中','rejected'=>'不採用'],$s['status']).'<button class="secondary">投稿状態のみ変更</button></form><form method="post" class="dn-danger">'.csrf().'<input type="hidden" name="action" value="redact_submission"><input type="hidden" name="id" value="'.e($id).'"><input type="hidden" name="revision" value="'.(int)$s['revision'].'"><label><input type="checkbox" name="confirm" value="1" required> 投稿者名・メール・補足を削除します（元に戻せません）</label><p><button class="secondary">投稿者情報を削除</button></p></form>';
    } else {
        $pending=(int)query("SELECT count(*) FROM submissions WHERE status='pending'")->fetchColumn();
        $body.='<h2>情報提供・承認待ち</h2><p class="dn-notice">未確認の投稿：<strong class="dn-alert-count">'.$pending.'件</strong>。承認前の投稿は公開一覧に出ません。</p>';
        $pg=max(1,(int)input($_GET,'page',8));$rows=query('SELECT id,status,created_at,payload FROM submissions ORDER BY created_at DESC LIMIT 51 OFFSET ?',[($pg-1)*50])->fetchAll();
        $body.='<div class="dn-admin-list">';foreach(array_slice($rows,0,50) as $s){$p=json_decode($s['payload'],true);$body.='<div class="dn-admin-row"><div>'.e($p['name']).'<small>'.e(['pending'=>'確認中','approved'=>'承認済み','rejected'=>'不採用'][$s['status']].' / '.$s['created_at']).'</small></div><a href="/admin/?view=submission&id='.e($s['id']).'">内容を確認</a></div>';}
        if(!$rows)$body.='<p>まだ情報提供はありません。</p>';$body.='</div>'.pagination($pg,count($rows)>50,'view=dashboard');
        $body.='<h2>最近の管理操作</h2><ul>';foreach(query('SELECT action,created_at FROM audit ORDER BY id DESC LIMIT 12')->fetchAll() as $a)$body.='<li>'.e($a['created_at'].' / '.$a['action']).'</li>';$body.='</ul>';
    }
    return page('Deaf Navi Web 管理画面',$body,'/admin/','管理者専用',[],true);
}
function pagination(int $p,bool $more,string $query): string { return '<nav class="dn-pagination" aria-label="ページ切替">'.($p>1?'<a href="?'.e($query).'&page='.($p-1).'">前の50件</a>':'').($more?'<a href="?'.e($query).'&page='.($p+1).'">次の50件</a>':'').'</nav>'; }
function admin_action(): void {
    check_csrf(); $action=input($_POST,'action',40);
    if($action==='login') {
        rate_limit('login',10,900);
        $username=input($_POST,'username',100);$password=input($_POST,'password',256);
        $u=query('SELECT * FROM users WHERE username=? AND active=1',[$username])->fetch();
        $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        if(!password_verify($password,$u['password_hash']??$dummy)||!$u)fail('IDまたはパスワードが正しくありません。',401);
        session_regenerate_id(true);$_SESSION=['csrf'=>uid(),'user_id'=>$u['id'],'version'=>$u['version'],'issued'=>time(),'last_active'=>time()];audit('login');return;
    }
    $u=require_user();
    if($action==='logout') { audit('logout');$_SESSION=[];session_destroy();return; }
    if($action==='password') {
        rate_limit('password',10,900);$old=input($_POST,'current_password',256);$new=input($_POST,'new_password',256);password_valid($new);
        if(!password_verify($old,$u['password_hash']))fail('現在のパスワードが正しくありません。',403);
        if($new!==input($_POST,'confirm_password',256)||$new===$old)fail('確認入力が一致しないか、現在と同じパスワードです。');
        query('UPDATE users SET password_hash=?,must_change=0,version=version+1 WHERE id=?',[password_hash($new,PASSWORD_DEFAULT),$u['id']]);
        session_regenerate_id(true);$_SESSION['version']=$u['version']+1;$_SESSION['csrf']=uid();audit('password_changed');$_SESSION['flash']='パスワードを変更しました。';return;
    }
    if($u['must_change'])fail('最初にパスワードを変更してください。',403);
    if($action==='create_user') {
        require_user(true);rate_limit('create_user',10,3600);$name=input($_POST,'username',40);$pw=input($_POST,'new_password',256);password_valid($pw);
        if(!preg_match('/^[a-zA-Z0-9_-]{3,40}$/D',$name))fail('IDの形式が不正です。');$role=choice(input($_POST,'role',10),['admin'=>1,'editor'=>1]);
        if(query('SELECT id FROM users WHERE username=?',[$name])->fetch())fail('このIDは既に使われています。');
        query('INSERT INTO users(username,password_hash,role,created_at) VALUES(?,?,?,?)',[$name,password_hash($pw,PASSWORD_DEFAULT),$role,now()]);audit('user_created');
    } elseif($action==='toggle_user') {
        require_user(true);$id=(int)input($_POST,'id',20);$expected=(int)input($_POST,'expected_active',1);if($id===$u['id'])fail('自分自身は停止できません。');
        $s=query('UPDATE users SET active=1-active,version=version+1 WHERE id=? AND active=?',[$id,$expected]);if($s->rowCount()!==1)fail('状態が変更されています。再読み込みしてください。',409);audit('user_toggled',(string)$id);
    } elseif($action==='settings') {
        require_user(true);$email=input($_POST,'notification_email',254);if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))fail('メールアドレスが不正です。');
        query('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',['notification_email',$email]);audit('notification_destination_changed');
    } elseif($action==='retry_mail') {
        require_user(true);if(input($_POST,'confirm',1)!=='1')fail('再送の確認が必要です。');
        $id=(int)input($_POST,'id',20);$s=query("UPDATE outbox SET status='pending',last_error=NULL,updated_at=? WHERE id=? AND status IN ('failed','uncertain')",[now(),$id]);if($s->rowCount()!==1)fail('通知状態が変わりました。再読み込みしてください。',409);audit('mail_retry_requested',(string)$id);
    } elseif($action==='save_record') {
        $kind=choice(input($_POST,'kind',10),['cafe'=>1,'store'=>1,'event'=>1]);$p=validated_record($_POST,$kind);$id=input($_POST,'id',64);$rev=(int)input($_POST,'revision',10);
        if(($id==='')!==($rev===0))fail('編集対象が不正です。');
        if($id && record($id)['slug']!==$p['slug'])fail('既存URLの変更は転送設定が必要なため、管理画面では変更できません。');
        $sid=input($_POST,'submission',64);$sr=(int)input($_POST,'submission_revision',10);$state=$sid?choice(input($_POST,'submission_status',20),['pending'=>1,'approved'=>1,'rejected'=>1]):'';
        if($state==='approved' && ($p['verification_level']==='pending'||!$p['verification_sources']||!$p['last_verified_at']))fail('承認前に情報源・確認日・確認状況を設定してください。');
        db()->exec('BEGIN IMMEDIATE');
        try {
            // Existing events cannot silently lose their publicly visible venue.
            if($kind==='store'&&$id&&$p['publication']!=='public') query("UPDATE records SET publication='private',revision=revision+1,updated_at=? WHERE store_id=? AND publication='public'",[now(),$id]);
            $id=save_record($p,$kind,$id,$rev);
            if($sid){$s=query('UPDATE submissions SET status=?,record_id=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',[$state,$id,now(),$sid,$sr]);if($s->rowCount()!==1)fail('投稿が既に変更されています。再読み込みしてください。',409);audit('submission_'.$state,$sid);}
            db()->exec('COMMIT');
        }catch(Throwable $ex){db()->exec('ROLLBACK');throw $ex;}
    } elseif($action==='review') {
        $state=choice(input($_POST,'status',20),['pending'=>1,'rejected'=>1]);$id=input($_POST,'id',64);
        $s=query('UPDATE submissions SET status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',[$state,now(),$id,(int)input($_POST,'revision',10)]);if($s->rowCount()!==1)fail('投稿が既に変更されています。',409);audit('submission_'.$state,$id);
    } elseif($action==='redact_submission') {
        if(input($_POST,'confirm',1)!=='1')fail('削除の確認が必要です。');$id=input($_POST,'id',64);$s=query('SELECT payload FROM submissions WHERE id=?',[$id])->fetch();if(!$s)fail('投稿が見つかりません。',404);$p=json_decode($s['payload'],true);unset($p['email'],$p['submitter'],$p['notes']);
        $s=query('UPDATE submissions SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',[json($p),now(),$id,(int)input($_POST,'revision',10)]);if($s->rowCount()!==1)fail('投稿が既に変更されています。',409);audit('submission_contact_redacted',$id);
    } else fail('不明な操作です。');
    $_SESSION['flash']='保存しました。';
}
