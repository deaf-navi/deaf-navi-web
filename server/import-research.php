<?php
declare(strict_types=1);
// Explicit operator-only import. Not invoked by requests, init, build or deployment.
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
try {
    $file=$argv[1]??'';$backupDir=$argv[2]??'';
    if(!is_file($file)||is_link($file)||!is_dir($backupDir)||is_link($backupDir))throw new RuntimeException('Valid manifest and backup directory required');
    $manifest=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
    if(($manifest['date']??'')!=='2026-09-05'||count($manifest['updates']??[])>30||count($manifest['additions']??[])>5)throw new RuntimeException('Unexpected manifest');
    $post=function(array $row):array{foreach(['verification_sources','subtypes'] as $k)if(isset($row[$k])&&is_array($row[$k]))$row[$k]=implode("\n",$row[$k]);if(isset($row['signing_store']))$row['signing_store']=$row['signing_store']?'1':'0';return $row;};
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('Integrity failure');
        $prepared=[];$ids=[];
        foreach($manifest['updates'] as $u){
            if(isset($ids[$u['id']]))throw new RuntimeException('Duplicate target');$ids[$u['id']]=true;
            $r=record($u['id']);if($r['revision']!==$u['expected_revision']||!in_array($r['kind'],['cafe','store'],true))throw new RuntimeException('Revision or kind conflict: '.$u['id']);
            $p=validated_record($post(array_merge(expanded($r),$u['changes'])),$r['kind']);
            $prepared[]=[$p,$r['kind'],$r['id'],$r['revision']];
        }
        foreach($manifest['additions'] as $p){
            if(isset($ids[$p['id']])||query('SELECT id FROM records WHERE id=?',[$p['id']])->fetch()||duplicate_records($p))throw new RuntimeException('Addition already exists');
            $ids[$p['id']]=true;$prepared[]=[validated_record($post($p),$p['kind']),$p['kind'],$p['id'],0];
        }
        // Consistent backup while the write reservation prevents competing writers.
        $backup=$backupDir.'/directory-research-'.gmdate('Ymd\THis\Z').'-'.substr(uid(),0,6).'.sqlite';
        umask(0077);$source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('Backup failed');
        $target->close();$source->close();chmod($backup,0600);
        foreach($prepared as [$p,$kind,$id,$revision])save_record($p,$kind,$id,$revision);
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Post-import integrity failure');
        db()->exec('COMMIT');
        echo json(['result'=>'RESEARCH_IMPORT_OK','updated'=>count($manifest['updates']),'added'=>count($manifest['additions']),'backup'=>$backup])."\n";
    }catch(Throwable $ex){db()->exec('ROLLBACK');throw $ex;}
}catch(Throwable $ex){fwrite(STDERR,'RESEARCH_IMPORT_FAILED: '.get_class($ex)."\n");exit(1);}
