<?php
declare(strict_types=1);

// Server-rendered analytics. All values come from the same bounded report.
function access_number(?int $n,string $unit='件'):string {
    return $n===null?'<span class="aa-unknown">未取得</span>':number_format($n).'<small> '.e($unit).'</small>';
}
function access_change(int $n,?int $prior,bool $valid):string {
    $d=access_delta($n,$prior,$valid);
    if($d['difference']===null)return '<span class="aa-unknown">比較不可</span>';
    $sign=$d['difference']>0?'+':'';
    return '<span class="aa-change">'.$sign.number_format($d['difference']).' 件'.($d['percent']===null?' <small>前期間0件</small>':' <small>('.($d['percent']>0?'+':'').number_format($d['percent'],1).'%)</small>').'</span>';
}
function access_table(string $label,array $headers):string {
    $out=admin_table_open($label).'<thead><tr>';
    foreach($headers as $i=>$h)$out.='<th scope="col"'.($i?' class="aa-number"':'').'>'.e($h).'</th>';
    return $out.'</tr></thead><tbody>';
}
function access_table_end(bool $empty,int $cols):string {
    return ($empty?'<tr><td colspan="'.$cols.'" class="admin-empty">この条件に一致するアクセスはありません。</td></tr>':'').'</tbody></table></div>';
}
function access_section(string $title,string $note=''):string {
    return '<section class="aa-section"><h2>'.e($title).'</h2>'.($note!==''?'<p class="aa-note">'.e($note).'</p>':'');
}
function access_filters(array $o,array $base):string {
    $today=new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));
    $out='<form method="get" class="aa-filters" autocomplete="off"><input type="hidden" name="view" value="access"><input type="hidden" name="tab" value="'.e($o['tab']).'">';
    $out.='<div class="aa-filter-grid">'.field('from','開始日',$o['from'],'date',true).field('to','終了日',$o['to'],'date',true)
        .select_field('content','コンテンツ',['all'=>'すべて']+ACCESS_CONTENTS,$o['content'])
        .field('q','URLパスで検索',$o['q']).'</div>';
    $out.='<div class="aa-filter-grid aa-filter-secondary">'.select_field('compare','期間比較',['previous'=>'同じ日数の前期間','off'=>'比較なし'],$o['compare'])
        .select_field('match','URLの一致方法',['contains'=>'文字列を含む','prefix'=>'この文字列で始まる','exact'=>'完全一致'],$o['match'])
        .select_field('mode','集計方法',['views'=>'ページ閲覧のみ','requests'=>'全リクエスト（調査用）'],$o['mode'])
        .select_field('limit','履歴の表示件数',['25'=>'25件','50'=>'50件','100'=>'100件'],(string)$o['limit']);
    if($o['mode']==='requests')$out.=select_field('group','対象',ACCESS_GROUPS,$o['group']).select_field('client','アクセス元の分類',ACCESS_CLIENTS,$o['client']).select_field('status','応答',[''=>'すべて','2xx'=>'成功（2xx）','3xx'=>'転送等（3xx）','4xx'=>'要求エラー（4xx）','5xx'=>'サーバーエラー（5xx）'],$o['status']);
    $out.='</div><div class="aa-filter-actions"><button>表示を更新</button><a href="/admin/?view=access">条件を解除</a><nav aria-label="期間のショートカット">';
    foreach([7,30] as $days)$out.='<a href="'.admin_query($base,['from'=>$today->modify('-'.$days.' days')->format('Y-m-d'),'to'=>$today->modify('-1 day')->format('Y-m-d'),'page'=>1]).'">直近'.$days.'日（昨日まで）</a>';
    $out.='<a href="'.admin_query($base,['from'=>$today->format('Y-m-d'),'to'=>$today->format('Y-m-d'),'page'=>1]).'">今日</a>';
    return $out.'</nav></div></form>';
}
function access_overview(array $o,array $r,array $uu,array $base,array $cmp):string {
    $commonMax=max([1,...array_values($r['days']),...array_values($r['previous']['days']??[])]);
    $out=access_section('アクセスの推移','日付は日本時間です。各日の棒から明細へ進めます。数値は「日別」で確認できます。');
    $out.='<div class="aa-chart-grid">'.access_daily_chart('選択期間','件',access_chart_series($o,$r['days'],$r['oldest'],!$r['partial']&&!$r['invalid']),array_replace($base,['tab'=>'requests']),$r['available'],$commonMax);
    $p=access_previous_options($o);
    if($p){$prev=$r['previous'];$out.=access_daily_chart('前期間 '.$p['from'].' ～ '.$p['to'],'件',access_chart_series($p,$prev['days'],$r['oldest'],!$r['partial']&&!$r['invalid']),array_replace($base,['tab'=>'requests','compare'=>'off']),$prev['available'],$commonMax);}
    $out.='</div>'.($p?'<p class="aa-note">2つのグラフは共通の目盛りです。増減は下の件数と比較欄でも確認できます。</p>':'').'</section>';
    $out.=access_section('コンテンツ別アクセス','サイト全体・選択期間・URL検索条件のページ閲覧です。詳細ページも各コンテンツに含めます。コンテンツ選択と調査用の条件は、この表には適用しません。');
    $out.=access_table('コンテンツ別アクセス',['コンテンツ','閲覧数','前期間との差','日別推定UUの合計']);
    foreach(ACCESS_CONTENTS as $key=>$label){
        $storyGap=$key==='stories'&&($uu['stories_measurement_gap']??false);
        $out.='<tr><th scope="row"><a href="'.admin_query($base,['mode'=>'views','content'=>$key,'client'=>'human','group'=>'all','status'=>'','page'=>1]).'">'.e($label).'</a></th><td class="aa-number">'.access_number($r['contents'][$key]).'</td><td class="aa-number">'.access_change($r['contents'][$key],$r['previous']['contents'][$key]??null,$cmp['available']).'</td><td class="aa-number">'.access_number(access_uu_value($o,$uu,(int)($uu['contents'][$key]??0),$key),'人日').($storyGap?'<small class="aa-unknown">計測漏れを含む期間</small>':'').'</td></tr>';
    }
    $out.=access_table_end(false,4).'<p class="aa-note">複数コンテンツを見た人は各行に含まれます。行のUUを足して全体人数にはできません。</p></section>';
    $out.=access_section('URL別件数（上位50件）','選択中の全条件を適用しています。ページ名の代わりに、実際に記録されたURLパスを表示します。');
    $out.=access_table('URL別アクセス件数',['URLパス',$o['mode']==='views'?'閲覧数':'リクエスト数','前期間との差','4xx・5xx']);
    foreach(array_slice($r['paths'],0,50,true) as $key=>$v){
        $out.='<tr><th scope="row"><a href="'.admin_query($base,['q'=>$v['path'],'match'=>'exact','page'=>1,'tab'=>'days']).'">'.e($v['path']).'</a><small>'.e($v['host']).'</small></th><td class="aa-number">'.access_number($v['count']).'</td><td class="aa-number">'.access_change($v['count'],$r['previous']['paths'][$key]['count']??0,$cmp['available']).'</td><td class="aa-number">'.number_format($v['errors']).'</td></tr>';
    }
    return $out.access_table_end(!$r['paths'],4).'</section>';
}
function access_sources(array $o,array $r,array $base,array $cmp):string {
    $out='<p class="aa-scope">選択中の全条件を適用。各ページのリクエストに付いた参照元です。初回の流入経路・訪問者数・検索キーワードではありません。</p>';
    $out.=access_section('参照元の区分','参照元なしには、直接入力・ブックマーク・アプリ・ブラウザーによる省略などが混在します。すべてを「直接流入」とは扱いません。');
    $out.=access_table('参照元の区分',['区分','件数','前期間との差']);
    foreach(ACCESS_CHANNELS as $k=>$label)$out.='<tr><th scope="row">'.e($label).'</th><td class="aa-number">'.access_number($r['channels'][$k]).'</td><td class="aa-number">'.access_change($r['channels'][$k],$r['previous']['channels'][$k]??null,$cmp['available']).'</td></tr>';
    $out.=access_table_end(false,3).'</section>';
    $out.=access_section('外部の参照元ドメイン（上位50件）','URLの全文や検索語は取得していません。ドメインの分類は既知の検索・SNSドメインとの一致によります。');
    $out.=access_table('外部の参照元',['ドメイン','区分','件数']);
    foreach(array_slice($r['referrers'],0,50) as $v)$out.='<tr><th scope="row">'.e($v['host']).'</th><td>'.e(ACCESS_CHANNELS[$v['channel']]).'</td><td class="aa-number">'.access_number($v['count']).'</td></tr>';
    $out.=access_table_end(!$r['referrers'],3).'</section><div class="aa-split">';
    $out.=access_section('端末の推定','User-Agentによる大まかな分類です。iPadのPC表示などは正確に分けられない場合があります。').access_table('端末の推定',['端末','件数']);
    foreach(ACCESS_DEVICES as $k=>$label)$out.='<tr><th scope="row">'.e($label).'</th><td class="aa-number">'.access_number($r['devices'][$k]).'</td></tr>';
    $out.=access_table_end(false,2).'</section>'.access_section('曜日別','曜日ごとの合計です。期間内に含まれる曜日の回数は同じとは限りません。').access_table('曜日別',['曜日','件数']);
    foreach(['月','火','水','木','金','土','日'] as $i=>$day)$out.='<tr><th scope="row">'.$day.'曜日</th><td class="aa-number">'.access_number($r['weekdays'][$i+1]).'</td></tr>';
    $out.=access_table_end(false,2).'</section></div>'.access_section('時間帯別','日本時間・各時間帯の合計。滞在時間を表すものではありません。');
    $out.='<div class="aa-hour-grid">';$max=max(1,...$r['hours']);
    foreach($r['hours'] as $hour=>$count)$out.='<div class="aa-hour"><span>'.$hour.'時台</span><meter min="0" max="'.$max.'" value="'.$count.'" aria-label="'.$hour.'時台 '.number_format($count).'件"></meter><strong>'.number_format($count).'</strong></div>';
    return $out.'</div></section>';
}
function access_actions(array $o):string {
    $eng=engagement_report($o);$co=access_covisits($o);
    $out='<p class="aa-scope">サイト全体・日付条件のみ。コンテンツ・URL・調査用の絞り込みは適用しません。</p>';
    $out.=access_section('関連記事・記事クリック','受け取った操作通知の件数です。表示は関連記事欄が画面内に入った回数、クリックは同じページ表示中の同じリンクを重複除外します。人数・成約・読了・クリック率には換算しません。');
    if(!$eng['available'])$out.='<p class="aa-notice">計測データ未取得。未開始または保存先を読み取れません。0件ではありません。</p>';
    else{
        $out.='<p class="aa-note">最古の保存日：'.e($eng['first_day']??'記録なし').'。この日より前から計測していたかは、この台帳だけでは分かりません。</p>';
        if($eng['saturated'])$out.='<p class="aa-notice">日別の記録上限に達した区分があります。「以上」と付いた値は最低件数です。</p>';
        $out.=access_table('クリック・操作の実績',['ページ区分','操作','通知件数']);
        foreach($eng['rows'] as $v)$out.='<tr><th scope="row">'.e(ENGAGEMENT_SOURCES[$v['source']]??'不明').'</th><td>'.e(ENGAGEMENT_EVENTS[$v['event']]??'不明').'</td><td class="aa-number">'.access_number((int)$v['hits']).($v['saturated']?' 以上':'').'</td></tr>';
        $out.=access_table_end(!$eng['rows'],3);
    }
    $out.='</section>'.access_section('同日の併読（コンテンツの組み合わせ）','同じ日に同じ推定接続が両方を表示した人日数です。移動の方向・順番・セッション・カフェからニュースへの直接遷移は分かりません。読みものの過去の計測漏れは補えません。');
    if(!$co['available'])$out.='<p class="aa-notice">併読データを取得できません。0件ではありません。</p>';
    else{
        $out.=access_table('同日の併読',['コンテンツの組み合わせ','人日数']);
        foreach($co['pairs'] as $v)$out.='<tr><th scope="row">'.e(ACCESS_CONTENTS[$v['a']]).' × '.e(ACCESS_CONTENTS[$v['b']]).'</th><td class="aa-number">'.access_number((int)$v['count'],'人日').'</td></tr>';
        $out.=access_table_end(!$co['pairs'],2);
    }
    return $out.'<p class="aa-note">複数の組み合わせに同じ接続が含まれます。表の数値は合計しません。Cookieや日をまたぐ識別子は使っていません。</p></section>';
}
function access_days(array $o,array $r,array $uu,array $base,array $cmp):string {
    $out=access_section('日別件数','左の期間に、同じ順番の日を前期間から並べています。期間全体を比較できない場合、増減は出しません。');
    $series=access_chart_series($o,$r['days'],$r['oldest'],!$r['partial']&&!$r['invalid']);
    $p=access_previous_options($o);$prev=$p?array_values(access_chart_series($p,$r['previous']['days'],$r['oldest'],!$r['partial']&&!$r['invalid'])):[];
    $out.=access_table('日別アクセス件数',['日付（日本時間）','件数','前期間の同じ順の日','差']);$i=0;
    foreach($series as $day=>$n){
        $pd=$p?(new DateTimeImmutable($p['from']))->modify('+'.$i.' days')->format('Y-m-d'):null;$pn=$prev[$i]??null;$i++;
        $out.='<tr><th scope="row"><a href="'.admin_query($base,['from'=>$day,'to'=>$day,'tab'=>'requests','page'=>1]).'">'.e($day).'</a></th><td class="aa-number">'.access_number($n).'</td><td class="aa-number">'.($pd?e($pd).'<small>'.access_number($pn).'</small>':'比較なし').'</td><td class="aa-number">'.($n===null?'<span class="aa-unknown">比較不可</span>':access_change($n,$pn,$cmp['available'])).'</td></tr>';
    }
    return $out.access_table_end(false,4).'</section>';
}
function access_uniques(array $o,array $uu,array $base):string {
    $out=access_section('日別の推定ユニーク数','同じ接続IPとブラウザー情報の重複を日本時間の1日ごとに除きます。複数日の合計は「人日」で、期間全体の実人数ではありません。期間・コンテンツ・URL条件と一般ブラウザーが対象です。');
    if(!$uu['available'])return $out.'<p class="aa-notice">推定ユニーク数を取得できません。0人という意味ではありません。</p></section>';
    $started=is_string($uu['started_at'])?strtotime($uu['started_at']):false;
    if($o['content']==='stories')$started=($uu['stories_started_at']??null)?strtotime($uu['stories_started_at']):false;
    $series=access_chart_series($o,$uu['days'],$started===false?null:(float)$started);
    $out.='<p class="aa-note">計測開始：'.e(access_iso_time($uu['started_at']??null)).'。JavaScriptによるページ表示の通知を受け取った分です。'.(($uu['stories_gap']??false)?'読みものは計測漏れを含む期間です。':'').'</p>';
    $out.=access_daily_chart('推定ユニーク数','人',$series,array_replace($base,['tab'=>'unique']),true);
    $out.=access_table('日別推定ユニーク数',['日付（日本時間）','推定ユニーク数']);
    foreach($series as $day=>$n)$out.='<tr><th scope="row">'.e($day).'</th><td class="aa-number">'.access_number($n,'人').'</td></tr>';
    $out.=access_table_end(false,2).'</section>'.access_section('URL別の推定ユニーク数（上位50件）','ページごとの日別人数の合計です。ページ間で重複するため合計しません。').access_table('URL別推定ユニーク数',['URLパス','日別人数の合計']);
    foreach($uu['paths'] as $p)$out.='<tr><th scope="row">'.e($p['path']).'</th><td class="aa-number">'.access_number((int)$p['count'],'人日').'</td></tr>';
    return $out.access_table_end(!$uu['paths'],2).'</section>';
}
function access_history(array $o,array $r,array $base):string {
    $out=access_section('個別のアクセス履歴（新しい順）','全ファイルの日時で並べています。接続情報は管理者の調査用です。CSVには含めません。');
    if($r['history_limited']??false)$out.='<p class="aa-notice">履歴の表示は新しい10,000件までです。期間やURLで絞り込んでください。集計件数は履歴の表示上限とは別です。</p>';
    $pager=admin_pager($o['page'],min(10000,$r['total']),$o['limit'],$base);
    $out.=$pager.access_table('個別のアクセス履歴',['日時（日本時間）','URLパス','分類・接続情報','メソッド','応答','処理時間','送信量']);
    foreach($r['rows'] as $p)$out.='<tr><td>'.e(access_time($p['ts'])).'</td><th scope="row">'.e($p['path']).'<small>'.e($p['host']).'</small></th><td>'.e(ACCESS_CLIENTS[$p['client']]).'<details><summary>判定理由・IP・ブラウザー</summary><p>'.e($p['classification']).'</p><dl><dt>接続IP</dt><dd>'.e($p['ip']??'未取得（旧ログ）').'</dd><dt>User-Agent</dt><dd>'.e($p['user_agent']??'未取得（旧ログ）').'</dd><dt>参照元ドメイン</dt><dd>'.e($p['referrer_host']??'未取得').'</dd></dl></details></td><td>'.e($p['method']).'</td><td>'.$p['status'].'</td><td>'.($p['duration']===null?'不明':number_format($p['duration']*1000,1).' ms').'</td><td>'.($p['size']===null?'不明':number_format($p['size']).' B').'</td></tr>';
    return $out.access_table_end(!$r['rows'],7).$pager.'</section>';
}
function access_quality_html(array $o,array $r,array $uu,array $cmp):string {
    $out=access_section('今回の集計品質','読み取れた保存ログと計測通知の状態です。「全ログを読めた」ことは、人を装う自動アクセスや通知されない閲覧まで判別できたという意味ではありません。');
    $out.='<dl class="aa-facts"><dt>計算時刻</dt><dd>'.e(access_iso_time($r['as_of'])).'</dd><dt>確認できた保存範囲</dt><dd>'.e(access_time($r['oldest'])).' ～ '.e(access_time($r['latest'])).'</dd><dt>読み取り</dt><dd>'.number_format($r['scanned_lines']).' 行 / '.number_format($r['scanned_bytes']/1048576,2).' MiB / '.number_format($r['elapsed_ms']??0,1).' ms</dd><dt>形式不明の記録</dt><dd>'.number_format($r['invalid']).' 件</dd><dt>前期間比較</dt><dd>'.e($cmp['available']?'保存範囲内で比較可能':$cmp['reason']).'</dd><dt>長いUser-Agent</dt><dd>'.number_format($r['ua_unmatchable']).' 件（選択条件内）。切り詰められた可能性があり、接続照合による再分類は行いません。</dd></dl>';
    $reasons=['unreadable-file'=>'読み取れないファイル','byte-limit'=>'64 MiBの読込上限','line-limit'=>'20万行の読込上限','time-limit'=>'約4秒の処理時間上限','read-or-classification-error'=>'読取または分類処理エラー'];
    if($r['reasons']){$out.='<ul class="aa-notice">';foreach(array_keys($r['reasons']) as $key)$out.='<li>'.e($reasons[$key]??$key).'</li>';$out.='</ul><p>期間を短くして再表示してください。上限に達した履歴や原本を削除する処理は行いません。</p>';}
    $out.='</section>'.access_section('集計から除外したアクセス','選択期間・URL検索条件の生ログ全体が対象です。コンテンツ・調査用条件を適用する前の内訳で、理由は重複しません。');
    $out.='<p>生ログ '.number_format($r['raw_total']).' 件中、除外 '.number_format(array_sum($r['excluded'])).' 件。</p>'.access_table('集計の除外理由',['理由','件数']);
    foreach(ACCESS_EXCLUSIONS as $key=>$label)$out.='<tr><th scope="row">'.e($label).'</th><td class="aa-number">'.access_number($r['excluded'][$key]).'</td></tr>';
    $out.=access_table_end(false,2).'</section>'.access_section('計測範囲と解釈');
    $out.='<dl class="aa-definitions"><dt>ページ閲覧数</dt><dd>公開対象のGET・200/304からbot・AI・先読み・管理操作・不審なURL探索などを除外した件数です。再表示は含みます。オフライン表示や外部サイトでの閲覧は含みません。コンテンツ区分は現在の公開パス規則を過去ログにも適用します。</dd><dt>推定ユニーク数</dt><dd>Cookieを使わず、IPとブラウザー情報を日ごとにHMAC化します。同じ回線・同じUAは少なく、回線変更などは多く数える場合があります。JavaScript停止や通知失敗も計測できません。日をまたぐ人数・再訪率・セッション・滞在時間は計測していません。</dd><dt>読みものの計測漏れ</dt><dd>動的な記事ページが以前の公開パス確認を通らず、UU通知が拒否されていました。修正後に初めて受け取った記事通知：'.e(access_iso_time($uu['stories_started_at']??null)).'。過去分は復元しません。全体UUにも不足があり得ます。HTTPのページ閲覧数とは別です。</dd><dt>クリックと併読</dt><dd>クリックは操作通知、併読は同日・同接続の組み合わせです。人数や移動順は保存していません。両者を割って成約率・CTRを作りません。</dd><dt>記録と書き出し</dt><dd>Cookie・認証情報・投稿本文・URLの検索条件・参照元の検索語は保存しません。集計CSVは現在の条件・件数・品質表示を含み、接続IP・UA・識別子・入力した検索文字列は含めません。参照元や端末は推定であり、検索キーワードはSearch Console側のデータで確認します。</dd></dl>';
    $out.='<p class="aa-note">一般ブラウザー判定は推定です。規則的巡回の「疑い」と確定botを区別し、原本は保持します。既存の詳細判定を毎回全件やり直す処理や常時監視は追加していません。</p>'.access_quality_notice();
    if($uu['available']&&isset($uu['raw_total']))$out.='<p>UU詳細判定前 '.number_format($uu['raw_total']).' 人日 → 除外後 '.number_format($uu['total']).' 人日。規則的巡回の疑い：'.number_format($uu['quality_counts']['suspected']??0).' 人日。</p>';
    return $out.'</section>'.access_storage_html();
}
function access_analytics_view(array $o,array $r,array $uu):string {
    $base=array_intersect_key($o,array_flip(['from','to','compare','match','mode','content','group','client','status','q','tab','limit']));$base=['view'=>'access']+$base;
    $cmp=access_comparison_state($o,$r,$r['previous']??null);
    $out='<div class="access-analytics"><div class="aa-toolbar"><p>利用の傾向と、数字の確かさを確認できます。日時は日本時間です。</p><a class="aa-button" href="'.admin_query($base,['export'=>'csv']).'">集計CSVを保存</a></div>'.access_filters($o,$base);
    if(!$r['available'])return $out.'<div class="aa-notice" role="status"><h2>アクセスログを読み取れません</h2><p>ログが未設定、または保存先を読み取れない状態です。アクセス数が0件という意味ではありません。</p></div></div>';
    if($r['partial']||$r['invalid'])$out.='<p class="aa-notice" role="status">一部のログを集計できていません。以下は読み取れた範囲の件数です。増減率は表示しません。<a href="'.admin_query($base,['tab'=>'quality']).'">計測品質で原因を確認</a></p>';
    if($o['mode']==='requests')$out.='<p class="aa-notice">全リクエストの調査表示です。画像・API・エラー等も選択条件に含まれます。利用者数やページ閲覧数として扱わないでください。</p>';
    $out.='<div class="aa-period"><strong>'.e($o['from']).' ～ '.e($o['to']).'</strong><span>'.e($cmp['from']?'前期間 '.$cmp['from'].' ～ '.$cmp['to']:'比較なし').'</span><span class="aa-status">'.e($r['partial']||$r['invalid']?'部分集計':'保存ログを読取済み').'</span></div>';
    $out.='<dl class="aa-metrics"><div><dt>'.($o['mode']==='views'?'ページ閲覧数':'選択条件のリクエスト').'</dt><dd>'.access_number($r['total']).'</dd></div><div><dt>前期間との差</dt><dd>'.access_change($r['total'],$r['previous']['total']??null,$cmp['available']).'</dd>'.(!$cmp['available']?'<small>'.e($cmp['reason']).'</small>':'').'</div><div><dt><a href="'.admin_query($base,['tab'=>'unique']).'">日別推定ユニークの合計</a></dt><dd>'.access_number(access_uu_value($o,$uu,(int)$uu['total']),'人日').'</dd><small>期間全体の実人数ではありません</small></div></dl>';
    if(access_uu_measurement($o,$uu)['partial'])$out.='<p class="aa-note">UUは一部の期間・ページが未計測です。<a href="'.admin_query($base,['tab'=>'quality']).'">計測範囲を確認</a></p>';
    $out.='<nav class="aa-tabs" id="access-report" aria-label="アクセスログの表示切替">';
    foreach(['paths'=>'概要','sources'=>'参照元・端末','actions'=>'クリックと併読','days'=>'日別','unique'=>'推定ユニーク数','requests'=>'個別履歴','quality'=>'計測品質'] as $tab=>$label)$out.='<a href="'.admin_query($base,['tab'=>$tab,'page'=>1]).'#access-report"'.($o['tab']===$tab?' aria-current="page"':'').'>'.e($label).'</a>';
    $out.='</nav>';
    $out.=match($o['tab']){
        'sources'=>access_sources($o,$r,$base,$cmp),'actions'=>access_actions($o),'days'=>access_days($o,$r,$uu,$base,$cmp),
        'unique'=>access_uniques($o,$uu,$base),'requests'=>access_history($o,$r,$base),'quality'=>access_quality_html($o,$r,$uu,$cmp),
        default=>access_overview($o,$r,$uu,$base,$cmp)};
    return $out.'<p class="aa-footer-note">計算時刻 '.e(access_iso_time($r['as_of'])).' · 集計は画面を更新したときに実行します。<a href="'.admin_query($base,['tab'=>'quality']).'">指標・保存・除外の詳細</a></p></div>';
}
