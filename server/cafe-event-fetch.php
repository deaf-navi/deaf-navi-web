<?php
declare(strict_types=1);
// Only the CLI source checker fetches URLs. A validated DNS result is pinned for
// every redirect; private addresses and credentials are never requested.
function cafe_event_fetch_target(string $url):?array {
    $p=parse_url($url);
    if(!$p||($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||(isset($p['port'])&&$p['port']!==443))return null;
    $host=strtolower($p['host']??'');
    if(!preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/D',$host)||preg_match('/\.(?:localhost|local|internal|test|invalid)$/D',$host)||strlen($url)>2000||preg_match('/[\s<>"\x00-\x1f]/u',$url))return null;
    return ['host'=>$host,'url'=>$url];
}
function cafe_event_public_ips(array $ips):bool {
    if(!$ips)return false;
    foreach($ips as $ip)if(!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4|FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)||str_starts_with($ip,'100.64.')||((int)explode('.',$ip)[0]===100&&(int)explode('.',$ip)[1]>=64&&(int)explode('.',$ip)[1]<=127))return false;
    return true;
}
function cafe_event_redirect(string $base,string $location):string {
    $location=trim($location);if($location===''||preg_match('/[\x00-\x20]/',$location))return '';
    if(str_starts_with($location,'https://'))return $location;
    if(str_starts_with($location,'//'))return 'https:'.$location;
    if(preg_match('/^[a-z][a-z0-9+.-]*:/i',$location))return '';
    $p=parse_url($base);$origin='https://'.$p['host'];
    if(str_starts_with($location,'/'))return $origin.$location;
    if(str_starts_with($location,'?'))return $origin.($p['path']??'/').$location;
    return $origin.preg_replace('#[^/]*$#','',$p['path']??'/').$location;
}
function cafe_event_fingerprint(string $body,string $type):?string {
    if(str_contains($type,'pdf'))return str_starts_with($body,'%PDF-')?hash('sha256',$body):null;
    if(!str_contains($type,'html')&&!str_contains($type,'text/plain')&&!str_contains($type,'xml'))return null;
    if(!preg_match('//u',$body)){
        $encoding='';if(preg_match('/charset\s*=\s*["\']?([a-z0-9_-]+)/i',$type.' '.substr($body,0,2000),$match))$encoding=strtolower($match[1]);
        $encodings=['shift_jis'=>'CP932','shift-jis'=>'CP932','sjis'=>'CP932','windows-31j'=>'CP932','cp932'=>'CP932','euc-jp'=>'EUC-JP','iso-2022-jp'=>'ISO-2022-JP'];
        if(!isset($encodings[$encoding])||!function_exists('iconv'))return null;
        $converted=iconv($encodings[$encoding],'UTF-8//IGNORE',$body);if($converted===false)return null;$body=$converted;
    }
    $text=preg_replace('#<(script|style|form|nav|header|footer)\b[^>]*>.*?</\1>#is','',$body);
    $text=html_entity_decode(strip_tags($text),ENT_QUOTES|ENT_HTML5,'UTF-8');
    $text=preg_replace('/[\s\p{Z}]+/u',' ',trim($text));
    if($text===null||strlen($text)<100)return null;
    return hash('sha256',$text);
}
function cafe_event_http(array $target,string $ip):array {
    // Production already supplies the curl executable, but not the PHP cURL
    // extension. Argument arrays avoid a shell; private temporary files are
    // removed after each bounded request, including failures.
    if(!function_exists('curl_init')){
        if(!function_exists('proc_open'))throw new RuntimeException('No supported HTTP fetcher');
        $headerFile=tempnam(data_dir(),'.cafe-source-header-');
        if(!$headerFile)throw new RuntimeException('Cannot prepare source request');
        chmod($headerFile,0600);
        try {
            $binary=PHP_OS_FAMILY==='Windows'?'C:\\Windows\\System32\\curl.exe':'/usr/bin/curl';
            $args=[$binary,'--silent','--show-error','--max-filesize','2500000','--connect-timeout','8','--max-time','20','--proxy','','--proto','=https','--resolve',$target['host'].':443:'.$ip,'--user-agent','DeafNavi-Cafe-SourceCheck/1.0 (+https://deafnavi.com/connect/sign-cafe/events/)','--output','-','--dump-header',$headerFile,'--url',$target['url']];
            $process=proc_open($args,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
            if(!is_resource($process))throw new RuntimeException('Cannot start source request');
            fclose($pipes[0]);stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);$body='';$bounded=true;$deadline=microtime(true)+25;
            while(!feof($pipes[1])||!feof($pipes[2])){
                $chunk=fread($pipes[1],16384);if($chunk!==false)$body.=$chunk;fread($pipes[2],16384);
                if(strlen($body)>2500000||microtime(true)>$deadline){$bounded=false;proc_terminate($process);break;}
                usleep(10000);
            }
            fclose($pipes[1]);fclose($pipes[2]);$code=proc_close($process);
            $headers=file_get_contents($headerFile,false,null,0,150000);$location='';$type='';$status=0;
            foreach(explode("\n",$headers) as $header){if(preg_match('#^HTTP/\S+\s+(\d{3})#',$header,$match))$status=(int)$match[1];if(stripos($header,'Location:')===0)$location=trim(substr($header,9));if(stripos($header,'Content-Type:')===0)$type=strtolower(trim(substr($header,13)));}
            return ['ok'=>$code===0&&$bounded,'status'=>$status,'body'=>$bounded?$body:'','location'=>$location,'type'=>$type];
        }finally{if(is_file($headerFile))unlink($headerFile);}
    }
    $body='';$location='';$type='';$c=curl_init($target['url']);
    curl_setopt_array($c,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>20,CURLOPT_PROXY=>'',CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_RESOLVE=>[$target['host'].':443:'.$ip],CURLOPT_USERAGENT=>'DeafNavi-Cafe-SourceCheck/1.0 (+https://deafnavi.com/connect/sign-cafe/events/)',CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_WRITEFUNCTION=>function($c,$chunk)use(&$body){if(strlen($body)+strlen($chunk)>2500000)return 0;$body.=$chunk;return strlen($chunk);},
        CURLOPT_HEADERFUNCTION=>function($c,$header)use(&$location,&$type){if(stripos($header,'Location:')===0)$location=trim(substr($header,9));if(stripos($header,'Content-Type:')===0)$type=strtolower(trim(substr($header,13)));return strlen($header);}
    ]);
    $ok=curl_exec($c);$status=(int)curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);
    return ['ok'=>$ok!==false,'status'=>$status,'body'=>$body,'location'=>$location,'type'=>$type];
}
function cafe_event_fetch(string $url):array {
    $out=['result'=>'unavailable','http_status'=>null,'fingerprint'=>null];
    for($hop=0;$hop<5;$hop++){
        $target=cafe_event_fetch_target($url);if(!$target)return array_replace($out,['result'=>'manual_check']);
        if(preg_match('/(^|\.)(instagram\.com|facebook\.com|x\.com|twitter\.com)$/D',$target['host']))return array_replace($out,['result'=>'manual_check']);
        $ips=gethostbynamel($target['host']);if(!cafe_event_public_ips($ips?:[]))return array_replace($out,['result'=>'blocked_target']);
        $response=cafe_event_http($target,$ips[0]);$out['http_status']=$response['status']?:null;
        if(!$response['ok'])return $out;
        if($response['status']>=300&&$response['status']<400){$url=cafe_event_redirect($url,$response['location']);continue;}
        if($response['status']!==200)return $out;
        $fingerprint=cafe_event_fingerprint($response['body'],$response['type']);
        return array_replace($out,['result'=>$fingerprint?'fetched':'manual_check','fingerprint'=>$fingerprint]);
    }
    return $out;
}
