<?php
declare(strict_types=1);
require_once __DIR__.'/access-visitors.php';
require_once __DIR__.'/access-engagement.php';
require_once __DIR__.'/access-charts.php';
require_once __DIR__.'/access-pages.php';
require_once __DIR__.'/access-analytics.php';

// Read only. Logs are written by Caddy, outside the public root and application DB.
const ACCESS_GROUPS = ['all'=>'すべてのリクエスト','pages'=>'公開ページ','data'=>'API・JSON・RSS等','assets'=>'画像・CSS・JavaScript等','management'=>'管理・情報提供'];

function access_log_dir(): string {
    return getenv('DEAFNAVI_LOCAL_TEST') === '1'
        ? (getenv('DEAFNAVI_ACCESS_LOG_DIR') ?: data_dir().'/access-logs')
        : '/srv/deafnavi/shared/access-logs';
}

function access_group(string $path): string {
    if (preg_match('#^/(admin|submit)(/|$)#', $path)) return 'management';
    if (preg_match('#^/(app|_access)/|\.(json|xml|webmanifest|csv|rss|atom)$#i', $path)) return 'data';
    if (preg_match('#\.[^/]+$#', $path) && !preg_match('#\.html?$#i', $path)) return 'assets';
    return 'pages';
}

function access_retention_start(DateTimeImmutable $today): DateTimeImmutable {
    $first=$today->modify('first day of this month')->modify('-6 months');
    return $first->setDate((int)$first->format('Y'),(int)$first->format('m'),min((int)$today->format('d'),(int)$first->format('t')))->setTime(0,0);
}

function access_options(): array {
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
    $from = date_value(input($_GET, 'from', 10)) ?: $today->modify('-7 days')->format('Y-m-d');
    $to = date_value(input($_GET, 'to', 10)) ?: $today->modify('-1 day')->format('Y-m-d');
    $start = new DateTimeImmutable($from, new DateTimeZone('Asia/Tokyo'));
    $end = new DateTimeImmutable($to, new DateTimeZone('Asia/Tokyo'));
    if ($end < $start || $start < access_retention_start($today) || $end > $today) fail('直近6か月以内の期間を指定してください。');
    $mode = input($_GET, 'mode', 10) ?: 'views';
    choice($mode, ['views'=>1,'requests'=>1]);
    $content = input($_GET, 'content', 20) ?: 'all';
    choice($content, ['all'=>'すべて']+ACCESS_CONTENTS);
    $client = input($_GET, 'client', 20) ?: 'human';
    choice($client, ACCESS_CLIENTS);
    $group = input($_GET, 'group', 20) ?: 'all';
    choice($group, ACCESS_GROUPS);
    $status = input($_GET, 'status', 3);
    choice($status, [''=>1,'2xx'=>1,'3xx'=>1,'4xx'=>1,'5xx'=>1]);
    $tab = input($_GET, 'tab', 12) ?: 'paths';
    choice($tab, ['paths'=>1,'days'=>1,'requests'=>1,'unique'=>1,'sources'=>1,'actions'=>1,'quality'=>1]);
    $compare=input($_GET,'compare',10)?:'previous';
    choice($compare,['previous'=>1,'off'=>1]);
    $match=input($_GET,'match',10)?:'contains';
    choice($match,['contains'=>1,'prefix'=>1,'exact'=>1]);
    if ($mode==='views') { $client='human'; $group='all'; $status=''; }
    $limit=admin_size();
    return ['from'=>$from, 'to'=>$to, 'start'=>$start->getTimestamp(), 'end'=>$end->modify('+1 day')->getTimestamp(),
        'compare'=>$compare, 'match'=>$match, 'mode'=>$mode, 'content'=>$content, 'group'=>$group, 'client'=>$client, 'status'=>$status, 'q'=>input($_GET, 'q', 200), 'tab'=>$tab,
        'page'=>min((int)ceil(10000/$limit),max(1, (int)input($_GET, 'page', 6))), 'limit'=>$limit];
}

