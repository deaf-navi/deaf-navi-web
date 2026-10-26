<?php
declare(strict_types=1);
require __DIR__.'/../server/public-copy.php';
$fixtures=json_decode(preg_replace('/^\xEF\xBB\xBF/','',file_get_contents(__DIR__.'/public-copy-fixtures.json')),true,512,JSON_THROW_ON_ERROR);
foreach($fixtures as $f){if((bool)public_copy_issues(['text'=>$f['text']],'text')!==$f['blocked'])throw new Exception('Fixture mismatch');}
if(public_copy_issues(['notes'=>'料金は要確認。','review_notes'=>'本文hash変更']))throw new Exception('Private notes inspected');
try{assert_public_copy(['notes'=>'内部向けの調査メモ']);throw new RuntimeException('Missing gate');}catch(DomainException $e){}
echo "Public copy PHP fixtures passed\n";
