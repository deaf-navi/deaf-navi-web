<?php
declare(strict_types=1);
require_once __DIR__.'/access-visitors.php';
require_once __DIR__.'/access-charts.php';

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

function access_options(): array {
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
    $from = date_value(input($_GET, 'from', 10)) ?: $today->modify('-6 days')->format('Y-m-d');
    $to = date_value(input($_GET, 'to', 10)) ?: $today->format('Y-m-d');
    $start = new DateTimeImmutable($from, new DateTimeZone('Asia/Tokyo'));
    $end = new DateTimeImmutable($to, new DateTimeZone('Asia/Tokyo'));
    if ($end < $start || $start->diff($end)->days > 179 || $start < $today->modify('-179 days') || $end > $today) fail('直近180日以内の期間を指定してください。');
    $client = input($_GET, 'client', 20) ?: 'human';
    choice($client, ACCESS_CLIENTS);
    $group = input($_GET, 'group', 20) ?: 'all';
    choice($group, ACCESS_GROUPS);
    $status = input($_GET, 'status', 3);
    choice($status, [''=>1,'2xx'=>1,'3xx'=>1,'4xx'=>1,'5xx'=>1]);
    $tab = input($_GET, 'tab', 12) ?: 'paths';
    choice($tab, ['paths'=>1,'days'=>1,'requests'=>1,'unique'=>1]);
    return ['from'=>$from, 'to'=>$to, 'start'=>$start->getTimestamp(), 'end'=>$end->modify('+1 day')->getTimestamp(),
        'group'=>$group, 'client'=>$client, 'status'=>$status, 'q'=>input($_GET, 'q', 200), 'tab'=>$tab,
        'page'=>max(1, (int)input($_GET, 'page', 6)), 'limit'=>admin_size()];
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
    if (!str_starts_with($path, '/') || strlen($path) > 8192 || preg_match('/[\x00-\x1f\x7f]/', $path) || !preg_match('//u', $path)) return null;
    $method = $req['method'] ?? '';
    if (!is_string($method) || !preg_match('/^[A-Z]{1,20}$/D', $method)) return null;
    $status = $r['status'] ?? 0;
    if (!is_int($status) || $status < 100 || $status > 599) return null;
    $ts = (float)$r['ts'];
    if (!is_finite($ts) || $ts <= 0 || $ts > 4102444800) return null;
    $duration = is_numeric($r['duration'] ?? null) ? (float)$r['duration'] : null;
    if ($duration !== null && (!is_finite($duration) || $duration < 0)) $duration = null;
    $client = is_string($r['client_kind']??null) && isset(ACCESS_CLIENTS[$r['client_kind']]) && $r['client_kind']!=='all' ? $r['client_kind'] : 'unknown';
    if (preg_match('#^/admin(?:/|$)#',$path) && in_array($client,['human','unknown'],true)) $client='internal';
    return ['ts'=>$ts, 'host'=>$host, 'path'=>$path, 'method'=>$method, 'status'=>$status,
        'duration'=>$duration, 'size'=>is_int($r['size'] ?? null) && $r['size'] >= 0 ? $r['size'] : null,
        'client'=>$client,
        'group'=>access_group($path)];
}

