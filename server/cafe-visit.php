<?php
declare(strict_types=1);

// Present existing public facts without inferring prices or reservation rules from prose.
function cafe_has_visit_info(array $p):bool {
    return ($p['country_code']??'')==='JP'&&cafe_listing_group($p)==='cafes'
        &&(($p['kind']??'')==='cafe'||(($p['kind']??'')==='store'&&!empty($p['signing_store'])));
}
function cafe_visit_current(array $p):bool {
    return in_array($p['status']??'',['open','active_recurring'],true)
        &&($p['confirmation_status']??'')==='confirmed'&&cafe_freshness($p)==='fresh';
}
function cafe_conversation_facts(array $p):array {
    $labels=['writing_support'=>'筆談対応','sign_language_support'=>'手話で注文可能','beginner_welcome'=>'初心者歓迎'];
    return array_values(array_filter($labels,fn($label,$key)=>($p[$key]??null)===true,ARRAY_FILTER_USE_BOTH));
}
function cafe_visit_summary(array $p):string {
    if(!cafe_has_visit_info($p))return '';
    $facts=cafe_visit_current($p)?cafe_conversation_facts($p):[];
    return '<div class="dn-visit-summary">'.($facts?'<p>'.e(implode('・',$facts)).'</p>':'')
        .'<a href="'.e(record_path($p)).'#visit-info" aria-label="'.e($p['name']).'の予約・料金・会話方法を確認">予約・料金・会話方法</a></div>';
}
function cafe_visit_information(array $p):string {
    $current=cafe_visit_current($p);
    $reservation=trim($p['reservation']??'');
    // Unknown and false are different. Never turn an empty field into "free" or "no booking".
    if($current&&$reservation===''&&is_bool($p['reservation_required']??null)){
        $reservation=$p['reservation_required']?'事前予約・申込が必要です。':'予約・事前申込は不要と案内されています。';
    }
    $conversation=implode('・',cafe_conversation_facts($p));
    if(!empty($p['sign_support']))$conversation.=($conversation!==''?"\n":'').$p['sign_support'];
    $rows=['reservation'=>$reservation,'conversation'=>$conversation,'notes'=>$p['notes']??''];
    $facts='';
    foreach(['reservation'=>'予約・参加方法','conversation'=>'会話の方法','notes'=>'利用条件・料金などの補足'] as $key=>$label){
        if(trim($rows[$key])!=='')$facts.='<dt>'.$label.'</dt><dd>'.nl2br(e($rows[$key])).'</dd>';
    }
    $out='<section class="dn-visitor-section dn-visit-information" id="visit-info"><h2>予約・料金・会話の方法</h2>';
    if(!$current)$out.='<p>現在の利用条件は再確認が必要です。以下の掲載情報だけで訪問や参加を決めず、公式の最新案内をご確認ください。</p>';
    if($facts!==''){
        $out.=!$current?'<details class="dn-visit-history"><summary>これまでに掲載した利用情報</summary>':'';
        $out.='<dl class="dn-visitor-facts">'.$facts.'</dl>'.(!$current?'</details>':'');
    }else $out.='<p>予約・料金・会話方法の詳しい案内は、まだ掲載できていません。</p>';
    if($current&&$reservation==='')$out.='<p>予約の要否・申込方法は、利用条件と公式案内をご確認ください。</p>';
    if($current&&$conversation==='')$out.='<p>希望する会話方法や対応スタッフのいる日時は、公式案内をご確認ください。</p>';
    return $out.'<p class="dn-visit-check">金額の記載がない場合も、無料とは限りません。飲食代と参加費・席料、時間制限、予約変更・キャンセルの条件を確認してからお出かけください。</p><p><a href="/connect/sign-cafe/#cafe-guide">目的に合う選び方・料金の見方</a></p></section>';
}
