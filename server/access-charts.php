<?php
declare(strict_types=1);

function access_chart_series(array $options, array $days, ?float $started): array {
    $series = [];
    $day = new DateTimeImmutable($options['from'], new DateTimeZone('Asia/Tokyo'));
    $end = new DateTimeImmutable($options['to'], new DateTimeZone('Asia/Tokyo'));
    for (; $day <= $end; $day = $day->modify('+1 day')) {
        $date = $day->format('Y-m-d');
        $series[$date] = isset($days[$date]) ? (int)$days[$date]
            : ($started === null || $day->modify('+1 day')->getTimestamp() <= $started ? null : 0);
    }
    return $series;
}

function access_daily_chart(string $title, string $unit, array $series, array $base, bool $available): string {
    $out = '<figure class="admin-access-chart"><figcaption>'.e($title).'<small>日別・'.e($unit).'</small></figcaption>';
    if (!$available) return $out.'<p class="dn-notice">未取得のためグラフを表示できません。0'.e($unit).'という意味ではありません。</p></figure>';
    $max = max([1, ...array_values(array_filter($series, fn($n)=>$n!==null))]);
    $ceiling = $max <= 5 ? $max : (int)(ceil($max / (10 ** floor(log10($max)))) * (10 ** floor(log10($max))));
    $width = 720; $height = 180; $step = $width / max(1,count($series)); $i=0;
    $out .= '<div class="admin-chart-plot"><div class="admin-chart-scale" aria-hidden="true"><span>'.number_format($ceiling).'</span><span>'.($ceiling%2 ? '' : number_format($ceiling/2)).'</span><span>0</span></div>';
    $out .= '<svg viewBox="0 0 720 180" preserveAspectRatio="none" role="img" aria-label="'.e($title).'。各日の棒から当日の詳細を開けます。"><title>'.e($title).'</title>';
    foreach ([0,90,179] as $y) $out .= '<path d="M0 '.$y.'H720" class="admin-chart-grid"/>';
    foreach ($series as $day=>$count) {
        $x = $i++ * $step; $bar = min(56,max(1,$step-2)); $barX=$x+($step-$bar)/2;
        $label = $day.'：'.($count===null?'未取得':number_format($count).$unit);
        $out .= '<a href="'.admin_query($base,['from'=>$day,'to'=>$day,'page'=>1]).'" aria-label="'.e($label).'"><title>'.e($label).'</title><rect x="'.$x.'" y="0" width="'.$step.'" height="180" fill="transparent"/>';
        $h = $count===null ? $height : max(1,$count/$ceiling*($height-2));
        $out .= '<rect class="'.($count===null?'admin-chart-unknown':'admin-chart-bar').'" x="'.round($barX,2).'" y="'.round($height-$h,2).'" width="'.round($bar,2).'" height="'.round($h,2).'"/></a>';
    }
    $dates=array_keys($series);
    $out .= '</svg><div class="admin-chart-dates" aria-hidden="true"><span>'.e(substr($dates[0],5)).'</span>';
    if (count($dates)>2) $out .= '<span>'.e(substr($dates[(int)floor((count($dates)-1)/2)],5)).'</span>';
    if (count($dates)>1) $out .= '<span>'.e(substr($dates[count($dates)-1],5)).'</span>';
    $out .= '</div></div><p class="admin-chart-help">棒を選ぶと当日の詳細を開きます。';
    if (in_array(null,$series,true)) $out .= ' 薄い灰色は未取得です。';
    return $out.'</p></figure>';
}

function access_charts_html(array $options, array $report, array $unique, array $base): string {
    $out = '<section class="admin-panel admin-access-charts" aria-labelledby="access-charts-title"><h2 id="access-charts-title">アクセスの推移</h2><p>'.e($options['from']).' ～ '.e($options['to']).'・日本時間</p>';
    $out .= '<nav class="admin-chart-ranges" aria-label="グラフの表示期間">';
    $today = new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));
    foreach ([7,30,180] as $days) $out .= '<a href="'.admin_query($base,['from'=>$today->modify('-'.($days-1).' days')->format('Y-m-d'),'to'=>$today->format('Y-m-d'),'page'=>1]).'">直近'.$days.'日</a>';
    $out .= '</nav><div class="admin-chart-pair">';
    $out .= access_daily_chart(($options['mode']??'requests')==='views'?'ページ閲覧数':'リクエスト数','件',access_chart_series($options,$report['days'],$report['oldest']),array_merge($base,['tab'=>'requests']),$report['available']);
    $started = is_string($unique['started_at']) ? strtotime($unique['started_at']) : false;
    $out .= access_daily_chart('推定ユニーク数','人',access_chart_series($options,$unique['days'],$started===false?null:(float)$started),array_merge($base,['tab'=>'unique']),$unique['available']);
    return $out.'</div><p class="admin-chart-help">リクエストは選択中の全条件、推定UUは期間・コンテンツ・URL条件と一般ブラウザーが対象です。計測開始日は開始時刻以降の値です。日別の数値は下の表示切替でも確認できます。</p></section>';
}