function access_report(array $options): array {
    $summary = ($options['summary'] ?? false) === true;
    $report = ['available'=>false, 'partial'=>false, 'invalid'=>0, 'total'=>0, 'pages'=>0, 'not_found'=>0, 'errors'=>0,
        'latest'=>null, 'oldest'=>null, 'paths'=>[], 'days'=>[], 'rows'=>[]];
    $dir = realpath(access_log_dir());
    if ($dir === false || !is_dir($dir) || !is_readable($dir)) return $report;
    $files = glob($dir.'/access*.log') ?: [];
    $files = array_values(array_filter($files, fn($p) => preg_match('/^access(?:-v[0-9]+)?(?:-[0-9T.Z:+-]+(?:-(?:size|time))?)?\.log$/D', basename($p))));
    usort($files, function($a, $b) {
        return (filemtime($b) <=> filemtime($a)) ?: strcmp($b, $a);
    });
    $bytes = 0; $scanned = 0; $deadline = microtime(true)+($summary ? 0.5 : 4);
    $index = access_maintenance_state()['file_index'] ?? [];
    $offset = ($options['page']-1)*$options['limit'];
    foreach ($files as $file) {
        if (is_link($file) || !is_file($file) || !is_readable($file) || dirname(realpath($file) ?: '') !== $dir) { $report['partial'] = true; continue; }
        $handle = @fopen($file, 'rb');
        if ($handle === false) { $report['partial'] = true; continue; }
        $report['available'] = true;
        try {
            $range = $index[basename($file)] ?? null;
            $stat = fstat($handle);
            if (is_array($range) && ($range['bytes']??null)===$stat['size'] && ($range['mtime']??null)===$stat['mtime']
                && is_numeric($range['first']??null) && is_numeric($range['last']??null)
                && ($range['first'] >= $options['end'] || $range['last'] < $options['start'])) {
                // Index covers complete closed files and is invalidated by size/mtime changes.
                $report['oldest'] = min($report['oldest'] ?? $range['first'], $range['first']);
                $report['latest'] = max($report['latest'] ?? 0, $range['last']);
                continue;
            }
            foreach (access_reverse_lines($handle) as $line) {
                $bytes += strlen($line)+1; $scanned++;
                if ($bytes > ($summary ? 8 : 64)*1024*1024 || $scanned > ($summary ? 25000 : 200000) || ($scanned%512 === 0 && microtime(true) > $deadline)) {
                    $report['partial'] = true; break 2;
                }
                $r = access_entry($line);
                if (!$r) { $report['invalid']++; continue; }
                $report['latest'] = max($report['latest'] ?? 0, $r['ts']);
                $report['oldest'] = min($report['oldest'] ?? $r['ts'], $r['ts']);
                if ($r['ts'] < $options['start'] || $r['ts'] >= $options['end']) continue;
                if ($options['group'] !== 'all' && $r['group'] !== $options['group']) continue;
                if (($options['client'] ?? 'all') !== 'all' && $r['client'] !== $options['client']) continue;
                if ($options['status'] !== '' && intdiv($r['status'], 100) !== (int)$options['status'][0]) continue;
                if ($options['q'] !== '' && stripos($r['path'], $options['q']) === false) continue;
                $report['total']++;
                if ($r['group'] === 'pages' && $r['method'] === 'GET' && $r['status'] >= 200 && $r['status'] < 300) $report['pages']++;
                if ($r['status'] === 404) $report['not_found']++;
                if ($r['status'] >= 500) $report['errors']++;
                if ($summary) {
                    if ($r['group']==='pages' && $r['method']==='GET' && (count($report['rows'])<5 || $r['ts']>$report['rows'][4]['ts'])) {
                        $report['rows'][]=$r;
                        usort($report['rows'],fn($a,$b)=>$b['ts']<=>$a['ts']);
                        if (count($report['rows'])>5) array_pop($report['rows']);
                    }
                    continue;
                }
                $key = $r['host'].$r['path'];
                if (!isset($report['paths'][$key])) $report['paths'][$key] = ['host'=>$r['host'],'path'=>$r['path'],'count'=>0,'errors'=>0];
                $report['paths'][$key]['count']++;
                if ($r['status'] >= 400) $report['paths'][$key]['errors']++;
                $day = (new DateTimeImmutable('@'.(int)$r['ts']))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d');
                $report['days'][$day] = ($report['days'][$day] ?? 0)+1;
                if ($report['total'] > $offset && count($report['rows']) < $options['limit']) $report['rows'][] = $r;
            }
        } catch (Throwable) { $report['partial'] = true; }
        finally { fclose($handle); }
    }
    uasort($report['paths'], fn($a, $b) => ($b['count'] <=> $a['count']) ?: strcmp($a['host'].$a['path'], $b['host'].$b['path']));
    krsort($report['days']);
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
        'group'=>'all','client'=>'human','status'=>'','q'=>'','page'=>1,'limit'=>5,'summary'=>true];
    $r = access_report($o); $uu = access_unique_report($o);
    $base = ['view'=>'access','from'=>$day,'to'=>$day,'client'=>'human'];
    $out = '<section class="admin-panel admin-access-summary" aria-labelledby="access-summary-title"><div class="admin-access-summary-heading"><div><h2 id="access-summary-title">今日のアクセス</h2><p>'.e($today->format('Y/m/d')).'・日本時間</p></div><a href="'.admin_query($base).'">アクセスログで詳細分析 →</a></div>';
    if (!$r['available']) $out .= '<p class="dn-error" role="status">アクセスログを読み取れません。0件という意味ではありません。</p>';
    elseif ($r['partial'] || $r['invalid']) $out .= '<p class="dn-notice" role="status">リクエスト数と履歴は読み取れた範囲の部分集計です。詳細分析でもご確認ください。</p>';
    $out .= '<div class="admin-access-summary-metrics">';
    foreach ([['リクエスト',$r['available']?$r['total']:null,'件',['tab'=>'requests']],['推定ユニーク数',$uu['available']?$uu['total']:null,'人',['tab'=>'unique']],['サーバーエラー（5xx）',$r['available']?$r['errors']:null,'件',['tab'=>'requests','status'=>'5xx']]] as [$label,$count,$unit,$filter]) {
        $out .= '<a href="'.admin_query($base,$filter).'"><span>'.e($label).'</span><strong>'.($count===null?'未取得':number_format($count).'<small>'.e($unit).'</small>').'</strong></a>';
    }
    $out .= '</div><p class="admin-access-summary-note">一般ブラウザーのみ。Codex・AI・bot・自動操作・管理画面・分類不明を除外しています。リクエストには画像等も含み、UUは推定人数です。</p><h3>直近の公開ページアクセス<span>今日・最大5件</span></h3><ol class="admin-access-recent">';
    foreach ($r['rows'] as $row) {
        $at = (new DateTimeImmutable('@'.(int)$row['ts']))->setTimezone(new DateTimeZone('Asia/Tokyo'));
        $out .= '<li><time datetime="'.e($at->format('c')).'">'.e($at->format('H:i:s')).'</time><div><span class="admin-access-path">'.e($row['path']).'</span><small>'.e(ACCESS_CLIENTS[$row['client']]).'</small></div><span class="admin-access-status'.($row['status']>=400?' is-error':'').'" aria-label="HTTP応答 '.(int)$row['status'].'">'.(int)$row['status'].'</span></li>';
    }
    if (!$r['rows']) $out .= '<li class="admin-access-empty">'.(!$r['available']?'履歴は未取得です。':(($r['partial']||$r['invalid'])?'読み取れた範囲に公開ページアクセスはありません。':'今日の公開ページアクセスはまだありません。')).'</li>';
    return $out.'</ol></section>';
}

