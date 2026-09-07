<?php
declare(strict_types=1);
// CLI only. The reviewed manifest stays outside the public root and repository.
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
const OVERSEAS_BATCH_SHA256='a01856f7e63d506a66396234b42db09ff50738a39fb11a7b2e3c256af489ea56';
try {
    $file=$argv[1]??'';$backupDir=$argv[2]??'';$mode=$argv[3]??'';
    if(!in_array($mode,['--dry-run','--apply'],true)||!is_file($file)||is_link($file)||!is_dir($backupDir)||is_link($backupDir))throw new RuntimeException('Invalid arguments');
    if(!hash_equals(OVERSEAS_BATCH_SHA256,hash_file('sha256',$file)))throw new RuntimeException('Manifest mismatch');
    $manifest=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
    if($manifest['batch']!=='overseas-cafes-20260907-batch1'||$manifest['date']!=='2026-09-07'||count($manifest['records'])!==27)throw new RuntimeException('Unexpected batch');
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Integrity failure');
        $existing=query('SELECT * FROM records ORDER BY id')->fetchAll();
        $unchanged=[];foreach(['users','settings','submissions','outbox'] as $table)$unchanged[$table]=hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()));
        $prepared=[];$ids=[];$slugs=[];
        foreach($manifest['records'] as $row) {
            $id=$row['id'];$kind=$row['kind'];
            if(!preg_match('/^[a-f0-9]{32}$/D',$id)||isset($ids[$id])||isset($slugs[$row['slug']])||!in_array($kind,['cafe','store'],true))throw new RuntimeException('Invalid record identity');
            $ids[$id]=true;$slugs[$row['slug']]=true;
            foreach($existing as $old) {
                $p=expanded($old);
                if($old['id']===$id||$old['slug']===$row['slug']||($old['country_code']===$row['country_code']&&normalized($old['city'])===normalized($row['city'])&&(normalized($old['name'])===normalized($row['name'])||($row['address']!==''&&normalized($p['address']??'')===normalized($row['address'])))))throw new RuntimeException('Existing record conflict');
            }
            $post=$row;foreach(['verification_sources','subtypes'] as $k)$post[$k]=implode("\n",$row[$k]);
            $post['latitude']='';$post['longitude']='';$post['scope']='overseas';$post['signing_store']=!empty($row['signing_store'])?'1':'0';
            $p=validated_record($post,$kind);
            if($p['country_code']==='JP'||$p['publication']!=='pending'||$p['status']!=='open'||$p['last_verified_at']!=='2026-09-07'||$p['latitude']!==null||$p['longitude']!==null||$p['coordinate_accuracy']!=='unknown')throw new RuntimeException('Unexpected initial state');
            $prepared[]=[$id,$kind,$p];
        }
        if($mode==='--dry-run') {db()->exec('ROLLBACK');echo json(['result'=>'OVERSEAS_DRY_RUN_OK','records'=>count($prepared),'existing'=>count($existing),'changed'=>false])."\n";exit;}
        umask(0077);$backup=$backupDir.'/before-overseas-'.gmdate('Ymd_His').'-'.substr(uid(),0,6).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('Backup failed');
        $target->close();$source->close();chmod($backup,0600);
        foreach($prepared as [$id,$kind,$p])save_record($p,$kind,$id);
        $after=query('SELECT * FROM records ORDER BY id')->fetchAll();
        $retained=array_values(array_filter($after,fn($r)=>!isset($ids[$r['id']])));
        if(json($retained)!==json($existing)||count($after)!==count($existing)+27)throw new RuntimeException('Existing records changed');
        foreach($unchanged as $table=>$hash)if(!hash_equals($hash,hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()))))throw new RuntimeException('Unrelated table changed');
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Integrity failure');
        db()->exec('COMMIT');
        echo json(['result'=>'OVERSEAS_IMPORTED','added'=>27,'pending'=>27,'cafes'=>23,'signing_stores'=>4,'before'=>count($existing),'after'=>count($after),'existing_unchanged'=>true,'unrelated_tables_unchanged'=>true,'backup'=>$backup])."\n";
    }catch(Throwable $ex){db()->exec('ROLLBACK');throw $ex;}
}catch(Throwable $ex){fwrite(STDERR,'OVERSEAS_IMPORT_FAILED: '.get_class($ex).' '.($ex instanceof DomainException?$ex->getMessage():'Preflight, conflict or integrity check failed')."\n");exit(1);}
