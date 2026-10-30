<?php
declare(strict_types=1);
// Authenticated admin overview only. This generated report contains public
// source material; no submissions or visitor identifiers are exported to it.
function admin_quality_source_dates(array $record):string {
    $source=$record['sourcePublication']??null;
    if(!is_array($source))return ($record['sourcePublishedDate']??'')!==''?'<br>原記事の公開日：'.e($record['sourcePublishedDate']).(($record['sourceUpdatedDate']??'')!==''?' ／ 原記事の更新日：'.e($record['sourceUpdatedDate']):'').' ／ 配信日時：'.e($record['feedPublishedAt']??'未確認'):'';
    $parts=[];
    if(($source['editorialOriginalDate']??'')!=='')$parts[]='初出（編集注記）：'.e($source['editorialOriginalDate']);
    elseif(($source['originalPublishedDate']??'')!=='')$parts[]='原記事の公開日（媒体の表示）：'.e($source['originalPublishedDate']);
    if(($source['pageRepublishedDate']??'')!=='')$parts[]='ページ再公開日：'.e($source['pageRepublishedDate']);
    if(($source['originalPublishedAtUtc']??'')!=='')$parts[]='原記事の公開日時（UTC）：'.e($source['originalPublishedAtUtc']);
    if(!$parts)return '';
    $parts[]='配信日時（UTC）：'.e($record['feedPublishedAt']??'未確認');
    return '<br>'.implode(' ／ ',$parts);
}
function admin_quality_overview(?string $file=null):string {
    $path=$file??data_dir().'/publication-quality-report.json';
    $report=is_file($path)?json_decode((string)file_get_contents($path),true):null;
    $missing='<section><h2>掲載品質の確認</h2><p>品質集計は未取得です。件数・充足率は未確認です。</p></section>';
    if(!is_array($report)||($report['schemaVersion']??'')!=='deafnavi-quality-report.v1'||!is_array($report['coverage']??null)||!is_array($report['events']??null)||!is_array($report['holds']??null)||!is_array($report['classificationReview']??null)||strtotime($report['generatedAt']??'')===false||!isset($report['range']['from'],$report['range']['through'],$report['recheckDue']))return $missing;
    if(isset($report['resolvedReviews'])&&!is_array($report['resolvedReviews']))return $missing;
    if(isset($report['integrityWarnings'])&&!is_array($report['integrityWarnings']))return $missing;
    $fields=['time'=>'時刻','fee'=>'料金','signup'=>'申込方法','deadline'=>'申込締切','communication'=>'情報の受け取り方'];
    foreach(array_keys($fields) as $key){$coverage=$report['coverage'][$key]??[];foreach(['confirmed','notApplicable','unknown','total'] as $count)if(!isset($coverage[$count])||!is_int($coverage[$count])||$coverage[$count]<0)return $missing;if($coverage['confirmed']+$coverage['notApplicable']+$coverage['unknown']!==$coverage['total'])return $missing;}
    $out='<section><h2>掲載品質の確認</h2><p>集計：'.e($report['generatedAt']).' ／ '.e($report['range']['from']).'〜'.e($report['range']['through']).'</p><p>以下は集計時点の記載状況です。支援の利用可否や参加可能性を保証しません。期限切れの確認情報も要確認として含みます。</p>';
    if(time()-strtotime($report['generatedAt'])>86400)$out.='<p>この集計は24時間以上前のものです。最新の集計で確認してください。</p>';
    if(!empty($report['integrityWarnings']))$out.='<p role="alert">処理済みの確認記録に整合性の不一致が'.count($report['integrityWarnings']).'件あります。根拠の記録を再確認してください。掲載対象外の状態は維持されています。</p>';
    $out.='<p>再確認が必要なイベント：'.(int)$report['recheckDue'].'件 ／ 公開保留：'.count($report['holds']).'件 ／ Worldの地域未確認：'.count($report['classificationReview']??[]).'件 <a href="/deaf-navi-world-jp.html?region=unknown">対象記事を見る</a></p>';
    $out.=admin_table_open('今後30日のイベント情報充足').'<thead><tr><th>項目</th><th>記載あり</th><th>該当なしと確認</th><th>未確認</th><th>対象件数</th></tr></thead><tbody>';
    foreach($fields as $key=>$label){$c=$report['coverage'][$key]??[];$out.='<tr><th scope="row">'.$label.'</th><td>'.(int)($c['confirmed']??0).'</td><td>'.(int)($c['notApplicable']??0).'</td><td>'.(int)($c['unknown']??0).'</td><td>'.(int)($c['total']??0).'</td></tr>';}
    $out.='</tbody></table></div><details><summary>イベントごとの不足・再確認を確認</summary>'.admin_table_open('イベントごとの情報充足').'<thead><tr><th>イベント</th><th>確認状態</th><th>未確認の項目</th></tr></thead><tbody>';
    foreach($report['events'] as $event){$missing=[];foreach($fields as $key=>$label)if(($event['information'][$key]??'unknown')==='unknown')$missing[]=$label;$url='/events/'.rawurlencode($event['id']).'/';$out.='<tr><th scope="row"><a href="'.e($url).'">'.e($event['title']).'</a><small>'.e($event['startDate'].' '.$event['prefecture']).'</small></th><td>'.e($event['period']==='review'?'要再確認':($event['period']==='cancelled'?'中止の告知':'確認記録あり')).'</td><td>'.e($missing?implode('、',$missing):'未確認項目なし').'</td></tr>';}
    $out.='</tbody></table></div></details><details><summary>ニュース・Worldの公開保留を確認（'.count($report['holds']).'件）</summary><p>原文と訳文を照合し、同一内容への確認記録を残してから解除します。自動校正は人による確認と区別します。</p><ul>';
    foreach($report['holds'] as $hold){$reason=['advertisement-review'=>'記事広告の表示区分を要確認','source-date-mismatch'=>'原記事と配信日時が不一致','source-changed-after-closure'=>'処理済み記事の原文が変更','possible-repost-of-closed'=>'処理済み記事の再配信の可能性','archived-original-date'=>'保管済みの記事を再収集','advertisement'=>'対象外の記事広告を再収集','source-context-review'=>'情報源の文脈を要確認','translation-review'=>'訳文の確認が必要','unrelated'=>'関連性の確認が必要','review-expired-or-changed'=>'確認後に内容が変更','incidental-celebrity-history'=>'過去の難聴歴が付随する芸能記事'][$hold['reason']]??'掲載基準の再確認';$source='';foreach(['articleUrl','sourceUrl'] as $key){$candidate=$hold[$key]??'';if(filter_var($candidate,FILTER_VALIDATE_URL)&&in_array(strtolower((string)parse_url($candidate,PHP_URL_SCHEME)),['http','https'],true)){$source=$candidate;break;}}$out.='<li>'.e($hold['title']).' — '.e($reason);if(($hold['translatedTitle']??'')!==''&&$hold['translatedTitle']!==$hold['title'])$out.='<br>訳文：'.e($hold['translatedTitle']);if(($hold['sourcePublishedDate']??'')!=='')$out.='<br>原記事の公開日：'.e($hold['sourcePublishedDate']).(($hold['sourceUpdatedDate']??'')!==''?' ／ 原記事の更新日：'.e($hold['sourceUpdatedDate']):'').' ／ 配信日時：'.e($hold['feedPublishedAt']??'未確認');if(($hold['previousSourcePublication']['originalPublishedDate']??'')!=='')$out.='<br>前回確認した原記事の公開日：'.e($hold['previousSourcePublication']['originalPublishedDate']);if($source!=='')$out.=' <a href="'.e($source).'" target="_blank" rel="noopener noreferrer">原文・情報源（新しいタブ）</a>';$out.='</li>';}
    $out.='</ul></details>';
    if(isset($report['resolvedReviews'])){
        $resolved=$report['resolvedReviews'];
        $out.='<details><summary>処理済みの確認記録（'.count($resolved).'件）</summary><p>過去記事は原記事の公開日を記録して保管し、通常ニュースへ自動で戻しません。記事広告などの対象外記事も原文と判断理由を残します。</p><ul>';
        foreach($resolved as $record){
            $label=($record['status']??'')==='archived'?'過去記事として保管':(($record['reason']??'')==='advertisement'?'記事広告のため対象外':'掲載対象外');
            $out.='<li>'.e($record['title']??'').' — '.e($label);
            $out.=admin_quality_source_dates($record);
            if(($record['reviewNote']??'')!=='')$out.='<br>'.e($record['reviewNote']);
            foreach(['articleUrl','sourceUrl'] as $key){$candidate=$record[$key]??'';if(filter_var($candidate,FILTER_VALIDATE_URL)&&in_array(strtolower((string)parse_url($candidate,PHP_URL_SCHEME)),['http','https'],true)){$out.=' <a href="'.e($candidate).'" target="_blank" rel="noopener noreferrer">原文・情報源（新しいタブ）</a>';break;}}
            $out.='</li>';
        }
        $out.='</ul></details>';
    }
    $out.='<p><a href="/admin/?view=submissions&amp;status=pending">訂正・情報提供の確認待ち</a> ／ <a href="/admin/?view=cafe-events">カフェイベントの再確認台帳</a></p><p>来店・申込完了・利用目的の達成：未計測。既存の外部クリック数とは区別します。</p></section>';
    return $out;
}