function admin_access_logs(): string {
    require_user(true);
    $o = access_options(); $r = access_report($o); $uu = access_unique_report($o);
    $base = ['view'=>'access','from'=>$o['from'],'to'=>$o['to'],'group'=>$o['group'],'client'=>$o['client'],'status'=>$o['status'],'q'=>$o['q'],'tab'=>$o['tab'],'limit'=>$o['limit']];
    $out = '<p class="admin-lead">全コンテンツのアクセスを期間・URL・分類で詳しく分析できます。日時は日本時間です。</p>';
    $out .= '<p class="dn-notice">'.($o['client']==='human'?'一般ブラウザーのみ集計しています。Codex・AI・bot・自動操作・管理画面・分類不明は除外しています。':'調査用の分類を表示しています。このリクエスト数を一般ユーザーの利用数として扱わないでください。').'</p>';
    $out .= '<form method="get" class="admin-filters"><input type="hidden" name="view" value="access"><input type="hidden" name="tab" value="'.e($o['tab']).'">'
        .field('from','開始日',$o['from'],'date',true).field('to','終了日',$o['to'],'date',true)
        .($o['tab']==='unique'?'':select_field('group','対象',ACCESS_GROUPS,$o['group']).select_field('client','アクセス元の分類',ACCESS_CLIENTS,$o['client']).select_field('status','応答',[''=>'すべて','2xx'=>'成功（2xx）','3xx'=>'転送等（3xx）','4xx'=>'要求エラー（4xx）','5xx'=>'サーバーエラー（5xx）'],$o['status']))
        .field('q','URLパスで検索',$o['q']).select_field('limit','履歴の表示件数',['25'=>'25件','50'=>'50件','100'=>'100件'],(string)$o['limit'])
        .'<button>表示を更新</button><a href="/admin/?view=access">条件を解除</a></form>';
    if (!$r['available']) return $out.'<div class="dn-notice" role="status"><h2>アクセスログを読み取れません</h2><p>ログが未設定、または保存先を読み取れない状態です。アクセス数が0件という意味ではありません。</p></div>';
    if ($r['partial'] || $r['invalid']) $out .= '<div class="dn-error" role="status">一部のログを集計できていません。読込上限・保存中の切替・読取エラー等のため、以下は読み取れた範囲の集計です。'.($r['invalid']?'形式を確認できなかった記録：'.number_format($r['invalid']).'件。':'').'</div>';
    $out .= '<p class="dn-muted">確認できた保存範囲：'.e(access_time($r['oldest'])).' ～ '.e(access_time($r['latest'])).'。管理画面は直近180日を表示します。180日を過ぎた分は月初に圧縮保存し、日次処理で210日超の滞留も確認します。</p>';
    $out .= '<div class="admin-metrics admin-access-metrics">';
    foreach ([['選択条件のリクエスト',$r['total']],['公開ページの成功GET',$r['pages']],['見つからないURL（404）',$r['not_found']],['サーバーエラー（5xx）',$r['errors']]] as [$label,$count])
        $out .= '<a href="'.admin_query($base,['tab'=>'requests']).'"><span>'.e($label).'</span><strong>'.number_format($count).'<small>件</small></strong></a>';
    $out .= '<a href="'.admin_query($base,['tab'=>'unique']).'"><span>日別推定ユニークの合計</span><strong>'.($uu['available']?number_format($uu['total']).'<small>人日</small>':'未取得').'</strong><small>期間とURL条件・一般ブラウザーのみ</small></a>';
    $out .= '</div>'.access_charts_html($o,$r,$uu,$base).'<nav class="dn-admin-nav" aria-label="アクセスログの表示切替">';
    foreach (['paths'=>'URL別件数','days'=>'日別件数','requests'=>'個別のアクセス履歴','unique'=>'推定ユニーク数'] as $tab=>$label)
        $out .= '<a href="'.admin_query($base,['tab'=>$tab,'page'=>1]).'"'.($tab===$o['tab']?' aria-current="page"':'').'>'.e($label).'</a> ';
    $out .= '</nav>';
    if ($o['tab'] === 'unique') {
        $out .= '<h2>日別の推定ユニーク数</h2><p>日本時間の1日ごとに、同じ接続IPとブラウザー情報の重複を除きます。期間とURL検索条件が対象です。同じ人の別ページは日別人数で重複しません。複数日の合計は「人日」で、期間全体の実人数ではありません。</p>';
        if (!$uu['available']) $out .= '<p class="dn-error">推定ユニーク数を取得できません。0人という意味ではありません。</p>';
        $out .= '<p>計測開始：'.e(access_iso_time($uu['started_at']??null)).'。JavaScriptによるページ表示の通知を受け取った分を集計します。</p>'.admin_table_open('日別推定ユニーク数').'<thead><tr><th scope="col">日付（日本時間）</th><th scope="col">推定ユニーク数</th></tr></thead><tbody>';
        foreach ($uu['days'] as $day=>$count) $out .= '<tr><th scope="row">'.e($day).'</th><td>'.number_format($count).' 人</td></tr>';
        if (!$uu['days']) $out .= '<tr><td colspan="2" class="admin-empty">この期間・URL条件の計測記録はありません。</td></tr>';
        $out .= '</tbody></table></div><h2>URL別の推定ユニーク数（上位50件）</h2><p>ページごとの日別人数を合計しています。別のページの人数とは重複するため、足して全体人数にはできません。</p>'.admin_table_open('URL別推定ユニーク数').'<thead><tr><th scope="col">URLパス</th><th scope="col">日別人数の合計</th></tr></thead><tbody>';
        foreach ($uu['paths'] as $p) $out .= '<tr><th scope="row">'.e($p['path']).'</th><td>'.number_format((int)$p['count']).' 人日</td></tr>';
        if (!$uu['paths']) $out .= '<tr><td colspan="2" class="admin-empty">計測記録はありません。</td></tr>';
    } elseif ($o['tab'] === 'paths') {
        $out .= '<h2>URL別件数（上位50件）</h2>'.admin_table_open('URL別アクセス件数').'<thead><tr><th scope="col">URLパス</th><th scope="col">リクエスト数</th><th scope="col">4xx・5xx</th></tr></thead><tbody>';
        foreach (array_slice($r['paths'],0,50) as $p) $out .= '<tr><th scope="row">'.e($p['path']).'<small>'.e($p['host']).'</small></th><td>'.number_format($p['count']).'</td><td>'.number_format($p['errors']).'</td></tr>';
        if (!$r['paths']) $out .= '<tr><td colspan="3" class="admin-empty">この条件に一致するアクセスはありません。</td></tr>';
    } elseif ($o['tab'] === 'days') {
        $out .= '<h2>日別件数</h2>'.admin_table_open('日別アクセス件数').'<thead><tr><th scope="col">日付（日本時間）</th><th scope="col">リクエスト数</th></tr></thead><tbody>';
        foreach ($r['days'] as $day=>$count) $out .= '<tr><th scope="row">'.e($day).'</th><td>'.number_format($count).'</td></tr>';
        if (!$r['days']) $out .= '<tr><td colspan="2" class="admin-empty">この条件に一致するアクセスはありません。</td></tr>';
    } else {
        $out .= '<h2>個別のアクセス履歴（新しい順）</h2>'.admin_pager($o['page'],$r['total'],$o['limit'],$base)
            .admin_table_open('個別のアクセス履歴').'<thead><tr><th scope="col">日時（日本時間）</th><th scope="col">URLパス</th><th scope="col">分類</th><th scope="col">メソッド</th><th scope="col">応答</th><th scope="col">処理時間</th><th scope="col">送信量</th></tr></thead><tbody>';
        foreach ($r['rows'] as $p) $out .= '<tr><td>'.e(access_time($p['ts'])).'</td><th scope="row">'.e($p['path']).'<small>'.e($p['host']).'</small></th><td>'.e(ACCESS_CLIENTS[$p['client']]).'</td><td>'.e($p['method']).'</td><td>'.$p['status'].'</td><td>'.($p['duration']===null?'不明':number_format($p['duration']*1000,1).' ms').'</td><td>'.($p['size']===null?'不明':number_format($p['size']).' B').'</td></tr>';
        if (!$r['rows']) $out .= '<tr><td colspan="7" class="admin-empty">このページに表示するアクセスはありません。</td></tr>';
    }
    $out .= '</tbody></table></div>';
    if ($o['tab'] === 'requests') $out .= admin_pager($o['page'],$r['total'],$o['limit'],$base);
    return $out.access_storage_html().'<details class="admin-panel"><summary>記録の範囲と数え方</summary><p>ニュース・World・手話カフェ・地図・おとまど・API・画像等、deafnavi.com と www.deafnavi.com に届くリクエストを記録します。取得開始前の履歴、外部サイト、オフライン表示は含みません。リクエスト数には再表示・画像・bot等も含まれます。</p><p>アクセス元はUser-Agent等から分類します。通常集計は一般ブラウザーのみで、Codex・AI・bot・自動操作・管理画面・分類不明を除外します。除外した分類は調査用に切り替えて確認できます。判別情報のない通常ブラウザーの自動操作は見分けられません。過去に一般ブラウザーとして保存された記録を、後から完全に分類し直すことはできません。</p><p>推定ユニーク数はIPとブラウザー情報をサーバー内で日ごとにHMAC化します。Cookieや端末への識別子保存は使いません。同じ回線・同じブラウザー情報は少なく、IPやブラウザー情報が変わると多く数える場合があります。JavaScriptが動かないアクセスは推定ユニーク数に入りません。同じ日の接続が後からCodex等と判定された場合は、その日の推定UUから除外します。</p><p>生のIP・User-Agent・Cookie・認証情報・参照元・入力本文・URLの検索条件は保存しません。公開領域外で管理者のみ参照できます。180日超を月初にgzip圧縮し、展開内容のSHA-256一致を確認してから元記録を移します。210日超は日次でも確認します。バックアップは自動削除しません。履歴の読込は最大64 MiB・20万行・約4秒で、未集計があれば明示します。</p></details>';
}
