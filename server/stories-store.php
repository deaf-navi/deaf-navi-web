<?php
declare(strict_types=1);

// Editorial content has its own durable store. Never migrate the café database here.
function stories_dir():string { return getenv('DEAFNAVI_LOCAL_TEST')==='1' ? data_dir().'/stories' : '/srv/deafnavi/shared/stories'; }
function stories_db():PDO {
    $f=stories_dir().'/stories.sqlite';
    if(!is_file($f)||is_link($f))throw new RuntimeException('Stories storage not initialized');
    $db=new PDO('sqlite:'.$f,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return $db;
}
function stories_init():void {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    $dir=stories_dir();if(is_link($dir))throw new RuntimeException('Invalid storage');
    foreach([$dir,$dir.'/media',$dir.'/backups'] as $d)if(!is_dir($d)&&!mkdir($d,0700,true))throw new RuntimeException('Storage creation failed');
    $file=$dir.'/stories.sqlite';if(is_link($file))throw new RuntimeException('Invalid database');
    if(!is_file($file)){fclose(fopen($file,'x'));chmod($file,0600);}
    $db=stories_db();$db->exec("CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL REFERENCES categories(id),tags TEXT NOT NULL,cover TEXT NOT NULL,alt TEXT NOT NULL,author TEXT NOT NULL,sources TEXT NOT NULL,related TEXT NOT NULL,checked_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','published','archived')),featured INTEGER NOT NULL DEFAULT 0,published_at TEXT,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS aliases(slug TEXT PRIMARY KEY,story_id TEXT NOT NULL REFERENCES stories(id));
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,story_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS stories_listing ON stories(status,category,published_at);");
    $s=$db->prepare('INSERT OR IGNORE INTO categories VALUES(?,?)');
    foreach(['life'=>'暮らし・制度','culture'=>'ろう文化・交流','world-tech'=>'世界・テクノロジー'] as $id=>$name)$s->execute([$id,$name]);
}
function stories_query(string $sql,array $args=[]):PDOStatement {$s=stories_db()->prepare($sql);$s->execute($args);return $s;}
function stories_backup(PDO $db):string {
    $file=stories_dir().'/backups/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.sqlite';
    $db->exec('VACUUM INTO '.$db->quote($file));chmod($file,0600);return $file;
}
function stories_categories():array {return stories_query('SELECT id,name FROM categories ORDER BY rowid')->fetchAll(PDO::FETCH_KEY_PAIR);}
function story_get(string $id):array {$r=stories_query('SELECT * FROM stories WHERE id=?',[$id])->fetch();if(!$r)fail('記事が見つかりません。',404);return $r;}
function story_public(array $r):bool {return $r['status']==='published'&&$r['published_at']!==null&&strtotime($r['published_at'])<=time();}
function story_media_url(string $id):string {return '/stories/media/'.$id.'.webp';}
function story_url(string $url):bool {return strlen($url)<2000&&!preg_match('/[\x00-\x20\x7f<>"\\\\]/',$url)&&filter_var($url,FILTER_VALIDATE_URL)&&in_array(strtolower(parse_url($url,PHP_URL_SCHEME)??''),['http','https'],true)&&!parse_url($url,PHP_URL_USER)&&!parse_url($url,PHP_URL_PASS);}
function story_internal(string $url):bool {
    if(str_starts_with($url,BASE.'/'))$url=substr($url,strlen(BASE));
    if(!str_starts_with($url,'/')||str_starts_with($url,'//')||preg_match('/[\x00-\x20\x7f<>"\\\\%?]/',$url)||str_contains($url,'..'))return false;
    $path=explode('#',$url,2)[0];
    if(in_array($path,['/','/connect/sign-cafe/','/connect/sign-cafe/overseas/','/connect/sign-cafe/events/','/stories/'],true))return true;
    if(preg_match('#^/connect/sign-cafe/area/([a-z-]+)/$#D',$path,$region))return defined('CAFE_REGION_PAGES')&&isset(CAFE_REGION_PAGES[$region[1]]);
    if(preg_match('#^/connect/sign-cafe/(?:starbucks/)?[a-z0-9-]+/$#D',$path)){
        foreach(query("SELECT * FROM records WHERE publication='public'")->fetchAll() as $r)if(record_path(expanded($r))===$path&&publicly_visible(expanded($r)))return true;
        return false;
    }
    if(preg_match('#^/stories/([a-z0-9-]+)/$#D',$path,$m)){$r=stories_query('SELECT * FROM stories WHERE slug=?',[$m[1]])->fetch();return $r&&story_public($r);}
    $root=getenv('DEAFNAVI_LOCAL_TEST')==='1'?__DIR__.'/../docs':'/srv/deafnavi/current';
    return preg_match('#^/(?:news/|guide(?:/|\.html$)|events(?:/|\.html$)|otomado/|deaf-navi-world-(?:jp|original)\.html$|about\.html$)#D',$path)&&is_file($root.$path.(str_ends_with($path,'/')?'index.html':''));
}
function story_links(string $text,bool $internal=false):array {
    $out=[];foreach(explode("\n",$text) as $line){if(trim($line)==='')continue;[$label,$url]=array_pad(explode('|',$line,2),2,'');$label=trim($label);$url=trim($url);
        if(!$label||strlen($label)>300||!($internal?story_internal($url):story_url($url)))fail('リンクは「説明 | URL」の形式で、実在する安全なURLを入力してください。');
        if($internal&&str_starts_with($url,BASE.'/'))$url=substr($url,strlen(BASE));$out[]=['label'=>$label,'url'=>$url];if(count($out)>20)fail('リンクは20件までです。');
    }return $out;
}
function story_save(array $in,string $actor):string {
    $id=input($in,'id',64)?:bin2hex(random_bytes(16));$old=isset($in['id'])&&$in['id']!==''?story_get($id):null;
    $p=[];foreach(['slug'=>100,'title'=>300,'summary'=>1500,'body'=>50000,'category'=>64,'tags'=>1000,'cover'=>64,'alt'=>600,'author'=>200,'sources'=>8000,'related'=>8000,'checked_at'=>10] as $k=>$n)$p[$k]=input($in,$k,$n);
    if(!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$p['slug'])||in_array($p['slug'],['media','feed','sitemap','preview','api'],true))fail('URLは半角英数字とハイフンで指定してください。');
    if(!$p['title'])fail('記事タイトルを入力してください。');
    if(!isset(stories_categories()[$p['category']]))fail('カテゴリを選んでください。');
    $p['status']=choice(input($in,'status',20),['draft'=>1,'published'=>1,'archived'=>1]);$p['featured']=isset($in['featured'])?1:0;
    if($p['status']==='published'&&(!$p['summary']||!$p['body']))fail('公開には概要と本文が必要です。');
    if($p['checked_at']!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$p['checked_at'])||date('Y-m-d',strtotime($p['checked_at']))!==$p['checked_at']))fail('情報確認日を確認してください。');
    if($p['cover']!==''&&!stories_query('SELECT id FROM media WHERE id=?',[$p['cover']])->fetchColumn())fail('登録済みのカバー画像を選んでください。');
    if($p['cover']!==''&&$p['alt']==='')fail('カバー画像の説明を入力してください。');
    preg_match_all('#/stories/media/([a-f0-9]{32})\.webp#',$p['body'],$media);
    foreach($media[1] as $mid)if(!stories_query('SELECT id FROM media WHERE id=?',[$mid])->fetchColumn())fail('本文の画像が見つかりません。');
    $p['sources']=json(story_links($p['sources']));$p['related']=json(story_links($p['related'],true));
    $p['tags']=json(array_values(array_unique(array_filter(array_map('trim',preg_split('/[,、\n]/u',$p['tags']))))));
    $p['published_at']=$old['published_at']??null;
    if($p['status']==='published'&&!$p['published_at'])$p['published_at']=now();
    $date=input($in,'published_at',30);if($date!==''){$dt=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$date,new DateTimeZone('Asia/Tokyo'));if(!$dt||$dt->format('Y-m-d\TH:i')!==$date||$dt->getTimestamp()>time())fail('公開日時は現在以前を指定してください。予約投稿は未対応です。');$p['published_at']=$dt->format(DATE_ATOM);}
    $p['updated_at']=now();$db=stories_db();stories_backup($db);$db->exec('BEGIN IMMEDIATE');
    try {
        if($old){$s=$db->prepare('SELECT revision FROM stories WHERE id=?');$s->execute([$id]);if((int)$s->fetchColumn()!==(int)($in['revision']??0))fail('別の保存が先に行われました。入力をコピーしてから再読み込みしてください。',409);}
        $s=$db->prepare('SELECT story_id FROM aliases WHERE slug=?');$s->execute([$p['slug']]);$owner=$s->fetchColumn();
        $s=$db->prepare('SELECT id FROM stories WHERE slug=?');$s->execute([$p['slug']]);$current=$s->fetchColumn();
        if(($owner&&$owner!==$id)||($current&&$current!==$id))fail('このURLは使用済みです。別のスラッグを指定してください。',409);
        if($old&&$old['slug']!==$p['slug']){$db->prepare('INSERT OR IGNORE INTO aliases VALUES(?,?)')->execute([$old['slug'],$id]);}
        if($old){$sql='UPDATE stories SET '.implode(',',array_map(fn($k)=>$k.'=?',array_keys($p))).',revision=revision+1 WHERE id=?';$values=[...array_values($p),$id];}
        else{$sql='INSERT INTO stories(id,'.implode(',',array_keys($p)).') VALUES('.implode(',',array_fill(0,count($p)+1,'?')).')';$values=[$id,...array_values($p)];}
        $db->prepare($sql)->execute($values);$db->prepare('INSERT INTO history(story_id,actor,action,created_at) VALUES(?,?,?,?)')->execute([$id,$actor,'save:'.$p['status'],now()]);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}return $id;
}
