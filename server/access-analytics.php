<?php
declare(strict_types=1);

// Pure aggregation helpers. No new identifiers, network calls, or background jobs.
const ACCESS_CHANNELS = ['search'=>'検索サイト','social'=>'SNS','referral'=>'外部サイト','internal'=>'サイト内','unattributed'=>'参照元なし・判別不能','unrecorded'=>'旧ログ・未取得'];
const ACCESS_DEVICES = ['mobile'=>'スマートフォン','tablet'=>'タブレット','desktop'=>'PC等','unknown'=>'判別不能・未取得'];

function access_referrer(mixed $value): array {
    if ($value === null) return ['channel'=>'unrecorded','host'=>null];
    $host = is_string($value) ? strtolower(rtrim($value,'.')) : '';
    if ($host==='none-or-invalid' || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,63}$/D',$host) || strlen($host)>253)
        return ['channel'=>'unattributed','host'=>null];
    if (in_array($host,['deafnavi.com','www.deafnavi.com'],true)) return ['channel'=>'internal','host'=>$host];
    foreach (['google.com','google.co.jp','bing.com','search.yahoo.co.jp','search.yahoo.com','duckduckgo.com','ecosia.org','search.brave.com','baidu.com'] as $suffix)
        if ($host===$suffix || str_ends_with($host,'.'.$suffix)) return ['channel'=>'search','host'=>$host];
    foreach (['x.com','t.co','twitter.com','instagram.com','facebook.com','l.facebook.com','line.me','liff.line.me','tiktok.com','threads.net','threads.com','bsky.app','youtube.com'] as $suffix)
        if ($host===$suffix || str_ends_with($host,'.'.$suffix)) return ['channel'=>'social','host'=>$host];
    return ['channel'=>'referral','host'=>$host];
}

function access_device(?string $ua): string {
    if ($ua===null || $ua==='' || $ua==='invalid-or-missing') return 'unknown';
    if (preg_match('/iPad|Tablet|Kindle|Silk|Android(?!.*Mobile)/i',$ua)) return 'tablet';
    if (preg_match('/iPhone|iPod|Android|Mobile|Windows Phone/i',$ua)) return 'mobile';
    return preg_match('/Windows NT|Macintosh|X11|CrOS/i',$ua)?'desktop':'unknown';
}

function access_previous_options(array $o): ?array {
    if (($o['summary']??false) || ($o['compare']??'off')!=='previous') return null;
    $from = new DateTimeImmutable($o['from'],new DateTimeZone('Asia/Tokyo'));
    $to = new DateTimeImmutable($o['to'],new DateTimeZone('Asia/Tokyo'));
    $days = (int)$from->diff($to)->days+1;
    $end = $from; $start = $end->modify('-'.$days.' days');
    return array_replace($o,['from'=>$start->format('Y-m-d'),'to'=>$end->modify('-1 day')->format('Y-m-d'),
        'start'=>$start->getTimestamp(),'end'=>$end->getTimestamp(),'compare'=>'off','page'=>1]);
}

function access_report_empty(): array {
    return ['available'=>false,'partial'=>false,'invalid'=>0,'total'=>0,'pages'=>0,'not_found'=>0,'errors'=>0,
        'latest'=>null,'oldest'=>null,'paths'=>[],'days'=>[],'rows'=>[],'raw_total'=>0,
        'excluded'=>array_fill_keys(array_keys(ACCESS_EXCLUSIONS),0),'contents'=>array_fill_keys(array_keys(ACCESS_CONTENTS),0),
        'channels'=>array_fill_keys(array_keys(ACCESS_CHANNELS),0),'referrers'=>[],
        'devices'=>array_fill_keys(array_keys(ACCESS_DEVICES),0),'hours'=>array_fill(0,24,0),'weekdays'=>array_fill(1,7,0),
        'duration_count'=>0,'duration_sum'=>0.0,'ua_unmatchable'=>0,'reasons'=>[],
        'scanned_lines'=>0,'scanned_bytes'=>0,'as_of'=>gmdate('c')];
}