// Snapshot each file's length, then read complete lines newest first in bounded chunks.
// A writer's incomplete final line is deferred until the next refresh.
function access_reverse_lines($handle): Generator {
    $position = (int)fstat($handle)['size'];
    if ($position === 0) return;
    fseek($handle, -1, SEEK_END);
    $partial = fread($handle, 1) !== "\n";
    $buffer = '';
    while ($position > 0) {
        $length = min(65536, $position);
        $position -= $length;
        if (fseek($handle, $position) !== 0) throw new RuntimeException('Log seek failed');
        $chunk = fread($handle, $length);
        if ($chunk === false || strlen($chunk) !== $length) throw new RuntimeException('Log read failed');
        $lines = explode("\n", $chunk.$buffer);
        $buffer = array_shift($lines);
        for ($i = count($lines)-1; $i >= 0; $i--) {
            if ($lines[$i] === '') continue;
            if ($partial) { $partial = false; continue; }
            yield $lines[$i];
        }
        if (strlen($buffer) > 65536) throw new RuntimeException('Oversized log record');
    }
    if ($buffer !== '' && !$partial) yield $buffer;
}

function access_entry(string $line): ?array {
    $r = json_decode($line, true, 32);
    if (!is_array($r) || !is_numeric($r['ts'] ?? null) || !is_array($r['request'] ?? null)) return null;
    $req = $r['request'];
    $host = $req['host'] ?? '';
    if (!is_string($host)) return null;
    $host = preg_replace('/:(?:80|443)$/D', '', strtolower($host));
    if (!in_array($host, ['deafnavi.com','www.deafnavi.com'], true)) return null;
    $path = $req['uri'] ?? '';
    if (!is_string($path)) return null;
    $path = explode('?', $path, 2)[0];
    $unsafePath=!str_starts_with($path, '/') || strlen($path)>8192 || preg_match('/[\x00-\x1f\x7f]/',$path) || !preg_match('//u',$path);
    // Preserve valid HTTP metadata for malformed/probing URLs, but never render
    // their control bytes. These are excluded explicitly, not a missing log.
    if ($unsafePath) $path='/[invalid-request-path]';
    $method = $req['method'] ?? '';
    if (!is_string($method) || !preg_match('/^[A-Z]{1,20}$/D', $method)) return null;
    $status = $r['status'] ?? 0;
    if (!is_int($status) || $status < 100 || $status > 599) return null;
    $ts = (float)$r['ts'];
    if (!is_finite($ts) || $ts <= 0 || $ts > 4102444800) return null;
    $duration = is_numeric($r['duration'] ?? null) ? (float)$r['duration'] : null;
    if ($duration !== null && (!is_finite($duration) || $duration < 0)) $duration = null;
    $client = is_string($r['client_kind']??null) && isset(ACCESS_CLIENTS[$r['client_kind']]) && $r['client_kind']!=='all' ? $r['client_kind'] : 'unknown';
    $ip=is_string($req['remote_ip']??null)&&filter_var($req['remote_ip'],FILTER_VALIDATE_IP)?$req['remote_ip']:null;
    $ua=is_string($r['user_agent']??null)?substr($r['user_agent'],0,2048):null;
    $ref=array_key_exists('referrer_host',$r)?(is_string($r['referrer_host'])?$r['referrer_host']:'none-or-invalid'):null;
    $refInfo=access_referrer($ref);
    $ref=$refInfo['host']??($refInfo['channel']==='unrecorded'?null:'none-or-invalid');
    $originalClient=$client;$classification='記録時の分類';
    if($ua!==null&&in_array($client,['human','unknown'],true)){
        $new=access_client($ua);
        if($new!=='human'&&$new!=='unknown'){$client=$new;$classification='User-Agentによる再判定';}
    }
    if(($r['purpose']??null)==='prefetch'&&$client==='human'){$client='automation';$classification='ブラウザーの先読み';}
    if($client==='human'&&$ip!==null&&$ua!==null){
        $identity=strlen($ua)<512?access_quality_identity($ip,$ua,$ts):null;
        $quality=$identity?access_known_exclusion(...$identity):null;
        if($quality!==null){$client=$quality;$classification=$quality==='suspected'?'同じ接続・ブラウザーの規則的な巡回':'詳細ログ照合による除外';}
    }
    if (preg_match('#^/admin(?:/|$)#',$path) && in_array($client,['human','unknown'],true)) $client='internal';
    if (in_array($path,['/sw.js','/otomado/sw.js'],true) && in_array($client,['human','unknown'],true)) $client='automation';
    return ['ts'=>$ts, 'host'=>$host, 'path'=>$path, 'method'=>$method, 'status'=>$status,
        'duration'=>$duration, 'size'=>is_int($r['size'] ?? null) && $r['size'] >= 0 ? $r['size'] : null,
        'client'=>$client,'original_client'=>$originalClient,'classification'=>$unsafePath?'URL形式不正・パス非表示':$classification,'ip'=>$ip,'user_agent'=>$ua,'referrer_host'=>$ref,'unsafe_path'=>(bool)$unsafePath,
        'group'=>access_group($path)];
}

