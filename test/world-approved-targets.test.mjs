import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedWorldTargets} from '../src/lib/world-approved-targets.mjs';
test('approved World items beyond the old 50-item cap are reached without generating unapproved batches',async()=>{
 const articles=Array.from({length:90},(_,i)=>({originalTitle:'Title '+i,originalSummary:'Summary',topicLabel:'文化'}));let calls=0;
 const result=await approvedWorldTargets(articles,{endpoint:'https://service.example/generate',headers:{},limit:50,request:async(url,options)=>{
  calls++;assert.equal(url,'https://service.example/filter-approved');assert.equal(JSON.parse(options.body).items.length,90);
  return Response.json({success:true,accountReady:true,approvedIds:['70','80'],generationRequests:0});
 }});assert.deepEqual(result,[articles[70],articles[80]]);assert.equal(calls,1);
});
test('missing account check yields no targets and malformed responses stop processing',async()=>{
 const articles=[{originalTitle:'A',originalSummary:'B'}],opts={endpoint:'https://service.example/generate',headers:{},limit:50};
 assert.deepEqual(await approvedWorldTargets(articles,{...opts,request:async()=>Response.json({success:true,accountReady:false,approvedIds:[]})}),[]);
 for(const data of [{success:true,accountReady:true,approvedIds:['unknown']},{success:true,accountReady:false,approvedIds:['0']},{success:true,accountReady:true,approvedIds:['0','0']}]){
  await assert.rejects(approvedWorldTargets(articles,{...opts,request:async()=>Response.json(data)}),/Invalid/);
 }
});
