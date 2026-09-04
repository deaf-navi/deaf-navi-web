<?php
declare(strict_types=1);

const TYPES = ['permanent'=>'常設','limited'=>'限定営業','recurring'=>'定期開催','special'=>'特殊'];
const STATUSES = ['open'=>'営業・活動確認済','temporarily_closed'=>'休業中','unknown'=>'営業状況未確認','closed'=>'閉店・活動終了'];
const EVENT_STATUSES = ['scheduled'=>'開催予定','ongoing'=>'開催中','recurring'=>'定期開催','ended'=>'開催終了','cancelled'=>'中止','date_unknown'=>'日程未確認'];
const PUBLICATIONS = ['pending'=>'保留・確認中','public'=>'公開','private'=>'非公開','deleted'=>'削除済み（復元可能）'];
const LEVELS = ['official'=>'公式確認済み','authority'=>'公的団体で確認','multiple_sources'=>'複数情報源で確認','pending'=>'要確認'];
const CONFIDENCE = ['official'=>'公式確認済み','organizer'=>'主催者発信','store'=>'店舗発信','participant'=>'参加者提供','unverified'=>'未確認情報'];
const REPORT_TYPES = ['new'=>'新しい手話カフェ','move'=>'移転','hours'=>'営業時間変更','url'=>'URL変更','rest'=>'休業','closed'=>'閉店','other'=>'その他'];
const BASE = 'https://deafnavi.com';

