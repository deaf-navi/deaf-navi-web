<?php
declare(strict_types=1);

// This file reads a private, atomically replaced aggregate. It never stores raw IPs.
function access_quality_snapshot(): array {
    static $snapshot;
    if (isset($snapshot)) return $snapshot;
    $snapshot=['available'=>false,'days'=>[],'generated_at'=>null,'coverage_start'=>null];
    $file=access_visitor_dir().'/quality.json';
    if (!is_file($file)||is_link($file)||filesize($file)>16*1024*1024) return $snapshot;
    $data=json_decode((string)@file_get_contents($file),true,16);
    if (!is_array($data)||($data['version']??null)!==1||($data['complete']??false)!==true||!is_array($data['days']??null)) return $snapshot;
    foreach ($data['days'] as $day=>$visitors) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D',(string)$day)||!is_array($visitors)) return $snapshot;
        foreach ($visitors as $id=>$entry) if (!preg_match('/^[a-f0-9]{64}$/D',(string)$id)||!is_array($entry)||!in_array($entry['class']??null,['bot','ai','automation','suspected'],true)) return $snapshot;
    }
    return $snapshot=$data+['available'=>true];
}

function access_quality_class(string $day,string $visitor): ?string {
    $entry=access_quality_snapshot()['days'][$day][$visitor]??null;
    return is_array($entry)?$entry['class']:null;
}

function access_quality_identity(string $ip,string $ua,float $ts): ?array {
    static $secret;
    $packed=@inet_pton($ip);
    if($packed===false||$ua===''||strlen($ua)>2048)return null;
    if(!isset($secret)){
        $file=access_visitor_dir().'/secret.key';
        if(is_link($file)||!is_file($file))return null;
        $secret=@file_get_contents($file);
    }
    if(!is_string($secret)||strlen($secret)!==32)return null;
    $day=(new DateTimeImmutable('@'.(int)$ts))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d');
    return [$day,hash_hmac('sha256',$day."\0".$packed."\0".$ua,$secret)];
}

function access_quality_notice(): string {
    $s=access_quality_snapshot();
    if(!$s['available'])return '<p class="dn-notice">詳細ログによる定期再判定は停止中です。既知のbot・自動操作を除外していますが、一般ブラウザーを名乗る自動アクセスが含まれる可能性があります。</p>';
    $updated=strtotime($s['generated_at']??'');
    $time=$updated===false?'不明':(new DateTimeImmutable('@'.$updated))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y/m/d H:i');
    $start=strtotime($s['coverage_start']??'');
    $startText=$start===false?'不明':(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y/m/d H:i');
    return '<p class="dn-notice">詳細ログによる定期再判定は停止中です。既知のbot・自動操作の除外と保存済みの判定を適用します。詳細判定の記録範囲：'.e($startText).' ～ '.e($time).'。開始前の履歴は再判定できません。「一般ブラウザー」は人間であることの保証ではありません。</p>';
}
