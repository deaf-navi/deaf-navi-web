<?php
declare(strict_types=1);
// An operator-reviewed, revision-checked batch. No HTTP mutation endpoint.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
require __DIR__.'/cafe-event-registry.php';
umask(0077);
try {
    $mode=$argv[1]??'';
    if($mode==='--export'){echo json(cafe_registry_export())."\n";exit;}
    $file=$argv[2]??'';$backupDir=$argv[3]??'';$approved=$argv[4]??'';
    if(!in_array($mode,['--dry-run','--apply'],true)||!is_file($file)||is_link($file)||filesize($file)>1000000)fail('Usage: curate-cafe-events.php --export | --dry-run MANIFEST | --apply MANIFEST BACKUP_DIR PLAN_SHA256');
    $m=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);$hash=hash_file('sha256',$file);
    if(($m['version']??0)!==1)fail('Unsupported curation manifest');
    $batch=cafe_registry_id($m['batch']??null);$day=date_value(input($m,'checked_on',10));
    if(!$day||$day>cafe_registry_today())fail('Invalid research date');
    foreach(['series'=>200,'checks'=>200,'upserts'=>50,'links'=>200] as $key=>$max){$m[$key]??=[];if(!is_array($m[$key])||!array_is_list($m[$key])||count($m[$key])>$max)fail('Invalid batch list');}
    $discovery=[];foreach(['regions'=>10,'prefectures'=>47,'queries'=>60] as $key=>$max){$values=$m['discovery'][$key]??[];if(!is_array($values)||!array_is_list($values)||count($values)>$max)fail('Invalid discovery coverage');$discovery[$key]=[];foreach($values as $value)$discovery[$key][]=input(['value'=>$value],'value',600);}
    foreach($discovery['prefectures'] as $pref)if(!in_array($pref,explode(' ',JP_PREFECTURES),true))fail('Invalid discovery prefecture');
    $discovery['notes']=input($m['discovery']??[],'notes',2000);
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Database integrity failure');
        cafe_registry_schema();
        $done=query('SELECT manifest_hash,summary FROM cafe_event_curation_runs WHERE batch=?',[$batch])->fetch();
        if($done){if(!hash_equals($done['manifest_hash'],$hash))fail('Batch identity already used with different contents');db()->exec('ROLLBACK');echo json(['result'=>'ALREADY_APPLIED','changed'=>false,'summary'=>json_decode($done['summary'],true)])."\n";exit;}
        $before=query('SELECT * FROM records ORDER BY id')->fetchAll();$records=array_column($before,null,'id');$protected=[];
        foreach(['users','settings','submissions','outbox'] as $table)$protected[$table]=hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()));
        $oldSeries=query('SELECT * FROM cafe_event_series ORDER BY id')->fetchAll();$series=array_column($oldSeries,null,'id');$preparedSeries=[];
        foreach($m['series'] as $item){
            $id=cafe_registry_id($item['id']??null);if(isset($preparedSeries[$id]))fail('Repeated series identity');$old=$series[$id]??null;
            if(!is_int($item['expected_revision']??null)||$item['expected_revision']!==($old['revision']??0))fail('Series revision conflict: '.$id);
            $data=cafe_registry_series($item['data']??[]);$preparedSeries[$id]=$data;$series[$id]=array_replace($old??[],$data);
        }
        $checks=[];
        foreach($m['checks'] as $item){
            $id=cafe_registry_id($item['series_id']??null);if(!isset($series[$id])||isset($checks[$id]))fail('Unknown or repeated checked series');
            if(!is_int($item['expected_revision']??null)||$item['expected_revision']!==(array_column($oldSeries,'revision','id')[$id]??0))fail('Research revision conflict: '.$id);
            $result=choice(input($item,'result',20),CAFE_RESEARCH_RESULTS);
            $next=date_value(input($item,'next_event_on',10));if($next!==''&&$next<$day)fail('Next event must not be a past date');
            $nextCheck=date_value(input($item,'next_check_on',10));if(!$nextCheck||$nextCheck<$day||$nextCheck>(new DateTimeImmutable($day))->modify('+90 days')->format('Y-m-d'))fail('Research recheck must be within 90 days');
            $evidence=cafe_registry_urls($item['evidence_urls']??null);$notes=input($item,'notes',2000);
            $annual=$item['annual_review']??false;if(!is_bool($annual))fail('Annual review must be explicit');
            if($annual&&in_array($result,['unavailable','needs_review'],true))fail('Unverified research cannot finish an annual review');
            $checks[$id]=['result'=>$result,'next_event_on'=>$next?:null,'next_check_on'=>$nextCheck,'evidence_urls'=>$evidence,'notes'=>$notes,'annual_review'=>$annual];
        }
        $upserts=[];$summaryRecords=[];$links=$m['links'];
        foreach($preparedSeries as $sid=>$s)if($s['state']==='ended'&&($checks[$sid]['result']??'')!=='updated')fail('Ending a series requires verified research');
        foreach($m['upserts'] as $item){
            $id=cafe_registry_id($item['id']??null);$sid=cafe_registry_id($item['series_id']??null);$old=$records[$id]??null;
            if(isset($upserts[$id])||!isset($series[$sid])||($checks[$sid]['result']??'')!=='updated')fail('An updated research check is required for each listing');
            if(!is_int($item['expected_revision']??null)||$item['expected_revision']!==($old['revision']??0))fail('Listing revision conflict: '.$id);
            if($old&&($old['kind']!=='cafe'||$old['publication']!=='public'))fail('Only public cafe/event listings can be curated');
            $data=array_replace($old?json_decode($old['payload'],true,512,JSON_THROW_ON_ERROR):[],$item['data']??[]);
            if(($data['publication']??'')!=='public')fail('Curation may not delete, hide or approve a private listing');
            $p=array_replace($data,validated_record(cafe_post($data),'cafe'));
            foreach(['id','kind','revision','payload','created_at','updated_at'] as $systemKey)unset($p[$systemKey]);
            if(!empty($p['store_id']))fail('General cafe events cannot change store ownership');
            if(query("SELECT id FROM records WHERE slug=? AND id!=? AND kind IN ('cafe','store')",[$p['slug'],$id])->fetch())fail('Listing URL already exists');
            if($old&&$p['slug']!==$old['slug'])fail('Published URLs must be retained');
            if($p['last_verified_at']!==$day||!array_intersect($p['verification_sources'],$checks[$sid]['evidence_urls']))fail('Dated source evidence must support a listing update');
            if($p['country_code']!==$series[$sid]['country_code'])fail('Listing country mismatch');
            if(($p['shop_type']??'')==='event'){
                if($series[$sid]['series_kind']!=='oneoff'||empty($p['activity_date']))fail('A dated one-off series is required');
                if(isset($p['event_reported'])&&!is_bool($p['event_reported']))fail('Held-report flag must be boolean');
                if(!$old)foreach($records as $other){$op=isset($other['payload'])&&is_string($other['payload'])?expanded($other):$other;$od=$op['kind']==='event'?($op['event_date']??''):($op['activity_date']??'');if($op['publication']==='deleted'||cafe_listing_group($op)!=='events'||$od!==$p['activity_date']||$op['country_code']!==$p['country_code']||$op['prefecture']!==$p['prefecture']||$op['city']!==$p['city'])continue;$sameName=normalized($op['name'])===normalized($p['name']);$sameVenue=!empty($p['venue_name'])&&normalized($p['venue_name'])===normalized($op['venue_name']??'');if($sameName||$sameVenue)fail('Existing event on the same date and location; update its record instead');}
                $links[]=['series_id'=>$sid,'record_id'=>$id,'slot'=>$item['slot']??'default'];
            }else{
                if($series[$sid]['series_kind']!=='recurring'||!in_array($p['shop_type']??'',['recurring_program','recurring_popup','public_recurring','community_program'],true))fail('Only event or recurring-program listings are in scope');
                if($series[$sid]['listing_id']&&$series[$sid]['listing_id']!==$id)fail('Recurring listing already linked');
                if(!$old&&duplicate_records($p))fail('Duplicate recurring listing');
                if(!isset($preparedSeries[$sid])){$seriesData=$series[$sid];if(is_string($seriesData['source_urls']))$seriesData['source_urls']=json_decode($seriesData['source_urls'],true);$preparedSeries[$sid]=cafe_registry_series($seriesData);}
                $preparedSeries[$sid]['listing_id']=$id;
            }
            foreach($upserts as $other)if($other['payload']['slug']===$p['slug'])fail('Duplicate batch URL');
            $upserts[$id]=['payload'=>$p,'revision'=>$old['revision']??0];$records[$id]=array_replace($old??[],$p,['id'=>$id,'kind'=>'cafe','payload'=>json($p)]);
            $summaryRecords[]=['id'=>$id,'name'=>$p['name'],'action'=>$old?'update':'add','classification'=>cafe_listing_group($p)];
        }
        $oldLinks=query('SELECT * FROM cafe_event_occurrences ORDER BY record_id')->fetchAll();$occurrences=array_column($oldLinks,null,'record_id');$preparedLinks=[];$keys=[];
        foreach($links as $link){
            $sid=cafe_registry_id($link['series_id']??null);$rid=cafe_registry_id($link['record_id']??null);
            if(!isset($series[$sid],$records[$rid])||$series[$sid]['series_kind']!=='oneoff')fail('Invalid occurrence link');
            $r=$records[$rid];$p=isset($r['payload'])&&is_string($r['payload'])?expanded($r):$r;
            if(!publicly_visible($p)||cafe_listing_group($p)!=='events')fail('Only visible event records may be linked');
            if(isset($occurrences[$rid])&&$occurrences[$rid]['series_id']!==$sid)fail('Occurrence belongs to another series');
            $date=($p['kind']==='event'?$p['event_date']??'':$p['activity_date']??'');
            $slot=cafe_registry_id($link['slot']??'default');$key=$date?$date.'/'.$slot:'undated/'.$rid;
            if(isset($keys[$sid.'|'.$key])&&$keys[$sid.'|'.$key]!==$rid)fail('Duplicate dated occurrence');$keys[$sid.'|'.$key]=$rid;
            foreach($oldLinks as $o)if($o['series_id']===$sid&&$o['occurrence_key']===$key&&$o['record_id']!==$rid)fail('Duplicate dated occurrence');
            $preparedLinks[$rid]=['series_id'=>$sid,'occurrence_key'=>$key,'event_date'=>$date?:null];
        }
        $registrySnapshot=[];foreach(['cafe_event_research_checks','cafe_event_curation_runs','cafe_event_source_checks','cafe_event_source_runs'] as $t)$registrySnapshot[$t]=query('SELECT * FROM '.$t.' ORDER BY 1,2')->fetchAll();
        $plan=hash('sha256',json([$hash,$before,$protected,$oldSeries,$oldLinks,$registrySnapshot,$preparedSeries,$checks,$upserts,$preparedLinks]));
        $summary=['series_registered'=>count($preparedSeries),'researched'=>count($checks),'annual_reviews'=>count(array_filter($checks,fn($c)=>$c['annual_review'])),'added'=>count(array_filter($upserts,fn($u)=>!$u['revision'])),'updated'=>count(array_filter($upserts,fn($u)=>(bool)$u['revision'])),'occurrences_linked'=>count($preparedLinks),'records'=>$summaryRecords,'discovery'=>$discovery];
        $out=['result'=>'CAFE_CURATION_DRY_RUN_OK','batch'=>$batch,'checked_on'=>$day,'plan_sha256'=>$plan,'changed'=>false,'summary'=>$summary];
        if($mode==='--dry-run'){db()->exec('ROLLBACK');echo json($out)."\n";exit;}
        if(!hash_equals($plan,$approved)||!is_dir($backupDir)||is_link($backupDir))fail('Plan changed or backup directory invalid');
        $backup=$backupDir.'/before-cafe-curation-'.gmdate('YmdHis').'-'.substr(uid(),0,8).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')fail('Consistent backup failed');$target->close();$source->close();chmod($backup,0600);
        foreach($upserts as $id=>$u)save_record($u['payload'],'cafe',$id,$u['revision']);
        foreach($preparedSeries as $id=>$p){
            $args=[$p['title'],$p['organizer'],$p['country_code'],$p['prefecture'],$p['city'],$p['series_kind'],$p['state'],json($p['source_urls']),$p['cadence'],$p['notes'],$p['listing_id'],$p['next_check_on'],$p['annual_review_due_on'],now()];
            if(isset(array_column($oldSeries,null,'id')[$id]))query('UPDATE cafe_event_series SET title=?,organizer=?,country_code=?,prefecture=?,city=?,series_kind=?,state=?,source_urls=?,cadence=?,notes=?,listing_id=?,next_check_on=?,annual_review_due_on=?,updated_at=? WHERE id=?',[...$args,$id]);
            else query('INSERT INTO cafe_event_series(title,organizer,country_code,prefecture,city,series_kind,state,source_urls,cadence,notes,listing_id,next_check_on,annual_review_due_on,updated_at,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[...$args,$id,now()]);
        }
        query('INSERT INTO cafe_event_curation_runs VALUES(?,?,?,?,?,?)',[$batch,$hash,$day,json($discovery),json($summary),now()]);
        foreach($checks as $sid=>$c){
            query('INSERT INTO cafe_event_research_checks VALUES(?,?,?,?,?,?)',[$batch,$sid,$day,$c['result'],json($c['evidence_urls']),$c['notes']]);
            query('UPDATE cafe_event_series SET last_researched_on=?,last_result=?,next_event_on=?,next_check_on=?,annual_reviewed_on=CASE WHEN ? THEN ? ELSE annual_reviewed_on END,annual_review_due_on=CASE WHEN ? THEN ? ELSE annual_review_due_on END,updated_at=? WHERE id=?',[$day,$c['result'],$c['next_event_on'],$c['next_check_on'],(int)$c['annual_review'],$day,(int)$c['annual_review'],(new DateTimeImmutable($day))->modify('+1 year')->format('Y-m-d'),now(),$sid]);
        }
        foreach(array_unique([...array_keys($preparedSeries),...array_keys($checks)]) as $sid)if(isset(array_column($oldSeries,null,'id')[$sid]))query('UPDATE cafe_event_series SET revision=revision+1 WHERE id=?',[$sid]);
        foreach($preparedLinks as $rid=>$o)query('INSERT INTO cafe_event_occurrences VALUES(?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET occurrence_key=excluded.occurrence_key,event_date=excluded.event_date',[$rid,$o['series_id'],$o['occurrence_key'],$o['event_date']]);
        foreach($before as $r)if(!isset($upserts[$r['id']])&&json(record($r['id']))!==json($r))fail('Unrelated listing changed');
        foreach($protected as $table=>$digest)if(!hash_equals($digest,hash('sha256',json(query('SELECT * FROM '.$table.' ORDER BY 1')->fetchAll()))))fail('Protected table changed');
        if((int)query('SELECT count(*) FROM records')->fetchColumn()!==count($before)+$summary['added'])fail('Unexpected record count');
        audit('cafe_event_curation',$batch);
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Database integrity failure');
        db()->exec('COMMIT');echo json(array_replace($out,['result'=>'CAFE_CURATION_APPLIED','changed'=>true,'backup'=>$backup,'unrelated_records_unchanged'=>true,'protected_tables_unchanged'=>true]))."\n";
    }catch(Throwable $error){if(db()->inTransaction())db()->exec('ROLLBACK');else try{db()->exec('ROLLBACK');}catch(Throwable){}throw $error;}
}catch(Throwable $error){fwrite(STDERR,'CAFE_CURATION_FAILED: '.($error instanceof DomainException?$error->getMessage():get_class($error))."\n");exit(1);}
