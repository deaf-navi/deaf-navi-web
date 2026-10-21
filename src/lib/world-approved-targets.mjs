// Sends originals only to the existing authenticated Deaf Navi service, not to
// OpenAI. The actual generation repeats all allowance, privacy and budget checks.
export async function approvedWorldTargets(articles,{endpoint,headers,request,limit}){
  const selected=[];
  for(let offset=0;offset<articles.length&&selected.length<limit;offset+=600){
    const batch=articles.slice(offset,offset+600);
    const items=batch.map((article,i)=>({id:String(offset+i),topic:article.topicLabel,
      original_title:article.originalTitle,original_summary:article.originalSummary}));
    const response=await request(endpoint.replace(/\/generate$/,'/filter-approved'),{method:'POST',headers,body:JSON.stringify({items})});
    if(!response.ok)throw new Error('Approval preflight unavailable');
    const data=await response.json();
    if(data.success!==true||typeof data.accountReady!=='boolean'||!Array.isArray(data.approvedIds)
      ||new Set(data.approvedIds).size!==data.approvedIds.length||data.approvedIds.some(id=>!items.some(item=>item.id===id))
      ||!data.accountReady&&data.approvedIds.length)throw new Error('Invalid approval preflight');
    const allowed=new Set(data.approvedIds);
    selected.push(...batch.filter((_,i)=>allowed.has(String(offset+i))));
  }
  return selected.slice(0,limit);
}
