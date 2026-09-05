<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/core.php';
try {
    $file=$argv[1]??'';$dir=$argv[2]??'';
    if(!is_file($file)||is_link($file)||!is_dir($dir)||is_link($dir))throw new RuntimeException('Invalid paths');
    $m=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
    $ids=['knot','cafe-2u','sign-with-me','lamunedou','tetote','nishiochaya','hands-place','tabicafe'];
    if($m['date']!=='2026-09-06'||array_column($m['updates'],'id')!==$ids)throw new RuntimeException('Unexpected manifest');
    db()->exec('BEGIN IMMEDIATE');
    try {
        if(query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('Integrity failure');
        $prepared=[];$changed=false;
        foreach($m['updates'] as $u){
            $r=record($u['id']);$p=expanded($r);
            if($r['kind']!=='cafe'||$p['official_url']!==$u['source'])throw new RuntimeException('Source conflict');
            foreach($u['links'] as $key=>$url){
                if(!in_array($key,['instagram_url','x_url','facebook_url','line_url','youtube_url'],true)||(!empty($p[$key])&&$p[$key]!==$url))throw new RuntimeException('Existing value conflict');
                if(($p[$key]??'')!==$url)$changed=true;
                $p[$key]=safe_url($url);
            }
            foreach(['verification_sources','subtypes'] as $key)$p[$key]=implode("\n",$p[$key]??[]);
            $prepared[]=[$r,validated_record($p,'cafe')];
        }
        if(!$changed)throw new RuntimeException('Already applied');
        umask(0077);$backup=$dir.'/social-links-'.gmdate('Ymd_His').'-'.substr(uid(),0,6).'.sqlite';
        $source=new SQLite3(data_dir().'/directory.sqlite',SQLITE3_OPEN_READONLY);$target=new SQLite3($backup);
        if(!$source->backup($target)||$target->querySingle('PRAGMA integrity_check')!=='ok')throw new RuntimeException('Backup failure');
        $target->close();$source->close();chmod($backup,0600);
        foreach($prepared as [$r,$p])save_record($p,'cafe',$r['id'],$r['revision']);
        db()->exec('COMMIT');echo json(['result'=>'SOCIAL_LINKS_IMPORTED','updated'=>count($prepared),'backup'=>$backup])."\n";
    }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}catch(Throwable $e){fwrite(STDERR,'SOCIAL_IMPORT_FAILED: '.get_class($e)."\n");exit(1);}
