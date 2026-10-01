<?php
declare(strict_types=1);

// Source/series tracking is independent of a dated public listing. Read-only pages
// tolerate a release whose explicit CLI migration has not yet been applied.
const CAFE_SERIES_KINDS=['oneoff'=>'単発開催の追跡','recurring'=>'定期・シリーズ開催','discovery'=>'新規発見の確認先'];
const CAFE_SERIES_STATES=['watching'=>'追跡中','paused'=>'保留','ended'=>'終了確認済み'];
const CAFE_RESEARCH_RESULTS=['updated'=>'情報更新あり','no_change'=>'新しい告知なし','unavailable'=>'取得・確認できず','needs_review'=>'内容の再確認が必要'];

function cafe_registry_ready():bool {return (bool)query("SELECT name FROM sqlite_master WHERE type='table' AND name='cafe_event_series'")->fetchColumn();}
function cafe_registry_schema():void {
    db()->exec("CREATE TABLE IF NOT EXISTS cafe_event_series (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, organizer TEXT NOT NULL DEFAULT '',
        country_code TEXT NOT NULL, prefecture TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
        series_kind TEXT NOT NULL CHECK(series_kind IN ('oneoff','recurring','discovery')),
        state TEXT NOT NULL CHECK(state IN ('watching','paused','ended')), source_urls TEXT NOT NULL,
        cadence TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', listing_id TEXT REFERENCES records(id),
        last_researched_on TEXT, last_result TEXT, next_event_on TEXT, next_check_on TEXT NOT NULL,
        annual_reviewed_on TEXT, annual_review_due_on TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cafe_series_due ON cafe_event_series(state,next_check_on);
    CREATE TABLE IF NOT EXISTS cafe_event_occurrences (
        record_id TEXT PRIMARY KEY REFERENCES records(id), series_id TEXT NOT NULL REFERENCES cafe_event_series(id),
        occurrence_key TEXT NOT NULL, event_date TEXT, UNIQUE(series_id,occurrence_key)
    );
    CREATE TABLE IF NOT EXISTS cafe_event_curation_runs (
        batch TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, checked_on TEXT NOT NULL,
        discovery TEXT NOT NULL, summary TEXT NOT NULL, applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cafe_event_research_checks (
        batch TEXT NOT NULL REFERENCES cafe_event_curation_runs(batch), series_id TEXT NOT NULL REFERENCES cafe_event_series(id),
        checked_on TEXT NOT NULL, result TEXT NOT NULL, evidence_urls TEXT NOT NULL, notes TEXT NOT NULL,
        PRIMARY KEY(batch,series_id)
    );
    CREATE TABLE IF NOT EXISTS cafe_event_source_runs (
        checked_on TEXT PRIMARY KEY, summary TEXT NOT NULL, finished_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cafe_event_source_checks (
        checked_on TEXT NOT NULL REFERENCES cafe_event_source_runs(checked_on), url TEXT NOT NULL,
        result TEXT NOT NULL, http_status INTEGER, fingerprint TEXT, PRIMARY KEY(checked_on,url)
    );");
}
function cafe_registry_today():string {return (new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo')))->format('Y-m-d');}
function cafe_registry_id(mixed $id):string {
    if(!is_string($id)||!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$id)||strlen($id)>64)fail('Invalid registry identity');
    return $id;
}
function cafe_registry_urls(mixed $urls):array {
    if(!is_array($urls)||!array_is_list($urls)||!$urls||count($urls)>8)fail('One to eight source URLs are required');
    $out=[];foreach($urls as $url){if(!is_string($url)||strlen($url)>2000)fail('Invalid source URL');$out[]=safe_url($url);}
    return array_values(array_unique($out));
}
function cafe_registry_series(array $data):array {
    $p=[];foreach(['title'=>300,'organizer'=>300,'country_code'=>2,'prefecture'=>100,'city'=>200,'cadence'=>600,'notes'=>2000,'listing_id'=>64] as $key=>$limit)$p[$key]=input($data,$key,$limit);
    if($p['title']===''||!preg_match('/^[A-Z]{2}$/D',$p['country_code']))fail('Series title and country are required');
    if($p['country_code']==='JP'&&$p['prefecture']!==''&&!in_array($p['prefecture'],explode(' ',JP_PREFECTURES),true))fail('Invalid prefecture');
    $p['series_kind']=choice(input($data,'series_kind',20),CAFE_SERIES_KINDS);
    $p['state']=choice(input($data,'state',20)?:'watching',CAFE_SERIES_STATES);
    $p['source_urls']=cafe_registry_urls($data['source_urls']??null);
    $p['listing_id']=$p['listing_id']?:null;
    if($p['listing_id']){ $r=expanded(record($p['listing_id']));if($p['series_kind']!=='recurring'||cafe_listing_group($r)==='events'||$r['country_code']!==$p['country_code'])fail('Recurring listing mismatch'); }
    $p['next_check_on']=date_value(input($data,'next_check_on',10));
    $p['annual_review_due_on']=date_value(input($data,'annual_review_due_on',10));
    if(!$p['next_check_on']||!$p['annual_review_due_on'])fail('Check and annual review due dates are required');
    return $p;
}
function cafe_registry_export():array {
    if(!cafe_registry_ready())return ['ready'=>false,'series'=>[],'runs'=>[],'coverage'=>[]];
    $series=query('SELECT * FROM cafe_event_series ORDER BY next_check_on,prefecture,title,id')->fetchAll();
    $health=[];
    foreach(query('SELECT c.* FROM cafe_event_source_checks c JOIN (SELECT url,max(checked_on) AS day FROM cafe_event_source_checks GROUP BY url) latest ON latest.url=c.url AND latest.day=c.checked_on')->fetchAll() as $check)$health[$check['url']]=$check;
    $changes=array_column(query("SELECT c.url,max(r.finished_at) AS changed_at FROM cafe_event_source_checks c JOIN cafe_event_source_runs r ON r.checked_on=c.checked_on WHERE c.result='changed' GROUP BY c.url")->fetchAll(),'changed_at','url');
    $verified=array_column(query("SELECT c.series_id,max(r.applied_at) AS verified_at FROM cafe_event_research_checks c JOIN cafe_event_curation_runs r ON r.batch=c.batch WHERE c.result IN ('updated','no_change') GROUP BY c.series_id")->fetchAll(),'verified_at','series_id');
    foreach($series as &$s){
        $s['source_urls']=json_decode($s['source_urls'],true,512,JSON_THROW_ON_ERROR);
        $s['source_health']=array_values(array_map(fn($url)=>array_replace($health[$url]??['url'=>$url,'checked_on'=>null,'result'=>'not_checked'],['pending_change_at'=>$changes[$url]??null,'needs_review'=>isset($changes[$url])&&($changes[$url]>($verified[$s['id']]??''))]), $s['source_urls']));
        $s['occurrences']=query("SELECT o.*,r.name,r.slug,r.kind,r.publication FROM cafe_event_occurrences o JOIN records r ON r.id=o.record_id WHERE series_id=? ORDER BY event_date DESC,record_id",[$s['id']])->fetchAll();
        $s['annual_review_due']=$s['annual_review_due_on']<=cafe_registry_today();
    }unset($s);
    $coverage=[];foreach(explode(' ',JP_PREFECTURES) as $pref)$coverage[$pref]=0;
    foreach($series as $s)if($s['country_code']==='JP'&&isset($coverage[$s['prefecture']]))$coverage[$s['prefecture']]++;
    $runs=query('SELECT * FROM cafe_event_curation_runs ORDER BY applied_at DESC,batch DESC LIMIT 14')->fetchAll();
    foreach($runs as &$run){$run['discovery']=json_decode($run['discovery'],true);$run['summary']=json_decode($run['summary'],true);}unset($run);
    return ['ready'=>true,'today'=>cafe_registry_today(),'series'=>$series,'runs'=>$runs,'source_runs'=>query('SELECT * FROM cafe_event_source_runs ORDER BY checked_on DESC LIMIT 7')->fetchAll(),'coverage'=>$coverage];
}
function cafe_registry_public_update():string {
    if(!cafe_registry_ready())return '';
    return (string)(query('SELECT max(checked_on) FROM cafe_event_research_checks')->fetchColumn()?:'');
}
function cafe_registry_discovery_regions(string $day):array {
    date_value($day);
    return match((int)(new DateTimeImmutable($day))->format('N')){
        1=>['北海道','東北'],2=>['関東'],3=>['中部'],4=>['近畿'],5=>['中国','四国'],6=>['九州'],7=>['沖縄']
    };
}
