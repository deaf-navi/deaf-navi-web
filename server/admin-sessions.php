<?php
declare(strict_types=1);

// A durable, revocable login independent of PHP's two-hour form-session GC.
// Browsers cap persistent cookies at 400 days. Renew during authenticated use.
const ADMIN_LOGIN_COOKIE = 'deafnavi_admin_login';
const ADMIN_LOGIN_LIFETIME = 400 * 86400;

function admin_login_schema(): void {
    static $ready=false;
    if($ready)return;
    if(!query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_login_sessions'")->fetchColumn()) {
        // Additive migration for existing installations; never alter users or content.
        db()->exec(file_get_contents(__DIR__.'/admin-sessions.sql'));
    }
    $ready=true;
}
function admin_login_cookie(string $token, int $expires): void {
    setcookie(ADMIN_LOGIN_COOKIE,$token,['expires'=>$expires,'path'=>'/',
        'secure'=>getenv('DEAFNAVI_LOCAL_TEST')!=='1','httponly'=>true,'samesite'=>'Lax']);
}
function admin_login_forget(): void {
    unset($_SESSION['user_id'],$_SESSION['version'],$_SESSION['admin_login_hash'],$_SESSION['issued'],$_SESSION['last_active']);
    $_SESSION['csrf']=uid();
    admin_login_cookie('',time()-3600);
    unset($_COOKIE[ADMIN_LOGIN_COOKIE]);
}
function admin_login_revoke(): void {
    $hash=$_SESSION['admin_login_hash']??null;
    if(is_string($hash)) {
        admin_login_schema();
        query('DELETE FROM admin_login_sessions WHERE token_hash=?',[$hash]);
    }
    admin_login_forget();
}
function admin_login_issue(array $user): void {
    admin_login_schema();
    $token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);$time=time();
    query('DELETE FROM admin_login_sessions WHERE expires_at<=?',[$time]);
    query('INSERT INTO admin_login_sessions(token_hash,user_id,user_version,csrf,created_at,expires_at) VALUES(?,?,?,?,?,?)',
        [$hash,$user['id'],$user['version'],$_SESSION['csrf'],$time,$time+ADMIN_LOGIN_LIFETIME]);
    $_SESSION['admin_login_hash']=$hash;
    admin_login_cookie($token,$time+ADMIN_LOGIN_LIFETIME);
    $_COOKIE[ADMIN_LOGIN_COOKIE]=$token;
}
function admin_login_restore(): void {
    $token=$_COOKIE[ADMIN_LOGIN_COOKIE]??null;
    if($token!==null && (!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))) {
        admin_login_forget();return;
    }
    // An existing PHP session remains usable by clients without persistent storage.
    // Always check the durable record too, so logout revokes every restored session.
    $hash=$token!==null?hash('sha256',$token):($_SESSION['admin_login_hash']??null);
    if(!is_string($hash))return;
    admin_login_schema();
    $row=query('SELECT l.*,u.active,u.version FROM admin_login_sessions l JOIN users u ON u.id=l.user_id WHERE l.token_hash=?',[$hash])->fetch();
    $time=time();
    if(!$row || !(int)$row['active'] || (int)$row['user_version']!==(int)$row['version'] || (int)$row['expires_at']<=$time) {
        query('DELETE FROM admin_login_sessions WHERE token_hash=?',[$hash]);
        admin_login_forget();return;
    }
    if(($_SESSION['admin_login_hash']??null)!==$hash) {
        session_regenerate_id(true);
        $_SESSION=[];
    }
    $_SESSION['user_id']=(int)$row['user_id'];$_SESSION['version']=(int)$row['version'];
    $_SESSION['csrf']=$row['csrf'];$_SESSION['admin_login_hash']=$hash;
    $_SESSION['issued']=(int)$row['created_at'];$_SESSION['last_active']=$time;
    if($token!==null) {
        // Renew at most daily in SQLite; keep the browser expiration in sync with it.
        $expires=(int)$row['expires_at'];
        if($expires<$time+ADMIN_LOGIN_LIFETIME-86400) {
            $expires=$time+ADMIN_LOGIN_LIFETIME;
            query('UPDATE admin_login_sessions SET expires_at=? WHERE token_hash=?',[$expires,$hash]);
        }
        admin_login_cookie($token,$expires);
    }
}
