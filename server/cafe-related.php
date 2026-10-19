<?php
declare(strict_types=1);
function cafe_related_news():string {
    $root=getenv('DEAFNAVI_LOCAL_TEST')==='1'?__DIR__.'/../docs':'/srv/deafnavi/current';
    $file=$root.'/cafe-related.json';
    if(!is_file($file)||filesize($file)>32768)return '';
    $data=json_decode(file_get_contents($file),true);$items=[];
    foreach(($data['articles']??[]) as $item){
        if(!is_string($item['title']??null)||!is_string($item['publishedAt']??null))continue;
        $ts=strtotime($item['publishedAt']);if(!$ts||$ts>time()||time()-$ts>14*86400)continue;
        $day=(new DateTimeImmutable('@'.$ts))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d');
        $items[]='<li><time datetime="'.e($day).'">'.e(str_replace('-','/',$day)).'</time><a href="/?q='.rawurlencode($item['title']).'#articles">'.e($item['title']).'</a></li>';
        if(count($items)===2)break;
    }
    if(!$items)return '';
    return '<section class="dn-related-news" data-cafe-related aria-labelledby="cafe-related-heading"><h2 id="cafe-related-heading">手話・ろう文化の最近の話題</h2><p>気になる話題を、ニュース一覧で読んでみませんか。</p><ul>'.implode('',$items).'</ul><a class="dn-related-more" href="/#articles">ニュースをすべて見る</a></section>';
}
