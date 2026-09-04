<?php
// For isolated local testing only; never routed publicly on XServer.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/directory.css'){header('Content-Type: text/css');readfile(__DIR__.'/../src/assets/directory.css');return;}
if(preg_match('#^/(admin(?:/|$)|submit(?:/|$)|connect/sign-cafe(?:/|$)|directory-sitemap\.xml$)#',$path)){require __DIR__.'/index.php';return;}
return false;