function access_aggregate_row(array &$report,array $r,array $o): bool {
    if ($r['ts']<$o['start'] || $r['ts']>=$o['end']) return false;
    if ($o['q']!=='') {
        $hit=stripos($r['path'],$o['q']);
        if (match($o['match']??'contains') {'exact'=>strcasecmp($r['path'],$o['q'])!==0,'prefix'=>$hit!==0,default=>$hit===false}) return false;
    }
    // A page's category is independent of a successful response or client classification.
    $content = access_content($r['path']);
    $reason = access_exclusion($r);
    $report['raw_total']++;
    if ($reason!==null) $report['excluded'][$reason]++;
    else $report['contents'][$content]++;
    if (($o['mode']??'requests')==='views' && $reason!==null) return false;
    if (($o['content']??'all')!=='all' && $content!==$o['content']) return false;
    if ($o['group']!=='all' && $r['group']!==$o['group']) return false;
    if (($o['client']??'all')!=='all' && $r['client']!==$o['client']) return false;
    if ($o['status']!=='' && intdiv($r['status'],100)!==(int)$o['status'][0]) return false;
    $report['total']++;
    if ($reason===null) $report['pages']++;
    if ($r['status']===404) $report['not_found']++;
    if ($r['status']>=500) $report['errors']++;
    if (($o['summary']??false)===true) return true;
    $pagePath=$r['path'];
    $key=$r['host'].$pagePath;
    if (!isset($report['paths'][$key])) $report['paths'][$key]=['host'=>$r['host'],'path'=>$pagePath,'count'=>0,'errors'=>0];
    $report['paths'][$key]['count']++;
    if ($r['status']>=400) $report['paths'][$key]['errors']++;
    $at=(new DateTimeImmutable('@'.(int)$r['ts']))->setTimezone(new DateTimeZone('Asia/Tokyo'));
    $day=$at->format('Y-m-d'); $report['days'][$day]=($report['days'][$day]??0)+1;
    $report['hours'][(int)$at->format('G')]++; $report['weekdays'][(int)$at->format('N')]++;
    $ref=access_referrer($r['referrer_host']); $report['channels'][$ref['channel']]++;
    if (in_array($ref['channel'],['search','social','referral'],true)) {
        $host=$ref['host'];
        if (!isset($report['referrers'][$host])) $report['referrers'][$host]=['host'=>$host,'channel'=>$ref['channel'],'count'=>0];
        $report['referrers'][$host]['count']++;
    }
    $report['devices'][access_device($r['user_agent'])]++;
    if ($r['duration']!==null) { $report['duration_count']++; $report['duration_sum']+=$r['duration']; }
    if ($r['user_agent']!==null && strlen($r['user_agent'])>=512) $report['ua_unmatchable']++;
    return true;
}

function access_comparison_state(array $o,array $r,?array $previous,?DateTimeImmutable $today=null): array {
    $p=access_previous_options($o);
    if (!$p || !$previous) return ['available'=>false,'reason'=>'比較なし','from'=>null,'to'=>null];
    $reasons=[]; $today??=new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));
    if ($o['end']>$today->getTimestamp()) $reasons[]='今日を含む期間は集計途中';
    if ($p['start']<access_retention_start($today)->getTimestamp()) $reasons[]='前期間が保存対象期間外';
    if (!$r['available'] || !$previous['available']) $reasons[]='ログ未取得';
    if ($r['partial'] || $previous['partial'] || $r['invalid'] || $previous['invalid']) $reasons[]='部分集計・形式不明';
    if ($r['oldest']===null || $r['oldest']>$p['start']) $reasons[]='前期間の先頭まで記録を確認できない';
    if ($r['latest']===null || $r['latest']<$o['end']) $reasons[]='期間末まで記録を確認できない';
    return ['available'=>!$reasons,'reason'=>implode(' / ',array_unique($reasons)),'from'=>$p['from'],'to'=>$p['to']];
}

function access_delta(int $current,?int $previous,bool $valid): array {
    if (!$valid || $previous===null) return ['difference'=>null,'percent'=>null];
    return ['difference'=>$current-$previous,'percent'=>$previous===0?null:round(($current-$previous)/$previous*100,1)];
}

