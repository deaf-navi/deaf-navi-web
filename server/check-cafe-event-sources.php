<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
require __DIR__.'/cafe-event-registry.php';
require __DIR__.'/cafe-event-fetch.php';
umask(0077);
try {
    $mode=$argv[1]??'';
    if(!in_array($mode,['--dry-run','--apply','--recover','--refresh'],true))fail('Usage: check-cafe-event-sources.php --dry-run | --apply | --recover | --refresh');
    if(!cafe_registry_ready()||!cafe_event_recovery_ready())fail('Event recovery schema is not initialized');
    $lock=fopen(data_dir().'/cafe-event-source-check.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){echo json(['result'=>'SOURCE_CHECK_BUSY','changed'=>false])."\n";exit;}
    $day=cafe_registry_today();$recover=in_array($mode,['--recover','--refresh'],true);$started=microtime(true);
    if(!$recover&&query('SELECT checked_on FROM cafe_event_source_runs WHERE checked_on=?',[$day])->fetchColumn()){echo json(['result'=>'SOURCE_CHECK_ALREADY_DONE','checked_on'=>$day,'changed'=>false])."\n";exit;}
    $series=query("SELECT id,source_urls FROM cafe_event_series WHERE state='watching' ORDER BY id")->fetchAll();$urls=[];
    foreach($series as $s)foreach(json_decode($s['source_urls'],true) as $url)$urls[$url]=true;
    $states=array_column(query('SELECT * FROM cafe_event_source_state')->fetchAll(),null,'url');
    $ordered=array_keys($urls);
    if($mode==='--refresh'){
        $eventUrls=[];foreach(query("SELECT payload FROM records WHERE publication='public' AND COALESCE(json_extract(payload,'$.activity_date'),json_extract(payload,'$.event_date'))>=?",[$day])->fetchAll() as $r)foreach(json_decode($r['payload'],true)['verification_sources']??[] as $u)$eventUrls[$u]=true;
        $ordered=array_values(array_filter($ordered,fn($u)=>isset($eventUrls[$u])));
    }
    if($mode==='--recover')$ordered=array_values(array_filter($ordered,fn($u)=>!empty($states[$u]['next_attempt_at'])&&strtotime($states[$u]['next_attempt_at'])<=time()));
    // Prioritize approved future events over the wider discovery backlog.
    $priority=array_fill_keys(query("SELECT v.url FROM cafe_event_source_reviews v JOIN records r ON r.id=v.record_id WHERE r.publication='public' AND COALESCE(json_extract(r.payload,'$.activity_date'),json_extract(r.payload,'$.event_date'))>=?",[$day])->fetchAll(PDO::FETCH_COLUMN),true);
    $lastDays=array_column(query('SELECT url,max(checked_on) AS day FROM cafe_event_source_checks GROUP BY url')->fetchAll(),'day','url');
    usort($ordered,fn($a,$b)=>($recover?0:(isset($priority[$b])<=>isset($priority[$a])))?:strcmp($recover?($states[$a]['next_attempt_at']??''):($states[$a]['last_attempt_at']??$lastDays[$a]??''),$recover?($states[$b]['next_attempt_at']??''):($states[$b]['last_attempt_at']??$lastDays[$b]??''))?:strcmp($a,$b));
    if($recover&&!$ordered){echo json(['result'=>'NO_SOURCES_DUE','changed'=>false])."\n";exit;}
    $checks=[];$counts=[];
    foreach(array_slice($ordered,0,$recover?40:120) as $url){
        if(microtime(true)-$started>($recover?240:780))break;
        $old=$states[$url]??null;
        if(!$old){$row=query('SELECT c.*,r.finished_at FROM cafe_event_source_checks c JOIN cafe_event_source_runs r ON r.checked_on=c.checked_on WHERE url=? AND fingerprint IS NOT NULL ORDER BY c.checked_on DESC LIMIT 1',[$url])->fetch();if($row)$old=['fingerprint'=>$row['fingerprint'],'last_success_at'=>$row['finished_at']];}
        $check=cafe_event_fetch($url);
        $checks[$url]=cafe_event_source_transition($old,$check,time());
        $counts[$checks[$url]['result']]=($counts[$checks[$url]['result']]??0)+1;
    }
    $summary=['checked_on'=>$day,'mode'=>$recover?'recovery':'daily','sources'=>count($checks),'registered_sources'=>count($urls),'deferred_sources'=>count($ordered)-count($checks),'results'=>$counts,'public_listings_changed'=>0];
    if($mode==='--dry-run'){echo json(['result'=>'SOURCE_CHECK_DRY_RUN_OK','changed'=>false,'summary'=>$summary])."\n";exit;}
    db()->exec('BEGIN IMMEDIATE');
    try {
        $latest=query("SELECT id,source_urls FROM cafe_event_series WHERE state='watching' ORDER BY id")->fetchAll();
        if(json($series)!==json($latest))fail('Source registry changed while checking; retry with current URLs');
        if(!$recover){
            if(query('SELECT checked_on FROM cafe_event_source_runs WHERE checked_on=?',[$day])->fetchColumn())fail('Daily source check already recorded');
            query('INSERT INTO cafe_event_source_runs VALUES(?,?,?)',[$day,json($summary),now()]);
            foreach($checks as $url=>$c)query('INSERT INTO cafe_event_source_checks VALUES(?,?,?,?,?)',[$day,$url,$c['result'],$c['http_status'],in_array($c['result'],['baseline','unchanged','changed'],true)?$c['fingerprint']:null]);
        }else query('INSERT INTO cafe_event_recovery_runs VALUES(?,?,?)',[gmdate('c',(int)$started),now(),json($summary)]);
        foreach($checks as $url=>$c)cafe_event_source_save($url,$c);
        foreach($states as $url=>$c)if(!isset($urls[$url])&&!empty($c['next_attempt_at']))query('UPDATE cafe_event_source_state SET next_attempt_at=NULL WHERE url=?',[$url]);
        db()->exec('COMMIT');echo json(['result'=>$recover?'SOURCE_RECOVERY_APPLIED':'SOURCE_CHECK_APPLIED','changed'=>true,'summary'=>$summary])."\n";
    }catch(Throwable $error){try{db()->exec('ROLLBACK');}catch(Throwable){}throw $error;}
}catch(Throwable $error){fwrite(STDERR,'CAFE_SOURCE_CHECK_FAILED: '.($error instanceof DomainException?$error->getMessage():get_class($error))."\n");exit(1);}
