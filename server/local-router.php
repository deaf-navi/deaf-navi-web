<?php
// For isolated local testing only; never routed publicly on XServer.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
foreach(json_decode(file_get_contents(__DIR__.'/entry-redirects.json'),true) as $entry){
    if(in_array($path,[rtrim($entry['from'],'/'),$entry['from'],$entry['from'].'index.html'],true)){
        $query=str_replace(["\r","\n"],'',$_SERVER['QUERY_STRING']??'');
        header('Location: '.$entry['to'].($query!==''?'?'.$query:''),true,301);return;
    }
}
if($path==='/_access/visit'){require __DIR__.'/index.php';return;}
if($path==='/directory.css'){header('Content-Type: text/css');readfile(__DIR__.'/../src/assets/directory.css');return;}
if($path==='/directory-ui.js'){header('Content-Type: application/javascript');readfile(__DIR__.'/../src/assets/directory-ui.js');return;}
if(preg_match('#^/(admin(?:/|$)|submit(?:/|$)|connect/sign-cafe(?:/|$)|directory-sitemap\.xml$)#',$path)){require __DIR__.'/index.php';return;}
return false;
