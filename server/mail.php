<?php
declare(strict_types=1);
/** Optional private SMTP adapter. BASP21 is Windows COM; never execute it on Linux.
 * Credentials live in shared/directory/mail.php, not in Git or the public root.
 * Only the configured administrator recipient is used; submitter email is never a recipient.
 */
function smtp_read($s,array $codes): void {
    $last='';
    do {$last=fgets($s,2048);if($last===false)throw new RuntimeException('SMTP response unavailable');}while(strlen($last)>3&&$last[3]==='-');
    if(!in_array((int)substr($last,0,3),$codes,true))throw new RuntimeException('SMTP response rejected');
}
function smtp_write($s,string $line): void { $line.="\r\n";while($line!==''){$n=fwrite($s,$line);if(!$n)throw new RuntimeException('SMTP write unavailable');$line=substr($line,$n);} }
function smtp_send(array $cfg,string $to,string $subject,string $body,string $messageId,bool &$dispatched): void {
    $host=$cfg['host']??'';$port=(int)($cfg['port']??465);$from=$cfg['from']??'';$mode=$cfg['encryption']??'tls';
    if(!preg_match('/^[a-z0-9.-]+$/iD',$host)||!in_array($port,[465,587],true)||!in_array($mode,['tls','starttls'],true)||!filter_var($from,FILTER_VALIDATE_EMAIL)||!filter_var($to,FILTER_VALIDATE_EMAIL))throw new RuntimeException('SMTP configuration invalid');
    $ctx=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'peer_name'=>$host,'allow_self_signed'=>false]]);
    $s=stream_socket_client(($mode==='tls'?'tls':'tcp').'://'.$host.':'.$port,$errno,$errstr,10,STREAM_CLIENT_CONNECT,$ctx);
    if(!$s)throw new RuntimeException('SMTP connection failed');stream_set_timeout($s,10);
    try {
        smtp_read($s,[220]);smtp_write($s,'EHLO deafnavi.com');smtp_read($s,[250]);
        if($mode==='starttls'){smtp_write($s,'STARTTLS');smtp_read($s,[220]);if(!stream_socket_enable_crypto($s,true,STREAM_CRYPTO_METHOD_TLS_CLIENT))throw new RuntimeException('TLS failed');smtp_write($s,'EHLO deafnavi.com');smtp_read($s,[250]);}
        if(!empty($cfg['username'])){smtp_write($s,'AUTH LOGIN');smtp_read($s,[334]);smtp_write($s,base64_encode($cfg['username']));smtp_read($s,[334]);smtp_write($s,base64_encode($cfg['password']??''));smtp_read($s,[235]);}
        smtp_write($s,'MAIL FROM:<'.$from.'>');smtp_read($s,[250]);smtp_write($s,'RCPT TO:<'.$to.'>');smtp_read($s,[250,251]);smtp_write($s,'DATA');smtp_read($s,[354]);
        $headers='From: '.$from."\r\n".'To: '.$to."\r\n".'Date: '.gmdate('D, d M Y H:i:s').' +0000'."\r\n".'Message-ID: <'.$messageId.'@deafnavi.com>'."\r\n".'Subject: =?UTF-8?B?'.base64_encode($subject).'?='."\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
        // From this boundary onward, any error is ambiguous and must not auto-retry.
        $dispatched=true;smtp_write($s,$headers.rtrim(chunk_split(base64_encode($body),76,"\r\n"),"\r\n")."\r\n.");smtp_read($s,[250]);
    }finally{fclose($s);}
}
function send_outbox(): void {
    $path=data_dir().'/mail.php';$to=setting('notification_email');
    if(!is_file($path)||$to===''){echo "MAIL_NOT_CONFIGURED\n";return;}
    $lock=fopen(data_dir().'/mail.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))return;
    $cfg=require $path;if(!is_array($cfg))throw new RuntimeException('Invalid mail configuration');
    query("UPDATE outbox SET status='uncertain',last_error='Interrupted; check delivery before retry' WHERE status='sending'");
    foreach(query("SELECT o.id,o.submission_id FROM outbox o WHERE o.status='pending' ORDER BY o.id LIMIT 10")->fetchAll() as $r) {
        $id=$r['submission_id'];
        query("UPDATE outbox SET status='sending',attempts=attempts+1,updated_at=? WHERE id=?",[now(),$r['id']]);
        $dispatched=false;
        try {
            // No contact information in notifications; full submission stays behind login.
            smtp_send($cfg,$to,'Deaf Navi：手話カフェ情報提供を受け付けました',"新しい情報提供を確認中として保存しました。\n管理画面で内容を確認してください。\n".BASE.'/admin/?view=submission&id='.$id,$id,$dispatched);
            query("UPDATE outbox SET status='sent',last_error=NULL,updated_at=? WHERE id=?",[now(),$r['id']]);
        }catch(Throwable $ex){query('UPDATE outbox SET status=?,last_error=?,updated_at=? WHERE id=?',[$dispatched?'uncertain':'failed',$dispatched?'Delivery result unknown':'Transport failed; configuration check required',now(),$r['id']]);}
    }
    flock($lock,LOCK_UN);fclose($lock);echo "MAIL_QUEUE_PROCESSED\n";
}
