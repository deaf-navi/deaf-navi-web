<?php
declare(strict_types=1);
const ADMIN_TITLES=['dashboard'=>'ダッシュボード','records'=>'掲載情報','edit'=>'掲載情報の編集','submissions'=>'情報提供・承認待ち','submission'=>'投稿内容の確認','users'=>'ID・権限管理','user'=>'IDの設定','settings'=>'通知設定','preferences'=>'表示・入力設定','password'=>'パスワード変更','audit'=>'操作履歴'];
function admin_shell(string $body,array $user,string $view):string {
    $kind=input($_GET,'kind',10);$title=ADMIN_TITLES[$view]??'ダッシュボード';if($view==='records')$title=['cafe'=>'手話カフェ一覧','store'=>'スターバックス店舗一覧','event'=>'スターバックス開催情報'][$kind]??$title;
    $items=[['dashboard','','概要'],['records','cafe','手話カフェ'],['records','store','スターバックス店舗'],['records','event','スターバックス開催情報'],['submissions','','情報提供・承認待ち'],['audit','','操作履歴']];
    if($user['role']==='admin')$items=[...$items,['users','','ID・権限管理'],['settings','','通知設定'],['preferences','','表示・入力設定']];
    $items[]=['password','','パスワード変更'];
    $nav='';foreach($items as [$v,$k,$label]){$active=($view===$v||($view==='edit'&&$v==='records')||($view==='submission'&&$v==='submissions')||($view==='user'&&$v==='users'))&&($k===''||$k===$kind);$nav.='<a href="/admin/?'.e(http_build_query(['view'=>$v]+($k?['kind'=>$k]:[]))).'"'.($active?' aria-current="page"':'').'>'.e($label).'</a>';}
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'.e($title).' | Deaf Navi 管理画面</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/directory.css?v=20260905c"><link rel="stylesheet" href="/admin-dashboard.css?v=1"><script src="/directory-safety.js" defer></script><script src="/directory-ui.js?v=20260905c" defer></script></head><body class="dn-directory dn-dashboard"><a class="dn-skip" href="#main">本文へ</a><div class="admin-layout"><aside class="admin-sidebar"><a class="admin-brand" href="/admin/">Deaf Navi<span>管理ダッシュボード</span></a><nav aria-label="管理メニュー">'.$nav.'</nav><div class="admin-sidebar-foot"><span>'.e($user['username']).' / '.($user['role']==='admin'?'管理者':'編集者').'</span><form action="/admin/" method="post">'.csrf().'<input type="hidden" name="action" value="logout"><button class="secondary">ログアウト</button></form></div></aside><div class="admin-workspace"><header class="admin-topbar"><span>CONTENT MANAGEMENT</span><a href="/connect/sign-cafe/" target="_blank" rel="noopener noreferrer">公開サイトを確認</a></header><main id="main"><div class="admin-page-heading"><p>Deaf Navi Web</p><h1>'.e($title).'</h1></div>'.$body.'</main><footer class="admin-footer">公開・非公開と営業・開催状態は別々に管理します。変更は保存ボタンで確定します。</footer></div></div></body></html>';
}
function admin_date(?string $s):string {if(!$s)return '—';try{return (new DateTimeImmutable($s))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y/m/d H:i');}catch(Throwable){return '—';}}
function admin_size():int {$v=(int)input($_GET,'limit',3);if(!in_array($v,[25,50,100],true))$v=(int)(setting('admin_page_size')?:25);return in_array($v,[25,50,100],true)?$v:25;}
function admin_query(array $base,array $extra=[]):string {return '/admin/?'.e(http_build_query(array_replace($base,$extra)));}
function admin_th(string $key,string $label,array $base,string $sort,string $dir):string {return '<th scope="col" aria-sort="'.($sort===$key?($dir==='asc'?'ascending':'descending'):'none').'"><a href="'.admin_query($base,['sort'=>$key,'dir'=>$sort===$key&&$dir==='asc'?'desc':'asc','page'=>1]).'">'.e($label).' <span aria-hidden="true">'.($sort===$key?($dir==='asc'?'▲':'▼'):'↕').'</span></a></th>';}
function admin_pager(int $page,int $total,int $size,array $base):string {$max=max(1,(int)ceil($total/$size));return '<nav class="admin-pagination" aria-label="一覧のページ切替">'.($page>1?'<a href="'.admin_query($base,['page'=>$page-1]).'">前のページ</a>':'').'<span>'.$total.'件 / '.$page.'・'.$max.'ページ</span>'.($page<$max?'<a href="'.admin_query($base,['page'=>$page+1]).'">次のページ</a>':'').'</nav>';}
function admin_table_open(string $label):string{return '<div class="admin-table-scroll" role="region" aria-label="'.e($label).'" tabindex="0"><table class="admin-table"><caption class="dn-visually-hidden">'.e($label).'</caption>';}
function admin_records_table(string $kind):string {
    $q=input($_GET,'q',200);$pub=input($_GET,'publication',20);$state=input($_GET,'status',30);
    $states=$kind==='event'?EVENT_STATUSES:STATUSES;
    if($pub!=='')choice($pub,PUBLICATIONS);if($state!=='')choice($state,$states);
    $where=['kind=?'];$args=[$kind];if($q!==''){$where[]="(name LIKE ? ESCAPE '!' OR prefecture LIKE ? ESCAPE '!' OR city LIKE ? ESCAPE '!')";$like='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';$args=[...$args,$like,$like,$like];}
    foreach(['publication'=>$pub,'status'=>$state] as $k=>$v)if($v!==''){$where[]=$k.'=?';$args[]=$v;}
    $sorts=['name'=>'name COLLATE NOCASE','region'=>'country_code,prefecture,city','publication'=>'publication','status'=>'status','updated'=>'updated_at','verified'=>"json_extract(payload,'$.last_verified_at')",'date'=>"json_extract(payload,'$.event_date')"];
    $sort=input($_GET,'sort',20);if(!isset($sorts[$sort]))$sort='updated';$dir=input($_GET,'dir',4)==='asc'?'asc':'desc';$size=admin_size();$page=max(1,min(100000,(int)input($_GET,'page',6)));
    $clause=implode(' AND ',$where);$total=(int)query('SELECT count(*) FROM records WHERE '.$clause,$args)->fetchColumn();$page=min($page,max(1,(int)ceil($total/$size)));
    $order=$sort==='region'?'country_code '.$dir.',prefecture '.$dir.',city '.$dir:$sorts[$sort].' '.$dir;
    $rows=query('SELECT * FROM records WHERE '.$clause.' ORDER BY '.$order.',id ASC LIMIT ? OFFSET ?',[...$args,$size,($page-1)*$size])->fetchAll();
    $base=['view'=>'records','kind'=>$kind,'q'=>$q,'publication'=>$pub,'status'=>$state,'sort'=>$sort,'dir'=>$dir,'limit'=>$size];
    $body='<div class="admin-toolbar"><p>列名で検索結果全体を並べ替えできます。</p><a class="dn-cta" href="/admin/?view=edit&kind='.$kind.'">新しく追加</a></div><form method="get" class="admin-filters"><input type="hidden" name="view" value="records"><input type="hidden" name="kind" value="'.$kind.'"><input type="hidden" name="sort" value="'.$sort.'"><input type="hidden" name="dir" value="'.$dir.'">'.field('q','店舗名・地域で検索',$q).select_field('publication','公開状態',[''=>'すべて']+PUBLICATIONS,$pub).select_field('status',$kind==='event'?'開催状態':'営業状態',[''=>'すべて']+$states,$state).select_field('limit','表示件数',['25'=>'25件','50'=>'50件','100'=>'100件'],(string)$size).'<button>絞り込む</button><a href="/admin/?view=records&kind='.$kind.'">解除</a></form>';
    $body.=admin_pager($page,$total,$size,$base).admin_table_open('掲載情報一覧').'<thead><tr>';
    foreach(['name'=>'名称','region'=>'地域','publication'=>'公開状態','status'=>$kind==='event'?'開催状態':'営業状態',($kind==='event'?'date':'verified')=>$kind==='event'?'開催日':'情報確認日','updated'=>'更新日時'] as $k=>$label)$body.=admin_th($k,$label,$base,$sort,$dir);
    $body.='<th scope="col">操作</th></tr></thead><tbody>';
    foreach($rows as $r){$p=expanded($r);$body.='<tr><th scope="row"><a href="/admin/?view=edit&kind='.$kind.'&id='.e($r['id']).'">'.e($r['name']).'</a>'.($kind==='event'?'<small>'.e(record($r['store_id'])['name']).'</small>':'').'</th><td>'.e($r['prefecture']).'<small>'.e($r['city']).'</small></td><td><span class="admin-status">'.e(PUBLICATIONS[$r['publication']]).'</span></td><td>'.e($states[$r['status']]??$r['status']).'</td><td>'.e(($p[$kind==='event'?'event_date':'last_verified_at']??'')?:'未確認').'</td><td>'.e(admin_date($r['updated_at'])).'</td><td><a href="/admin/?view=edit&kind='.$kind.'&id='.e($r['id']).'">確認・編集</a>'.(publicly_visible($p)?'<a class="admin-secondary-link" href="'.e(record_path($p)).'" target="_blank" rel="noopener noreferrer">公開ページ</a>':'').'</td></tr>';}
    if(!$rows)$body.='<tr><td colspan="7" class="admin-empty">条件に一致する情報はありません。条件を解除するか、新しく追加してください。</td></tr>';
    return $body.'</tbody></table></div>'.admin_pager($page,$total,$size,$base);
}
function admin_submissions_table(bool $preview=false):string {
    $q=$preview?'':input($_GET,'q',200);$state=$preview?'pending':input($_GET,'status',20);if($state!=='')choice($state,['pending'=>1,'approved'=>1,'rejected'=>1]);
    $sorts=['name'=>"json_extract(payload,'$.name')",'status'=>'status','date'=>'created_at'];$sort=$preview?'date':input($_GET,'sort',20);if(!isset($sorts[$sort]))$sort='date';$dir=(!$preview&&input($_GET,'dir',4)==='asc')?'asc':'desc';
    $where=['1=1'];$args=[];if($state!==''){$where[]='status=?';$args[]=$state;}if($q!==''){$where[]="json_extract(payload,'$.name') LIKE ? ESCAPE '!'";$args[]='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';}
    $sql=implode(' AND ',$where);$total=(int)query('SELECT count(*) FROM submissions WHERE '.$sql,$args)->fetchColumn();$size=$preview?8:admin_size();$pg=$preview?1:max(1,min(100000,(int)input($_GET,'page',6)));$pg=min($pg,max(1,(int)ceil($total/$size)));$base=['view'=>'submissions','q'=>$q,'status'=>$state,'sort'=>$sort,'dir'=>$dir,'limit'=>$size];
    $rows=query('SELECT id,payload,status,created_at FROM submissions WHERE '.$sql.' ORDER BY '.$sorts[$sort].' '.$dir.',id LIMIT ? OFFSET ?',[...$args,$size,($pg-1)*$size])->fetchAll();$labels=['pending'=>'確認中','approved'=>'承認済み','rejected'=>'不採用'];
    $body=$preview?'<div class="admin-toolbar"><h2>承認待ちの情報提供</h2><a href="/admin/?view=submissions">すべて確認</a></div>':'<form method="get" class="admin-filters"><input type="hidden" name="view" value="submissions">'.field('q','店舗・企画名',$q).select_field('status','確認状態',[''=>'すべて']+$labels,$state).'<button>絞り込む</button></form>';
    $body.=admin_table_open('情報提供一覧').'<thead><tr>'.admin_th('name','店舗・企画名',$base,$sort,$dir).'<th>種別</th>'.admin_th('status','確認状態',$base,$sort,$dir).admin_th('date','受付日時',$base,$sort,$dir).'<th>操作</th></tr></thead><tbody>';
    foreach($rows as $r){$p=json_decode($r['payload'],true);$body.='<tr><th scope="row">'.e($p['name']??'名称未入力').'</th><td>'.e(($p['category']??'')==='starbucks'?'スターバックス':'カフェ・その他').'</td><td>'.e($labels[$r['status']]).'</td><td>'.e(admin_date($r['created_at'])).'</td><td><a href="/admin/?view=submission&id='.e($r['id']).'">内容を確認</a></td></tr>';}
    if(!$rows)$body.='<tr><td colspan="5" class="admin-empty">'.($preview?'確認待ちの投稿はありません。':'条件に一致する投稿はありません。').'</td></tr>';
    return $body.'</tbody></table></div>'.($preview?'':admin_pager($pg,$total,$size,$base));
}
function admin_activity(bool $preview=false):string {
    $size=$preview?8:admin_size();$total=(int)query('SELECT count(*) FROM audit')->fetchColumn();$page=$preview?1:max(1,min(100000,(int)input($_GET,'page',6)));$page=min($page,max(1,(int)ceil($total/$size)));
    $rows=query('SELECT a.action,a.created_at,u.username FROM audit a LEFT JOIN users u ON a.actor=u.id ORDER BY a.id DESC LIMIT ? OFFSET ?',[$size,($page-1)*$size])->fetchAll();
    $labels=['login'=>'ログイン','logout'=>'ログアウト','password_changed'=>'パスワード変更','save_cafe'=>'カフェ情報の保存','save_store'=>'スターバックス店舗の保存','save_event'=>'開催情報の保存','user_created'=>'ID作成','user_toggled'=>'ID利用状態の変更','user_updated'=>'ID・権限の変更','notification_destination_changed'=>'通知先変更','admin_preferences_changed'=>'表示・入力設定の変更','mail_retry_requested'=>'通知の再送待ち登録','submission_pending'=>'投稿を確認中へ変更','submission_approved'=>'投稿の承認','submission_rejected'=>'投稿の不採用','submission_contact_redacted'=>'投稿者情報の削除'];
    $out='<h2>最近の管理操作</h2>'.admin_table_open('操作履歴').'<thead><tr><th>日時（日本時間）</th><th>操作したID</th><th>操作内容</th></tr></thead><tbody>';
    foreach($rows as $r)$out.='<tr><td>'.e(admin_date($r['created_at'])).'</td><td>'.e($r['username']??'システム').'</td><td>'.e($labels[$r['action']]??'管理操作').'</td></tr>';
    if(!$rows)$out.='<tr><td colspan="3" class="admin-empty">操作履歴はまだありません。</td></tr>';
    return $out.'</tbody></table></div>'.($preview?'':admin_pager($page,$total,$size,['view'=>'audit','limit'=>$size]));
}
function admin_overview():string {
    $metrics=[['確認待ちの投稿',"SELECT count(*) FROM submissions WHERE status='pending'",'/admin/?view=submissions&status=pending'],['公開中の手話カフェ',"SELECT count(*) FROM records WHERE kind='cafe' AND publication='public'",'/admin/?view=records&kind=cafe&publication=public'],['スターバックス店舗',"SELECT count(*) FROM records WHERE kind='store' AND publication!='deleted'",'/admin/?view=records&kind=store'],['開催情報',"SELECT count(*) FROM records WHERE kind='event' AND publication!='deleted'",'/admin/?view=records&kind=event']];
    $out='<p class="admin-lead">掲載情報と、みなさんから届いた情報を管理します。</p><div class="admin-metrics">';
    foreach($metrics as [$label,$sql,$url])$out.='<a href="'.e($url).'"><span>'.e($label).'</span><strong>'.(int)query($sql)->fetchColumn().'<small>件</small></strong></a>';
    return $out.'</div>'.admin_submissions_table(true).admin_activity(true);
}
function admin_edit_fields(array $p,string $kind):string {
    $all=record_fields($kind);
    $groups=['基本情報'=>['name','name_kana','description','operator'],'営業・開催情報'=>['business_hours','event_schedule','holidays','reservation','sign_support','event_date','start_time','end_time','organizer','partners','conditions','application'],'住所・地域'=>['country_code','country_name','prefecture','city','address','map_url'],'公式サイト・SNS'=>['official_url','instagram_url','x_url','facebook_url','line_url','youtube_url'],'情報確認・公開の根拠'=>['verification_sources','last_verified_at','published_at'],'詳細設定・管理用情報'=>['timezone','subtypes','latitude','longitude','coordinate_accuracy','coordinate_source_url','observation_only','internal_note']];
    $out='';foreach($groups as $title=>$keys){$keys=array_values(array_filter($keys,fn($k)=>isset($all[$k])));if(!$keys)continue;$out.='<fieldset class="admin-fieldset"><legend>'.e($title).'</legend>';
        if($title==='詳細設定・管理用情報')$out.='<p class="dn-muted">座標・タイムゾーン・内部メモなど。これらの管理用項目は一般向けの店舗本文には表示しません。</p>';
        if($title==='情報確認・公開の根拠')$out.='<p class="dn-muted">公開には、情報源URL・確認日・確認済みの情報確度が必要です。</p>';
        $out.='<div class="dn-form-grid">';
        foreach($keys as $k){
            if($k==='coordinate_accuracy'){$out.=select_field($k,'地図位置の確認',['unknown'=>'未確認・地図に掲載しない','address_vicinity'=>'住所付近まで確認済み'],$p[$k]??'unknown');continue;}
            if($k==='observation_only'){$out.=select_field($k,'開催情報の種類',['0'=>'日時のある個別開催・通常の企画','1'=>'日時不詳の開催実績'],$p[$k]??'0');continue;}
            $type=in_array($k,['description','internal_note','verification_sources','subtypes','sign_support','event_schedule','business_hours','conditions','application','partners'])?'textarea':(in_array($k,['last_verified_at','event_date','published_at'])?'date':(in_array($k,['start_time','end_time'])?'time':(str_ends_with($k,'_url')?'url':'text')));
            $out.=field($k,$all[$k],$p[$k]??'',$type,$k==='name');
        }$out.='</div></fieldset>';
    }return $out;
}
function admin_users(array $self):string {
    require_user(true);$q=input($_GET,'q',100);$state=input($_GET,'active',1);if($state!=='')choice($state,['0'=>1,'1'=>1]);
    $sorts=['username'=>'u.username COLLATE NOCASE','role'=>'u.role','active'=>'u.active','created'=>'u.created_at','login'=>'last_login'];$sort=input($_GET,'sort',20);if(!isset($sorts[$sort]))$sort='username';$dir=input($_GET,'dir',4)==='desc'?'desc':'asc';$size=admin_size();$pg=max(1,min(100000,(int)input($_GET,'page',6)));
    $where=['1=1'];$args=[];if($state!==''){$where[]='u.active=?';$args[]=$state;}if($q!==''){$where[]="u.username LIKE ? ESCAPE '!'";$args[]='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';}$where=implode(' AND ',$where);
    $total=(int)query('SELECT count(*) FROM users u WHERE '.$where,$args)->fetchColumn();$pg=min($pg,max(1,(int)ceil($total/$size)));
    $users=query("SELECT u.id,u.username,u.role,u.active,u.must_change,u.created_at,(SELECT max(a.created_at) FROM audit a WHERE a.actor=u.id AND a.action='login') AS last_login FROM users u WHERE ".$where.' ORDER BY '.$sorts[$sort].' '.$dir.',u.id LIMIT ? OFFSET ?',[...$args,$size,($pg-1)*$size])->fetchAll();
    $base=['view'=>'users','q'=>$q,'active'=>$state,'sort'=>$sort,'dir'=>$dir,'limit'=>$size];
    $out='<p>利用者ごとにIDを発行してください。パスワードは表示・共有できません。新しいIDは初回ログイン時にパスワード変更が必要です。</p><form method="get" class="admin-filters"><input type="hidden" name="view" value="users">'.field('q','IDを検索',$q).select_field('active','利用状態',[''=>'すべて','1'=>'有効','0'=>'停止中'],$state).'<button>絞り込む</button><a href="#create-user">IDを作成</a></form>';
    $out.=admin_table_open('ログインID一覧').'<thead><tr>';foreach(['username'=>'ログインID','role'=>'権限','active'=>'利用状態','created'=>'作成日時','login'=>'最終ログイン'] as $k=>$label)$out.=admin_th($k,$label,$base,$sort,$dir);
    $out.='<th>初回設定</th><th>操作</th></tr></thead><tbody>';
    foreach($users as $u)$out.='<tr><th scope="row">'.e($u['username']).($u['id']===$self['id']?'<small>あなたのID</small>':'').'</th><td>'.($u['role']==='admin'?'管理者':'編集者').'</td><td>'.($u['active']?'有効':'停止中').'</td><td>'.e(admin_date($u['created_at'])).'</td><td>'.e(admin_date($u['last_login'])).'</td><td>'.($u['must_change']?'パスワード変更待ち':'変更の要求なし').'</td><td>'.($u['id']===$self['id']?'<a href="/admin/?view=password">パスワード変更</a>':'<a href="/admin/?view=user&id='.(int)$u['id'].'">権限・利用状態</a>').'</td></tr>';
    if(!$users)$out.='<tr><td colspan="7" class="admin-empty">該当するIDはありません。</td></tr>';
    $out.='</tbody></table></div>'.admin_pager($pg,$total,$size,$base).'<section class="admin-panel"><h2>権限の違い</h2>'.admin_table_open('権限の説明').'<thead><tr><th>権限</th><th>できること</th></tr></thead><tbody><tr><th>編集者</th><td>掲載情報の追加・編集・公開、投稿の確認、操作履歴の確認、自分のパスワード変更</td></tr><tr><th>管理者</th><td>編集者の操作に加えて、ID発行・権限変更・利用停止、通知先と入力設定の変更</td></tr></tbody></table></div></section>';
    return $out.'<section class="admin-panel" id="create-user"><h2>IDを作成</h2><form action="/admin/" method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="create_user"><div class="dn-form-grid">'.field('username','ログインID（英数字・_・-、3〜40文字）','','text',true).select_field('role','権限',['editor'=>'編集者 — 掲載情報・投稿の管理','admin'=>'管理者 — ID・設定も管理'],'editor').field('new_password','初期パスワード（8文字以上）','','password',true).field('confirm_password','初期パスワード（確認）','','password',true).'</div><p class="dn-muted">作成後に本人へ安全な方法でお知らせください。こちらからメールは送信しません。</p><button>IDを作成する</button></form></section>';
}
function admin_user_detail(array $self):string {
    require_user(true);$id=(int)input($_GET,'id',10);$u=query('SELECT id,username,role,active,version FROM users WHERE id=?',[$id])->fetch();if(!$u)fail('IDが見つかりません。',404);
    if($id===$self['id'])return '<p class="dn-notice">自分自身の権限変更・利用停止はできません。</p><a href="/admin/?view=password">自分のパスワードを変更</a>';
    return '<p><a href="/admin/?view=users">ID一覧へ戻る</a></p><section class="admin-panel"><h2>'.e($u['username']).' の設定</h2><p>権限や利用状態を保存すると、このIDのログイン中のセッションは無効になります。停止してもIDと過去の操作履歴は残ります。</p><form action="/admin/" method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="update_user"><input type="hidden" name="id" value="'.$id.'"><input type="hidden" name="version" value="'.(int)$u['version'].'"><div class="dn-form-grid">'.select_field('role','権限',['editor'=>'編集者','admin'=>'管理者'],$u['role']).select_field('active','利用状態',['1'=>'有効','0'=>'停止中'],(string)$u['active']).field('current_password','操作する管理者（あなた）の現在のパスワード','','password',true).'</div><label class="dn-check"><input type="checkbox" name="confirm" value="1" required> 対象が「'.e($u['username']).'」であることと、変更する権限・利用状態を確認しました。</label><button>このIDの設定を保存</button></form></section>';
}
function admin_update_user(array $self):void {
    require_user(true);rate_limit('update_user',10,900);
    if(input($_POST,'confirm',1)!=='1')fail('対象IDと変更内容の確認が必要です。');
    if(!password_verify(input($_POST,'current_password',256),$self['password_hash']))fail('あなたの現在のパスワードが正しくありません。',403);
    $id=(int)input($_POST,'id',10);$version=(int)input($_POST,'version',10);$role=choice(input($_POST,'role',10),['admin'=>1,'editor'=>1]);$active=(int)choice(input($_POST,'active',1),['0'=>1,'1'=>1]);
    if($id===$self['id'])fail('自分自身の権限変更・利用停止はできません。');
    db()->exec('BEGIN IMMEDIATE');try {
        require_user(true);
        $target=query('SELECT id FROM users WHERE id=? AND version=?',[$id,$version])->fetch();if(!$target)fail('IDの状態が変更されています。再読み込みしてください。',409);
        if(($role!=='admin'||!$active)&&(int)query("SELECT count(*) FROM users WHERE role='admin' AND active=1 AND id!=?",[$id])->fetchColumn()<1)fail('有効な管理者を最低1人残してください。');
        $s=query('UPDATE users SET role=?,active=?,version=version+1 WHERE id=? AND version=?',[$role,$active,$id,$version]);if($s->rowCount()!==1)fail('編集が競合しました。',409);
        audit('user_updated',(string)$id);db()->exec('COMMIT');
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
function admin_preferences():string {
    require_user(true);
    return '<section class="admin-panel"><h2>一覧表示・新規登録の初期値</h2><p>変更は管理画面の表示と、これから作成する店舗にだけ使います。登録済みの店舗や公開画面は書き換えません。</p><form action="/admin/" method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="admin_preferences"><div class="dn-form-grid">'.select_field('admin_page_size','一覧の標準表示件数',['25'=>'25件','50'=>'50件','100'=>'100件'],setting('admin_page_size')?:'25').field('default_country_code','新規店舗の国コード（JP、USなど）',setting('default_country_code')?:'JP','text',true).field('default_country_name','新規店舗の国名',setting('default_country_name')?:'日本','text',true).field('default_timezone','新規情報のタイムゾーン',setting('default_timezone')?:'Asia/Tokyo','text',true).'</div><p class="dn-muted">例：Asia/Tokyo、America/New_York、Europe/London。海外店舗は個別の編集画面でも変更できます。</p><button>初期値を保存</button></form></section><section class="admin-panel"><h2>保護のため固定している設定</h2><dl class="dn-detail"><dt>公開までの流れ</dt><dd>ユーザー投稿は必ず確認待ち。自動公開しません。</dd><dt>パスワード</dt><dd>8文字以上・128バイト以内。保存済みパスワードは表示しません。</dd><dt>ログインの有効時間</dt><dd>操作がない状態で2時間、ログインから最長12時間。</dd><dt>削除</dt><dd>掲載情報は削除済みとして非表示にし、復元可能な状態で保持します。</dd></dl></section>';
}
function admin_save_preferences():void {
    require_user(true);$values=[];$values['admin_page_size']=choice(input($_POST,'admin_page_size',3),['25'=>1,'50'=>1,'100'=>1]);$values['default_country_code']=input($_POST,'default_country_code',2);$values['default_country_name']=input($_POST,'default_country_name',100);$values['default_timezone']=input($_POST,'default_timezone',100);
    if(!preg_match('/^[A-Z]{2}$/D',$values['default_country_code'])||$values['default_country_name']===''||!in_array($values['default_timezone'],DateTimeZone::listIdentifiers(),true))fail('国コード・国名・タイムゾーンを確認してください。');
    db()->exec('BEGIN IMMEDIATE');try{require_user(true);foreach($values as $k=>$v)query('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[$k,$v]);audit('admin_preferences_changed');db()->exec('COMMIT');}catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}
