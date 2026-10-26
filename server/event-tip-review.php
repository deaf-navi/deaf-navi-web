<?php
declare(strict_types=1);
require_once __DIR__.'/event-tips.php';
require_once __DIR__.'/cafe-event-fetch.php';
require_once __DIR__.'/cafe-event-registry.php';
function event_tip_text(string $body):string {
 $body=preg_replace('#<(script|style|noscript)\b[^>]*>.*?</\1>#is',' ',$body);
 $body=preg_replace('/<!--[\s\S]*?(?:-->|$)/',' ',$body??'');
 return trim(preg_replace('/[\s\p{Z}]+/u',' ',html_entity_decode(strip_tags(preg_replace('/<[^>]*>/',' ',$body??'')),ENT_QUOTES|ENT_HTML5,'UTF-8'))??'');
}
function event_tip_contains(string $text,string $part):bool {return $part!==''&&str_contains(preg_replace('/[\s\p{Z}]+/u','',$text),preg_replace('/[\s\p{Z}]+/u','',$part));}
function event_tip_snapshot(string $url):array {
 $target=cafe_event_fetch_target($url);if(!$target)fail('公式URLは公開HTTPSの通常ページを指定してください。');
 $check=contact_url_check(['source_url'=>$url]);if(($check['counts']['high']??0)+($check['counts']['review']??0)>0)fail('URLの個別確認が必要です。通常の掲載編集から判断してください。');
 $ips=gethostbynamel($target['host']);if(!cafe_event_public_ips($ips?:[]))fail('公式サイトの接続先を確認できません。');
 // No redirects, no arbitrary ports; pinned public IPv4 and existing time/size bounds.
 $r=cafe_event_http($target,$ips[0]);
 if(!$r['ok']||$r['status']!==200||!str_contains($r['type'],'html')||strlen($r['body'])>800000||!preg_match('//u',$r['body']))fail('公式HTMLを確認できません。移転・画像・SNSの告知は個別に確認してください。');
 $text=event_tip_text($r['body']);if(strlen($text)<100)fail('公式本文が不足しています。');
 return ['url'=>$url,'rawHash'=>hash('sha256',$r['body']),'text'=>$text,'fingerprint'=>cafe_event_fingerprint($r['body'],$r['type'])];
}
function event_tip_review_save():void {
 $id=input($_POST,'id',32);$rev=(int)input($_POST,'revision',10);$s=query('SELECT * FROM submissions WHERE id=?',[$id])->fetch();
 if(!$s||$s['status']!=='pending'||(int)$s['revision']!==$rev)fail('投稿が変更されています。再読み込みしてください。',409);
 $p=json_decode($s['payload'],true);if(!is_event_tip($p))fail('対象の投稿ではありません。');
 foreach(EVENT_TIP_CHECKS as $key=>$label)if(input($_POST,'check_'.$key,1)!=='1')fail('各確認項目の確認が必要です。');
 $record=[];foreach(['name'=>300,'activity_date'=>10,'business_hours'=>300,'venue_name'=>300,'prefecture'=>100,'city'=>200,'address'=>1000,'description'=>6000,'venue_url'=>2000] as $key=>$max){$record[$key]=input($_POST,$key,$max);if($record[$key]==='')fail('公開用の項目を入力してください。');}
 assert_public_copy($record);
 $record['activity_date']=date_value($record['activity_date']);if(!event_tip_in_window($record['activity_date']))fail('自動掲載は本日から4暦月以内の開催が対象です。');
 $url=safe_url(input($_POST,'source_url',2000));$record['venue_url']=safe_url($record['venue_url']);
 $excerpt=input($_POST,'excerpt',4400);if(mb_strlen($excerpt)>1100)fail('引用は1100文字以内にしてください。');
 $venueQuote=input($_POST,'venue_quote',2000);$application=input($_POST,'application',1000);$communication=choice(input($_POST,'communication',10),['sign'=>1,'writing'=>1,'both'=>1]);
 if($excerpt===''||$venueQuote===''||$application==='')fail('根拠の引用が必要です。');
 // Do not accept raw submission text merely because a model might call it safe.
 $source=event_tip_snapshot($url);$venue=$url===$record['venue_url']?$source:event_tip_snapshot($record['venue_url']);
 foreach([$excerpt,$application,$record['venue_name']] as $part)if(!event_tip_contains($source['text'],$part))fail('告知本文と引用・会場・申込条件が一致しません。');
 foreach([$venueQuote,$record['venue_name'],$record['address']] as $part)if(!event_tip_contains($venue['text'],$part))fail('会場の公式本文で名称・住所を確認できません。');
 $safe=contact_url_check(['description'=>$record['description'],'source_url'=>$url,'notes'=>$excerpt.' '.$application.' '.$venueQuote]);
 if(($safe['counts']['high']??0)+($safe['counts']['review']??0)>0||!empty($safe['truncated']))fail('公開文中のURLに個別確認が必要です。');
 $review=['version'=>1,'reviewedAt'=>gmdate('c'),'reviewerId'=>require_user()['id'],'sourceUrl'=>$url,'sourceRawHash'=>$source['rawHash'],'sourceFingerprint'=>$source['fingerprint'],'venueRawHash'=>$venue['rawHash'],'venueQuote'=>$venueQuote,'excerpt'=>$excerpt,'application'=>$application,'communication'=>$communication,'record'=>$record,'photos'=>$p['photos']??[]];
 $p['tip_review']=$review;$p['tip_state']='api_pending';$p['tip_reasons']=['根拠確認済み。次回の定期処理で無料APIを照合します'];
 if(query("UPDATE submissions SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='pending'",[json($p),now(),$id,$rev])->rowCount()!==1)fail('投稿の競合が発生しました。',409);
 audit('event_tip_review',$id);$_SESSION['flash']='根拠を保存しました。無料APIの照合後、一致した開催回を登録します。不一致・無料枠未確認は確認待ちになります。';
}
function event_tip_in_window(string $date):bool {
 if($date==='')return false;date_value($date);$today=new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo'));$end=$today->modify('first day of this month')->modify('+4 months');$end=$end->setDate((int)$end->format('Y'),(int)$end->format('m'),min((int)$today->format('d'),(int)$end->format('t')));
 return $date>=$today->format('Y-m-d')&&$date<=$end->format('Y-m-d');
}
function event_tip_export():array {
 $out=[];
 // Local private transport only. Never export sender text, upload bytes or notes.
 foreach(query("SELECT * FROM submissions WHERE status='pending' AND json_extract(payload,'$.form_kind')='event_tip' ORDER BY CASE WHEN json_extract(payload,'$.tip_state')='api_pending' THEN 0 ELSE 1 END,updated_at,id LIMIT 100")->fetchAll() as $s){
  $p=json_decode($s['payload'],true);$r=$p['tip_review']??null;
  if(($p['tip_state']??'')==='exception'&&strtotime($p['tip_retry_at']??'')>time())continue;
  $out[]=['id'=>$s['id'],'revision'=>(int)$s['revision'],'payloadHash'=>hash('sha256',$s['payload']),'state'=>$p['tip_state']??'review_required','review'=>$r,'photoHashes'=>array_column($p['photos']??[],'sha256')];
 }
 return ['version'=>1,'items'=>$out];
}
function event_tip_decision(array $d,bool $apply):array {
 $id=input($d,'id',32);$s=query('SELECT * FROM submissions WHERE id=?',[$id])->fetch();
 if(!$s)fail('Unknown submission');$p=json_decode($s['payload'],true);
 if(!is_event_tip($p))fail('Wrong submission type');
 if(($p['tip_state']??'')==='published')return ['status'=>'already-published','id'=>$id,'recordId'=>$p['tip_record_id']];
 if($s['status']!=='pending'||($d['revision']??null)!==(int)$s['revision']||!hash_equals(hash('sha256',$s['payload']),input($d,'payloadHash',64)))fail('Submission changed',409);
 $publish=($d['status']??'')==='ready';$r=$p['tip_review']??null;
 // Recheck even a previously approved/cached review at the final write boundary.
 if($publish&&$r&&public_copy_issues($r['record'])){ $d['reason']='公開文に内部向けの調査メモがあります。Codexで文面を整理して再確認してください。';$publish=false; }
 $reason=input($d,'reason',1000)?:'照合に一致しません。根拠を再確認してください。';
 if(!$publish){
  if(!$apply)return ['status'=>'exception','id'=>$id];
  if(($p['tip_reasons']??[])===[$reason]&&strtotime($p['tip_retry_at']??'')>time())return ['status'=>'unchanged','id'=>$id];
  $p['tip_state']='exception';$p['tip_reasons']=[$reason];$p['tip_retry_at']=(new DateTimeImmutable('tomorrow 09:00',new DateTimeZone('Asia/Tokyo')))->format('c');
  query("UPDATE submissions SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='pending'",[json($p),now(),$id,$s['revision']]);audit('event_tip_exception',$id);
  return ['status'=>'exception','id'=>$id];
 }
 if(!$r||time()-strtotime($r['reviewedAt'])>=172800||strtotime($r['reviewedAt'])>time()||!event_tip_in_window($r['record']['activity_date']))fail('Review expired');
 foreach(['sourceRawHash','venueRawHash'] as $key)if(!hash_equals($r[$key],input($d,$key,64)))fail('Source changed');
 if(($r['photos']??[])!==($p['photos']??[]))fail('Photos changed');
 foreach($r['photos']??[] as $photo){$file=event_tip_photo_dir($id).'/'.$photo['slot'].'.jpg';if(!is_file($file)||!hash_equals($photo['sha256'],hash_file('sha256',$file)))fail('Photo changed');}
 $at=strtotime(input($d,'checkedAt',40));if(!$at||$at>time()||time()-$at>300)fail('Stale machine result');
 if(!in_array($d['model']??'',['gpt-6.1-sol','gpt-5.6-terra'],true)||($d['engine']??'')!=='openai_complimentary'||($d['decision']['relevance']??'')!=='yes'||($d['decision']['contentType']??'')!=='announcement')fail('Unverified extraction');
 $facts=[];foreach($d['decision']['facts']??[] as $fact){if(!event_tip_contains($r['excerpt'],$fact['evidence']??''))fail('Unsupported extraction');$facts[$fact['field']][]=$fact['value'];}
 foreach(['startDate'=>$r['record']['activity_date'],'venue'=>$r['record']['venue_name'],'application'=>$r['application'],'status'=>'scheduled'] as $key=>$value)if(($facts[$key]??[])!==[$value])fail('Event facts do not match');
 $methods=$r['communication']==='both'?['sign','writing']:[$r['communication']];sort($methods);$found=$facts['communication']??[];sort($found);if($methods!==$found)fail('Communication differs');
 if(isset($facts['endDate'])&&$facts['endDate']!==[$r['record']['activity_date']])fail('Multi-day event needs review');
 $record=$r['record'];
 foreach(query("SELECT * FROM records WHERE publication!='deleted' AND kind IN ('cafe','event')")->fetchAll() as $row){$other=expanded($row);$date=$other['activity_date']??$other['event_date']??'';if($date===$record['activity_date']&&(normalized($other['name'])===normalized($record['name'])||normalized($other['venue_name']??'')===normalized($record['venue_name'])))fail('Duplicate event needs review');}
 $record=array_replace($record,['slug'=>'event-'.substr($id,0,16),'country_code'=>'JP','country_name'=>'日本','timezone'=>'Asia/Tokyo','publication'=>'public','status'=>'unknown','type'=>'limited','shop_type'=>'event','confirmation_status'=>'confirmed','verification_level'=>'official','verification_sources'=>[$r['sourceUrl'],$record['venue_url']],'official_url'=>$r['sourceUrl'],'last_verified_at'=>(new DateTimeImmutable($r['reviewedAt']))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d'),'schedule_verified_at'=>substr($r['reviewedAt'],0,10)]);
 $record=array_replace($record,validated_record(cafe_post($record),'cafe'));$rid=substr(hash('sha256','event-tip:'.$id),0,32);
 $plan=hash('sha256',json([$s['revision'],hash('sha256',$s['payload']),$record,$d]));
 if(!$apply)return ['status'=>'ready','id'=>$id,'planSha256'=>$plan,'recordId'=>$rid];
 if(!hash_equals($plan,($GLOBALS['event_tip_approved_plan']??'')))fail('Plan changed');
 $backupDir=data_dir().'/event-tip-backups';if(!is_dir($backupDir))mkdir($backupDir,0700);
 $backup=$backupDir.'/'.$id.'-'.gmdate('YmdHis').'-'.substr(uid(),0,8).'.sqlite';$source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')fail('Backup failed');$target->close();$source->close();chmod($backup,0600);
 // Caller holds BEGIN IMMEDIATE: publication and pending->approved are atomic.
 cafe_registry_schema();$sid='tip-'.$id;$stamp=now();
 save_record($record,'cafe',$rid);
 query('INSERT INTO cafe_event_series(id,title,organizer,country_code,prefecture,city,series_kind,state,source_urls,cadence,notes,next_check_on,annual_review_due_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[$sid,$record['name'],'','JP',$record['prefecture'],$record['city'],'oneoff','watching',json([$r['sourceUrl']]),'','利用者投稿を公式根拠と照合',cafe_registry_today(),cafe_registry_today(),$stamp,$stamp]);
 query('INSERT INTO cafe_event_occurrences VALUES(?,?,?,?)',[$rid,$sid,$record['activity_date'].'/default',$record['activity_date']]);
 // Original human inspection, not the API response time. Conservative visual
 // freshness keeps new/changed HTML from silently renewing publication approval.
 query('INSERT INTO cafe_event_source_reviews VALUES(?,?,?,?,?,?)',[$rid,1,$r['sourceUrl'],'visual',null,$r['reviewedAt']]);
 $p['tip_state']='published';$p['tip_record_id']=$rid;$p['tip_reasons']=[];$p['tip_api']=['model'=>$d['model'],'engine'=>$d['engine'],'checkedAt'=>$d['checkedAt']];
 query("UPDATE submissions SET payload=?,status='approved',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='pending'",[json($p),$stamp,$id,$s['revision']]);audit('event_tip_auto_published',$id);
 if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())fail('Integrity failure');
 return ['status'=>'published','id'=>$id,'recordId'=>$rid,'path'=>record_path_for_tip($record)];
}
function record_path_for_tip(array $p):string {return '/connect/sign-cafe/'.$p['slug'].'/';}
