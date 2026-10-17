<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
require __DIR__.'/cafe-event-registry.php';
umask(0077);
try {
    if(($argv[1]??'')!=='--apply'||!is_dir($argv[2]??'')||is_link($argv[2]))fail('Usage: init-cafe-event-recovery.php --apply PRIVATE_BACKUP_DIR');
    if(!cafe_registry_ready())fail('Curation registry must exist');
    if(cafe_event_recovery_ready()){echo json(['result'=>'ALREADY_INITIALIZED','changed'=>false])."\n";exit;}
    $backup=$argv[2].'/before-cafe-recovery-'.gmdate('YmdHis').'-'.substr(uid(),0,8).'.sqlite';
    db()->exec('BEGIN IMMEDIATE');
    try {
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')fail('Consistent backup failed');
        $target->close();$source->close();chmod($backup,0600);
        $protected=[];foreach(['records','users','settings','submissions','outbox'] as $t)$protected[$t]=hash('sha256',json(query('SELECT * FROM '.$t.' ORDER BY 1')->fetchAll()));
        cafe_event_recovery_schema();
        foreach($protected as $t=>$hash)if(!hash_equals($hash,hash('sha256',json(query('SELECT * FROM '.$t.' ORDER BY 1')->fetchAll()))))fail('Protected table changed');
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Database integrity failure');
        db()->exec('COMMIT');echo json(['result'=>'RECOVERY_INITIALIZED','backup'=>$backup,'protected_tables_unchanged'=>true])."\n";
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}catch(Throwable $e){fwrite(STDERR,'CAFE_RECOVERY_INIT_FAILED: '.($e instanceof DomainException?$e->getMessage():get_class($e))."\n");exit(1);}
