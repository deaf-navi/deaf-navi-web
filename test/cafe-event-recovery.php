<?php
declare(strict_types=1);
require __DIR__.'/../server/cafe-event-fetch.php';
require __DIR__.'/../server/cafe-event-recovery.php';
$checks=0;
function check(bool $ok,string $label):void {global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
$at=strtotime('2026-10-17T03:00:00Z');$url='https://example.org/event';$hash=hash('sha256','reviewed content');
$p=['id'=>'event','revision'=>2,'last_verified_at'=>'2026-10-16','verification_sources'=>[$url]];
$review=['record_revision'=>2,'url'=>$url,'mode'=>'html','fingerprint'=>$hash,'reviewed_at'=>gmdate('c',$at-3600)];
$success=['result'=>'fetched','fingerprint'=>$hash,'http_status'=>200,'review_mode'=>'html'];
$failure=['result'=>'unavailable','fingerprint'=>null,'http_status'=>null,'retryable'=>true,'error_code'=>'CURL_28'];
$state=cafe_event_source_transition(null,$success,$at-1800);
check(cafe_event_source_freshness($p,$review,$state,$at)['status']==='verified','reviewed matching HTML is current');
$bad=cafe_event_source_transition($state,$failure,$at);
check(cafe_event_source_freshness($p,$review,$bad,$at)['status']==='retrying','transient failure retains current event');
check($bad['last_success_at']===$state['last_success_at'],'failure never renews verification');
check(strtotime($bad['next_attempt_at'])===$at+1800,'first retry after 30 minutes');
check(cafe_event_source_freshness($p,$review,$bad,$at-1800+172800)['status']==='review','48 hour exact expiry');
check(cafe_event_source_freshness($p,$review,$bad,$at-1800+172799)['status']==='retrying','before expiry retains');
$recovered=cafe_event_source_transition($bad,$success,$at+1800);
check(cafe_event_source_freshness($p,$review,$recovered,$at+1800)['status']==='verified','matching recovery restores');
$changed=cafe_event_source_transition($bad,array_replace($success,['fingerprint'=>hash('sha256','changed')]),$at+1800);
check(cafe_event_source_freshness($p,$review,$changed,$at+1800)['reason']==='content_changed','changed source held');
$again=cafe_event_source_transition($changed,$success,$at+3600);
check(cafe_event_source_freshness($p,$review,$again,$at+3600)['status']==='review','change cannot clear itself by reverting');
$newReview=array_replace($review,['reviewed_at'=>gmdate('c',$at+3600)]);
check(cafe_event_source_freshness($p,$newReview,$again,$at+3600)['status']==='verified','explicit content re-review releases latch');
$denied=cafe_event_source_transition($state,array_replace($failure,['retryable'=>false,'http_status'=>403]),$at);
check(!$denied['next_attempt_at'],'denial not repeatedly requested');
check(cafe_event_source_freshness($p,$review,$denied,$at)['status']==='review','denial fails closed');
check(cafe_event_source_freshness($p,$review,cafe_event_source_transition($denied,$success,$at+1),$at+1)['status']==='review','successful fetch after denial needs review');
$long=$bad;for($i=0;$i<12;$i++)$long=cafe_event_source_transition($long,$failure,$at);
check(strtotime($long['next_attempt_at'])===$at+21600,'backoff capped at six hours');
$visual=array_replace($review,['mode'=>'visual','fingerprint'=>null]);
check(cafe_event_source_freshness($p,$visual,$state,$at)['verified_at']===$visual['reviewed_at'],'image fetch does not renew visual review');
check(cafe_event_source_freshness($p,$visual,$recovered,$at+172800)['status']==='review','visual expiry remains after fetch success');
check(cafe_event_source_freshness(array_replace($p,['revision'=>3]),$review,$state,$at)['reason']==='record_changed','record revisions invalidate source approval');
check(cafe_event_source_freshness(array_replace($p,['verification_sources'=>['https://example.org/new']]),$review,$state,$at)['status']==='review','source replacement invalidates approval');
check(cafe_event_source_freshness($p,null,null,strtotime('2026-10-18T00:00:00+09:00'))['status']==='review','legacy dates conservatively expire at midnight plus 48 hours');
$html='<html><body>'.str_repeat('Organizer announcement for an event. ',10).'</body></html>';
$resolve=fn()=>['93.184.215.14'];$pause=fn()=>null;
foreach([502,503,504] as $code){$calls=0;$get=function()use(&$calls,$code,$html){$calls++;return ['ok'=>true,'status'=>$calls===1?$code:200,'body'=>$html,'type'=>'text/html','location'=>''];};$result=cafe_event_fetch($url,$resolve,$get,$pause);check($calls===2&&$result['result']==='fetched','gateway outage retries once');}
foreach([403,404,429] as $code){$calls=0;$get=function()use(&$calls,$code){$calls++;return ['ok'=>true,'status'=>$code,'body'=>'','type'=>'text/html','location'=>''];};$result=cafe_event_fetch($url,$resolve,$get,$pause);check($calls===1&&!$result['retryable'],'permanent HTTP status is not retried');}
foreach([7,18,28,52,55,56] as $code){$calls=0;$get=function()use(&$calls,$code){$calls++;return ['ok'=>false,'status'=>0,'error_code'=>$code];};$result=cafe_event_fetch($url,$resolve,$get,$pause);check($calls===2&&$result['retryable'],'transient transport retries once');}
foreach([60,63] as $code){$calls=0;$get=function()use(&$calls,$code){$calls++;return ['ok'=>false,'status'=>0,'error_code'=>$code];};$result=cafe_event_fetch($url,$resolve,$get,$pause);check($calls===1&&!$result['retryable'],'TLS and size safety not bypassed');}
$result=cafe_event_fetch($url,fn()=>false,fn()=>throw new RuntimeException('should not fetch'),$pause);check($result['retryable']&&$result['error_code']==='DNS_UNAVAILABLE','DNS failure retryable');
foreach([['127.0.0.1'],['93.184.215.14','10.0.0.1']] as $ips){$result=cafe_event_fetch($url,fn()=>$ips,fn()=>throw new RuntimeException('private request'),$pause);check($result['result']==='blocked_target'&&!$result['retryable'],'non-public DNS blocked');}
$result=cafe_event_fetch('https://www.instagram.com/official/',fn()=>throw new RuntimeException('SNS DNS'),fn()=>[], $pause);check($result['result']==='manual_check','SNS never auto-approved');
echo "Cafe event recovery: $checks checks passed\n";
