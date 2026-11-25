<?php
declare(strict_types=1);

function cafe_schedule_history(array $p,?DateTimeImmutable $today=null):array {
    if(($p['kind']??'')!=='cafe')return [];
    $day=cafe_schedule_day($p,$today);
    $archive=[];
    foreach($p['cafe_schedule_archive']??[] as $entry){
        $start=$entry['start']??'';$end=$entry['end']??'';
        if(!is_string($start)||!is_string($end)||!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$start)||!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$end)||$start>$end||$end>=$day)continue;
        $archive[$start.'/'.$end]=['start'=>$start,'end'=>$end,'source'=>(string)($entry['source']??'')];
    }
    if(cafe_has_recurring_schedule($p)){
        $schedule=(string)($p['event_schedule']??'');
        preg_match('/20\d{2}(?:年|(?=-\d{2}-\d{2}))/u',$schedule,$yearMatch);
        $year=empty($yearMatch)?null:(int)$yearMatch[0];
        $source=(string)(($p['official_url']??'')?:($p['verification_sources'][0]??''));
        foreach(['event_schedule','recurrence','business_hours'] as $field){
            [, $dated, , $past]=cafe_filter_schedule((string)($p[$field]??''),$day,$field==='event_schedule'?null:$year,true);
            foreach($past as [$start,$end])$archive[$start.'/'.$end]??=['start'=>$start,'end'=>$end,'source'=>$source];
            if($dated)break;
        }
    }
    uasort($archive,fn($a,$b)=>[$b['end'],$b['start']]<=>[$a['end'],$a['start']]);
    return array_values($archive);
}

function cafe_retain_schedule_history(array $previous,array $next,?DateTimeImmutable $today=null):array {
    if(!publicly_visible($previous)||!cafe_has_recurring_schedule($previous))return $next;
    foreach(['event_schedule','recurrence','business_hours','shop_type','timezone','country_code'] as $field){
        if(($previous[$field]??'')!==($next[$field]??'')){
            $history=cafe_schedule_history($previous,$today);
            if($history)$next['cafe_schedule_archive']=$history;
            break;
        }
    }
    return $next;
}

function cafe_schedule_history_html(array $history):string {
    if(!$history)return '';
    $out='<section class="dn-visitor-section" id="schedule-history"><h2>過去の開催情報</h2><p>日程を過ぎた告知です。開催されたかどうかは、主催者の開催報告をご確認ください。</p><ul>';
    $groups=[];
    foreach($history as $entry){
        $start=$entry['start'];$end=$entry['end'];
        $dates='<time datetime="'.e($start).'">'.e(str_replace('-','.',$start)).'</time>';
        if($end!==$start)$dates.='〜<time datetime="'.e($end).'">'.e(str_replace('-','.',$end)).'</time>';
        $groups[$entry['source']][]=$dates;
    }
    foreach($groups as $source=>$dates){
        $out.='<li>'.implode('、',$dates);
        // An older source can disappear; the announced date still stays in the archive.
        try{
            if($url=safe_url((string)$source))$out.=' '.ext_link($url,'掲載時の情報源');
        }catch(DomainException){}
        $out.='</li>';
    }
    return $out.'</ul></section>';
}
