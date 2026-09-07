<?php
declare(strict_types=1);
// CLI only; never run automatically in HTTP requests or in the seed initializer.
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
function candidate_match(array $row,array $existing):?array {
    $hits=[];
    foreach($existing as $r){if($r['country_code']!=='JP'||!in_array($r['kind'],['cafe','store'],true))continue;$p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
        $same=$r['id']===$row['id']||$r['slug']===$row['slug'];
        foreach(['official_url','instagram_url'] as $k)if(!empty($row['fields'][$k])&&cafe_identity_url($row['fields'][$k])===cafe_identity_url($p[$k]??''))$same=true;
        foreach([$row['name'],...($row['aliases']??[])] as $name)if(normalized($name)===normalized($r['name'])&&$r['prefecture']===$row['prefecture'])$same=true;
        if($same)$hits[]=$r;
    }
    if(count($hits)>1)fail('複数の重複候補があります: '.$row['slug'],409);
    return $hits[0]??null;
}
try{
    $mode=$argv[1]??'';$file=$argv[2]??'';$backupDir=$argv[3]??'';$approved=$argv[4]??'';
    if(!in_array($mode,['--dry-run','--apply'],true)||!is_file($file)||is_link($file))fail('Usage: cafe-migrate.php --dry-run MANIFEST | --apply MANIFEST BACKUP_DIR PLAN_SHA256');
    $manifest=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);$hash=hash_file('sha256',$file);
    if(($manifest['version']??0)!==2||!preg_match('/^[a-z0-9-]{1,100}$/D',$manifest['batch']??'')||!is_array($manifest['records']??null))fail('Manifest invalid');
    $preserve=$manifest['preserve_ids']??[];
    if(!is_array($preserve))fail('Invalid preserve list');
    foreach($preserve as $id)if(!is_string($id)||!preg_match('/^[a-z0-9-]{1,64}$/D',$id))fail('Invalid preserved id');
    db()->exec('BEGIN IMMEDIATE');
    try{
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Integrity failure');
        if(query("SELECT name FROM sqlite_master WHERE name='cafe_migration_runs'")->fetch()){
            $done=query('SELECT manifest_hash FROM cafe_migration_runs WHERE batch=?',[$manifest['batch']])->fetchColumn();
            if($done){if(!hash_equals($done,$hash))fail('Batch hash mismatch');db()->exec('ROLLBACK');echo json(['result'=>'ALREADY_APPLIED','changed'=>false])."\n";exit;}
        }
        $existing=query('SELECT * FROM records ORDER BY id')->fetchAll();$prepared=[];$original=[];
        foreach($existing as $r){$original[$r['id']]=$r;if(in_array($r['id'],$preserve,true)||!in_array($r['kind'],['cafe','store'],true))continue;
            $raw=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$p=cafe_model($raw+['kind'=>$r['kind'],'created_at'=>$r['created_at']]);
            foreach(['kind','created_at'] as $k)if(!array_key_exists($k,$raw))unset($p[$k]);
            if($r['status']==='closed')$p['status']='permanently_closed';
            if(json($p)!==json($raw))$prepared[$r['id']]=['kind'=>$r['kind'],'p'=>$p,'revision'=>(int)$r['revision'],'reason'=>'schema'];
        }
        $seen=[];$summary=[];
        foreach($manifest['records'] as $row){
            if(!preg_match('/^[a-z0-9-]{1,64}$/D',$row['id']??''))fail('Invalid id');
            $old=candidate_match($row,$existing);$id=$old['id']??$row['id'];if(isset($seen[$id]))fail('Duplicate in batch');$seen[$id]=true;
            if(in_array($id,$preserve,true))fail('Preserved record cannot be updated: '.$id);
            if($old&&$old['publication']==='deleted')fail('Deleted record requires manual review: '.$row['slug']);
            if(isset($row['expected_revision'])&&(!$old||(int)$old['revision']!==$row['expected_revision']))fail('Revision changed: '.$row['slug'],409);
            $base=$old?json_decode($old['payload'],true,512,JSON_THROW_ON_ERROR):['slug'=>$row['slug'],'name'=>$row['name'],'country_code'=>'JP','country_name'=>'日本','prefecture'=>$row['prefecture'],'city'=>$row['city'],'timezone'=>'Asia/Tokyo','publication'=>'pending','status'=>'needs_review','type'=>'special','verification_level'=>'pending','verification_sources'=>[],'last_verified_at'=>'','first_found_at'=>$manifest['date'],'subtypes'=>[]];
            $p=array_replace($prepared[$id]['p']??$base,$row['fields']);
            // Research changes cannot grant publication or restore removed records.
            $p['publication']=$base['publication'];$p['slug']=$base['slug'];
            $kind=$old['kind']??'cafe';$validated=validated_record(cafe_post($p),$kind);$p=cafe_model(array_replace($p,$validated));
            // Old map coordinates cease being evidence after an address change.
            if(($base['address']??'')!==($p['address']??'')){$p['latitude']=null;$p['longitude']=null;$p['coordinate_accuracy']='unknown';$p['coordinate_source_url']='';$p['map_url']='';if(!empty($base['address'])&&empty($p['previous_address']))$p['previous_address']=$base['address'];}
            $prepared[$id]=['kind'=>$kind,'p'=>$p,'revision'=>(int)($old['revision']??0),'reason'=>$old?'research_update':'research_add'];
            $summary[]=['id'=>$id,'name'=>$p['name'],'action'=>$old?'update':'add','status'=>$p['status'],'publication'=>$p['publication'],'confirmation_status'=>$p['confirmation_status']];
        }
        $planHash=hash('sha256',json(['manifest'=>$hash,'before'=>$existing,'prepared'=>$prepared]));
        $result=['result'=>'CAFE_MIGRATION_DRY_RUN_OK','batch'=>$manifest['batch'],'plan_sha256'=>$planHash,'existing'=>count($existing),'migration_records'=>count($prepared),'records'=>$summary,'changed'=>false];
        if($mode==='--dry-run'){db()->exec('ROLLBACK');echo json($result)."\n";exit;}
        if(!hash_equals($planHash,$approved)||!is_dir($backupDir)||is_link($backupDir))fail('Plan changed or backup directory invalid');
        $untouched=[];foreach(['users','settings','submissions','outbox'] as $table)$untouched[$table]=hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()));
        umask(0077);$backup=$backupDir.'/before-cafe-v2-'.gmdate('YmdHis').'-'.substr(uid(),0,8).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')fail('Backup failure');$target->close();$source->close();chmod($backup,0600);
        foreach($prepared as $id=>$item)save_record($item['p'],$item['kind'],$id,$item['revision']);
        foreach($original as $id=>$before){$after=record($id);if(!isset($prepared[$id])&&json($after)!==json($before))fail('Unrelated record changed');if($before['slug']!==$after['slug']||$before['publication']!==$after['publication']||$before['created_at']!==$after['created_at'])fail('Identity/publication changed');}
        foreach($untouched as $table=>$before)if(!hash_equals($before,hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()))))fail('Unrelated table changed');
        db()->exec('CREATE TABLE IF NOT EXISTS cafe_migration_runs(batch TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL,applied_at TEXT NOT NULL)');
        query('INSERT INTO cafe_migration_runs VALUES(?,?,?)',[$manifest['batch'],$hash,now()]);
        db()->exec("CREATE INDEX IF NOT EXISTS cafes_freshness ON records(json_extract(payload,'$.last_verified_at')) WHERE kind IN ('cafe','store')");
        db()->exec("CREATE INDEX IF NOT EXISTS cafes_shop_type ON records(country_code,json_extract(payload,'$.shop_type'),status) WHERE kind IN ('cafe','store')");
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Integrity failure');
        db()->exec('COMMIT');echo json(array_replace($result,['result'=>'CAFE_MIGRATION_APPLIED','changed'=>true,'backup'=>$backup,'preserved_existing_ids'=>true,'unrelated_tables_unchanged'=>true]))."\n";
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}catch(Throwable $e){fwrite(STDERR,'CAFE_MIGRATION_FAILED: '.($e instanceof DomainException?$e->getMessage():get_class($e))."\n");exit(1);}
