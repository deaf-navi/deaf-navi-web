<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
require __DIR__.'/cafe-event-registry.php';
require __DIR__.'/cafe-event-fetch.php';
umask(0077);
try {
    $mode=$argv[1]??'';if(!in_array($mode,['--dry-run','--apply'],true))fail('Usage: check-cafe-event-sources.php --dry-run | --apply');
    if(!cafe_registry_ready())fail('Event registry is not initialized');
    $day=cafe_registry_today();
    if(query('SELECT checked_on FROM cafe_event_source_runs WHERE checked_on=?',[$day])->fetchColumn()){echo json(['result'=>'SOURCE_CHECK_ALREADY_DONE','checked_on'=>$day,'changed'=>false])."\n";exit;}
    $lock=fopen(data_dir().'/cafe-event-source-check.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))fail('Source check already running');
    $series=query("SELECT id,source_urls FROM cafe_event_series WHERE state='watching' ORDER BY id")->fetchAll();$urls=[];
    foreach($series as $s)foreach(json_decode($s['source_urls'],true) as $url)$urls[$url]=true;
    $lastDays=array_column(query('SELECT url,max(checked_on) AS day FROM cafe_event_source_checks GROUP BY url')->fetchAll(),'day','url');
    $ordered=array_keys($urls);usort($ordered,fn($a,$b)=>strcmp($lastDays[$a]??'',$lastDays[$b]??'')?:strcmp($a,$b));
    $checks=[];$counts=[];$started=microtime(true);
    foreach(array_slice($ordered,0,120) as $url){
        if(microtime(true)-$started>780)break;
        $last=query('SELECT fingerprint FROM cafe_event_source_checks WHERE url=? AND fingerprint IS NOT NULL ORDER BY checked_on DESC LIMIT 1',[$url])->fetchColumn()?:null;
        $check=cafe_event_fetch($url);
        if($check['result']==='fetched')$check['result']=$last===null?'baseline':(hash_equals($last,$check['fingerprint'])?'unchanged':'changed');
        $checks[$url]=$check;$counts[$check['result']]=($counts[$check['result']]??0)+1;
    }
    $summary=['checked_on'=>$day,'sources'=>count($checks),'registered_sources'=>count($urls),'deferred_sources'=>count($urls)-count($checks),'results'=>$counts,'public_listings_changed'=>0];
    if($mode==='--dry-run'){echo json(['result'=>'SOURCE_CHECK_DRY_RUN_OK','changed'=>false,'summary'=>$summary])."\n";exit;}
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('SELECT checked_on FROM cafe_event_source_runs WHERE checked_on=?',[$day])->fetchColumn()){db()->exec('ROLLBACK');echo json(['result'=>'SOURCE_CHECK_ALREADY_DONE','checked_on'=>$day,'changed'=>false])."\n";exit;}
        $latest=query("SELECT id,source_urls FROM cafe_event_series WHERE state='watching' ORDER BY id")->fetchAll();
        if(json($series)!==json($latest))fail('Source registry changed while checking; retry with current URLs');
        query('INSERT INTO cafe_event_source_runs VALUES(?,?,?)',[$day,json($summary),now()]);
        foreach($checks as $url=>$c)query('INSERT INTO cafe_event_source_checks VALUES(?,?,?,?,?)',[$day,$url,$c['result'],$c['http_status'],$c['fingerprint']]);
        db()->exec('COMMIT');echo json(['result'=>'SOURCE_CHECK_APPLIED','changed'=>true,'summary'=>$summary])."\n";
    }catch(Throwable $error){try{db()->exec('ROLLBACK');}catch(Throwable){}throw $error;}
}catch(Throwable $error){fwrite(STDERR,'CAFE_SOURCE_CHECK_FAILED: '.($error instanceof DomainException?$error->getMessage():get_class($error))."\n");exit(1);}