function access_referrer_coverage(array $r):array {
    $total=(int)($r['total']??0);$missing=(int)($r['channels']['unrecorded']??0);
    $recorded=max(0,$total-$missing);
    return ['recorded'=>$recorded,'missing'=>$missing,'total'=>$total,
        'available'=>($r['available']??false)&&($total===0||$recorded>0),
        'partial'=>$missing>0];
}

function access_uu_measurement(array $o,array $uu,?string $content=null):array {
    $content??=$o['content']??'all';
    $at=$content==='stories'?($uu['stories_started_at']??null):($uu['started_at']??null);
    $start=is_string($at)?strtotime($at):false;
    $from=(new DateTimeImmutable($o['from'],new DateTimeZone('Asia/Tokyo')))->getTimestamp();
    $end=(new DateTimeImmutable($o['to'],new DateTimeZone('Asia/Tokyo')))->modify('+1 day')->getTimestamp();
    $available=($uu['available']??false)&&$start!==false&&$end>$start;
    return ['available'=>$available,'partial'=>$available&&($from<$start||($content==='all'&&($uu['stories_measurement_gap']??false)))];
}
function access_uu_value(array $o,array $uu,int $n,?string $content=null):?int {
    return access_uu_measurement($o,$uu,$content)['available']?$n:null;
}

function access_covisits(array $o): array {
    $result=['available'=>false,'pairs'=>[],'total'=>null];
    try {
        $db=access_visitor_db();
        $create=method_exists($db,'createFunction')?'createFunction':'sqliteCreateFunction';
        $db->$create('content_key',fn($p)=>access_content($p),1);
        $db->$create('quality_excluded',fn($d,$v)=>access_quality_class($d,$v)!==null?1:0,2);
        $s=$db->prepare('WITH c AS (SELECT DISTINCT day,visitor,content_key(path) AS content FROM visits v
            WHERE day>=? AND day<=? AND content_key(path) IS NOT NULL AND quality_excluded(day,visitor)=0
            AND NOT EXISTS (SELECT 1 FROM excluded_visitors x WHERE x.day=v.day AND x.visitor=v.visitor))
            SELECT a.content AS a,b.content AS b,COUNT(*) AS count FROM c a JOIN c b
            ON a.day=b.day AND a.visitor=b.visitor AND a.content<b.content GROUP BY a.content,b.content ORDER BY count DESC,a.content,b.content');
        $s->execute([$o['from'],$o['to']]); $result['pairs']=$s->fetchAll(); $result['available']=true;
    } catch (Throwable) { /* Unavailable stays distinct from an empty observed result. */ }
    return $result;
}

function access_csv_cell(mixed $value): string {
    if (is_int($value)||is_float($value)) return (string)$value;
    $s=(string)($value??'UNKNOWN');
    // Spreadsheet formula injection: exports contain aggregates, never raw identifiers.
    return preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$s)?"'".$s:$s;
}

