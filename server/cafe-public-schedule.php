<?php
declare(strict_types=1);

const CAFE_SCHEDULE_PENDING = '日程確認中';

/** Filter calendar dates from an announced schedule, without calculating dates from a cadence. */
function cafe_filter_schedule(string $schedule,string $today,?int $year=null): array {
    $pattern='/\b(?<isoYear>20\d{2})-(?<isoMonth>\d{2})-(?<isoDay>\d{2})\b|(?:(?<year>20\d{2})年)?(?<month>\d{1,2})月(?:は)?\s*(?<days>\d{1,2}(?:[・･]\d{1,2})*)日(?:[（(][月火水木金土日](?:曜(?:日)?)?[）)])?/u';
    $lines=[];$dated=false;$upcoming=false;$changed=false;
    foreach(preg_split('/(?<=。)|(?<=\n)/u',$schedule,-1,PREG_SPLIT_NO_EMPTY) as $line){
        $originalLine=$line;
        preg_match_all($pattern,$line,$matches,PREG_SET_ORDER|PREG_OFFSET_CAPTURE|PREG_UNMATCHED_AS_NULL);
        $dates=[];
        foreach($matches as $m){
            $explicitYear=$m['year'][0]??$m['isoYear'][0];
            if($explicitYear!==null)$year=(int)$explicitYear;
            if($year===null)continue;
            $month=(int)($m['month'][0]??$m['isoMonth'][0]);
            $days=preg_split('/[・･]/u',$m['days'][0]??$m['isoDay'][0]);
            if(array_filter($days,fn($day)=>!checkdate($month,(int)$day,$year)))continue;
            $live=array_values(array_filter($days,fn($day)=>sprintf('%04d-%02d-%02d',$year,$month,(int)$day)>=$today));
            $dates[]=['text'=>$m[0][0],'offset'=>$m[0][1],'live'=>$live,'all'=>$days,
                'year'=>$year,'datePrefix'=>$year.'年'.$month.'月','explicit'=>$explicitYear!==null];
        }
        if(!$dates){$lines[]=[$line,false];continue;}
        // For a date range, both endpoints provide context through the last day.
        foreach($dates as $i=>&$date){
            if($i===0||!$date['live'])continue;
            $previous=$dates[$i-1];
            $gap=$previous['offset']+strlen($previous['text']);
            if(preg_match('/^\s*[〜～−–—~]\s*$/u',substr($line,$gap,$date['offset']-$gap)))$dates[$i-1]['live']=$previous['all'];
        }
        unset($date);
        $dated=true;
        $liveDates=array_filter($dates,fn($date)=>$date['live']);
        if(!$liveDates){$changed=true;continue;}
        $upcoming=true;
        $removed=false;
        for($i=count($dates)-1;$i>=0;$i--){
            $date=$dates[$i];
            if($date['live']===$date['all'])continue;
            $changed=true;
            $replacement=$date['live']?$date['datePrefix'].implode('・',$date['live']).'日':'';
            $line=substr_replace($line,$replacement,$date['offset'],strlen($date['text']));
            $removed=$removed||$replacement==='';
        }
        // Rebuild date lists when a removed date left separators or a stale 「次回」 label.
        if($removed){
            $last=end($dates);
            $prefix=implode('、',array_map(fn($date)=>$date['live']!==$date['all']?$date['datePrefix'].implode('・',$date['live']).'日':($date['explicit']?$date['text']:$date['year'].'年'.$date['text']),$liveDates));
            // Suffix is after the last retained date only when it was the last announced date.
            $line=$prefix.(end($liveDates)===$last?substr($originalLine,$last['offset']+strlen($last['text'])):'。');
        }elseif($changed&&!$dates[0]['explicit']&&$line!==''){
            $line=preg_replace('/^\s*以降/u','',$line);
            $first=$dates[0];
            if(str_starts_with(trim($line),$first['text']))$line=$first['year'].'年'.trim($line);
        }
        $lines[]=[$line,true];
    }
    if($dated&&!$upcoming)return ['',true,false];
    if($changed)$lines=array_filter($lines,fn($line)=>$line[1]);
    return [trim(implode('',array_column($lines,0))),$dated,$upcoming];
}

function cafe_public_schedule(array $p,?DateTimeImmutable $today=null):array {
    if(($p['kind']??'')!=='cafe' || !in_array($p['shop_type']??'',['recurring_program','recurring_popup','public_recurring','community_program','community_space','facility_cafe'],true))return $p;
    if(in_array($p['shop_type'],['facility_cafe','community_space'],true)&&($p['status']??'')!=='active_recurring')return $p;
    $zone=($p['country_code']??'JP')==='JP'?'Asia/Tokyo':($p['timezone']??'');
    $today??=new DateTimeImmutable('today',new DateTimeZone(in_array($zone,DateTimeZone::listIdentifiers(),true)?$zone:'Asia/Tokyo'));
    $day=$today->format('Y-m-d');
    $originalSchedule=(string)($p['event_schedule']??'');
    [$schedule,$dated,$upcoming]=cafe_filter_schedule($originalSchedule,$day);
    preg_match('/20\d{2}年|20\d{2}(?=-\d{2}-\d{2})/u',$originalSchedule,$yearMatch);
    $year=empty($yearMatch)?null:(int)$yearMatch[0];
    [$recurrence,$recurrenceDated,$recurrenceUpcoming]=cafe_filter_schedule((string)($p['recurrence']??''),$day,$year);
    [$hours,$hoursDated,$hoursUpcoming]=cafe_filter_schedule((string)($p['business_hours']??''),$day,$year);
    $p['event_schedule']=$upcoming?$schedule:($recurrenceUpcoming?$recurrence:($hoursUpcoming?$hours:CAFE_SCHEDULE_PENDING));
    $p['recurrence']=$recurrenceDated?'':$recurrence;
    $p['business_hours']=$hours;
    $notesMentionDatedNext=preg_match('/次回[^。\n]{0,24}(?:\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})/u',(string)($p['notes']??''));
    if($p['event_schedule']===CAFE_SCHEDULE_PENDING&&($dated||$recurrenceDated||$hoursDated||$notesMentionDatedNext)){
        // Keep the original conditions available as history, away from current visit information.
        $p['past_visit_information']=['notes'=>$p['notes']??'','reservation'=>$p['reservation']??''];
        $p['notes']='';$p['reservation']='';$p['business_hours']='';
    }elseif($upcoming&&$schedule!==$originalSchedule){
        foreach(['notes','reservation'] as $key){
            $p[$key]=preg_replace_callback('/[^。\n]*次回(?:は|：|:|の)[^。\n]*(?:。|$)/u',
                fn($m)=>cafe_filter_schedule($m[0],$day,$year)[2]?$m[0]:'',(string)($p[$key]??''));
        }
    }
    $p['public_cafe_schedule']=true;
    return $p;
}
