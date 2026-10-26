<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';require __DIR__.'/event-tip-review.php';umask(0077);
try {
 $mode=$argv[1]??'';if($mode==='--export'){echo json(event_tip_export());exit;}
 if(!in_array($mode,['--dry-run','--apply'],true))fail('Unsupported queue mode');
 $bytes=stream_get_contents(STDIN,100001);if(strlen($bytes)>100000)fail('Oversized decision');$d=json_decode($bytes,true,512,JSON_THROW_ON_ERROR);
 // Plan excludes its own supplied digest.
 $plan=$d['planSha256']??null;unset($d['planSha256']);
 db()->exec('BEGIN IMMEDIATE');
 try{
  $preview=event_tip_decision($d,false);
  if($mode==='--apply'){
   if($preview['status']==='ready'&&!hash_equals($preview['planSha256'],$plan??''))fail('Plan changed');
   // event_tip_decision hashes the original decision without planSha256.
   $GLOBALS['event_tip_approved_plan']=$plan;
   $result=event_tip_decision($d,true);db()->exec('COMMIT');
  }else{$result=$preview;db()->exec('ROLLBACK');}
  echo json($result)."\n";
 }catch(Throwable $e){db()->exec('ROLLBACK');throw $e;}
}catch(Throwable $e){fwrite(STDERR,'EVENT_TIP_QUEUE_FAILED: '.($e instanceof DomainException?$e->getMessage():'private state requires review')."\n");exit(1);}
