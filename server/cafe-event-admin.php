<?php
declare(strict_types=1);
require_once __DIR__.'/cafe-event-registry.php';

function cafe_event_admin():string {
    require_user();
    $data=cafe_registry_export();
    if(!$data['ready'])return '<p class="dn-notice">イベントの追跡台帳は準備中です。</p>';
    $today=$data['today'];$q=input($_GET,'q',200);$pref=input($_GET,'prefecture',100);$filter=input($_GET,'review',20);
    if($filter!=='')choice($filter,['due'=>1,'annual'=>1,'changed'=>1,'unavailable'=>1]);
    $rows=array_values(array_filter($data['series'],function($s)use($q,$pref,$filter,$today){
        if($pref!==''&&$s['prefecture']!==$pref)return false;
        if($q!==''&&!str_contains(normalized($s['title'].' '.$s['organizer'].' '.$s['city']),normalized($q)))return false;
        $health=array_column($s['source_health'],'result');
        return match($filter){'due'=>$s['state']==='watching'&&$s['next_check_on']<=$today,'annual'=>$s['annual_review_due'],'changed'=>in_array(true,array_column($s['source_health'],'needs_review'),true),'unavailable'=>array_intersect($health,['unavailable','manual_check','blocked_target'])!==[],default=>true};
    }));
    $prefs=array_combine(explode(' ',JP_PREFECTURES),explode(' ',JP_PREFECTURES));$sourceLabels=['baseline'=>'初回取得','unchanged'=>'ページ変更なし','changed'=>'ページ変更あり','unavailable'=>'取得できず','manual_check'=>'目視での確認が必要','blocked_target'=>'確認先の見直しが必要','not_checked'=>'未取得'];
    $due=count(array_filter($data['series'],fn($s)=>$s['state']==='watching'&&$s['next_check_on']<=$today));$annual=count(array_filter($data['series'],fn($s)=>$s['annual_review_due']));
    $total=count($rows);$size=admin_size();$page=min(max(1,(int)input($_GET,'page',6)),max(1,(int)ceil($total/$size)));$rows=array_slice($rows,($page-1)*$size,$size);$base=['view'=>'cafe-events','q'=>$q,'prefecture'=>$pref,'review'=>$filter];
    $out='<p>主催者・確認先と、日付ごとの掲載履歴を分けて管理します。次回告知が未発表でも追跡先を残します。</p><div class="admin-metrics admin-event-metrics"><a href="/admin/?view=cafe-events"><strong>'.count($data['series']).'</strong><span>登録した追跡先</span></a><a href="/admin/?view=cafe-events&review=due"><strong>'.$due.'</strong><span>再確認期限が到来</span></a><a href="/admin/?view=cafe-events&review=annual"><strong>'.$annual.'</strong><span>年次棚卸の期限が到来</span></a></div>';
    $out.='<form method="get" class="admin-filters"><input type="hidden" name="view" value="cafe-events">'.field('q','主催者・企画名',$q).select_field('prefecture','都道府県',[''=>'すべて']+$prefs,$pref).select_field('review','確認対象',[''=>'すべて','due'=>'再確認期限が到来','annual'=>'年次棚卸の期限が到来','changed'=>'ページ変更あり','unavailable'=>'取得できず・目視確認'],$filter).'<button>絞り込む</button><a href="/admin/?view=cafe-events">解除</a></form>';
    $out.='<p class="dn-muted">サイトの取得日と、内容の調査日は別々に記録しています。日次の新規発見では全国を検索し、曜日ごとに重点地域を変えます。</p>'.admin_pager($page,$total,$size,$base).admin_table_open('手話カフェイベントの追跡台帳').'<thead><tr><th scope="col">企画・主催者</th><th scope="col">地域・分類</th><th scope="col">調査・次回開催</th><th scope="col">確認先・ページ取得</th><th scope="col">再確認・年次棚卸</th><th scope="col">掲載履歴</th></tr></thead><tbody>';
    foreach($rows as $s){
        $out.='<tr><th scope="row">'.e($s['title']).'<small>'.e($s['organizer']?:'主催者未確認').'</small><small>'.e(CAFE_SERIES_STATES[$s['state']]).'</small>';
        $history=query('SELECT checked_on,result,notes FROM cafe_event_research_checks WHERE series_id=? ORDER BY checked_on DESC,batch DESC LIMIT 6',[$s['id']])->fetchAll();
        if($history){$out.='<details><summary>確認履歴</summary><ul>';foreach($history as $h)$out.='<li>'.e($h['checked_on'].' / '.CAFE_RESEARCH_RESULTS[$h['result']]).'<p>'.nl2br(e($h['notes'])).'</p></li>';$out.='</ul></details>';}
        if($s['notes'])$out.='<small>'.nl2br(e($s['notes'])).'</small>';
        $out.='</th><td>'.e($s['prefecture'].' '.$s['city']).'<small>'.e(CAFE_SERIES_KINDS[$s['series_kind']]).'</small>'.($s['cadence']?'<small>'.e($s['cadence']).'</small>':'').'</td><td>調査 '.e($s['last_researched_on']?:'未調査').'<small>'.e($s['last_result']?CAFE_RESEARCH_RESULTS[$s['last_result']]:'').'</small><small>次回 '.e($s['next_event_on']?:'未発表・未確認').'</small></td><td>';
        foreach($s['source_health'] as $health)$out.='<a href="'.e($health['url']).'" target="_blank" rel="noopener noreferrer">'.e(parse_url($health['url'],PHP_URL_HOST)).' ↗</a><small>'.e(($health['checked_on']?:'未取得').' / '.($sourceLabels[$health['result']]??$health['result'])).'</small>'.($health['needs_review']?'<small>未確認の変更あり · 内容調査待ち</small>':'');
        $out.='</td><td>再確認 '.e($s['next_check_on']).'<small>年次 '.e($s['annual_review_due_on']).($s['annual_review_due']?'（期限到来）':'').'</small><small>前回棚卸 '.e($s['annual_reviewed_on']?:'未実施').'</small></td><td>';
        if($s['listing_id'])$out.='<a href="/admin/?view=edit&kind=cafe&id='.e($s['listing_id']).'">定期開催の掲載内容</a>';
        foreach(array_slice($s['occurrences'],0,6) as $o)$out.='<a href="/admin/?view=edit&kind='.e($o['kind']).'&id='.e($o['record_id']).'">'.e($o['event_date']?:'日時未確認の実績').'</a><small>'.e(PUBLICATIONS[$o['publication']]).'</small>';
        if(!$s['occurrences']&&!$s['listing_id'])$out.='未掲載・確認先として登録';
        $out.='</td></tr>';
    }
    $out.='</tbody></table></div>'.admin_pager($page,$total,$size,$base).'<h2>日次確認の実行履歴</h2>';
    if($data['source_runs']){$run=$data['source_runs'][0];$summary=json_decode($run['summary'],true);$out.='<p>ページ取得：'.e($run['checked_on']).' · '.(int)($summary['sources']??0).' / '.(int)($summary['registered_sources']??$summary['sources']??0).' URLを確認。次回へ繰越 '.(int)($summary['deferred_sources']??0).' URL。</p>';}
    foreach(array_slice($data['runs'],0,7) as $run){$summary=$run['summary'];$out.='<p>'.e($run['checked_on']).'：調査 '.(int)$summary['researched'].'件 / 新規掲載 '.(int)$summary['added'].'件 / 掲載更新 '.(int)$summary['updated'].'件 / 棚卸 '.(int)$summary['annual_reviews'].'件<small>重点地域：'.e(implode('・',$run['discovery']['regions'])?:'登録済み確認先').'</small></p>';}
    $out.='<details><summary>都道府県ごとの追跡先登録数</summary><p>登録数は全国の開催総数や調査完了率を示すものではありません。</p><ul>';
    foreach($data['coverage'] as $p=>$count)$out.='<li><a href="/admin/?view=cafe-events&prefecture='.e(rawurlencode($p)).'">'.e($p).'：'.$count.'件</a></li>';
    return $out.'</ul></details><p class="dn-muted">年次棚卸では、主催者・確認先URL・開催継続・分類・会場・未確認事項を見直します。告知が見つからないだけで終了扱いにせず、過去の掲載と確認履歴を保持します。</p>';
}