function access_report(array $options): array {
    $summary=($options['summary']??false)===true;
    $report=access_report_empty(); $previous=access_previous_options($options);
    $prior=$previous?access_report_empty():null;
    $scanStart=$previous?min($options['start'],$previous['start']):$options['start'];
    $dir=realpath(access_log_dir());
    if ($dir===false || !is_dir($dir) || !is_readable($dir)) return $report+['previous'=>$prior];
    $files=array_values(array_filter(glob($dir.'/access*.log')?:[],fn($p)=>preg_match('/^access(?:-v[0-9]+)?(?:-[0-9T.Z:+-]+(?:-(?:size|time))?)?\.log$/D',basename($p))));
    usort($files,fn($a,$b)=>(filemtime($b)<=>filemtime($a))?:strcmp($b,$a));
    $started=microtime(true); $deadline=$started+($summary?.5:4);
    $bytes=0; $scanned=0; $index=access_maintenance_state()['file_index']??[];
    $offset=($options['page']-1)*$options['limit'];
    $keep=$summary?5:min(10000,$offset+$options['limit']);
    $heap=new SplPriorityQueue(); $heap->setExtractFlags(SplPriorityQueue::EXTR_DATA);
    foreach ($files as $file) {
        if (is_link($file)||!is_file($file)||!is_readable($file)||dirname(realpath($file)?:'')!==$dir) { $report['reasons']['unreadable-file']=true; continue; }
        $handle=@fopen($file,'rb');
        if ($handle===false) { $report['reasons']['unreadable-file']=true; continue; }
        $report['available']=true;
        try {
            $stat=fstat($handle); $range=$index[basename($file)]??null;
            if (is_array($range)&&($range['bytes']??null)===$stat['size']&&($range['mtime']??null)===$stat['mtime']
                &&is_numeric($range['first']??null)&&is_numeric($range['last']??null)
                &&($range['first']>=$options['end']||$range['last']<$scanStart)) {
                $report['oldest']=min($report['oldest']??$range['first'],$range['first']);
                $report['latest']=max($report['latest']??0,$range['last']); continue;
            }
            foreach (access_reverse_lines($handle) as $line) {
                $bytes+=strlen($line)+1; $scanned++;
                if ($bytes>($summary?8:64)*1024*1024) { $report['reasons']['byte-limit']=true; break 2; }
                if ($scanned>($summary?25000:200000)) { $report['reasons']['line-limit']=true; break 2; }
                if ($scanned%512===0&&microtime(true)>$deadline) { $report['reasons']['time-limit']=true; break 2; }
                $r=access_entry($line);
                if (!$r) {
                    // A timestamp outside both windows cannot affect these totals.
                    $bad=json_decode($line,true,32); $ts=is_numeric($bad['ts']??null)?(float)$bad['ts']:null;
                    if ($ts===null||($ts>=$scanStart&&$ts<$options['end'])) $report['invalid']++;
                    continue;
                }
                $report['oldest']=min($report['oldest']??$r['ts'],$r['ts']);
                $report['latest']=max($report['latest']??0,$r['ts']);
                if ($r['ts']<$scanStart||$r['ts']>=$options['end']) continue;
                if ($previous&&$r['ts']<$options['start']) { access_aggregate_row($prior,$r,$previous); continue; }
                if (!access_aggregate_row($report,$r,$options)) continue;
                if ($summary && !($r['group']==='pages'&&$r['method']==='GET')) continue;
                // Keep only the newest K rows, independently of file modification order.
                $r['_order']=basename($file).':'.str_pad((string)$scanned,9,'0',STR_PAD_LEFT);
                $heap->insert($r,[-$r['ts'],$r['_order']]);
                if ($heap->count()>$keep) $heap->extract();
            }
        } catch (Throwable) { $report['reasons']['read-or-classification-error']=true; }
        finally { fclose($handle); }
    }
    $rows=[]; foreach ($heap as $r) $rows[]=$r;
    usort($rows,fn($a,$b)=>($b['ts']<=>$a['ts'])?:strcmp($a['_order'],$b['_order']));
    $report['rows']=array_map(function($r){unset($r['_order']);return $r;},array_slice($rows,$summary?0:$offset,$summary?5:$options['limit']));
    $report['partial']=(bool)$report['reasons'];
    $report['scanned_lines']=$scanned; $report['scanned_bytes']=$bytes;
    $report['elapsed_ms']=round((microtime(true)-$started)*1000,1);
    $report['history_limited']=$report['total']>10000;
    if ($prior!==null) foreach (['available','partial','invalid','oldest','latest','reasons','as_of'] as $key) $prior[$key]=$report[$key];
    foreach (['paths','referrers'] as $key) {
        uasort($report[$key],fn($a,$b)=>($b['count']<=>$a['count'])?:strcmp($a['host'].($a['path']??''),$b['host'].($b['path']??'')));
        if ($prior!==null) uasort($prior[$key],fn($a,$b)=>($b['count']<=>$a['count'])?:strcmp($a['host'].($a['path']??''),$b['host'].($b['path']??'')));
    }
    krsort($report['days']);
    $report['previous']=$prior;
    return $report;
}

