<?php
declare(strict_types=1);
require __DIR__.'/../server/core.php';
require __DIR__.'/../server/mail.php';
$checks=0;
function check(bool $value,string $message):void {global $checks;if(!$value)throw new RuntimeException($message);$checks++;}
foreach([
 'https://deafnavi.com/about.html'=>'no_indicator',
 'HTTPS://EXAMPLE.ORG/page'=>'no_indicator',
 'https://deafnavi.com@evil.example.org/'=>'high',
 'http://127.0.0.1/admin'=>'high',
 'https://[::1]/'=>'high',
 'https://[::ffff:127.0.0.1]/'=>'high',
 'https://2130706433/'=>'high',
 'http://0177.0.0.1/'=>'high',
 'https://local.internal/'=>'high',
 'https://bit.ly/abc'=>'review',
 'https://xn--pple-43d.com/'=>'review',
 'https://example.org/setup.%65xe'=>'high',
 'https://example.org/file.zip'=>'review',
 'https://example.org/?redirect=https%3a%2f%2flocalhost'=>'review',
 'https://example.org:8443/'=>'review',
 'javascript:alert(1)'=>'high',
 'data:text/html;base64,PHNjcmlwdD4='=>'high',
 '//127.0.0.1/a'=>'high',
 'www.example.org'=>'no_indicator',
 'bit.ly/abc'=>'review',
] as $url=>$risk){$r=contact_url_check(['private_message'=>'確認「'.$url.'」です。']);check(count($r['items'])===1,'one URL: '.$url);check($r['items'][0]['risk']===$risk,'risk: '.$url);}
$r=contact_url_check(['private_message'=>'連絡先 contact@example.org です。']);check(!$r['items'],'email is not treated as URL');
$r=contact_url_check(['private_message'=>'https://example.org/a。https://example.org/a','source_url'=>'https://example.org/a']);check(count($r['items'])===1,'duplicate URLs deduplicated');
$r=contact_url_check(['private_message'=>implode(' ',array_map(fn($i)=>'https://example.org/'.$i,range(1,55)))]);check($r['truncated']&&count($r['items'])===50,'bounded work explicitly reported');
$p=['form_kind'=>'cafe_contact','contact_scope'=>'site','name'=>'PRIVATE_TITLE','email'=>'private@example.org','private_message'=>'PRIVATE_BODY https://127.0.0.1/secret?token=PRIVATE_TOKEN'];
$m=submission_notification(str_repeat('a',32),$p);
check(str_contains($m['subject'],'サイトへのお問い合わせ'),'site-specific notification');
check(str_contains($m['body'],'注意度高 1件'),'screened before notification');
check(!str_contains(json($m),'PRIVATE')&&!str_contains(json($m),'127.0.0.1')&&!str_contains(json($m),'private@example'),'no private content or supplied URL forwarded');
check(str_contains($m['body'],BASE.'/admin/'),'only configured management URL in mail');
$p['contact_scope']='cafe';check(str_contains(submission_notification(str_repeat('a',32),$p)['subject'],'手話カフェへのお問い合わせ'),'cafe-specific notification');
$html=contact_url_admin($p);check(!str_contains($html,'href='),'untrusted URL never clickable');
echo "CONTACT_URL_CHECK_OK $checks\n";
