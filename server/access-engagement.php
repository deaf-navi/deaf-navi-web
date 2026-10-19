<?php
declare(strict_types=1);
require_once __DIR__.'/access-visitors.php';
const ENGAGEMENT_SOURCES=['news'=>'国内ニュース','support'=>'制度・支援','accessibility'=>'字幕・手話通訳','world'=>'World','archive'=>'過去ニュース','cafe'=>'国内カフェ一覧'];
const ENGAGEMENT_EVENTS=['related_view'=>'関連記事欄の表示','related_click'=>'関連記事からニュースへ','article_click'=>'元記事を開く','cafe_detail'=>'店舗詳細を開く','cafe_search'=>'検索条件を適用'];
function engagement_db(bool $write=false):PDO {
    $dir=access_visitor_dir();$file=$dir.'/engagement.sqlite';
    if(!is_dir($dir)||is_link($dir)||is_link($file))throw new RuntimeException('Storage unavailable');
    if(!is_file($file)){
        if(!$write)throw new RuntimeException('Not started');
        $handle=@fopen($file,'x');if($handle){chmod($file,0600);fclose($handle);}
    }
    $db=new PDO('sqlite:'.$file,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=1500');
    if($write)$db->exec('CREATE TABLE IF NOT EXISTS counts(day TEXT NOT NULL,source TEXT NOT NULL,event TEXT NOT NULL,hits INTEGER NOT NULL,PRIMARY KEY(day,source,event)) WITHOUT ROWID');
    else $db->exec('PRAGMA query_only=ON');
    return $db;
}
function engagement_valid(array $data):bool {
    if(count($data)!==2||!is_string($data['source']??null)||!is_string($data['event']??null))return false;
    if(!isset(ENGAGEMENT_SOURCES[$data['source']],ENGAGEMENT_EVENTS[$data['event']]))return false;
    return $data['source']==='cafe'?$data['event']!=='article_click':$data['event']==='article_click';
}
function engagement_record(string $source,string $event):void {
    $day=(new DateTimeImmutable('now',new DateTimeZone('Asia/Tokyo')))->format('Y-m-d');
    $s=engagement_db(true)->prepare('INSERT INTO counts VALUES(?,?,?,1) ON CONFLICT(day,source,event) DO UPDATE SET hits=MIN(hits+1,100000)');$s->execute([$day,$source,$event]);
}
function engagement_endpoint():never {
    header('Cache-Control: private, no-store');header('Content-Type: text/plain');header('X-Robots-Tag: noindex');
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit;}
    $origin=getenv('DEAFNAVI_LOCAL_TEST')==='1'?'http://'.($_SERVER['HTTP_HOST']??''):'https://deafnavi.com';
    if(($_SERVER['HTTP_ORIGIN']??'')!==$origin||!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')){http_response_code(403);exit;}
    $body=file_get_contents('php://input',false,null,0,257);
    if(strlen($body)>256){http_response_code(413);exit;}
    $data=json_decode($body,true,4);
    if(!is_array($data)||!engagement_valid($data)){http_response_code(400);exit;}
    if(access_client(substr($_SERVER['HTTP_USER_AGENT']??'',0,2048),substr($_SERVER['HTTP_X_DEAFNAVI_CLIENT']??'',0,100))!=='human'){http_response_code(204);exit;}
    try{engagement_record($data['source'],$data['event']);http_response_code(204);}catch(Throwable){http_response_code(503);}exit;
}
function engagement_report_html(array $o):string {
    $out='<section class="admin-panel"><h2>関連記事・記事クリック</h2><p>選択期間のサイト全体を対象とする日別の操作件数です。コンテンツ・URL検索条件は適用しません。導入後の計測のみ。表示は関連記事欄が画面内に入った回数、クリックは同じページ表示中の同じリンクを重複除外します。人数・読了・再訪率ではありません。</p>';
    try{$s=engagement_db()->prepare('SELECT source,event,SUM(hits) AS hits FROM counts WHERE day>=? AND day<=? GROUP BY source,event ORDER BY source,event');$s->execute([$o['from'],$o['to']]);$rows=$s->fetchAll();}
    catch(Throwable){return $out.'<p>計測データ未取得（未開始または保存先を確認できません）。</p></section>';}
    if(!$rows)return $out.'<p>この期間の計測データはありません。</p></section>';
    $out.='<div class="admin-table-wrap"><table><thead><tr><th>ページ</th><th>操作</th><th>件数</th></tr></thead><tbody>';
    foreach($rows as $r)$out.='<tr><td>'.e(ENGAGEMENT_SOURCES[$r['source']]??'不明').'</td><td>'.e(ENGAGEMENT_EVENTS[$r['event']]??'不明').'</td><td>'.(int)$r['hits'].'</td></tr>';
    return $out.'</tbody></table></div><p>Cookie・個人識別子・IP・検索語・記事URLは保存しません。AI・bot・検証アクセスは除外します。日付・ページ区分・操作の合計だけを保持します。</p></section>';
}
