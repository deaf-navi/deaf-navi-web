<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
if($argc!==1){fwrite(STDERR,"No arguments supported\n");exit(1);}
// No private memo, contact, account, deleted/private record or mutation is exported.
$out=[];
foreach(query("SELECT * FROM records WHERE kind IN ('cafe','store') AND publication='public' AND country_code<>'' AND country_code<>'JP' ORDER BY id")->fetchAll() as $r){
 $p=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
 $urls=array_values(array_unique(array_filter(array_merge([$p['official_url']??''],$p['verification_sources']??[]),fn($u)=>is_string($u)&&str_starts_with($u,'https://'))));
 $out[]=['id'=>$r['id'],'countryCode'=>$r['country_code'],'revision'=>(int)$r['revision'],'publicationHash'=>hash('sha256',$r['payload']),'sourceUrls'=>$urls];
}
echo json(['version'=>1,'records'=>$out])."\n";