function data_dir(): string { return getenv('DEAFNAVI_DATA_DIR') ?: '/srv/deafnavi/shared/directory'; }
function db(): PDO {
    static $db;
    if (!$db) {
        $path = data_dir().'/directory.sqlite';
        if (!is_file($path)) throw new RuntimeException('Directory is not initialized');
        $db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
    }
    return $db;
}
function now(): string { return gmdate('c'); }
function uid(): string { return bin2hex(random_bytes(16)); }
function e(mixed $v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function json(mixed $v): string { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); }
function query(string $sql, array $args=[]): PDOStatement { $s=db()->prepare($sql); $s->execute($args); return $s; }
function setting(string $key): string { return (string)(query('SELECT value FROM settings WHERE key=?',[$key])->fetchColumn() ?: ''); }
function audit(string $action, string $target=''): void { query('INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)', [$_SESSION['user_id']??null,$action,$target,now()]); }
function fail(string $message, int $code=400): never { throw new DomainException($message,$code); }
function input(array $data, string $key, int $max=2000): string {
    $v=$data[$key]??'';
    if (!is_string($v) || !preg_match('//u',$v) || strlen($v)>$max || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$v)) fail('入力値が不正または長すぎます: '.$key);
    return trim($v);
}
function choice(string $value, array $choices): string { if (!array_key_exists($value,$choices)) fail('選択値が不正です。'); return $value; }
function safe_url(string $value): string {
    if ($value==='') return '';
    $p=parse_url($value);
    if (!$p || !in_array($p['scheme']??'', ['http','https'],true) || empty($p['host']) || isset($p['user']) || isset($p['pass']) || preg_match('/[\s<>"\x00-\x1f]/u',$value)) fail('URLは正しい http:// または https:// のURLを入力してください。');
    if (preg_match('/(^|\.)google\.[a-z.]+$/i',$p['host']) && str_starts_with($p['path']??'','/search')) fail('検索結果URLではなく情報元のURLを入力してください。');
    return $value;
}
function date_value(string $v): string {
    if ($v==='') return '';
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$v);
    if (!$d || $d->format('Y-m-d')!==$v) fail('日付が正しくありません。');
    return $v;
}
function normalized(string $v): string {
    $from=preg_split('//u','０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',-1,PREG_SPLIT_NO_EMPTY);
    $v=strtr($v,array_combine($from,str_split('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')));
    $v=strtolower($v);
    $v=preg_replace('#^https?://(?:www\.)?#i','',$v)??$v;
    // intl is optional on the production PHP runtime.
    if (class_exists('Normalizer')) $v=Normalizer::normalize($v,Normalizer::FORM_KC);
    $v=strtr($v,['　'=>'','－'=>'-','ー'=>'ー','／'=>'/','：'=>':','＆'=>'&']);
    return preg_replace('/[\s\p{Z}\p{P}]/u','',$v)??$v;
}
function duplicate_records(array $p): array {
    $found=[];
    foreach(query("SELECT * FROM records WHERE kind IN ('cafe','store') AND publication!='deleted'")->fetchAll() as $r) {
        $other=json_decode($r['payload'],true);
        foreach(['name','address','official_url','instagram_url'] as $key) {
            $a=normalized($p[$key]??''); $b=normalized($other[$key]??$r[$key]??'');
            if ($a!=='' && $a===$b) { $found[]=$r; break; }
        }
    }
    return $found;
}
function rate_limit(string $scope, int $max, int $seconds): void {
    $secret=setting('rate_secret');
    if ($secret==='') throw new RuntimeException('Rate limit secret missing');
    $key=hash_hmac('sha256',$scope.'|'.($_SERVER['REMOTE_ADDR']??'unknown'),$secret);
    db()->exec('BEGIN IMMEDIATE');
    try {
        query('DELETE FROM limits WHERE expires < ?', [time()]);
        query('INSERT INTO limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',[$key,time()+$seconds]);
        $hits=(int)query('SELECT hits FROM limits WHERE key=?',[$key])->fetchColumn();
        db()->exec('COMMIT');
    } catch(Throwable $ex) { db()->exec('ROLLBACK'); throw $ex; }
    if ($hits>$max) { header('Retry-After: '.$seconds); fail('操作が続いています。時間をおいて再度お試しください。',429); }
}
function start_session(): void {
    if(session_status()===PHP_SESSION_ACTIVE) return;
    session_name('deafnavi_directory');
    ini_set('session.use_strict_mode','1');
    ini_set('session.gc_maxlifetime','7200');
    session_save_path(data_dir().'/sessions');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>getenv('DEAFNAVI_LOCAL_TEST')!=='1','httponly'=>true,'samesite'=>'Lax']);
    session_start();
    if(!isset($_SESSION['csrf'])) $_SESSION['csrf']=uid();
}
function csrf(): string { start_session(); return '<input type="hidden" name="csrf" value="'.e($_SESSION['csrf']).'">'; }
function check_csrf(): void {
    start_session();
    if(!hash_equals($_SESSION['csrf'],input($_POST,'csrf',64))) fail('画面を再読み込みして、もう一度操作してください。',403);
}
function current_user(): ?array {
    start_session();
    if(empty($_SESSION['user_id'])) return null;
    $u=query('SELECT * FROM users WHERE id=? AND active=1',[$_SESSION['user_id']])->fetch();
    if(!$u || $u['version']!==($_SESSION['version']??null) || time()-($_SESSION['last_active']??0)>7200 || time()-($_SESSION['issued']??0)>43200) { unset($_SESSION['user_id']); return null; }
    $_SESSION['last_active']=time(); return $u;
}
function require_user(bool $admin=false): array {
    $u=current_user(); if(!$u) fail('ログインが必要です。',401);
    if($admin && $u['role']!=='admin') fail('管理者権限が必要です。',403);
    return $u;
}
function password_valid(string $p): void { if(strlen($p)<12 || strlen($p)>128) fail('新しいパスワードは12〜128バイトで入力してください。'); }
function record(string $id): array { $r=query('SELECT * FROM records WHERE id=?',[$id])->fetch(); if(!$r) fail('情報が見つかりません。',404); return $r; }
function expanded(array $r): array { return array_merge(json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR),$r); }
function record_fields(string $kind): array {
    $common=['name'=>'店舗・活動名','name_kana'=>'名称の読み','country_code'=>'国コード（例 JP / US）','country_name'=>'国名','prefecture'=>'都道府県・州','city'=>'市区町村','address'=>'住所','map_url'=>'地図URL','latitude'=>'緯度','longitude'=>'経度','timezone'=>'タイムゾーン（例 Asia/Tokyo）','subtypes'=>'補助ラベル（1行1件）','business_hours'=>'営業時間','event_schedule'=>'営業曜日・開催曜日','holidays'=>'定休日','reservation'=>'予約の要否','description'=>'特徴・説明','sign_support'=>'手話対応の内容','official_url'=>'公式サイト','instagram_url'=>'Instagram','x_url'=>'X','facebook_url'=>'Facebook','operator'=>'運営団体','verification_sources'=>'情報源URL（1行1件）','last_verified_at'=>'情報確認日','internal_note'=>'管理者メモ（非公開）'];
    if($kind==='event') $common=['name'=>'企画名','event_date'=>'開催日','start_time'=>'開始時刻','end_time'=>'終了時刻','timezone'=>'タイムゾーン','event_schedule'=>'定期開催日程','organizer'=>'主催者','partners'=>'共催・協力団体','description'=>'内容','conditions'=>'参加条件','application'=>'申込方法','official_url'=>'公式サイト','verification_sources'=>'情報源URL（1行1件）','published_at'=>'情報公開日','last_verified_at'=>'最終確認日','internal_note'=>'管理者メモ（非公開）'];
    return $common;
}
function validated_record(array $post, string $kind): array {
    $p=[];
    foreach(record_fields($kind) as $key=>$label) {
        $p[$key]=input($post,$key,in_array($key,['description','internal_note','verification_sources'])?6000:2000);
        if(str_ends_with($key,'_url')) $p[$key]=safe_url($p[$key]);
    }
    if($p['name']==='' || strlen($p['name'])>300) fail('名称を300バイト以内で入力してください。');
    $p['slug']=input($post,'slug',100);
    if(!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$p['slug']) || in_array($p['slug'],['starbucks','index','admin'],true)) fail('URL名は半角小文字・数字・ハイフンで指定してください。');
    $p['publication']=choice(input($post,'publication'),PUBLICATIONS);
    $p['verification_level']=choice(input($post,'verification_level'),LEVELS);
    $p['last_verified_at']=date_value($p['last_verified_at']);
    if($p['last_verified_at']>(new DateTimeImmutable('now',new DateTimeZone('Asia/Tokyo')))->format('Y-m-d')) fail('情報確認日に未来の日付は指定できません。');
    $p['verification_sources']=array_values(array_filter(array_map('trim',explode("\n",$p['verification_sources']))));
    foreach($p['verification_sources'] as $url) safe_url($url);
    if($kind==='event') {
        $p['status']=choice(input($post,'status'),EVENT_STATUSES);
        $p['confidence']=choice(input($post,'confidence'),CONFIDENCE);
        $p['event_date']=date_value($p['event_date']); $p['published_at']=date_value($p['published_at']);
        foreach(['start_time','end_time'] as $k) if($p[$k]!=='' && !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$p[$k])) fail('時刻は HH:MM 形式です。');
        if($p['end_time']!=='' && $p['end_time']<=$p['start_time']) fail('終了時刻は開始時刻より後にしてください。日をまたぐ企画は時刻を未設定にして説明へ記載してください。');
        $p['store_id']=input($post,'store_id',64); $store=record($p['store_id']);
        if($store['kind']!=='store' || $store['publication']==='deleted') fail('有効なスターバックス店舗を選んでください。');
        $p['country_code']=$store['country_code']; $p['prefecture']=$store['prefecture']; $p['city']=$store['city'];
        if($p['publication']==='public' && $store['publication']!=='public') fail('開催店舗を先に公開してください。');
    } else {
        $p['status']=choice(input($post,'status'),STATUSES);
        $p['type']=choice(input($post,'type'),TYPES);
        $p['subtypes']=array_values(array_filter(array_map('trim',explode("\n",$p['subtypes']))));
        if(!preg_match('/^[A-Z]{2}$/D',$p['country_code'])) fail('国コードは英大文字2文字で入力してください。');
        foreach(['latitude'=>90,'longitude'=>180] as $k=>$range) {
            if($p[$k]==='') $p[$k]=null;
            elseif(!is_numeric($p[$k]) || abs((float)$p[$k])>$range) fail('緯度・経度が不正です。');
            else $p[$k]=(float)$p[$k];
        }
        $p['signing_store']=($kind==='store' && input($post,'signing_store',1)==='1');
    }
    if($p['timezone']!=='' && !in_array($p['timezone'],DateTimeZone::listIdentifiers(),true)) fail('タイムゾーンが不正です。');
    if($p['publication']==='public' && ($p['verification_level']==='pending' || !$p['verification_sources'] || $p['last_verified_at']==='' || $p['status']==='unknown')) fail('公開には情報源・確認日・確認済みの情報確度・営業状態が必要です。');
    return $p;
}
function save_record(array $p, string $kind, string $id='', int $revision=0): string {
    $id=$id?:uid(); $stamp=now();
    $collision=query('SELECT id FROM records WHERE slug=? AND id!=? AND '.($kind==='event'?"kind='event'":"kind IN ('cafe','store')"),[$p['slug'],$id])->fetch();
    if($collision) fail('このURL名は既に使われています。別のURL名を指定してください。',409);
    $args=[$p['slug'],$p['name'],$p['country_code'],$p['prefecture'],$p['city'],$p['publication'],$p['status'],$p['store_id']??null,json($p),$stamp];
    if($revision) {
        $r=record($id); if($r['kind']!==$kind) fail('種別を変更できません。');
        $s=query('UPDATE records SET slug=?,name=?,country_code=?,prefecture=?,city=?,publication=?,status=?,store_id=?,payload=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?',[...$args,$id,$revision]);
        if($s->rowCount()!==1) fail('別の管理者が変更しました。再読み込みして確認してください。',409);
    } else {
        query('INSERT INTO records(slug,name,country_code,prefecture,city,publication,status,store_id,payload,updated_at,id,kind,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[...$args,$id,$kind,$stamp]);
    }
    audit('save_'.$kind,$id); return $id;
}
function publicly_visible(array $p): bool {
    return $p['publication']==='public' && ($p['verification_level']??'pending')!=='pending' && !empty($p['last_verified_at']) && !empty($p['verification_sources']) && $p['status']!=='unknown';
}