function access_csv_rows(array $o,array $r,array $uu,array $eng=[],array $co=[]): array {
    $quality=!$r['available']?'unavailable':($r['partial']||$r['invalid']?'partial':'saved_logs_read');
    $rows=[['section','key','value','unit','from_JST','to_JST','quality'],
        ['conditions','mode',$o['mode'],'',$o['from'],$o['to'],$quality],
        ['conditions','content',$o['content'],'',$o['from'],$o['to'],$quality],
        ['conditions','group',$o['group'],'',$o['from'],$o['to'],$quality],
        ['conditions','path_match',$o['match']??'contains','',$o['from'],$o['to'],$quality],
        ['conditions','path_filter_applied',$o['q']!==''?'yes':'no','',$o['from'],$o['to'],$quality],
        ['conditions','client',$o['client'],'',$o['from'],$o['to'],$quality],
        ['conditions','status',$o['status'],'',$o['from'],$o['to'],$quality],
        ['conditions','as_of',$r['as_of'],'UTC',$o['from'],$o['to'],$quality]];
    $add=function($section,$key,$value,$unit,$state=null) use (&$rows,$o,$quality) {
        if($quality==='unavailable'&&$unit==='requests')$value=null;
        $rows[]=[$section,$key,$value,$unit,$o['from'],$o['to'],$state??$quality];
    };
    $add('totals',$o['mode']==='views'?'page_views':'requests',$r['available']?$r['total']:null,'requests');
    $um=access_uu_measurement($o,$uu);
    $add('totals','estimated_daily_uniques_sum',access_uu_value($o,$uu,(int)($uu['total']??0)),'person_days',$um['available']?($um['partial']?'JS_received_partial_period':'JS_received_estimate'):'unavailable');
    $cmp=access_comparison_state($o,$r,$r['previous']??null);
    $add('comparison','reason',$cmp['available']?'comparable':$cmp['reason'],'');
    if ($cmp['from']!==null) {
        $rows[]=['comparison','previous_total',($r['previous']['available']??false)?$r['previous']['total']:null,'requests',$cmp['from'],$cmp['to'],$cmp['available']?'comparable':'not_comparable'];
        $delta=access_delta($r['total'],$r['previous']['total']??null,$cmp['available']);
        $add('comparison','difference',$delta['difference'],'requests',$cmp['available']?'comparable':'not_comparable');
        $add('comparison','percent',$delta['percent'],'percent',$cmp['available']?'comparable':'not_comparable');
    }
    foreach ($r['days'] as $day=>$n) $add('daily',$day,$n,'requests');
    foreach ($r['paths'] as $p) $add('pages',$p['host'].$p['path'],$p['count'],'requests');
    $rc=access_referrer_coverage($r);
    $refQuality=!$rc['available']?'unavailable':($rc['partial']?'referrer_records_partial':$quality);
    $add('referrer_coverage','recorded',$rc['recorded'],'requests');
    $add('referrer_coverage','unrecorded',$rc['missing'],'requests');
    foreach ($r['channels'] as $k=>$n) $add('request_referrers',$k,$k==='unrecorded'||$rc['available']?$n:null,'requests',$k==='unrecorded'?$quality:$refQuality);
    foreach ($r['referrers'] as $p) $add('external_referrers',$p['host'],$p['count'],'requests',$refQuality);
    foreach ($r['devices'] as $k=>$n) $add('device_estimate',$k,$n,'requests');
    foreach ($r['hours'] as $hour=>$n) $add('hour_JST',(string)$hour,$n,'requests');
    foreach ($r['excluded'] as $k=>$n) $add('excluded_all_contents',$k,$n,'requests');
    foreach ($uu['days']??[] as $day=>$n) $add('estimated_daily_uniques',$day,$n,'estimated_people','JS_received_estimate');
    if ($eng) {
        $add('actions_scope','filters','date_only','');
        $add('actions_scope','earliest_saved_day',$eng['first_day'],'',$eng['available']?'observed':'unavailable');
        foreach ($eng['rows'] as $v) $add('actions_date_only',$v['source'].'/'.$v['event'],(int)$v['hits'],'notifications',$v['saturated']?'lower_bound':'JS_received_count');
        if (!$eng['available']) $add('actions_date_only','total',null,'notifications','unavailable');
    }
    if ($co) {
        $add('co_reading_scope','filters','date_only_no_direction','');
        foreach ($co['pairs'] as $v) $add('co_reading_date_only',$v['a'].' + '.$v['b'],(int)$v['count'],'person_days','JS_received_estimate');
        if (!$co['available']) $add('co_reading_date_only','total',null,'person_days','unavailable');
    }
    return array_map(fn($row)=>array_map('access_csv_cell',$row),$rows);
}

function access_csv_download(array $o,array $r,array $uu): never {
    require_user(true);
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="deafnavi-access-'.$o['from'].'-'.$o['to'].'.csv"');
    header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
    $out=fopen('php://output','wb'); fwrite($out,"\xEF\xBB\xBF");
    foreach (access_csv_rows($o,$r,$uu,engagement_report($o),access_covisits($o)) as $row) fputcsv($out,$row,',','"','');
    fclose($out); exit;
}
