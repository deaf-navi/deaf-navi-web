<?php
declare(strict_types=1);
// Intentionally limited front matter, not a general YAML parser. No HTML or network I/O.
function story_import_parse(string $text):array {
    $text=str_replace("\r\n","\n",preg_replace('/^\xEF\xBB\xBF/','',$text));
    if(!preg_match('//u',$text)||!preg_match('/\A---\n(.*?)\n---(?:\n|$)(.*)\z/s',$text,$m))fail('原稿は --- で囲んだ項目と本文を指定してください。');
    $allowed=['title','slug','category','featured','summary','tags','author','checked_at','sources','related'];$in=[];$list='';
    foreach(explode("\n",$m[1]) as $line){
        if(trim($line)==='')continue;
        if(preg_match('/^- (.+)$/u',$line,$item)&&in_array($list,['sources','related'],true)){$in[$list].=($in[$list]!==''?"\n":'').$item[1];continue;}
        if(!preg_match('/^([a-z_]+):(?: (.*))?$/u',$line,$field)||!in_array($field[1],$allowed,true)||array_key_exists($field[1],$in))fail('原稿の項目・重複を確認してください。');
        $list=$field[1];$in[$list]=$field[2]??'';
    }
    if(isset($in['featured'])&&!in_array($in['featured'],['yes','no','true','false','1','0',''],true))fail('featured は yes / no で指定してください。');
    if(!in_array($in['featured']??'',['yes','true','1'],true))unset($in['featured']);
    $in['body']=$m[2];$in['status']='draft';return $in;
}
function stories_import(array $files,bool $dryRun):array {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    if(!$files||count($files)>50)fail('原稿を1〜50ファイル指定してください。');
    $rows=[];$seen=[];
    foreach($files as $file){
        if(!is_file($file)||filesize($file)>1024*1024)fail('原稿ファイルを確認してください。');
        $in=story_import_parse(file_get_contents($file));story_prepare($in);
        if(isset($seen[$in['slug']]))fail('取り込み対象のスラッグが重複しています。',409);
        $seen[$in['slug']]=true;$rows[]=$in;
    }
    if(!$dryRun){
        $db=stories_db();stories_backup($db);$db->exec('BEGIN IMMEDIATE');
        try{foreach($rows as $in)story_save($in,'cli:stories-import',$db);$db->exec('COMMIT');}
        catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }
    return ['dry_run'=>$dryRun,'count'=>count($rows),'status'=>'draft','slugs'=>array_keys($seen)];
}
