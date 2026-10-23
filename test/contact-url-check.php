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
 '例え.テスト/案内'=>'review',
 '127.0.0.1/admin'=>'high',
 'example.org?redirect=https%3A%2F%2Flocalhost'=>'review',
] as $url=>$risk){$r=contact_url_check(['private_message'=>'確認「'.$url.'」です。']);check(count($r['items'])===1,'one URL: '.$url);check($r['items'][0]['risk']===$risk,'risk: '.$url);}
$r=contact_url_check(['private_message'=>'連絡先 contact@example.org です。']);check(!$r['items'],'email is not treated as URL');
$r=contact_url_check(['private_message'=>'https://example.org/'.str_repeat('あ',800)]);check(preg_match('//u',$r['items'][0]['url'])===1&&$r['items'][0]['risk']==='review','long Japanese URL remains valid UTF-8');
check(json($r)!=='','long Japanese URL can be saved as JSON');
$r=contact_url_check(['private_message'=>'https://example.org/a。https://example.org/a','source_url'=>'https://example.org/a']);check(count($r['items'])===1,'duplicate URLs deduplicated');
$r=contact_url_check(['private_message'=>implode(' ',array_map(fn($i)=>'https://example.org/'.$i,range(1,55)))]);check($r['truncated']&&count($r['items'])===50,'bounded work explicitly reported');
$p=['form_kind'=>'cafe_contact','contact_scope'=>'site','category'=>'correction','name'=>'お問い合わせ件名','submitter'=>'テスト投稿者','email'=>'private@example.org','source_url'=>'https://example.org/info','private_message'=>"お問い合わせ本文です。\n改行も保持します。 https://127.0.0.1/secret?token=PRIVATE_TOKEN",'internal_secret'=>'DO_NOT_FORWARD'];
$original=$p;
$m=submission_notification(str_repeat('a',32),$p);
check(str_contains($m['subject'],'サイトへのお問い合わせ'),'site-specific notification');
check(str_contains($m['body'],'注意度高 1件'),'screened before notification');
check(str_contains($m['body'],"お問い合わせ本文です。\n改行も保持します。"),'full contact body and paragraphs forwarded');
foreach(['お問い合わせ件名','テスト投稿者','private@example.org','掲載内容の訂正'] as $value)check(str_contains($m['body'],$value),'contact field forwarded: '.$value);
check(!str_contains($m['body'],'DO_NOT_FORWARD'),'unlisted payload fields not forwarded');
check(!str_contains($m['body'],'https://127.0.0.1')&&!str_contains($m['body'],'https://example.org'),'submitted URLs not clickable in body or source field');
check(str_contains($m['body'],'https[:]／／127[.]0[.]0[.]1／secret?token=PRIVATE_TOKEN'),'URL text remains understandable');
check(str_contains($m['body'],'理由：内部・予約IPアドレスです'),'individual URL reason in mail');
check($p===$original,'stored payload not modified');
check(str_contains($m['body'],BASE.'/admin/'),'trusted management link retained');
$p['contact_scope']='cafe';check(str_contains(submission_notification(str_repeat('a',32),$p)['subject'],'手話カフェへのお問い合わせ'),'cafe-specific notification');
$html=contact_url_admin($p);check(!str_contains($html,'href='),'untrusted URL never clickable');

foreach([
 'https://example.org/path'=>'https[:]／／example[.]org／path',
 'www.example.org/page'=>'www[.]example[.]org／page',
 '例え.テスト/案内'=>'例え[.]テスト／案内',
 'example.org?redirect=https://evil.example/path'=>'example[.]org?redirect=https[:]／／evil[.]example／path',
 '//127.0.0.1/a'=>'／／127[.]0[.]0[.]1／a',
 '127.0.0.1'=>'127[.]0[.]0[.]1',
 'https://[2001:db8::1]/'=>'https[:]／／[2001[:]db8[:][:]1]／',
 'https://user:pass@example.org/'=>'https[:]／／user[:]pass[@]example[.]org／',
 'ftp://example.org/a'=>'ftp[:]／／example[.]org／a',
 'https&#58;//example.org/'=>'https[:]／／example[.]org／',
 'javascript:alert(1)'=>'javascript[:]alert(1)',
 'data:text/html;base64,PHNjcmlwdD4='=>'data[:]text／html;base64,PHNjcmlwdD4=',
] as $input=>$expected)check(contact_mail_text($input)===$expected,'defanged: '.$input);
check(contact_mail_text("料金は1,500円、開始は13:30。\n返信先 reply@example.org") === "料金は1,500円、開始は13:30。\n返信先 reply@example.org",'ordinary text, times and reply email stay readable');
check(contact_mail_text("文\0字\u{202e}列\r\n次の行") === "文字列\n次の行",'controls removed without losing paragraph');
$many=implode(' ',array_map(fn($i)=>'https://example.org/'.$i,range(1,55)));
$bulk=submission_notification(str_repeat('b',32),['form_kind'=>'cafe_contact','private_message'=>$many]);
check(!str_contains($bulk['body'],'https://example.org')&&str_contains($bulk['body'],'example[.]org／55'),'all URLs defanged beyond bounded inspection');
check(str_contains($bulk['body'],'50件を超えた分は未検査'),'bounded inspection is reported honestly');
$ordinary=submission_notification(str_repeat('c',32),['name'=>'PRIVATE_NAME','description'=>'PRIVATE_DESCRIPTION','email'=>'private@example.org']);
check(!str_contains($ordinary['body'],'PRIVATE_')&&!str_contains($ordinary['body'],'private@example.org'),'information submissions retain metadata-only scope');
$empty=submission_notification(str_repeat('d',32),['form_kind'=>'cafe_contact']);
check(str_contains($empty['body'],'記載なし'),'optional or redacted fields handled');
try {submission_notification("bad\r\nBcc:test@example.org",$p);check(false,'invalid notification id must fail');}catch(RuntimeException $error){check(true,'invalid notification id rejected');}
echo "CONTACT_URL_CHECK_OK $checks\n";
