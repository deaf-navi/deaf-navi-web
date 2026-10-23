<?php
declare(strict_types=1);

// Offline screening only: never fetch a submitted URL or send private text to a third party.
const CONTACT_URL_CHECK_VERSION = 1;
function contact_url_check(array $payload): array {
    $text=[];
    foreach(['name','private_message','description','notes','source_url','official_url','instagram_url','x_url','facebook_url','submitter','address','event_schedule','business_hours'] as $key) {
        if(is_string($payload[$key]??null))$text[]=$payload[$key];
    }
    $text=html_entity_decode(implode("\n",$text),ENT_QUOTES|ENT_HTML5,'UTF-8');
    // Include plain domains and non-web schemes; email addresses are not links to visit.
    preg_match_all('~(?:\b[a-z][a-z0-9+.-]*://|\b(?:javascript|data|vbscript|file):|(?<!:)//|\bwww\.)[^\s<>"\x27「」『』（）【】、。]+|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?![\w@.-])(?:/[^\s<>"\x27「」『』（）【】、。]*)?~iu',$text,$matches);
    $urls=array_values(array_unique(array_map(fn($s)=>rtrim($s,'.;,!?)]}'),$matches[0])));
    $limited=count($urls)>50;$items=[];$counts=['high'=>0,'review'=>0,'no_indicator'=>0];
    foreach(array_slice($urls,0,50) as $url){
        $reasons=[];$risk='no_indicator';
        $mark=function(string $level,string $reason)use(&$reasons,&$risk){$reasons[]=$reason;if($level==='high'||$risk==='no_indicator')$risk=$level;};
        if(strlen($url)>2000){$mark('review','URLが長すぎるため全体を判定できません');$url=substr($url,0,2000);}
        $explicit=(bool)preg_match('~^[a-z][a-z0-9+.-]*:~i',$url);
        $parsed=parse_url(str_starts_with($url,'//')?'https:'.$url:($explicit?$url:'https://'.$url));
        $scheme=strtolower($parsed['scheme']??'');$host=strtolower(rtrim($parsed['host']??'','.'));
        if(!$parsed||!in_array($scheme,['http','https'],true)||$host==='')$mark('high','通常のWebページURLではありません');
        if(isset($parsed['user'])||isset($parsed['pass']))$mark('high','認証情報を含むURL・表示先の偽装に注意');
        if(preg_match('~[\\\\\x00-\x20\x7f]|%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)~i',$url))$mark('high','制御文字や紛らわしい区切りを含みます');
        $ip=trim($host,'[]');
        if(filter_var($ip,FILTER_VALIDATE_IP)){
            if(!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)||str_starts_with($ip,'::ffff:'))$mark('high','内部・予約IPアドレスです');
            else $mark('review','ドメイン名ではなくIPアドレスを指定しています');
        }elseif($host!==''&&(!str_contains($host,'.')||preg_match('~(?:^|\.)(?:localhost|local|internal|lan|test|invalid|onion)$|^(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*$~i',$host))){
            $mark('high','内部名・特殊な名前または数値表記の接続先です');
        }
        if(preg_match('/[^a-z0-9.\-:\[\]]/i',$host)||str_contains($host,'xn--'))$mark('review','国際化ドメインです。似た文字による偽装を確認してください');
        if($scheme==='http')$mark('review','暗号化されていないHTTPです');
        if(isset($parsed['port'])&&!in_array($parsed['port'],[80,443],true))$mark('review','一般的でないポート番号です');
        foreach(['bit.ly','t.co','tinyurl.com','is.gd','cutt.ly','shorturl.at','buff.ly','goo.gl','ow.ly','qr.ae','rebrand.ly','rb.gy'] as $short){if($host===$short||str_ends_with($host,'.'.$short)){$mark('review','短縮URLのため最終的な接続先は未確認です');break;}}
        $decoded=rawurldecode($parsed['path']??'');
        if(preg_match('~\.(?:exe|msi|scr|bat|cmd|ps1|vbs|js|jar|apk|dmg|iso)(?:$|/)~i',$decoded))$mark('high','実行ファイル等へのリンクです');
        if(preg_match('~\.(?:zip|rar|7z)(?:$|/)~i',$decoded))$mark('review','圧縮ファイルへのリンクです');
        if(preg_match('~(?:https?%3a|https?://|(?:url|redirect|next|target|dest|destination)=)~i',$parsed['query']??''))$mark('review','転送先を指定するパラメーターを含む可能性があります');
        $counts[$risk]++;$items[]=['url'=>$url,'risk'=>$risk,'reasons'=>$reasons];
    }
    return ['version'=>CONTACT_URL_CHECK_VERSION,'checked_at'=>gmdate('c'),'method'=>'local-rules-no-fetch','reputation'=>'not_checked','truncated'=>$limited,'counts'=>$counts,'items'=>$items];
}
function contact_url_summary(array $check):string {
    $c=$check['counts'];
    return 'URL自動検査：注意度高 '.$c['high'].'件／要確認 '.$c['review'].'件／形式上の注意点なし '.$c['no_indicator'].'件'.($check['truncated']?'（50件を超えた分は未検査）':'')."\n外部サイトの安全性・マルウェア・転送先は未確認です。投稿されたURLはメールに載せていません。";
}
function contact_url_admin(array $payload):string {
    // Recompute so redaction and rule changes cannot leave stale URL copies visible.
    $check=contact_url_check($payload);
    $out='<section><h3>URLの自動検査</h3><p>'.nl2br(e(contact_url_summary($check))).'</p><p>リンク先へはアクセスせず、URLの形式を検査しています。「注意点なし」も安全性の保証ではありません。</p>';
    if($check['items']){$out.='<ul>';foreach($check['items'] as $item)$out.='<li><code>'.e($item['url']).'</code> — '.e(['high'=>'注意度高','review'=>'要確認','no_indicator'=>'形式上の注意点なし'][$item['risk']]).($item['reasons']?'<br>'.e(implode('／',$item['reasons'])):'').'</li>';$out.='</ul>';}
    return $out.'</section>';
}
