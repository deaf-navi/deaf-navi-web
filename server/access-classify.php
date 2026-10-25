<?php
declare(strict_types=1);
require_once __DIR__.'/access-logs.php';

function access_periodic_signal(array $times,int $paths): ?array {
    sort($times,SORT_NUMERIC);$times=array_values(array_unique($times));
    if(count($times)<8||$paths>3||end($times)-$times[0]<1800)return null;
    $gaps=[];$bins=[];
    for($i=1;$i<count($times);$i++){
        $gap=$times[$i]-$times[$i-1];if($gap<30)continue;
        $gaps[]=$gap;if($gap>=60&&$gap<=3600){$bin=(int)(round($gap/30)*30);$bins[$bin]=($bins[$bin]??0)+1;}
    }
    if(count($gaps)<7||!$bins)return null;
    arsort($bins);$interval=(int)array_key_first($bins);$matched=0;$single=0;
    foreach($gaps as $gap){$multiple=(int)round($gap/$interval);if($multiple>=1&&$multiple<=3&&abs($gap-$multiple*$interval)<=max(5,$interval*.10)){$matched++;if($multiple===1)$single++;}}
    if($matched/count($gaps)<.8||$single<5)return null;
    return ['interval_seconds'=>$interval,'requests'=>count($times),'matched_gaps'=>$matched,'gap_count'=>count($gaps)];
}

function access_classify_build(): array {
    $dir=realpath(access_log_dir());if(!$dir)throw new RuntimeException('Missing access logs');
    $out=['version'=>1,'complete'=>true,'generated_at'=>gmdate('c'),'coverage_start'=>null,'days'=>[],'stats'=>['rows'=>0,'detailed_rows'=>0,'confirmed_visitors'=>0,'suspected_visitors'=>0]];
    $groups=[];$bytes=0;$start=microtime(true);$oldest=null;
    $previous=access_quality_snapshot();
    $cutoff=(new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo')))->modify('-2 days');
    $retention=$cutoff->modify('-180 days')->format('Y-m-d');
    foreach($previous['days'] as $day=>$visitors)if($day<$cutoff->format('Y-m-d')&&$day>=$retention)$out['days'][$day]=$visitors;
    foreach(glob($dir.'/access-v3*.log')?:[] as $file){
        if(is_link($file)||dirname(realpath($file)?:'')!==$dir)throw new RuntimeException('Unexpected log path');
        if(filemtime($file)<$cutoff->getTimestamp())continue;
        $h=fopen($file,'rb');if(!$h)throw new RuntimeException('Unreadable log');
        try{while(($line=fgets($h,65537))!==false){
            $bytes+=strlen($line);$out['stats']['rows']++;
            if($bytes>128*1024*1024||$out['stats']['rows']>400000||microtime(true)-$start>25)throw new RuntimeException('Analysis limit reached; prior snapshot preserved');
            if(!str_ends_with($line,"\n")){if(feof($h))break;throw new RuntimeException('Oversized row');}
            $raw=json_decode($line,true,32);if(!is_array($raw))throw new RuntimeException('Invalid complete row');
            $r=access_entry($line);if(!$r||$r['ip']===null||$r['user_agent']===null)continue;
            if($r['ts']<$cutoff->getTimestamp())continue;
            $out['stats']['detailed_rows']++;$oldest=min($oldest??$r['ts'],$r['ts']);
            // Assets, service-worker prefetch and admin traffic do not exclude a real reader.
            $isVisit=$r['path']==='/_access/visit'&&$r['method']==='POST'&&$r['status']===204;
            $isPage=$r['group']==='pages'&&$r['method']==='GET'&&in_array($r['status'],[200,304],true)&&access_content($r['path'])!==null;
            if(!$isVisit&&!$isPage)continue;
            // Caddy caps UA at 512 bytes. Do not merge a truncated fingerprint
            // with a full-UA visitor identity or change the existing daily HMAC.
            if(strlen($r['user_agent'])>=512)continue;
            $id=access_quality_identity($r['ip'],$r['user_agent'],$r['ts']);if(!$id)continue;
            [$day,$visitor]=$id;$uaClass=access_client($r['user_agent']);$class=null;
            if(in_array($uaClass,['ai','bot','automation'],true))$class=$uaClass;
            elseif($r['original_client']==='ai')$class='ai';
            elseif($isVisit&&$r['original_client']==='automation')$class='automation';
            if($class!==null){$out['days'][$day][$visitor]=['class'=>$class,'reason'=>'explicit-client-or-user-agent'];continue;}
            if($isPage&&$r['original_client']==='human'&&($raw['purpose']??'none')==='none'){
                $groups[$day][$visitor]['times'][]=$r['ts'];$groups[$day][$visitor]['paths'][$r['path']]=true;
            }
        }}finally{fclose($h);}
    }
    foreach($groups as $day=>$visitors)foreach($visitors as $visitor=>$group){
        if(isset($out['days'][$day][$visitor]))continue;
        $signal=access_periodic_signal($group['times'],count($group['paths']));
        if($signal)$out['days'][$day][$visitor]=['class'=>'suspected','reason'=>'periodic-single-connection']+$signal;
    }
    foreach($out['days'] as $visitors)foreach($visitors as $entry)$out['stats'][$entry['class']==='suspected'?'suspected_visitors':'confirmed_visitors']++;
    $out['coverage_start']=$previous['coverage_start']??($oldest===null?null:gmdate('c',(int)$oldest));
    return $out;
}

if(PHP_SAPI==='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){
    try{
        $out=access_classify_build();
        if(($argv[1]??'')==='--write'){
            $dir=access_visitor_dir();$file=$dir.'/quality.json';if(is_link($dir)||is_link($file))throw new RuntimeException('Unsafe output');
            $tmp=tempnam($dir,'.quality-');if($tmp===false)throw new RuntimeException('Cannot stage report');
            chmod($tmp,0640);$bytes=json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
            if(file_put_contents($tmp,$bytes,LOCK_EX)!==strlen($bytes)||!rename($tmp,$file))throw new RuntimeException('Cannot save report');
        }
        // No IPs, user agents, keys or visitor hashes in operational output.
        echo json_encode(['complete'=>$out['complete'],'generated_at'=>$out['generated_at'],'coverage_start'=>$out['coverage_start'],'stats'=>$out['stats']],JSON_UNESCAPED_UNICODE)."\n";
    }catch(Throwable $e){fwrite(STDERR,"ACCESS_CLASSIFICATION_FAILED: ".$e->getMessage()."\n");exit(1);}
}