function access_time(?float $ts): string {
    return $ts === null ? '記録なし' : (new DateTimeImmutable('@'.(int)$ts))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y/m/d H:i:s');
}

function access_iso_time(mixed $value): string {
    $stamp = is_string($value) ? strtotime($value) : false;
    return $stamp === false ? '未確認' : access_time((float)$stamp);
}

function access_storage_html(): string {
    $dir = access_log_dir(); $bytes = 0;
    foreach (glob($dir.'/access*.log') ?: [] as $file) if (is_file($file) && !is_link($file)) $bytes += filesize($file);
    $database = access_visitor_dir().'/visitors.sqlite';
    $visitorBytes = is_file($database) && !is_link($database) ? filesize($database) : null;
    $state = access_maintenance_state();
    $out = '<details class="admin-panel"><summary>保存容量と圧縮バックアップ</summary><p>アクセスログ '.number_format($bytes/1048576,2).' MiB / 推定UUデータ '.($visitorBytes===null?'未設定':number_format($visitorBytes/1048576,2).' MiB').'。';
    if (!$state) return $out.'保存処理の実行記録をまだ確認できません。</p></details>';
    $archive = (float)($state['archive_bytes']??0)+(float)($state['visitor_archive_bytes']??0);
    $out .= '圧縮済み '.number_format($archive/1048576,2).' MiB（直近の保存処理時点）。</p><p>直近の確認：'.e(access_iso_time($state['time']??null)).' / 最終月次処理：'.e(access_iso_time($state['last_monthly']??null)).'。</p>';
    if (($state['status']??'')!=='ok') $out .= '<p class="dn-error">保存処理でエラーが発生しました。検証できない記録は削除せず保持しています。</p>';
    return $out.'</details>';
}

function access_maintenance_state(): array {
    $file = access_log_dir().'/maintenance.json';
    $state = is_file($file) && is_readable($file) && !is_link($file) && filesize($file)<1048576 ? json_decode(file_get_contents($file),true) : null;
    return is_array($state) ? $state : [];
}

