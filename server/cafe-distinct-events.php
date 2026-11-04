<?php
declare(strict_types=1);

// A reviewed exception to a venue collision, never an automatic deduplication rule.
function cafe_distinct_event_range(string $value): ?array {
    if(!preg_match('/^\s*([01][0-9]|2[0-3]):([0-5][0-9])\s*[〜～-]\s*([01][0-9]|2[0-3]):([0-5][0-9])\s*$/uD',$value,$m))return null;
    $start=(int)$m[1]*60+(int)$m[2];$end=(int)$m[3]*60+(int)$m[4];
    return $start<$end?[$start,$end]:null;
}
function cafe_distinct_event_reviewed(array $p,array $other,array $item,array $sourceReviews): bool {
    if($other['kind']!=='cafe'||($other['shop_type']??'')!=='event'||$other['publication']!=='public'||normalized($p['name'])===normalized($other['name']))return false;
    $declarations=$item['distinct_from']??[];
    if(!is_array($declarations)||!array_is_list($declarations)||count($declarations)>4)return false;
    $matches=array_values(array_filter($declarations,fn($d)=>is_array($d)&&($d['record_id']??null)===$other['id']));
    if(count($matches)!==1)return false;
    $review=$matches[0];$url=$review['evidence_url']??null;
    if(!is_int($review['expected_revision']??null)||$review['expected_revision']!==$other['revision']||!is_string($review['reason']??null)||!preg_match('/^.{10,1000}$/usD',trim($review['reason'])))return false;
    if(!is_string($url)||!in_array($url,$p['verification_sources']??[],true)||!in_array($url,$other['verification_sources']??[],true))return false;
    $ownReviews=array_values(array_filter($sourceReviews,fn($r)=>($r['record_id']??null)===$item['id']&&($r['url']??null)===$url));
    if(count($ownReviews)!==1)return false; // The regular source-review validator checks its date/hash/revision later.
    $oldReview=query('SELECT * FROM cafe_event_source_reviews WHERE record_id=?',[$other['id']])->fetch();
    if(!$oldReview||$oldReview['record_revision']!==$other['revision']||$oldReview['url']!==$url)return false;
    $at=strtotime($oldReview['reviewed_at']);
    if(!$at||$at>time()||time()-$at>=CAFE_EVENT_FRESH_SECONDS)return false;
    $a=cafe_distinct_event_range($p['business_hours']??'');$b=cafe_distinct_event_range($other['business_hours']??'');
    return $a!==null&&$b!==null&&($a[1]<=$b[0]||$b[1]<=$a[0]);
}
