import {readdir,readFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {publicCopyIssues} from '../src/lib/public-copy.mjs';
import {decodeEntities} from '../src/lib/text.mjs';
export function htmlCopyIssues(html){
 const text=decodeEntities(html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]+>/g,''));
 return publicCopyIssues({text},'text');
}
export async function verifyPublicCopy(root='docs'){
 let checked=0;const failures=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())await walk(path);
  else if(entry.isFile()&&entry.name.endsWith('.html')){checked++;const issues=htmlCopyIssues(await readFile(path,'utf8'));if(issues.length)failures.push({file:relative(root,path),rules:[...new Set(issues.map(x=>x.rule))]});}
 }}
 await walk(root);
 if(failures.length)throw Error('PUBLIC_COPY_REVIEW_REQUIRED '+JSON.stringify(failures));
 return {checked};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await verifyPublicCopy()));
