<?php
declare(strict_types=1);
// Operator-only, additive and transactional. Never called by deployment or HTTP.
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
try {
    $file=$argv[1]??'';$backupDir=$argv[2]??'';
    if(!is_file($file)||is_link($file)||!is_dir($backupDir)||is_link($backupDir))throw new RuntimeException('Invalid paths');
    $m=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
    $expected=['starbucks-machida-pario'=>'store','starbucks-machida-twins-east'=>'store','starbucks-shikishima-park'=>'store','observed-machida-pario'=>'event','observed-machida-twins-east'=>'event','observed-shikishima-park'=>'event'];
    if(($m['date']??'')!=='2026-09-05'||count($m['additions']??[])!==6)throw new RuntimeException('Unexpected manifest');
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('Integrity failure');
        $seen=[];
        foreach($m['additions'] as $p){
            if(($expected[$p['id']]??'')!==$p['kind']||isset($seen[$p['id']])||query('SELECT id FROM records WHERE id=? OR slug=?',[$p['id'],$p['slug']])->fetch())throw new RuntimeException('Target conflict');
            if($p['kind']==='event'&&(($p['observation_only']??'')!=='1'||$p['status']!=='ended'||!isset($seen[$p['store_id']])))throw new RuntimeException('Invalid history relation');
            $seen[$p['id']]=true;
        }
        umask(0077);$backup=$backupDir.'/directory-starbucks-'.gmdate('YmdTHis').'-'.substr(uid(),0,6).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('Backup failure');
        $target->close();$source->close();chmod($backup,0600);
        foreach($m['additions'] as $row){
            $post=$row;foreach(['verification_sources','subtypes'] as $k)if(isset($post[$k])&&is_array($post[$k]))$post[$k]=implode("\n",$post[$k]);
            if(isset($post['signing_store']))$post['signing_store']=$post['signing_store']?'1':'0';
            save_record(validated_record($post,$row['kind']),$row['kind'],$row['id']);
        }
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Integrity failure');
        db()->exec('COMMIT');echo json(['result'=>'STARBUCKS_IMPORT_OK','added'=>6,'backup'=>$backup])."\n";
    }catch(Throwable $ex){db()->exec('ROLLBACK');throw $ex;}
}catch(Throwable $ex){fwrite(STDERR,'STARBUCKS_IMPORT_FAILED: '.get_class($ex)."\n");exit(1);}
