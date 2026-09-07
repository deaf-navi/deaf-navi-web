<?php
declare(strict_types=1);

// Read only. Logs are written by Caddy, outside the public root and application DB.
const ACCESS_GROUPS = ['all'=>'すべてのリクエスト','pages'=>'公開ページ','data'=>'API・JSON・RSS等','assets'=>'画像・CSS・JavaScript等','management'=>'管理・情報提供'];

function access_log_dir(): string {
    return getenv('DEAFNAVI_LOCAL_TEST') === '1'
        ? (getenv('DEAFNAVI_ACCESS_LOG_DIR') ?: data_dir().'/access-logs')
        : '/srv/deafnavi/shared/access-logs';
}

function access_group(string $path): string {
    if (preg_match('#^/(admin|submit)(/|$)#', $path)) return 'management';
    if (preg_match('#^/app/|\.(json|xml|webmanifest|csv|rss|atom)$#i', $path)) return 'data';
    if (preg_match('#\.[^/]+$#', $path) && !preg_match('#\.html?$#i', $path)) return 'assets';
    return 'pages';
}

function access_options(): array {
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Tokyo'));
    $from = date_value(input($_GET, 'from', 10)) ?: $today->modify('-6 days')->format('Y-m-d');
    $to = date_value(input($_GET, 'to', 10)) ?: $today->format('Y-m-d');
    $start = new DateTimeImmutable($from, new DateTimeZone('Asia/Tokyo'));
    $end = new DateTimeImmutable($to, new DateTimeZone('Asia/Tokyo'));
    if ($end < $start || $start->diff($end)->days > 30) fail('期間は開始日から終了日まで31日以内で指定してください。');
    $group = input($_GET, 'group', 20) ?: 'all';
    choice($group, ACCESS_GROUPS);
    $status = input($_GET, 'status', 3);
    choice($status, [''=>1,'2xx'=>1,'3xx'=>1,'4xx'=>1,'5xx'=>1]);
    $tab = input($_GET, 'tab', 12) ?: 'paths';
    choice($tab, ['paths'=>1,'days'=>1,'requests'=>1]);
    return ['from'=>$from, 'to'=>$to, 'start'=>$start->getTimestamp(), 'end'=>$end->modify('+1 day')->getTimestamp(),
        'group'=>$group, 'status'=>$status, 'q'=>input($_GET, 'q', 200), 'tab'=>$tab,
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
    if (!is_string($host) || !in_array(strtolower($host), ['deafnavi.com','www.deafnavi.com'], true)) return null;
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
    return ['ts'=>$ts, 'host'=>strtolower($host), 'path'=>$path, 'method'=>$method, 'status'=>$status,
        'duration'=>$duration, 'size'=>is_int($r['size'] ?? null) && $r['size'] >= 0 ? $r['size'] : null,
        'group'=>access_group($path)];
}

function access_report(array $options): array {
    $report = ['available'=>false, 'partial'=>false, 'invalid'=>0, 'total'=>0, 'pages'=>0, 'not_found'=>0, 'errors'=>0,
        'latest'=>null, 'oldest'=>null, 'paths'=>[], 'days'=>[], 'rows'=>[]];
    $dir = realpath(access_log_dir());
    if ($dir === false || !is_dir($dir) || !is_readable($dir)) return $report;
    $files = glob($dir.'/access*.log') ?: [];
    $files = array_values(array_filter($files, fn($p) => preg_match('/^access(?:-[0-9T.Z:+-]+(?:-(?:size|time))?)?\.log$/D', basename($p))));
    usort($files, function($a, $b) {
        if (basename($a) === 'access.log') return -1;
        if (basename($b) === 'access.log') return 1;
        return strcmp($b, $a);
    });
    $bytes = 0; $scanned = 0; $deadline = microtime(true)+4;
    $offset = ($options['page']-1)*$options['limit'];
    foreach ($files as $file) {
        if (is_link($file) || !is_file($file) || !is_readable($file) || dirname(realpath($file) ?: '') !== $dir) { $report['partial'] = true; continue; }
        $handle = @fopen($file, 'rb');
        if ($handle === false) { $report['partial'] = true; continue; }
        $report['available'] = true;
        try {
            foreach (access_reverse_lines($handle) as $line) {
                $bytes += strlen($line)+1; $scanned++;
                if ($bytes > 64*1024*1024 || $scanned > 200000 || ($scanned%512 === 0 && microtime(true) > $deadline)) {
                    $report['partial'] = true; break 2;
                }
                $r = access_entry($line);
                if (!$r) { $report['invalid']++; continue; }
                $report['latest'] = max($report['latest'] ?? 0, $r['ts']);
                $report['oldest'] = min($report['oldest'] ?? $r['ts'], $r['ts']);
                if ($r['ts'] < $options['start'] || $r['ts'] >= $options['end']) continue;
                if ($options['group'] !== 'all' && $r['group'] !== $options['group']) continue;
                if ($options['status'] !== '' && intdiv($r['status'], 100) !== (int)$options['status'][0]) continue;
                if ($options['q'] !== '' && stripos($r['path'], $options['q']) === false) continue;
                $report['total']++;
                if ($r['group'] === 'pages' && $r['method'] === 'GET' && $r['status'] >= 200 && $r['status'] < 300) $report['pages']++;
                if ($r['status'] === 404) $report['not_found']++;
                if ($r['status'] >= 500) $report['errors']++;
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

function admin_access_logs(): string {
    require_user(true);
    $o = access_options(); $r = access_report($o);
    $base = ['view'=>'access','from'=>$o['from'],'to'=>$o['to'],'group'=>$o['group'],'status'=>$o['status'],'q'=>$o['q'],'tab'=>$o['tab'],'limit'=>$o['limit']];
    $out = '<p class="admin-lead">Deaf Naviの全コンテンツに届いたリクエストを確認できます。日時は日本時間です。</p>';
    $out .= '<form method="get" class="admin-filters"><input type="hidden" name="view" value="access"><input type="hidden" name="tab" value="'.e($o['tab']).'">'
        .field('from','開始日',$o['from'],'date',true).field('to','終了日',$o['to'],'date',true)
        .select_field('group','対象',ACCESS_GROUPS,$o['group']).select_field('status','応答',[''=>'すべて','2xx'=>'成功（2xx）','3xx'=>'転送等（3xx）','4xx'=>'要求エラー（4xx）','5xx'=>'サーバーエラー（5xx）'],$o['status'])
        .field('q','URLパスで検索',$o['q']).select_field('limit','履歴の表示件数',['25'=>'25件','50'=>'50件','100'=>'100件'],(string)$o['limit'])
        .'<button>表示を更新</button><a href="/admin/?view=access">条件を解除</a></form>';
    if (!$r['available']) return $out.'<div class="dn-notice" role="status"><h2>アクセスログを読み取れません</h2><p>ログが未設定、または保存先を読み取れない状態です。アクセス数が0件という意味ではありません。</p></div>';
    if ($r['partial'] || $r['invalid']) $out .= '<div class="dn-error" role="status">一部のログを集計できていません。読込上限・保存中の切替・読取エラー等のため、以下は読み取れた範囲の集計です。'.($r['invalid']?'形式を確認できなかった記録：'.number_format($r['invalid']).'件。':'').'</div>';
    $out .= '<p class="dn-muted">確認できた保存範囲：'.e(access_time($r['oldest'])).' ～ '.e(access_time($r['latest'])).'。保存期間の目安は30日（容量上限あり）。</p>';
    $out .= '<div class="admin-metrics">';
    foreach ([['選択条件のリクエスト',$r['total']],['公開ページの成功GET',$r['pages']],['見つからないURL（404）',$r['not_found']],['サーバーエラー（5xx）',$r['errors']]] as [$label,$count])
        $out .= '<a href="'.admin_query($base,['tab'=>'requests']).'"><span>'.e($label).'</span><strong>'.number_format($count).'<small>件</small></strong></a>';
    $out .= '</div><nav class="dn-admin-nav" aria-label="アクセスログの表示切替">';
    foreach (['paths'=>'URL別件数','days'=>'日別件数','requests'=>'個別のアクセス履歴'] as $tab=>$label)
        $out .= '<a href="'.admin_query($base,['tab'=>$tab,'page'=>1]).'"'.($tab===$o['tab']?' aria-current="page"':'').'>'.e($label).'</a> ';
    $out .= '</nav>';
    if ($o['tab'] === 'paths') {
        $out .= '<h2>URL別件数（上位50件）</h2>'.admin_table_open('URL別アクセス件数').'<thead><tr><th scope="col">URLパス</th><th scope="col">リクエスト数</th><th scope="col">4xx・5xx</th></tr></thead><tbody>';
        foreach (array_slice($r['paths'],0,50) as $p) $out .= '<tr><th scope="row">'.e($p['path']).'<small>'.e($p['host']).'</small></th><td>'.number_format($p['count']).'</td><td>'.number_format($p['errors']).'</td></tr>';
        if (!$r['paths']) $out .= '<tr><td colspan="3" class="admin-empty">この条件に一致するアクセスはありません。</td></tr>';
    } elseif ($o['tab'] === 'days') {
        $out .= '<h2>日別件数</h2>'.admin_table_open('日別アクセス件数').'<thead><tr><th scope="col">日付（日本時間）</th><th scope="col">リクエスト数</th></tr></thead><tbody>';
        foreach ($r['days'] as $day=>$count) $out .= '<tr><th scope="row">'.e($day).'</th><td>'.number_format($count).'</td></tr>';
        if (!$r['days']) $out .= '<tr><td colspan="2" class="admin-empty">この条件に一致するアクセスはありません。</td></tr>';
    } else {
        $out .= '<h2>個別のアクセス履歴（新しい順）</h2>'.admin_pager($o['page'],$r['total'],$o['limit'],$base)
            .admin_table_open('個別のアクセス履歴').'<thead><tr><th scope="col">日時（日本時間）</th><th scope="col">URLパス</th><th scope="col">メソッド</th><th scope="col">応答</th><th scope="col">処理時間</th><th scope="col">送信量</th></tr></thead><tbody>';
        foreach ($r['rows'] as $p) $out .= '<tr><td>'.e(access_time($p['ts'])).'</td><th scope="row">'.e($p['path']).'<small>'.e($p['host']).'</small></th><td>'.e($p['method']).'</td><td>'.$p['status'].'</td><td>'.($p['duration']===null?'不明':number_format($p['duration']*1000,1).' ms').'</td><td>'.($p['size']===null?'不明':number_format($p['size']).' B').'</td></tr>';
        if (!$r['rows']) $out .= '<tr><td colspan="6" class="admin-empty">このページに表示するアクセスはありません。</td></tr>';
    }
    $out .= '</tbody></table></div>';
    if ($o['tab'] === 'requests') $out .= admin_pager($o['page'],$r['total'],$o['limit'],$base);
    return $out.'<details class="admin-panel"><summary>記録の範囲と数え方</summary><p>ニュース・World・手話カフェ・地図・おとまど・API・画像等、deafnavi.com と www.deafnavi.com に届くリクエストを記録します。取得開始前の履歴、外部のリンク先での閲覧、端末内のオフライン表示は含みません。</p><p>ロボット・監視・管理者の確認も含むリクエスト数です。利用者数や厳密なページビュー数ではありません。Cloudflare Web Analyticsとは計測方法が異なります。</p><p>IPアドレス・Cookie・認証情報・User-Agent・参照元・入力本文・URLの検索条件は保存しません。ログは公開領域外に保管し、管理者権限でのみ閲覧できます。10 MiBまたは24時間ごとに分割し、最大31世代・30日を目安に保持します。表示は最大64 MiB・20万行・約4秒の読込範囲で、未集計分がある場合は画面に明示します。</p></details>';
}
