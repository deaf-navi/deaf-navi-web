<?php
declare(strict_types=1);
// Operator-only additions. Never executed by a request, seed, build or deployment.
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
try {
    [$mode,$manifestFile,$backupDir,$approved]=array_pad(array_slice($argv,1),4,'');
    if(!in_array($mode,['--dry-run','--apply'],true)||!is_file($manifestFile)||is_link($manifestFile))fail('Usage: import-cafe-listings.php --dry-run MANIFEST | --apply MANIFEST BACKUP_DIR PLAN_SHA256');
    $manifest=json_decode(file_get_contents($manifestFile),true,512,JSON_THROW_ON_ERROR);$manifestHash=hash_file('sha256',$manifestFile);
    if(($manifest['version']??0)!==1||!preg_match('/^[a-z0-9-]{1,100}$/D',$manifest['batch']??'')||!is_array($manifest['additions']??null)||count($manifest['additions'])<1||count($manifest['additions'])>50)fail('Invalid additions manifest');
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Integrity failure');
        if(query("SELECT name FROM sqlite_master WHERE name='cafe_migration_runs'")->fetch()){
            $done=query('SELECT manifest_hash FROM cafe_migration_runs WHERE batch=?',[$manifest['batch']])->fetchColumn();
            if($done){if(!hash_equals($done,$manifestHash))fail('Batch hash mismatch');db()->exec('ROLLBACK');echo json(['result'=>'ALREADY_APPLIED','changed'=>false])."\n";exit;}
        }
        $existing=query('SELECT * FROM records ORDER BY id')->fetchAll();$protected=[];
        foreach(['users','settings','submissions','outbox'] as $table)$protected[$table]=hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()));
        $prepared=[];$slugs=[];
        foreach($manifest['additions'] as $item){
            $id=$item['id']??'';$data=$item['data']??null;
            if(!preg_match('/^[a-z0-9-]{1,64}$/D',$id)||!is_array($data)||isset($prepared[$id])||query('SELECT id FROM records WHERE id=?',[$id])->fetch())fail('Addition identity conflict');
            if(($data['publication']??'')!=='public')fail('Approved additions must explicitly request publication');
            $validated=validated_record(cafe_post($data),'cafe');$p=cafe_model(array_replace($data,$validated));
            if(isset($slugs[$p['slug']])||query('SELECT id FROM records WHERE slug=? AND kind IN (\'cafe\',\'store\')',[$p['slug']])->fetch()||duplicate_records($p))fail('Duplicate addition: '.$p['slug']);
            $slugs[$p['slug']]=true;$prepared[$id]=$p;
        }
        $planHash=hash('sha256',json(['manifest'=>$manifestHash,'records'=>$existing,'protected'=>$protected,'prepared'=>$prepared]));
        $summary=array_map(fn($id,$p)=>['id'=>$id,'name'=>$p['name'],'classification'=>$p['shop_type']==='event'?'event':'cafe','publication'=>$p['publication'],'status'=>$p['status']],array_keys($prepared),array_values($prepared));
        $result=['result'=>'CAFE_LISTINGS_DRY_RUN_OK','batch'=>$manifest['batch'],'plan_sha256'=>$planHash,'existing_records'=>count($existing),'added'=>count($prepared),'records'=>$summary,'changed'=>false];
        if($mode==='--dry-run'){db()->exec('ROLLBACK');echo json($result)."\n";exit;}
        if(!hash_equals($planHash,$approved)||!is_dir($backupDir)||is_link($backupDir))fail('Plan changed or backup directory invalid');
        umask(0077);$backup=$backupDir.'/before-cafe-events-'.gmdate('YmdHis').'-'.substr(uid(),0,8).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')fail('Backup failure');$target->close();$source->close();chmod($backup,0600);
        foreach($prepared as $id=>$p)save_record($p,'cafe',$id);
        foreach($existing as $before)if(json(record($before['id']))!==json($before))fail('Existing record changed');
        foreach($protected as $table=>$hash)if(!hash_equals($hash,hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()))))fail('Unrelated table changed');
        if((int)query('SELECT COUNT(*) FROM records')->fetchColumn()!==count($existing)+count($prepared))fail('Record count mismatch');
        db()->exec('CREATE TABLE IF NOT EXISTS cafe_migration_runs(batch TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL,applied_at TEXT NOT NULL)');
        query('INSERT INTO cafe_migration_runs VALUES(?,?,?)',[$manifest['batch'],$manifestHash,now()]);
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Integrity failure');
        db()->exec('COMMIT');echo json(array_replace($result,['result'=>'CAFE_LISTINGS_APPLIED','changed'=>true,'backup'=>$backup,'existing_records_unchanged'=>true,'protected_tables_unchanged'=>true]))."\n";
    }catch(Throwable $error){db()->exec('ROLLBACK');throw $error;}
}catch(Throwable $error){fwrite(STDERR,'CAFE_LISTINGS_FAILED: '.($error instanceof DomainException?$error->getMessage():get_class($error))."\n");exit(1);}
