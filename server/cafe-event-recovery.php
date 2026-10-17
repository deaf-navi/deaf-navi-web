<?php
declare(strict_types=1);

const CAFE_EVENT_FRESH_SECONDS=172800;
function cafe_event_recovery_ready():bool {
    if(!is_file(data_dir().'/directory.sqlite'))return false;
    return (bool)query("SELECT name FROM sqlite_master WHERE type='table' AND name='cafe_event_source_state'")->fetchColumn();
}
function cafe_event_recovery_schema():void {
    db()->exec("CREATE TABLE IF NOT EXISTS cafe_event_source_state (
        url TEXT PRIMARY KEY, result TEXT NOT NULL, http_status INTEGER, fingerprint TEXT,
        last_attempt_at TEXT NOT NULL, last_success_at TEXT, failures INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT, changed_at TEXT, error_code TEXT, content_mode TEXT, blocked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cafe_event_source_reviews (
        record_id TEXT PRIMARY KEY REFERENCES records(id), record_revision INTEGER NOT NULL,
        url TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('html','visual')),
        fingerprint TEXT, reviewed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cafe_event_recovery_runs (
        started_at TEXT PRIMARY KEY, finished_at TEXT NOT NULL, summary TEXT NOT NULL
    );");
}
function cafe_event_source_transition(?array $old,array $check,int $at):array {
    $stamp=gmdate('c',$at);$ok=$check['result']==='fetched';
    $hash=$ok?$check['fingerprint']:($old['fingerprint']??null);
    $changed=$ok&&!empty($old['fingerprint'])&&!hash_equals($old['fingerprint'],$hash);
    $failures=!empty($check['retryable'])?min(32,($old['failures']??0)+1):0;
    return ['result'=>$ok?($changed?'changed':(empty($old['fingerprint'])?'baseline':'unchanged')):$check['result'],
        'http_status'=>$check['http_status'],'fingerprint'=>$hash,'last_attempt_at'=>$stamp,
        'last_success_at'=>$ok?$stamp:($old['last_success_at']??null),'failures'=>$failures,
        'next_attempt_at'=>$failures?gmdate('c',$at+min(21600,1800*2**min(4,$failures-1))):null,
        'changed_at'=>$changed?$stamp:($old['changed_at']??null),'error_code'=>$check['error_code']??null,'content_mode'=>$ok?($check['review_mode']??'visual'):($old['content_mode']??null),
        'blocked_at'=>!$ok&&empty($check['retryable'])&&$check['result']!=='manual_check'?$stamp:($old['blocked_at']??null)];
}
function cafe_event_source_save(string $url,array $s):void {
    query('INSERT INTO cafe_event_source_state VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET result=excluded.result,http_status=excluded.http_status,fingerprint=excluded.fingerprint,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,failures=excluded.failures,next_attempt_at=excluded.next_attempt_at,changed_at=excluded.changed_at,error_code=excluded.error_code,content_mode=excluded.content_mode,blocked_at=excluded.blocked_at',[$url,...array_values($s)]);
}
// Only a human-bound, revision-matched HTML fingerprint can renew freshness.
// Fetch success alone never certifies a new announcement, image, PDF or SNS post.
function cafe_event_source_freshness(array $p,?array $review,?array $state,int $at):array {
    $verified=strtotime(($p['last_verified_at']??'').'T00:00:00+09:00')?:0;
    $reason='expired';$retrying=false;
    if($review){
        if((int)$review['record_revision']!==(int)($p['revision']??0)||!in_array($review['url'],$p['verification_sources']??[],true))return ['status'=>'review','verified_at'=>null,'reason'=>'record_changed'];
        $verified=strtotime($review['reviewed_at'])?:0;
        if($state && (strtotime($state['last_attempt_at'])?:0)>=$verified){
            if(!empty($state['changed_at'])&&(strtotime($state['changed_at'])?:0)>$verified)return ['status'=>'review','verified_at'=>gmdate('c',$verified),'reason'=>'content_changed'];
            if(!empty($state['blocked_at'])&&strtotime($state['blocked_at'])>$verified)return ['status'=>'review','verified_at'=>gmdate('c',$verified),'reason'=>'source_unavailable'];
            $retrying=!empty($state['next_attempt_at']);
            if($review['mode']==='html'){
                if(!empty($state['fingerprint'])&&!hash_equals($review['fingerprint']??'',$state['fingerprint']))return ['status'=>'review','verified_at'=>gmdate('c',$verified),'reason'=>'content_changed'];
                if(in_array($state['result'],['baseline','unchanged','changed'],true)&&!empty($state['fingerprint'])&&hash_equals($review['fingerprint']??'',$state['fingerprint']))$verified=max($verified,strtotime($state['last_success_at'])?:0);
                elseif(!empty($state['next_attempt_at'])){
                    $retrying=true;
                    // A failed request may use the previous successful match, but
                    // never its own attempt time to extend the deadline.
                    if(!empty($state['fingerprint'])&&hash_equals($review['fingerprint']??'',$state['fingerprint']))$verified=max($verified,strtotime($state['last_success_at']??'')?:0);
                }else return ['status'=>'review','verified_at'=>gmdate('c',$verified),'reason'=>'source_unavailable'];
            }
        }
    }
    $fresh=$verified>0&&$verified<=$at&&$at-$verified<CAFE_EVENT_FRESH_SECONDS;
    return ['status'=>$fresh?($retrying?'retrying':'verified'):'review','verified_at'=>$verified?gmdate('c',$verified):null,'reason'=>$fresh?null:$reason];
}
function cafe_event_freshness(array $p,?int $at=null):array {
    if(!cafe_event_recovery_ready())return ['status'=>'verified','verified_at'=>null,'reason'=>null];
    // Request-local bulk reads keep filtering and large lists independent of N.
    static $reviews=null,$states=null;
    $reviews??=array_column(query('SELECT * FROM cafe_event_source_reviews')->fetchAll(),null,'record_id');
    $states??=array_column(query('SELECT * FROM cafe_event_source_state')->fetchAll(),null,'url');
    $r=$reviews[$p['id']??'']??null;
    return cafe_event_source_freshness($p,$r,$r?($states[$r['url']]??null):null,$at??time());
}
