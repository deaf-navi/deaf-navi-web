<?php
declare(strict_types=1);
// A deliberately small Markdown dialect. Raw HTML is always text, never executed.
function story_link_valid(string $url):bool {return str_starts_with($url,BASE.'/')||str_starts_with($url,'/')?story_internal($url):story_url($url);}
function story_invalid_links(string $body):array {
    preg_match_all('/(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)/u',$body,$matches,PREG_SET_ORDER);$out=[];
    foreach($matches as $m)if(!story_link_valid($m[2]))$out[]=$m[1].' ('.$m[2].')';
    return array_values(array_unique($out));
}
function story_link_warning(string $body):string {
    $links=story_invalid_links($body);return $links?'<div class="stories-notice" role="status"><strong>無効なリンク（未公開の記事など）</strong><ul>'.implode('',array_map(fn($l)=>'<li>'.e($l).'</li>',$links)).'</ul></div>':'';
}
function story_inline(string $text,int $depth=0):string {
    if($depth>3)return e($text);
    $pattern='/\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/u';
    $out='';$pos=0;preg_match_all($pattern,$text,$matches,PREG_SET_ORDER|PREG_OFFSET_CAPTURE);
    foreach($matches as $m){$out.=e(substr($text,$pos,$m[0][1]-$pos));$pos=$m[0][1]+strlen($m[0][0]);
        if(($m[1][0]??'')!==''){$url=$m[2][0];$out.=story_link_valid($url)?'<a href="'.e($url).'" rel="noopener noreferrer">'.e($m[1][0]).'</a>':e($m[1][0]);}
        elseif(($m[3][0]??'')!=='')$out.='<strong>'.story_inline($m[3][0],$depth+1).'</strong>';
        else $out.='<em>'.story_inline($m[4][0],$depth+1).'</em>';
    }return $out.e(substr($text,$pos));
}
function story_markdown(string $body):array {
    $lines=explode("\n",str_replace("\r",'',mb_substr($body,0,50000,'UTF-8')));$out='';$toc=[];$paragraph=[];$list='';$items=[];$heading=0;
    $flush=function()use(&$out,&$paragraph,&$list,&$items){if($paragraph){$text=implode("\n",array_map('trim',$paragraph));$text=preg_replace('/(?<=[\p{Han}\p{Hiragana}\p{Katakana}])\n(?=[\p{Han}\p{Hiragana}\p{Katakana}])/u','',$text);$out.='<p>'.story_inline(str_replace("\n",' ',$text)).'</p>';$paragraph=[];}if($items){$out.='<'.$list.'>'.implode('',$items).'</'.$list.'>';$list='';$items=[];}};
    foreach($lines as $line){
        if(trim($line)===''){$flush();continue;}
        if(preg_match('/^(#{2,3})\s+(.+)$/u',$line,$m)){$flush();$id='section-'.(++$heading);$level=strlen($m[1]);if($level===2)$toc[]=['id'=>$id,'title'=>$m[2],'level'=>$level];$out.='<h'.$level.' id="'.$id.'">'.story_inline($m[2]).'</h'.$level.'>';continue;}
        if(preg_match('#^!\[([^\]]+)\]\((/stories/media/[a-f0-9]{32}\.webp)(?: "([^"\n]*)")?\)$#u',$line,$m)){$flush();$out.='<figure><img src="'.e($m[2]).'" alt="'.e($m[1]).'" loading="lazy" decoding="async">'.(!empty($m[3])?'<figcaption>'.e($m[3]).'</figcaption>':'').'</figure>';continue;}
        if(preg_match('/^(?:([-*]) |(\d+)\. )(.+)$/u',$line,$m)){$type=$m[1]?'ul':'ol';if($paragraph||($list&&$list!==$type))$flush();$list=$type;$items[]='<li>'.story_inline($m[3]).'</li>';continue;}
        if(str_starts_with($line,'> ')){$flush();$out.='<blockquote><p>'.story_inline(substr($line,2)).'</p></blockquote>';continue;}
        if(trim($line)==='---'){$flush();$out.='<hr>';continue;}
        if($list)$flush();$paragraph[]=$line;
    }$flush();return ['html'=>$out,'toc'=>$toc];
}
function story_cards(array $rows):string {
    $out='<div class="stories-grid">';$cats=stories_categories();
    foreach($rows as $r){$out.='<article class="story-card">'.($r['cover']?'<a href="/stories/'.e($r['slug']).'/" tabindex="-1" aria-hidden="true"><img src="'.story_media_url($r['cover']).'" alt="" width="640" height="400" loading="lazy"></a>':'').'<p class="story-meta">'.e($cats[$r['category']]??'').' · <time datetime="'.e($r['published_at']).'">'.e(story_date($r['published_at'])).'</time></p><h3><a href="/stories/'.e($r['slug']).'/">'.e($r['title']).'</a></h3><p>'.e($r['summary']).'</p></article>';}
    return $out.'</div>';
}
function stories_shell(string $title,string $body,string $path,string $summary='',array $article=[],bool $private=false):string {
    $canonical=BASE.$path;$image=BASE.(!empty($article['cover'])?story_media_url($article['cover']):'/og-image.png');
    $crumbs=[['@type'=>'ListItem','position'=>1,'name'=>'ホーム','item'=>BASE.'/'],['@type'=>'ListItem','position'=>2,'name'=>'読みもの','item'=>BASE.'/stories/']];
    if($article)$crumbs[]=['@type'=>'ListItem','position'=>3,'name'=>$title,'item'=>$canonical];
    $schema=[['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>$crumbs]];
    if($article)$schema[]=['@context'=>'https://schema.org','@type'=>'Article','headline'=>$title,'citation'=>array_values(array_column(json_decode($article['sources'],true)?:[],'url')),'description'=>$summary,'image'=>$image,'datePublished'=>$article['published_at'],'dateModified'=>$article['updated_at'],'mainEntityOfPage'=>$canonical,'author'=>['@type'=>'Organization','name'=>$article['author']?:'Deaf Navi編集部'],'publisher'=>['@type'=>'Organization','name'=>'Deaf Navi']];
    $ld='';if(!$private)foreach($schema as $s)$ld.='<script type="application/ld+json">'.json_encode($s,JSON_HEX_TAG|JSON_UNESCAPED_UNICODE).'</script>';
    return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.e($title).' | Deaf Navi 読みもの</title><meta name="description" content="'.e($summary).'"><meta name="robots" content="'.($private?'noindex,nofollow':'index,follow').'"><link rel="canonical" href="'.e($canonical).'"><meta property="og:title" content="'.e($title).'"><meta property="og:description" content="'.e($summary).'"><meta property="og:type" content="'.($article?'article':'website').'"><meta property="og:url" content="'.e($canonical).'"><meta property="og:image" content="'.e($image).'"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/styles.css?v=20260909ui2"><link rel="stylesheet" href="/stories.css?v=20261019c">'.site_shell_head(true).$ld.'<script src="/access-visit.js" defer></script><script src="/stories.js" defer></script></head><body class="stories-page"><a class="skip-link" href="#main">本文へ</a>'.site_shell_header('stories').'<main id="main" class="stories-main"><nav aria-label="パンくず"><a href="/">ホーム</a> / <a href="/stories/">読みもの</a>'.($article?' / '.e($title):'').'</nav>'.$body.'</main><footer class="stories-footer"><a href="/stories/">読みもの</a> · <a href="/about.html">Deaf Naviについて</a><p>© '.date('Y').' TAMA.</p></footer></body></html>';
}
function stories_index():string {
    $q=input($_GET,'q',200);$cat=input($_GET,'category',64);$tag=input($_GET,'tag',100);$where=["status='published'","datetime(published_at)<=datetime(?)"];$args=[now()];
    if($q!==''){$where[]="(title LIKE ? ESCAPE '!' OR summary LIKE ? ESCAPE '!' OR body LIKE ? ESCAPE '!')";$s='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';$args=[...$args,$s,$s,$s];}
    if($cat!==''){$where[]='category=?';$args[]=$cat;}
    if($tag!==''){$where[]='EXISTS(SELECT 1 FROM json_each(tags) WHERE value=?)';$args[]=$tag;}
    $clause=implode(' AND ',$where);$total=(int)stories_query('SELECT COUNT(*) FROM stories WHERE '.$clause,$args)->fetchColumn();$pg=max(1,min((int)($_GET['page']??1),max(1,(int)ceil($total/12))));
    $rows=stories_query('SELECT * FROM stories WHERE '.$clause.' ORDER BY datetime(published_at) DESC,id LIMIT 12 OFFSET '.(($pg-1)*12),$args)->fetchAll();
    $intro='<header class="stories-intro"><h1>読みもの</h1><p class="stories-lead">知る、つながる、世界が広がる。</p><p>暮らしのヒントから、ろう文化、世界の動きまで。ニュースの背景を知り、自分の関心を深める記事をお届けします。</p></header>';
    $body=$intro.'<form class="stories-search" method="get"><label>キーワード<input type="search" name="q" value="'.e($q).'"></label><label>カテゴリ<select name="category"><option value="">すべて</option>';
    foreach(stories_categories() as $id=>$label)$body.='<option value="'.e($id).'"'.($cat===$id?' selected':'').'>'.e($label).'</option>';
    $body.='</select></label>'.($tag?'<input type="hidden" name="tag" value="'.e($tag).'">':'').'<button>探す</button><a href="/stories/">条件を解除</a></form>';
    if($tag)$body.='<p>タグ：'.e($tag).'</p>';
    if(!$q&&!$cat&&!$tag&&$pg===1&&$total>3){$featured=stories_query("SELECT * FROM stories WHERE status='published' AND datetime(published_at)<=datetime(?) AND featured=1 ORDER BY datetime(published_at) DESC LIMIT 3",[now()])->fetchAll();if($featured)$body.='<section><h2>おすすめの読みもの</h2>'.story_cards($featured).'</section>';}
    $body.='<section><h2>'.(($q||$cat||$tag)?'検索結果':'新着の読みもの').'</h2><p>'.$total.'件</p>';
    if($rows)$body.=story_cards($rows);else $body.='<p>'.(($q||$cat||$tag)?'条件に合う記事はありません。条件を変えてお試しください。':'記事の公開を準備しています。それまで、ニュースや手話カフェの情報をご覧ください。').'</p><p><a href="/">ニュースへ</a> · <a href="/connect/sign-cafe/">手話カフェを探す</a></p>';
    $body.='</section><nav class="stories-pager" aria-label="記事一覧のページ">';foreach([$pg-1=>'前のページ',$pg+1=>'次のページ'] as $n=>$label)if($n>=1&&$n<=ceil($total/12))$body.='<a href="/stories/?'.e(http_build_query(['q'=>$q,'category'=>$cat,'tag'=>$tag,'page'=>$n])).'">'.$label.'</a> ';
    return stories_shell('読みもの',$body.'</nav>','/stories/','暮らし・制度、ろう文化・交流、世界・テクノロジーを深く知る、Deaf Naviの編集記事。');
}
function story_detail(array $r,bool $preview=false):string {
    $render=story_markdown($r['body']);$cats=stories_categories();$body=$preview?'<p class="stories-notice">管理者プレビューです。公開状態：'.e($r['status']).'</p>':'';
    $body.=($preview?story_link_warning($r['body']):'').'<article class="story-body"><header><p><a href="/stories/?category='.e($r['category']).'">'.e($cats[$r['category']]??'').'</a></p><h1>'.e($r['title']).'</h1><p class="story-meta">'.($r['published_at']?'公開 '.e(story_date($r['published_at'])).' · ':'').'更新 '.e(story_date($r['updated_at'])).($r['author']?' · '.e($r['author']):'').'</p><p class="stories-lead">'.e($r['summary']).'</p>'.($r['cover']?'<img class="story-cover" src="'.story_media_url($r['cover']).'" alt="'.e($r['alt']).'" width="1440" height="900">':'').'</header>';
    if(count($render['toc'])>=2){$body.='<nav class="story-toc" aria-label="目次"><h2>目次</h2><ol>';foreach($render['toc'] as $t)$body.='<li><a href="#'.$t['id'].'">'.e($t['title']).'</a></li>';$body.='</ol></nav>';}
    $body.='<div class="story-prose">'.$render['html'].'</div>';
    foreach(['sources'=>'参考資料・出典','related'=>'関連するDeaf Naviの情報'] as $key=>$heading){$links=json_decode($r[$key],true)?:[];$valid=array_filter($links,fn($l)=>$key==='related'?story_internal($l['url']):story_url($l['url']));if($valid){$body.='<section><h2>'.$heading.'</h2><ul>';foreach($valid as $l)$body.='<li><a href="'.e($l['url']).'" rel="noopener noreferrer">'.e($l['label']).'</a></li>';$body.='</ul></section>';}}
    if($r['checked_at'])$body.='<p>情報確認日：'.e($r['checked_at']).'</p>';
    $body.='<nav class="story-tags" aria-label="タグ">';foreach(json_decode($r['tags'],true)?:[] as $tag)$body.='<a href="/stories/?tag='.rawurlencode($tag).'">'.e($tag).'</a> ';$body.='</nav>';
    if(!$preview){$url=BASE.'/stories/'.$r['slug'].'/';$body.='<div class="story-share"><button type="button" data-story-share data-url="'.e($url).'">この記事を共有</button> <a href="https://x.com/intent/post?url='.rawurlencode($url).'&text='.rawurlencode($r['title']).'" rel="noopener noreferrer" target="_blank">Xで共有</a><span role="status" data-share-status></span></div>';}
    $body.='</article>';$others=stories_query("SELECT * FROM stories WHERE status='published' AND datetime(published_at)<=datetime(?) AND category=? AND id!=? ORDER BY datetime(published_at) DESC LIMIT 3",[now(),$r['category'],$r['id']])->fetchAll();if($others)$body.='<section><h2>同じカテゴリの読みもの</h2>'.story_cards($others).'</section>';
    return stories_shell($r['title'],$body.'<p><a href="/stories/">読みもの一覧へ戻る</a></p>','/stories/'.$r['slug'].'/',$r['summary'],$r,$preview);
}