function admin_access_summary(): string {
    require_user(true);
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
    $day = $today->format('Y-m-d');
    $o = ['from'=>$day,'to'=>$day,'start'=>$today->getTimestamp(),'end'=>$today->modify('+1 day')->getTimestamp(),
        'mode'=>'views','content'=>'all','group'=>'all','client'=>'human','status'=>'','q'=>'','page'=>1,'limit'=>5,'summary'=>true];
    $r = access_report($o); $uu = access_unique_report($o);
    $base = ['view'=>'access','from'=>$day,'to'=>$day,'client'=>'human'];
    $out = '<section class="admin-panel admin-access-summary" aria-labelledby="access-summary-title"><div class="admin-access-summary-heading"><div><h2 id="access-summary-title">今日のアクセス</h2><p>'.e($today->format('Y/m/d')).'・日本時間</p></div><a href="'.admin_query($base).'">アクセスログで詳細分析 →</a></div>';
    if (!$r['available']) $out .= '<p class="dn-error" role="status">アクセスログを読み取れません。0件という意味ではありません。</p>';
    elseif ($r['partial'] || $r['invalid']) $out .= '<p class="dn-notice" role="status">リクエスト数と履歴は読み取れた範囲の部分集計です。詳細分析でもご確認ください。</p>';
    $out .= '<div class="admin-access-summary-metrics">';
    foreach ([['ページ閲覧',$r['available']?$r['total']:null,'件',['tab'=>'requests']],['推定ユニーク数',$uu['available']?$uu['total']:null,'人',['tab'=>'unique']],['集計から除外',$r['available']?array_sum($r['excluded']):null,'件',['tab'=>'requests','mode'=>'requests','client'=>'all']]] as [$label,$count,$unit,$filter]) {
        $out .= '<a href="'.admin_query($base,$filter).'"><span>'.e($label).'</span><strong>'.($count===null?'未取得':number_format($count).'<small>'.e($unit).'</small>').'</strong></a>';
    }
    $out .= '</div><p class="admin-access-summary-note">一般ブラウザーのみ。Codex・AI・bot・自動操作・管理画面・分類不明を除外しています。画像・API・404・不審な探索は閲覧に含めません。UUは推定人数です。</p><h3>直近の公開ページアクセス<span>今日・最大5件</span></h3><ol class="admin-access-recent">';
    foreach ($r['rows'] as $row) {
        $at = (new DateTimeImmutable('@'.(int)$row['ts']))->setTimezone(new DateTimeZone('Asia/Tokyo'));
        $out .= '<li><time datetime="'.e($at->format('c')).'">'.e($at->format('H:i:s')).'</time><div><span class="admin-access-path">'.e($row['path']).'</span><small>'.e(ACCESS_CLIENTS[$row['client']]).'</small></div><span class="admin-access-status'.($row['status']>=400?' is-error':'').'" aria-label="HTTP応答 '.(int)$row['status'].'">'.(int)$row['status'].'</span></li>';
    }
    if (!$r['rows']) $out .= '<li class="admin-access-empty">'.(!$r['available']?'履歴は未取得です。':(($r['partial']||$r['invalid'])?'読み取れた範囲に公開ページアクセスはありません。':'今日の公開ページアクセスはまだありません。')).'</li>';
    return $out.'</ol></section>';
}

function admin_access_logs(): string {
    require_user(true);
    $o=access_options(); $r=access_report($o); $uu=access_unique_report($o);
    if (input($_GET,'export',10)==='csv') access_csv_download($o,$r,$uu);
    require_once __DIR__.'/access-analytics-view.php';
    return access_analytics_view($o,$r,$uu);
}
function access_content_html(array $options, array $report, array $unique, array $base): string {
    $out = '<section class="admin-panel"><h2>コンテンツ別アクセス</h2><p>選択期間・URL検索条件の一般ブラウザーによるページ閲覧です。詳細ページも各コンテンツへ含めます。</p>';
    $out .= admin_table_open('コンテンツ別アクセス').'<thead><tr><th scope="col">コンテンツ</th><th scope="col">閲覧数</th><th scope="col">日別推定UUの合計</th></tr></thead><tbody>';
    foreach (ACCESS_CONTENTS as $key=>$label) {
        $out .= '<tr><th scope="row"><a href="'.admin_query($base,['mode'=>'views','content'=>$key,'client'=>'human','group'=>'all','status'=>'','page'=>1]).'">'.e($label).'</a></th><td>'.number_format($report['contents'][$key]).' 件</td><td>'.($unique['available']?number_format($unique['contents'][$key]??0).' 人日':'未取得').'</td></tr>';
    }
    $out .= '</tbody></table></div><p>同じ人が複数コンテンツを閲覧すると、それぞれに計上されます。UUのコンテンツ別合計は全体人数と一致しません。</p></section>';
    $out .= '<details class="admin-panel" open><summary>集計から除外したアクセス</summary><p>選択期間の生ログ '.number_format($report['raw_total']).' 件中、除外 '.number_format(array_sum($report['excluded'])).' 件。除外は重複しない理由別の件数です。</p><ul>';
    foreach (ACCESS_EXCLUSIONS as $key=>$label) $out .= '<li>'.e($label).'：'.number_format($report['excluded'][$key]).' 件</li>';
    return $out.'</ul><p>ブラウザー情報からの推定です。人を装う自動アクセスを完全に判別することはできません。調査用ログは削除せず保持します。</p></details>';
}
