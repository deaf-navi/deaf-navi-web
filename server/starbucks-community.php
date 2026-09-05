<?php
declare(strict_types=1);
function starbucks_form(string $storeId=''):string {
    start_session();$_SESSION['form_issued']??=time();
    $stores=[''=>'掲載にない店舗・店舗名を入力'];foreach(visible_records() as $p)if($p['kind']==='store')$stores[$p['id']]=$p['name'];
    if(!isset($stores[$storeId]))$storeId='';
    $body='<section class="dn-community-form"><p class="dn-eyebrow">COMMUNITY REPORT</p><h2>スターバックスの手話カフェ情報を投稿</h2><p>開催予定、参加した日の情報、日程変更などを教えてください。分かる範囲で大丈夫です。氏名・メールアドレスは不要です。</p><p class="dn-muted">投稿は確認待ちで保存し、管理者が確認してから公開します。店舗への予約にはなりません。</p><form action="/submit/" method="post" class="dn-form" data-starbucks-form>'.csrf().'<input type="hidden" name="form_kind" value="starbucks"><div class="dn-honey" aria-hidden="true"><label>空欄にしてください<input name="website_confirm" tabindex="-1" autocomplete="off"></label></div>';
    $body.=select_field('store_id','店舗',$stores,$storeId).'<div data-new-starbucks>'.field('store_name','店舗名（上で選んだ場合は不要）','','text').field('prefecture','都道府県・地域（新しい店舗の場合）','','text').'</div><div class="dn-form-grid">'.select_field('report_state','どの情報ですか',['scheduled'=>'開催予定','past'=>'開催された・参加した','cancelled'=>'中止・変更のお知らせ','unknown'=>'開催日が分からない'],'scheduled').field('event_date','開催日（分かれば）','','date').field('start_time','開始時刻（任意）','','time').field('end_time','終了時刻（任意）','','time').'</div><label class="dn-field"><span>参加条件・内容など（任意／500文字以内）</span><textarea name="conditions" maxlength="500" rows="4" data-short-count placeholder="例：初めての方も参加可、ドリンクの注文が必要、申込方法など"></textarea><small data-short-counter>0 / 500文字</small></label>'.field('source_url','情報源のURL（告知・公式SNSなど／任意）','','url').'<p class="dn-muted">URLが分からなければ、上の欄に「店頭の案内で見た」「参加した」などをご記入ください。第三者の個人情報は入力しないでください。</p><label class="dn-check"><input type="checkbox" name="consent" value="1" required> 内容確認のための保存と管理者への通知に同意します。</label><button type="submit">'.ui_icon('edit').'確認待ちとして投稿</button></form></section>';
    return $body;
}
function starbucks_submission(array $post):array {
    $id=input($post,'store_id',64);$store=null;
    if($id!==''){$r=query("SELECT * FROM records WHERE id=? AND kind='store' AND publication='public'",[$id])->fetch();if(!$r||!publicly_visible($store=expanded($r)))fail('掲載中の店舗を選んでください。');}
    $name=$store?$store['name']:input($post,'store_name',300);$pref=$store?$store['prefecture']:input($post,'prefecture',100);
    if($name===''||$pref==='')fail('店舗名と都道府県・地域を入力してください。');
    $date=date_value(input($post,'event_date',10));$start=input($post,'start_time',5);$end=input($post,'end_time',5);
    foreach([$start,$end] as $time)if($time!==''&&!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$time))fail('時刻はHH:MM形式で入力してください。');
    if($end!==''&&($start===''||$end<=$start))fail('終了時刻は開始時刻より後にしてください。日をまたぐ場合は内容欄へご記入ください。');
    $conditions=input($post,'conditions',2000);if(preg_match_all('/./us',$conditions)>500)fail('参加条件・内容は500文字以内で入力してください。');
    $state=choice(input($post,'report_state',20),['scheduled'=>1,'past'=>1,'cancelled'=>1,'unknown'=>1]);
    return ['category'=>'starbucks','report_type'=>$state==='cancelled'?'closed':'other','report_state'=>$state,'name'=>'手話カフェ開催情報：'.$name,'store_name'=>$name,'store_id'=>$id,'country_code'=>$store['country_code']??'JP','prefecture'=>$pref,'city'=>$store['city']??'','event_date'=>$date,'start_time'=>$start,'end_time'=>$end,'conditions'=>$conditions,'description'=>$conditions,'source_url'=>safe_url(input($post,'source_url',1000)),'timezone'=>$store['timezone']??'Asia/Tokyo'];
}
function starbucks_observed(array $stores,array $events,string $pref='',string $selected=''):string {
    $observed=[];foreach($events as $ev){if(($ev['observation_only']??'')==='1'||event_state($ev)==='ended')$observed[$ev['store_id']][]=$ev;}
    $body='<section class="dn-section" id="observed"><h2>手話カフェの開催実績がある店舗</h2><p>店舗・主催者・地域団体の発信で開催実績を確認した店舗です。現在の開催予定や定期開催を保証するものではありません。</p><div class="dn-observed-grid">';$count=0;
    foreach($observed as $id=>$history){$s=$stores[$id]??null;if(!$s||($pref!==''&&$s['prefecture']!==$pref)||($selected!==''&&$selected!==$id))continue;$count++;
        $body.='<article class="dn-observed-card"><div class="dn-observed-icon">'.ui_icon('pin').'</div><p class="dn-location">'.e($s['prefecture'].' / '.$s['city']).'</p><h3><a href="'.e(record_path($s)).'">'.e($s['name']).'</a></h3><span class="dn-badge">開催実績あり</span><p>'.e($history[0]['description']??'').'</p><div class="dn-observed-links">'.action_link(record_path($s),'開催履歴・情報源','page').action_link('/submit/?category=starbucks&store='.rawurlencode($id),'この店舗の情報を投稿','edit').'</div></article>';
    }
    if(!$count)$body.='<p>この条件で開催実績を確認できた店舗はありません。</p>';
    return $body.'</div></section>';
}
