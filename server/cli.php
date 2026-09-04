<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
$command=$argv[1]??'';
if($command==='init') {
    umask(0077);$dir=data_dir();if(!is_dir($dir))mkdir($dir,0700,true);
    if(!is_dir($dir.'/sessions'))mkdir($dir.'/sessions',0700);
    $first=!is_file($dir.'/directory.sqlite');
    $pdo=new PDO('sqlite:'.$dir.'/directory.sqlite');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $pdo->exec(file_get_contents(__DIR__.'/schema.sql'));
    query('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',['rate_secret',bin2hex(random_bytes(32))]);
    if(!query('SELECT id FROM users LIMIT 1')->fetch()) {
        // Initial credential is delivered on stdin, never in process arguments or source.
        $input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
        $name=$input['username']??'';$hash=$input['password_hash']??'';
        if(!preg_match('/^[a-zA-Z0-9_-]{3,40}$/D',$name)||password_get_info($hash)['algoName']==='unknown')throw new RuntimeException('Invalid bootstrap');
        query('INSERT INTO users(username,password_hash,role,created_at) VALUES(?,?,?,?)',[$name,$hash,'admin',now()]);
    }
    if(setting('seed_version')==='') {
      db()->exec('BEGIN IMMEDIATE');
      try { foreach(json_decode(file_get_contents(__DIR__.'/seed.json'),true,512,JSON_THROW_ON_ERROR) as $row) {
        $kind=$row['kind'];$id=$row['id'];unset($row['kind'],$row['id']);
        $post=$row;foreach(['verification_sources','subtypes'] as $k)if(isset($post[$k]))$post[$k]=implode("\n",$post[$k]);
        if(isset($post['signing_store']))$post['signing_store']=$post['signing_store']?'1':'0';
        $p=validated_record($post,$kind);save_record($p,$kind,$id);
      }
      query('INSERT INTO settings(key,value) VALUES(?,?)',['seed_version','20260905']);
      db()->exec('COMMIT');
      } catch(Throwable $ex) { db()->exec('ROLLBACK');throw $ex; }
    }
    echo "DIRECTORY_INIT_OK\n";
} elseif($command==='check') {
    if(query('PRAGMA integrity_check')->fetchColumn()!=='ok'||query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('DB integrity failure');
    echo json(['integrity'=>'ok','records'=>query('SELECT kind,publication,count(*) AS count FROM records GROUP BY kind,publication')->fetchAll(),'submissions'=>(int)query('SELECT count(*) FROM submissions')->fetchColumn(),'users'=>(int)query('SELECT count(*) FROM users')->fetchColumn()])."\n";
} elseif($command==='backup') {
    $dest=$argv[2]??'';
    if(!is_dir($dest)||is_link($dest))throw new RuntimeException('Backup directory must already exist');
    $file=$dest.'/directory-'.gmdate('Ymd\THis\Z').'-'.substr(uid(),0,6).'.sqlite';
    $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($file);
    if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('Backup failed');
    chmod($file,0600);echo "DIRECTORY_BACKUP_OK\n";
} elseif($command==='mail') {
    require __DIR__.'/mail.php';send_outbox();
} else {fwrite(STDERR,"Commands: init, check, backup DIRECTORY, mail\n");exit(1);}
