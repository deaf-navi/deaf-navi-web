import {readFileSync} from 'node:fs';
const policy=JSON.parse(readFileSync(new URL('../../server/public-copy-rules.json',import.meta.url),'utf8'));
const rules=policy.rules.map(rule=>({...rule,re:new RegExp(rule.pattern,'iu')}));
// Inspect only reader-facing fields. Evidence, review notes and dates stay private
// and are never rewritten. Findings contain field/rule IDs, never submitted text.
export function publicCopyIssues(record,kind){
 const fields=policy.fields[kind];if(!fields)throw Error('Unknown public copy kind');
 const issues=[];
 function visit(value,path){
  if(typeof value==='string'){
   const text=value.normalize('NFKC').replace(/[\s\p{Z}\p{Cf}]/gu,'');
   for(const rule of rules)if(rule.re.test(text))issues.push({field:path,rule:rule.id});
  }else if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${path}.${i}`));
  else if(value&&typeof value==='object')for(const key of ['title','description','label','detail'])if(Object.hasOwn(value,key))visit(value[key],`${path}.${key}`);
 }
 for(const field of fields)visit(record?.[field],field);
 return issues;
}
export function assertPublicCopy(records,kind){
 for(const [index,record] of records.entries()){
  const issues=publicCopyIssues(record,kind);
  if(issues.length)throw Error(`PUBLIC_COPY_REVIEW_REQUIRED ${kind}[${index}] ${issues.map(x=>x.field+':'+x.rule).join(', ')}`);
 }
}
