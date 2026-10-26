<?php
declare(strict_types=1);
// Submitted material stays private. Only the separately reviewed publication
// fields may reach the public directory or the complimentary text client.
const EVENT_TIP_KINDS=['announcement'=>'主催者の告知','poster'=>'店頭で見た','attended'=>'参加した','hearsay'=>'人から聞いた'];
const EVENT_TIP_CHECKS=[
 'official'=>'告知元が主催者・店舗・共催者本人のものと確認した',
 'venue'=>'会場の実在と所在地を、会場の公式案内でも確認した',
 'date'=>'開催年・日付・曜日・時刻を確認した（過去の開催報告ではない）',
 'conditions'=>'料金・対象・申込先・締切・定員・中止／満席の有無を確認した',
 'relevance'=>'手話・筆談で交流する催しであると本文で確認した',
 'links'=>'申込・決済・QRコードの誘導先が主催者の案内と一致し、不審な勧誘がない',
 'image'=>'添付写真を確認した（または添付なし）。日程との矛盾、個人情報、無関係な内容がない',
 'sharing'=>'下の題名・引用は公表済みで、個人の連絡先・健康体験・共有制限を含まない',
 'publish'=>'公開用の文章を確認した。無料APIの照合が一致した場合の新規掲載を認める'
];
function is_event_tip(array $p):bool {return ($p['form_kind']??'')==='event_tip';}
function event_tip_form(array $values=[],string $error=''):string {
 start_session();if(!$values)$_SESSION['form_issued']=time();
 $v=fn($k)=>is_string($values[$k]??null)?mb_substr($values[$k],0,6000):'';
 $out='<section class="dn-event-tip"><h2>イベント情報を送る</h2><p>手話カフェ・手話べり・筆談交流の情報をお寄せください。スターバックスでの開催もこちらへ。分かる範囲で送れます。</p>'.($error!==''?'<div class="dn-error" role="alert">'.e($error).' 写真を添えていた場合は、選び直してください。</div>':'').'<form method="post" action="/submit/?form=event" enctype="multipart/form-data" class="dn-form" autocomplete="off">'.csrf().'<input type="hidden" name="form_kind" value="event_tip"><div class="dn-honey" aria-hidden="true"><label>この欄は空欄のまま<input name="website_confirm" tabindex="-1" autocomplete="off"></label></div><fieldset><legend>どこで知りましたか</legend>';
 foreach(EVENT_TIP_KINDS as $key=>$label)$out.='<label><input type="radio" name="evidence_kind" value="'.$key.'"'.($v('evidence_kind')===$key?' checked':'').' required> '.$label.'</label> ';
 $out.='</fieldset><div class="dn-form-grid">'.field('name','イベント名・お店の名前',$v('name'),'text',true).field('venue_name','会場名（分かれば）',$v('venue_name')).select_field('prefecture','都道府県',[''=>'分からない']+array_combine(explode(' ',JP_PREFECTURES),explode(' ',JP_PREFECTURES)),$v('prefecture')).field('city','市区町村（分かれば）',$v('city')).field('activity_date','開催日（分かれば）',$v('activity_date'),'date').field('business_hours','開催時間（例：18:00〜19:00）',$v('business_hours')).'</div>'.field('source_url','告知URL（分かれば）',$v('source_url'),'url').'<label class="dn-field"><span>店頭ポスター・告知の写真（任意・2枚まで）</span><input type="file" name="event_photos[]" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="tip-photo-help"></label><p id="tip-photo-help">JPEG・PNG・WebP、1枚2MBまで。顔・名札・個人の電話番号などが写らないようにしてください。写真は確認用に非公開で保管し、公開ページへ転載しません。</p>'.field('description','内容・参加方法・料金など（分かる範囲で）',$v('description'),'textarea').'<p>URLも写真もない場合は、見聞きした内容を一言添えてください。次回の日付が分からなくても送れます。</p><label><input type="checkbox" name="consent" value="1" required> 内容と写真を確認用に保存し、管理者へ通知することに同意します。公開済みの告知の必要部分は、確認後にAIで照合する場合があります。</label><p>最初は確認待ちになります。投稿内容や写真をそのまま公開することはありません。確認できた開催情報を掲載し、不明点や不審な点があれば管理者が判断します。お名前・メールアドレスの入力は不要です。</p><button>確認用に送る</button></form></section>';
 return $out;
}
function event_tip_submission(array $post):array {
 $p=['form_kind'=>'event_tip','category'=>'cafe','report_type'=>'other','country_code'=>'JP','country_name'=>'日本','shop_type'=>'event','type'=>'limited','timezone'=>'Asia/Tokyo'];
 foreach(['name'=>300,'venue_name'=>300,'prefecture'=>100,'city'=>200,'activity_date'=>10,'business_hours'=>300,'source_url'=>2000,'description'=>6000] as $k=>$max)$p[$k]=input($post,$k,$max);
 if($p['name']==='')fail('イベント名かお店の名前を入力してください。');
 $p['evidence_kind']=choice(input($post,'evidence_kind',20),EVENT_TIP_KINDS);
 if($p['prefecture']!==''&&!in_array($p['prefecture'],explode(' ',JP_PREFECTURES),true))fail('都道府県を確認してください。');
 $p['activity_date']=date_value($p['activity_date']);$p['source_url']=safe_url($p['source_url']);
 $p['tip_state']='review_required';$p['tip_reasons']=['投稿の根拠・会場・画像・共有適性の確認待ち'];
 return $p;
}
function event_tip_photo_dir(string $id):string {
 if(!preg_match('/^[a-f0-9]{32}$/D',$id))fail('投稿IDが不正です。');
 return data_dir().'/event-tip-photos/'.$id;
}
function event_tip_uploads(string $id,array $files):array {
 if(!$files)return [];
 if(!is_array($files['error']??null)||count($files['error'])>2)fail('写真は2枚までです。');
 $prepared=[];$total=0;
 foreach($files['error'] as $i=>$error){
  if($error===UPLOAD_ERR_NO_FILE)continue;
  if($error!==UPLOAD_ERR_OK||!isset($files['tmp_name'][$i])||!is_uploaded_file($files['tmp_name'][$i]))fail('写真を受け取れませんでした。JPEG・PNG・WebPで送り直してください。');
  $file=$files['tmp_name'][$i];$size=filesize($file);$total+=$size;
  if($size>2*1024*1024||$total>4*1024*1024)fail('写真は1枚2MBまで、合計4MBまでです。');
  $info=@getimagesize($file);$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file);
  if(!$info||!in_array($mime,['image/jpeg','image/png','image/webp'],true)||$info['mime']!==$mime||$info[0]<1||$info[1]<1||$info[0]>8000||$info[1]>8000||$info[0]*$info[1]>16000000)fail('写真の形式か大きさを確認してください（最大1600万画素）。');
  if(!function_exists('imagecreatefromstring'))fail('写真の受付を一時的に利用できません。URLや文章でお送りください。',503);
  $im=@imagecreatefromstring(file_get_contents($file));if(!$im)fail('写真を読み取れませんでした。');
  // Re-encode pixels: discard EXIF/GPS, filenames, scripts and trailing bytes.
  if($mime==='image/jpeg'&&function_exists('exif_read_data')){
   $orientation=(int)(@exif_read_data($file)['Orientation']??1);
   if(in_array($orientation,[2,4,5,7],true))imageflip($im,IMG_FLIP_HORIZONTAL);
   $angle=match($orientation){3,4=>180,5,6=>-90,7,8=>90,default=>0};
   if($angle){$turned=imagerotate($im,$angle,0);imagedestroy($im);$im=$turned;}
  }
  ob_start();imagejpeg($im,null,90);$bytes=ob_get_clean();imagedestroy($im);
  if(!is_string($bytes)||strlen($bytes)>8*1024*1024)fail('写真を処理できませんでした。');
  $prepared[]=$bytes;
 }
 if(!$prepared)return [];
 $stored=0;foreach(glob(data_dir().'/event-tip-photos/*/*.jpg')?:[] as $existing)$stored+=filesize($existing);
 if($stored+array_sum(array_map('strlen',$prepared))>268435456)fail('写真の保管容量に達しています。告知URLや文章でお送りください。',503);
 $dir=event_tip_photo_dir($id);if(!is_dir(dirname($dir)))mkdir(dirname($dir),0700);if(!mkdir($dir,0700))throw new RuntimeException('Photo directory unavailable');
 $out=[];try{foreach($prepared as $i=>$bytes){$name=($i+1).'.jpg';if(file_put_contents($dir.'/'.$name,$bytes,LOCK_EX)!==strlen($bytes))throw new RuntimeException('Photo write failed');chmod($dir.'/'.$name,0600);$out[]=['slot'=>$i+1,'sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];}}catch(Throwable $e){event_tip_cleanup_photos($id);throw $e;}
 return $out;
}
function event_tip_cleanup_photos(string $id):void {
 $dir=event_tip_photo_dir($id);foreach(['1.jpg','2.jpg'] as $name)if(is_file($dir.'/'.$name))unlink($dir.'/'.$name);if(is_dir($dir))rmdir($dir);
}
function event_tip_photo():never {
 $u=require_user();if($u['must_change'])fail('パスワードの変更が必要です。',403);
 $id=input($_GET,'id',32);$slot=input($_GET,'photo',1);if(!in_array($slot,['1','2'],true))fail('写真が見つかりません。',404);
 $s=query('SELECT payload FROM submissions WHERE id=?',[$id])->fetch();$p=$s?json_decode($s['payload'],true):[];
 $photo=array_values(array_filter($p['photos']??[],fn($x)=>(string)$x['slot']===$slot))[0]??null;$file=event_tip_photo_dir($id).'/'.$slot.'.jpg';
 if(!is_event_tip($p)||!$photo||!is_file($file)||is_link($file)||!hash_equals($photo['sha256'],hash_file('sha256',$file)))fail('写真が見つかりません。',404);
 header('Content-Type: image/jpeg');header('Content-Disposition: inline; filename="poster.jpg"');header('X-Robots-Tag: noindex, nofollow');header('Cache-Control: private, no-store');readfile($file);exit;
}
function event_tip_admin(array $s,array $p):string {
 $id=$s['id'];$out='<section class="dn-notice"><h3>イベント投稿の確認</h3><p>知った経緯：'.e(EVENT_TIP_KINDS[$p['evidence_kind']]??'未確認').'</p><p>確認状況：'.e(['review_required'=>'管理者の確認待ち','api_pending'=>'無料APIの照合待ち','exception'=>'判断が必要','published'=>'掲載済み'][$p['tip_state']??'']??'確認待ち').'</p><ul>';
 foreach($p['tip_reasons']??[] as $reason)$out.='<li>'.e($reason).'</li>';
 $out.='</ul><p>URL検査は危険性の保証ではありません。短縮URLや別サイトの支払先、なりすまし、勧誘、個人情報、過去の開催報告にも注意してください。画像は目視で確認し、AIには画像そのものや投稿原文を送りません。</p>';
 foreach($p['photos']??[] as $photo)$out.='<p><a href="/admin/?view=event-photo&id='.e($id).'&photo='.(int)$photo['slot'].'" target="_blank" rel="noopener">写真'.(int)$photo['slot'].'を確認</a></p>';
 if($s['status']!=='pending')return $out.'</section>';
 $r=$p['tip_review']['record']??$p;
 $out.='<details><summary>根拠を確認して無料APIの照合へ進める</summary><p>公式HTMLの本文を確認してください。写真のみ・SNSのみ・年の補完が必要な告知は、この画面下の「正式データへ反映」で個別に判断します。引用が変わる、取得できない、APIが一致しない場合は自動掲載されません。</p><form method="post" class="dn-form">'.csrf().'<input type="hidden" name="action" value="event_tip_review"><input type="hidden" name="id" value="'.e($id).'"><input type="hidden" name="revision" value="'.(int)$s['revision'].'"><div class="dn-form-grid">';
 foreach(['name'=>'公開するイベント名','activity_date'=>'開催日','business_hours'=>'開催時刻','venue_name'=>'会場名','prefecture'=>'都道府県','city'=>'市区町村','address'=>'会場住所'] as $k=>$label)$out.=field($k,$label,$r[$k]??'',$k==='activity_date'?'date':'text',true);
 $out.='</div>'.field('source_url','主催者の公式HTML URL',$p['tip_review']['sourceUrl']??$p['source_url'],'url',true).field('venue_url','実在を確認した会場の公式URL',$r['venue_url']??'','url',true).field('venue_quote','会場の公式ページにある名称・住所の短い引用',$p['tip_review']['venueQuote']??'','textarea',true).field('excerpt','公式告知の引用（年・月日・会場・申込・手話/筆談の記載を含む、1100文字以内）',$p['tip_review']['excerpt']??'','textarea',true).field('description','公開用の説明（料金・対象・申込・締切・定員。不明な点は要確認）',$r['description']??'','textarea',true).field('application','公式本文の申込条件（原文と同じ表現）',$p['tip_review']['application']??'','text',true).select_field('communication','交流方法',['sign'=>'手話','writing'=>'筆談','both'=>'手話と筆談'],$p['tip_review']['communication']??'sign');
 foreach(EVENT_TIP_CHECKS as $key=>$label)$out.='<p><label><input type="checkbox" name="check_'.$key.'" value="1" required> '.e($label).'</label></p>';
 return $out.'<p>確認結果はこの投稿・写真・引用・取得した公式本文に結び付けて保存します。48時間を超えた確認は再確認待ちになります。無料枠が確認できない日は送信せず保留します。</p><button>確認を保存して照合待ちにする</button></form></details></section>';
}
