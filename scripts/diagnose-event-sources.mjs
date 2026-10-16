// Temporary, read-only comparison in the same runner as scheduled curation.
import {lookup} from 'node:dns/promises';
import {spawn} from 'node:child_process';
import {createEventSourceFetcher} from '../src/lib/event-source-fetch.mjs';
import https from 'node:https';
const urls=['https://www.oioi-sign.com/events_list/','https://fureailand.jp/events/8898'];
console.log(JSON.stringify({node:process.version}));
await Promise.all(urls.map(async url=>{
 console.log(JSON.stringify({url,dns:await lookup(new URL(url).hostname,{all:true})}));
 const start=Date.now();try{const text=await createEventSourceFetcher()(url);console.log(JSON.stringify({url,client:'current',ok:true,elapsedMs:Date.now()-start,bytes:Buffer.byteLength(text)}));}catch(e){console.log(JSON.stringify({url,client:'current',ok:false,elapsedMs:Date.now()-start,code:e.code,message:e.message}));}
 await new Promise(resolve=>{let output='';const child=spawn('curl',['--silent','--show-error','--connect-timeout','10','--max-time','30','--max-filesize','1800000','--user-agent','DeafNaviWeb-Events/1.0 (+https://deafnavi.com/)','--output','/dev/null','--write-out','status=%{http_code} remote=%{remote_ip} tcp=%{time_connect} tls=%{time_appconnect} first=%{time_starttransfer} total=%{time_total}',url]);child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('exit',code=>{console.log(JSON.stringify({url,client:'curl',code,output}));resolve();});});
 await new Promise(resolve=>{const started=Date.now(),stages=[];const request=https.get(url,{agent:false,signal:AbortSignal.timeout(15000),headers:{'User-Agent':'DeafNaviWeb-Events/1.0 (+https://deafnavi.com/)','Accept':'text/html,application/xhtml+xml,application/json;q=0.8'}},response=>{stages.push(['response',response.statusCode,Date.now()-started]);response.resume();response.on('end',()=>{console.log(JSON.stringify({url,client:'node-default',stages,ok:true}));resolve()});});request.on('socket',socket=>{socket.on('connect',()=>stages.push(['connect',Date.now()-started]));socket.on('secureConnect',()=>stages.push(['tls',Date.now()-started]));});request.on('error',e=>{console.log(JSON.stringify({url,client:'node-default',stages,ok:false,code:e.code,message:e.message}));resolve();});});
}));
