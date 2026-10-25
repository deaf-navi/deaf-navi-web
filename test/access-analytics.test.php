<?php
declare(strict_types=1);
// Synthetic data only. Never reads production logs or uses a real visitor identity.
$dir=sys_get_temp_dir().'/dn-analytics-'.bin2hex(random_bytes(6));
mkdir($dir); mkdir($dir.'/logs'); mkdir($dir.'/visitors');
putenv('DEAFNAVI_LOCAL_TEST=1'); putenv('DEAFNAVI_DATA_DIR='.$dir);
putenv('DEAFNAVI_ACCESS_LOG_DIR='.$dir.'/logs'); putenv('DEAFNAVI_VISITOR_DIR='.$dir.'/visitors');
require __DIR__.'/../server/core.php';
require __DIR__.'/../server/admin-dashboard.php';
require __DIR__.'/../server/access-logs.php';
$n=0;
function check(bool $value,string $message):void {global $n;if(!$value)throw new RuntimeException($message);$n++;}
function row(string $path,float $ts,int $status=200,array $extra=[]):string {
    return json_encode(array_replace_recursive(['ts'=>$ts,'request'=>['host'=>'deafnavi.com','method'=>'GET','uri'=>$path],
        'status'=>$status,'client_kind'=>'human','duration'=>.01,'referrer_host'=>'www.Google.co.jp.',
        'user_agent'=>'Mozilla/5.0 (iPhone; Mobile) Fixture'], $extra),JSON_THROW_ON_ERROR);
}
$from=new DateTimeImmutable('2026-10-20',new DateTimeZone('Asia/Tokyo'));
$start=$from->getTimestamp();
$o=['from'=>'2026-10-20','to'=>'2026-10-20','start'=>$start,'end'=>$start+86400,'mode'=>'views','content'=>'all','group'=>'all','client'=>'human','status'=>'','q'=>'','page'=>1,'limit'=>25,'compare'=>'previous'];
$lines=[row('/', $start-86401),row('/', $start-86400),row('/about.html',$start-1),
    row('/', $start),row('/about.html',$start+2,304),row('/about.html',$start+3,404),row('/about.html',$start+4,500),
    row('/news/support/',$start+5,200,['referrer_host'=>'none-or-invalid']),
    row('/news/accessibility/',$start+6,200,['referrer_host'=>'deafnavi.com']),
    row('/about.html',$start+7,200,['client_kind'=>'ai']),row('/', $start+86400)];
