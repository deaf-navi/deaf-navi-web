<?php
declare(strict_types=1);
function public_copy_issues(array $record,string $kind='cafe'):array {
 static $policy=null;
 $policy??=json_decode(file_get_contents(__DIR__.'/public-copy-rules.json'),true,512,JSON_THROW_ON_ERROR);
 if(!isset($policy['fields'][$kind]))throw new DomainException('Unknown public copy kind');
 $issues=[];
 $visit=function($value,string $path)use(&$visit,&$issues,$policy):void {
  if(is_string($value)){
   $text=mb_convert_kana($value,'asKV','UTF-8');
   $text=preg_replace('/[\s\p{Z}\p{Cf}]+/u','',$text);
   foreach($policy['rules'] as $rule)if(preg_match('~'.$rule['pattern'].'~iu',$text))$issues[]=['field'=>$path,'rule'=>$rule['id']];
  }elseif(is_array($value)){
   if(array_is_list($value))foreach($value as $i=>$v)$visit($v,$path.'.'.$i);
   else foreach(['title','description','label','detail'] as $key)if(array_key_exists($key,$value))$visit($value[$key],$path.'.'.$key);
  }
 };
 foreach($policy['fields'][$kind] as $field)$visit($record[$field]??null,$field);
 return $issues;
}
function assert_public_copy(array $record):void {
 $issues=public_copy_issues($record);
 if($issues)throw new DomainException('公開文に内部向けの調査メモが含まれています。参加者向けに書き直し、調査経緯は管理用メモへ残してください。対象: '.implode(', ',array_column($issues,'field')));
}
