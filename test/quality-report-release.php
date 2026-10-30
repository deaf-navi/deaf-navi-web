<?php
declare(strict_types=1);
// Isolated fixtures: no authentication, database, or production filesystem access.
$root=sys_get_temp_dir().'/dn-quality-release-'.bin2hex(random_bytes(8));
$data=$root.'/shared/directory';mkdir($data,0700,true);mkdir($root.'/shared/publication-quality',0750);
$id1=str_repeat('a',40).'-123-1';$id2=str_repeat('b',40).'-124-1';
foreach([$id1,$id2,'unexpected-release'] as $id){$backend=$root.'/releases/'.$id.'/_backend';mkdir($backend,0750,true);foreach(['admin-dashboard.php','quality-overview.php'] as $file)copy(__DIR__.'/../server/'.$file,$backend.'/'.$file);}
$coverage=array_fill_keys(['time','fee','signup','deadline','communication'],['confirmed'=>0,'notApplicable'=>0,'unknown'=>0,'total'=>0]);
$base=['schemaVersion'=>'deafnavi-quality-report.v1','generatedAt'=>gmdate('c'),'range'=>['from'=>'2026-10-30','through'=>'2026-11-28'],'coverage'=>$coverage,'events'=>[],'holds'=>[],'classificationReview'=>[],'recheckDue'=>0];
$report=fn(string $id,int $count)=>$base+['deployment'=>['releaseId'=>$id,'sourceCommit'=>substr($id,0,40),'inputSha256'=>array_fill_keys(['events','domesticLedger','worldLedger','worldArticles'],str_repeat('c',64))],'resolvedReviews'=>array_fill(0,$count,['status'=>'excluded','title'=>'Fixture','reason'=>'unrelated'])];
$write=fn(string $id,array $value)=>file_put_contents($root.'/shared/publication-quality/'.$id.'.json',json_encode($value));
$render=function(string $id,bool $viaLink=false)use($root,$data):string {
 $code='function e(mixed $v):string{return htmlspecialchars((string)($v??""),ENT_QUOTES|ENT_SUBSTITUTE,"UTF-8");} function data_dir():string{return '.var_export($data,true).';} require '.var_export(($viaLink?$root.'/current':$root.'/releases/'.$id).'/_backend/admin-dashboard.php',true).'; echo admin_quality_overview();';
 $p=proc_open([PHP_BINARY,'-r',$code],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);fclose($pipes[0]);$html=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);if(proc_close($p)!==0)throw new RuntimeException($errors);return $html;
};
$checks=0;$ok=function(bool $value,string $message)use(&$checks):void {if(!$value)throw new RuntimeException($message);$checks++;};
try {
 file_put_contents($data.'/publication-quality-report.json',json_encode($report($id1,9)));
 $ok(str_contains($render($id1),'品質集計は未取得'),'missing companion must not use legacy report');
 $write($id1,$report($id2,3));$ok(str_contains($render($id1),'品質集計は未取得'),'wrong release must be rejected');
 $write($id1,$report($id1,2));$ok(str_contains($render($id1),'処理済みの確認記録（2件）'),'current release report');
 $write($id2,$report($id2,3));$ok(str_contains($render($id2),'処理済みの確認記録（3件）'),'next release report');
 $ok(str_contains($render($id1),'処理済みの確認記録（2件）'),'rollback selects matching retained report');
 $bad=$report($id1,4);$bad['deployment']['sourceCommit']=str_repeat('d',40);$write($id1,$bad);$ok(str_contains($render($id1),'品質集計は未取得'),'wrong source commit');
 $bad=$report($id1,4);$bad['deployment']['inputSha256']['events']='invalid';$write($id1,$bad);$ok(str_contains($render($id1),'品質集計は未取得'),'missing input provenance');
 $ok(str_contains($render('unexpected-release'),'品質集計は未取得'),'invalid production release must not use legacy report');
 require __DIR__.'/../server/quality-overview.php';
 $world=$root.'/world.json';file_put_contents($world,'{"articles":[]}');$valid=$report($id1,2);$valid['deployment']['inputSha256']['worldArticles']=hash_file('sha256',$world);
 $ok(admin_quality_release_report_valid($valid,$id1,$world),'valid staged World hash');file_put_contents($world,'{"articles":["changed"]}');
 $ok(!admin_quality_release_report_valid($valid,$id1,$world),'changed staged World hash stops activation');file_put_contents($world,'{"articles":[]}');
 $bad=$valid;$bad['coverage']['time']['total']=1;$write($id1,$bad);$ok(!admin_quality_release_report_valid($bad,$id1,$world),'bad body stops activation');$ok(str_contains($render($id1),'品質集計は未取得'),'bad body stops display');
 $symlinkChecks=0;
 if(PHP_OS_FAMILY!=='Windows'){
  $write($id1,$report($id1,2));symlink($root.'/releases/'.$id1,$root.'/current');$ok(str_contains($render($id1,true),'処理済みの確認記録（2件）'),'current symlink first release');$symlinkChecks++;
  unlink($root.'/current');symlink($root.'/releases/'.$id2,$root.'/current');$ok(str_contains($render($id2,true),'処理済みの確認記録（3件）'),'current symlink next release');$symlinkChecks++;
  unlink($root.'/current');symlink($root.'/releases/'.$id1,$root.'/current');$ok(str_contains($render($id1,true),'処理済みの確認記録（2件）'),'current symlink rollback');$symlinkChecks++;
 }
 echo json_encode(['qualityReleaseChecks'=>$checks,'symlinkChecks'=>$symlinkChecks,'failed'=>0]).PHP_EOL;
}finally{
 $iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($iterator as $file){if(!$file->isLink()&&$file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($root);
}