file_put_contents($dir.'/logs/access.log',implode("\n",$lines)."\n");
$r=access_report($o);
$_GET=['limit'=>'25','page'=>'101'];
check(access_options()['page']===101,'25-row history can reach beyond page 100');
$_GET=['limit'=>'25','page'=>'401'];
check(access_options()['page']===400,'history stays bounded to 10000 rows');
$_GET=[];
check(access_csv_rows($o,$r,['available'=>false])[3][1]==='group','CSV preserves request group condition');
check($r['total']===4&&$r['pages']===4,'200/304 eligible views share one definition');
check($r['previous']['total']===2,'same-day-count preceding comparison and JST boundaries');
check($r['channels']['search']===2&&$r['channels']['unattributed']===1&&$r['channels']['internal']===1,'request referrers distinguish unavailable vs internal');
check($r['devices']['mobile']===4&&$r['hours'][0]===4&&$r['weekdays'][2]===4,'device/time dimensions use matching rows only');
check(access_comparison_state($o,$r,$r['previous'],new DateTimeImmutable('2026-10-25',new DateTimeZone('Asia/Tokyo')))['available'],'completed periods with observed boundaries compare');
$error=access_report(array_replace($o,['mode'=>'requests','content'=>'about','status'=>'5xx']));
check($error['total']===1&&$error['errors']===1,'content filter does not discard failed requests');
check(access_delta(2,0,true)['percent']===null&&access_delta(2,0,true)['difference']===2,'zero denominator is not infinity');
check(access_delta(2,1,false)['difference']===null,'incomplete comparisons remain unknown');
check(access_report(array_replace($o,['q'=>'/','match'=>'exact']))['total']===1,'exact root filter does not match every page');
check(access_report(array_replace($o,['q'=>'/news/','match'=>'prefix']))['total']===2,'prefix path filter matches only its subtree');
check(access_referrer('evilgoogle.com')['channel']==='referral','domain suffix boundary');
check(access_referrer('news.instagram.com')['channel']==='social','social subdomain');
check(access_referrer(null)['channel']==='unrecorded'&&access_referrer('none-or-invalid')['channel']==='unattributed','legacy absence is not a known direct visit');
check(access_referrer('https://secret.example/?token=secret')['host']===null,'reject full referrer URLs');
check(access_device('Mozilla/5.0 (iPad)')==='tablet'&&access_device(null)==='unknown','missing UA not a desktop');
check(access_csv_cell('=1+1')==="'=1+1"&&access_csv_cell("\t@SUM(1)")[0]==="'",'CSV formula safety');
$series=access_chart_series($o,[],$start-86400,false);
check($series['2026-10-20']===null,'unscanned missing day not zero');
file_put_contents($dir.'/logs/access.log',"not-json\n",FILE_APPEND);
$broken=access_report($o);
check($broken['invalid']===1&&!access_comparison_state($o,$broken,$broken['previous'])['available'],'malformed record suppresses exact change');
$unsafe=access_entry(row("/\x01invalid",$start+12));
check($unsafe!==null&&$unsafe['unsafe_path']&&access_exclusion($unsafe)==='probe'&&!str_contains(json_encode($unsafe),'invalid\\u0001'),'unsafe path is explicitly excluded with redacted display');
file_put_contents($dir.'/logs/access.log',implode("\n",$lines)."\n");
file_put_contents($dir.'/logs/access-v3-2026-10-19T01-00-00-time.log',row('/guide/life/',$start+20)."\n");
touch($dir.'/logs/access-v3-2026-10-19T01-00-00-time.log',time()-100);
$sorted=access_report(array_replace($o,['limit'=>2]));
check($sorted['rows'][0]['ts']===$start+20.0&&$sorted['rows'][1]['ts']===$start+6.0,'global timestamp order does not use file mtime');
$page=access_report(array_replace($o,['page'=>2,'limit'=>2]));
check($page['rows'][0]['ts']===$start+5.0&&$page['rows'][1]['ts']===$start+2.0,'stable global pagination');
access_visitor_init();
$at=new DateTimeImmutable('2026-10-20T01:00:00+09:00');
access_record_visit('/','192.0.2.1','Mozilla/5.0 Fixture',$at);
access_record_visit('/about.html','192.0.2.1','Mozilla/5.0 Fixture',$at);
access_record_visit('/about.html','192.0.2.1','Mozilla/5.0 Fixture',$at);
$u=access_unique_report($o);check($u['total']===1&&array_sum($u['contents'])===2,'UU one person-day across pages, category totals overlap');
$co=access_covisits($o);check($co['available']&&count($co['pairs'])===1&&(int)$co['pairs'][0]['count']===1,'same-day co-reading counted once without direction');
check(!str_contains(json_encode($co),'visitor'),'co-reading has no identifiers');
$db=access_visitor_db(true);$db->exec("INSERT INTO excluded_visitors SELECT day,visitor,'ai' FROM visits LIMIT 1");
check(access_covisits($o)['pairs']===[]&&access_unique_report($o)['total']===0,'explicit exclusion applies equally to UU and co-reading');
mkdir($dir.'/stories');$stories=new PDO('sqlite:'.$dir.'/stories/stories.sqlite');
$stories->exec("CREATE TABLE stories(slug TEXT,status TEXT,published_at TEXT); INSERT INTO stories VALUES('public-story','published','2020-01-01'),('private-story','draft',NULL),('future-story','published','2099-01-01')");
check(access_public_story_path('/stories/')&&access_public_story_path('/stories/public-story/'),'dynamic published stories accepted');
check(!access_public_story_path('/stories/private-story/')&&!access_public_story_path('/stories/future-story/')&&!access_public_story_path('/stories/missing/'),'draft, future, unknown stories rejected');
$edb=engagement_db(true);$edb->exec("INSERT INTO counts VALUES('2026-10-20','cafe','related_view',100000)");
$eng=engagement_report($o);check($eng['saturated']&&$eng['total']===100000&&$eng['first_day']==='2026-10-20','saturation and earliest saved day are explicit');
$before=['available'=>true,'total'=>0,'started_at'=>'2026-10-23T00:00:00Z','stories_started_at'=>null];
check(access_uu_value($o,$before,0)===null,'UU before measurement start is unknown, not zero');
$before['started_at']='2026-10-01T00:00:00Z';
check(access_uu_value($o,$before,0,'stories')===null,'stories without a measurement start stay unknown');
$empty=access_report_empty();$empty['previous']=access_report_empty();
$csv=access_csv_rows(array_replace($o,['content'=>'stories']),$empty,$before);
foreach($csv as $record)if(in_array($record[0],['totals','request_referrers','device_estimate','hour_JST','excluded_all_contents'],true))check($record[2]==='UNKNOWN','CSV missing metric is UNKNOWN: '.$record[1]);
$uuExact=access_unique_report(array_replace($o,['q'=>'/','match'=>'exact']));
check(count($uuExact['paths'])===0,'UU exact filter preserves existing exclusion');
$history=[];for($i=0;$i<2501;$i++)$history[]=row('/history-fixture/'.$i,$start+100+$i);
file_put_contents($dir.'/logs/access.log',implode("\n",$history)."\n");
$deep=access_report(array_replace($o,['mode'=>'requests','q'=>'/history-fixture/','page'=>101,'limit'=>25]));
check($deep['total']===2501&&count($deep['rows'])===1&&!$deep['history_limited'],'25-row page 101 retains the 2501st request');
echo json_encode(['result'=>'ANALYTICS_OK','checks'=>$n,'productionWrites'=>false])."\n";
