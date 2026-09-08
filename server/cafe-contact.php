<?php
declare(strict_types=1);

const CAFE_CONTACT_TYPES=['correction'=>'掲載内容の訂正','removal'=>'掲載の取り下げ','other'=>'その他のお問い合わせ'];
function cafe_listing_notice():string {
    return '<aside class="dn-cafe-policy" aria-labelledby="cafe-information-heading"><h2 id="cafe-information-heading">掲載情報について</h2><p>当ページの情報は、運営者が個人で調べ、公開情報やお寄せいただいた情報をもとにまとめています。最新の状況と異なる場合がありますので、訪問前に各店舗・主催者の公式情報をご確認ください。</p><p>掲載にご都合の悪い点や、内容の訂正・掲載取り下げのご希望がありましたら、<a href="#contact">お問い合わせフォーム</a>からご連絡ください。内容を確認のうえ、対応いたします。</p></aside>';
}
function cafe_contact_form(bool $overseas=false,bool $open=false):string {
    start_session();$_SESSION['form_issued']??=time();
    $out='<section class="dn-submit dn-cafe-contact" id="contact"><h2>掲載情報についてのお問い合わせ</h2><p>訂正・掲載取り下げなどのご希望をお知らせください。内容とご連絡先は公開されません。返信をご希望の場合はメールアドレスをご記入ください。</p><details'.($open?' open':'').'><summary class="dn-cta">お問い合わせフォームを開く</summary><form action="/submit/" method="post" class="dn-form" aria-label="掲載情報のお問い合わせ">'.csrf().'<input type="hidden" name="form_kind" value="cafe_contact"><div class="dn-honey" aria-hidden="true"><label>この欄には入力しないでください<input name="website_confirm" tabindex="-1" autocomplete="off"></label></div><div class="dn-form-grid">';
    $out.=select_field('category','お問い合わせの種類',CAFE_CONTACT_TYPES,'correction');
    $fields=[['name','対象の店舗・活動名またはページ名','','text',true],['source_url','対象ページのURL（任意）',BASE.'/connect/sign-cafe/'.($overseas?'overseas/':''),'url',false],['private_message','お問い合わせ内容','','textarea',true],['submitter','お名前・ニックネーム（任意）','','text',false],['email','返信先メールアドレス（任意）','','email',false]];
    foreach($fields as [$name,$label,$value,$type,$required])$out.=str_replace('f-'.$name,'contact-'.$name,field($name,$label,$value,$type,$required));
    return $out.'</div><label class="dn-check"><input type="checkbox" name="consent" value="1" required> 内容確認のための保存と管理者への通知に同意します。</label><p class="dn-muted">お寄せいただいた内容・連絡先はお問い合わせ対応のために使用します。確認完了後の保管期間は最長1年を目安に管理します。第三者の非公開の個人情報は記載しないでください。店舗への予約は受け付けていません。</p><button>お問い合わせを送信する</button></form></details></section>';
}
function cafe_contact_submission(array $post):array {
    $p=['form_kind'=>'cafe_contact','category'=>choice(input($post,'category',20),CAFE_CONTACT_TYPES),'report_type'=>'other'];
    foreach(['name'=>1000,'private_message'=>6000,'submitter'=>1000,'email'=>320,'source_url'=>2000] as $k=>$max)$p[$k]=input($post,$k,$max);
    if($p['name']===''||$p['private_message']==='')fail('対象の店舗・ページ名とお問い合わせ内容を入力してください。');
    $p['source_url']=safe_url($p['source_url']);
    if($p['email']!==''&&!filter_var($p['email'],FILTER_VALIDATE_EMAIL))fail('返信先メールアドレスをご確認ください。');
    return $p;
}
function is_cafe_contact(array $p):bool {return ($p['form_kind']??'')==='cafe_contact';}
function require_record_submission(array $s):void {
    if(is_cafe_contact(json_decode($s['payload'],true)))fail('お問い合わせ本文は公開データに転用できません。掲載情報は別途編集し、お問い合わせの対応状況を更新してください。');
}
function cafe_contact_admin_detail(array $s,array $p):string {
    $states=['pending'=>'確認中','approved'=>'対応済み','rejected'=>'対応不要'];$id=e($s['id']);$revision=(int)$s['revision'];
    $out='<h2>掲載情報のお問い合わせ</h2><p>状態：'.e($states[$s['status']]).' / '.e($s['created_at']).'</p><p>お問い合わせ内容は非公開です。必要な掲載情報は店舗一覧から編集し、対応後に下の状態を更新してください。</p>';
    $labels=['category'=>'お問い合わせの種類','name'=>'対象の店舗・ページ名','source_url'=>'対象ページURL','private_message'=>'お問い合わせ内容（非公開）','submitter'=>'お名前（非公開）','email'=>'返信先メール（非公開）'];
    $out.='<dl class="dn-detail">';foreach($labels as $key=>$label)if(!empty($p[$key]))$out.='<dt>'.e($label).'</dt><dd>'.nl2br(e($key==='category'?(CAFE_CONTACT_TYPES[$p[$key]]??$p[$key]):$p[$key])).'</dd>';
    return $out.'</dl><form method="post">'.csrf().'<input type="hidden" name="action" value="review"><input type="hidden" name="id" value="'.$id.'"><input type="hidden" name="revision" value="'.$revision.'">'.select_field('status','対応状況',$states,$s['status']).'<button>対応状況を保存</button></form><form method="post" class="dn-danger">'.csrf().'<input type="hidden" name="action" value="redact_submission"><input type="hidden" name="id" value="'.$id.'"><input type="hidden" name="revision" value="'.$revision.'"><label><input type="checkbox" name="confirm" value="1" required> お名前・メール・お問い合わせ本文・対象名・URLを削除します（元に戻せません）</label><p><button class="secondary">お問い合わせの個人情報を削除</button></p></form>';
}
