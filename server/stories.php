<?php
declare(strict_types=1);
require_once __DIR__.'/stories-store.php';
require_once __DIR__.'/stories-render.php';
require_once __DIR__.'/stories-admin.php';
function stories_dispatch(string $path):bool {
    if($path==='/stories'){header('Location: /stories/',true,308);return true;}
    if($path==='/admin/stories/'){
        $u=stories_editor_user();header('X-Robots-Tag: noindex, nofollow');
        if($_SERVER['REQUEST_METHOD']==='GET'&&isset($_GET['preview'])){echo story_detail(story_get(input($_GET,'preview',64)),true);return true;}
        if($_SERVER['REQUEST_METHOD']!=='POST')fail('この操作は利用できません。',405);
        check_csrf();$action=input($_POST,'action',20);
        if($action==='bulk_review'){echo stories_bulk_review($_POST,$u);return true;}
        if($action==='bulk_apply'){stories_bulk_apply($_POST,(string)$u['id']);$_SESSION['flash']='選んだ記事の状態を保存しました。';header('Location: /admin/?view=stories',true,303);return true;}
        if($action==='slug'){header('Content-Type: application/json');echo json(['used'=>story_slug_used(story_input($_POST,'slug',100),input($_POST,'id',64))]);return true;}
        if($action==='preview'){header('Content-Type: application/json');echo json(['invalid_links'=>story_invalid_links(story_input($_POST,'body',50000)),'html'=>story_link_warning(story_input($_POST,'body',50000)).story_markdown(story_input($_POST,'body',50000))['html']]);return true;}
        if($action==='upload'){header('Content-Type: application/json');echo json(stories_upload());return true;}
        if($action==='category'){
            $id=input($_POST,'category_id',64);$name=input($_POST,'category_name',100);if(!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$id)||!$name)fail('カテゴリIDと表示名を確認してください。');
            $db=stories_db();stories_backup($db);$db->prepare('INSERT INTO categories VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name')->execute([$id,$name]);$target='/admin/?view=stories';
        }elseif($action==='save'){$id=story_save($_POST,(string)$u['id']);$target='/admin/?view=stories&mode=edit&id='.$id;}
        elseif($action==='duplicate'){$r=story_get(input($_POST,'id',64));$r['id']='';$r['slug'].='-copy-'.bin2hex(random_bytes(3));$r['title'].='（複製）';$r['status']='draft';$r['published_at']='';unset($r['featured']);$r['tags']=implode(',',json_decode($r['tags'],true));$r['sources']=story_lines($r['sources']);$r['related']=story_lines($r['related']);$id=story_save($r,(string)$u['id']);$target='/admin/?view=stories&mode=edit&id='.$id;}
        else fail('操作が見つかりません。',400);
        $_SESSION['flash']='保存しました。';
        if(str_contains($_SERVER['HTTP_ACCEPT']??'','application/json')){header('Content-Type: application/json');echo json(['redirect'=>$target]);return true;}
        header('Location: '.$target,true,303);return true;
    }
    if(!str_starts_with($path,'/stories/'))return false;
    if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true))fail('この操作は利用できません。',405);
    if(preg_match('#^/stories/media/([a-f0-9]{32})\.webp$#D',$path,$m)){
        $id=$m[1];$rows=stories_query("SELECT id FROM stories WHERE status='published' AND datetime(published_at)<=datetime(?) AND (cover=? OR instr(body,?)>0) LIMIT 1",[now(),$id,story_media_url($id)])->fetchAll();
        if(!$rows)stories_editor_user();$file=stories_dir().'/media/'.$id.'.webp';if(!is_file($file)||is_link($file))fail('画像が見つかりません。',404);
        header('Content-Type: image/webp');header('X-Robots-Tag: noindex');readfile($file);return true;
    }
    if($path==='/stories/sitemap.xml'){
        header('Content-Type: application/xml; charset=UTF-8');echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'.BASE.'/stories/</loc></url>';
        foreach(stories_query("SELECT slug,updated_at FROM stories WHERE status='published' AND datetime(published_at)<=datetime(?)",[now()])->fetchAll() as $r)echo '<url><loc>'.BASE.'/stories/'.e($r['slug']).'/</loc><lastmod>'.e($r['updated_at']).'</lastmod></url>';echo '</urlset>';return true;
    }
    if($path==='/stories/feed.json'){
        $page=input($_GET,'page',500);if($page!==''&&!story_internal($page))fail('対象ページが見つかりません。',404);
        $rows=stories_query("SELECT title,summary,slug,cover,alt,related FROM stories WHERE status='published' AND datetime(published_at)<=datetime(?) ORDER BY featured DESC,datetime(published_at) DESC",[now()])->fetchAll();$out=[];
        foreach($rows as $r){$match=$page==='/'||$page==='';foreach(json_decode($r['related'],true)?:[] as $l)if(explode('#',$l['url'])[0]===explode('#',$page)[0])$match=true;
            if($match)$out[]=['title'=>$r['title'],'summary'=>$r['summary'],'url'=>'/stories/'.$r['slug'].'/','cover'=>$r['cover']?story_media_url($r['cover']):null,'alt'=>$r['alt']];if(count($out)===3)break;}
        header('Content-Type: application/json');echo json(['articles'=>$out]);return true;
    }
    if($path==='/stories/'){echo stories_index();return true;}
    if(preg_match('#^/stories/([a-z0-9-]+)/$#D',$path,$m)){
        $r=stories_query('SELECT * FROM stories WHERE slug=?',[$m[1]])->fetch();
        if(!$r){$r=stories_query('SELECT s.* FROM aliases a JOIN stories s ON a.story_id=s.id WHERE a.slug=?',[$m[1]])->fetch();if($r&&story_public($r)){header('Location: /stories/'.$r['slug'].'/',true,301);return true;}}
        if($r&&story_public($r)){echo story_detail($r);return true;}
    }
    http_response_code(404);header('X-Robots-Tag: noindex');echo stories_shell('記事が見つかりません','<h1>記事が見つかりません</h1><p>公開前または公開を終了した記事です。</p><a href="/stories/">読みもの一覧へ</a>','/stories/','',[],true);return true;
}
