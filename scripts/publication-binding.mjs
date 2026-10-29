const sha=value=>/^[a-f0-9]{64}$/.test(value??'');

// Full hashes remain the audit trail. A versioned comparison binding is enrolled
// only while that exact full record still matches the inspected baseline.
export function publicationBindingMatches(record,target){
 if(!sha(record?.publicationHash)||!sha(target?.publicationHash))return false;
 if(record.publicationHash===target.publicationHash)return true;
 const b=target.comparisonBinding;
 return b?.version===1&&record.comparisonVersion===1&&b.publicationHash===target.publicationHash
  &&sha(b.comparisonHash)&&record.comparisonHash===b.comparisonHash;
}
export function enrollComparisonBindings(catalog,{lodging,overseas},now=Date.now()){
 const next=structuredClone(catalog),enrolled=[],skipped=[];
 for(const [field,snapshot] of [['lodgingTargets',lodging],['overseasCafeTargets',overseas]]){
  const records=new Map((snapshot?.records??[]).map(r=>[r.id,r]));
  for(const t of next[field]??[]){
   if(field==='overseasCafeTargets'&&t.role!=='published')continue;
   const r=records.get(t.facilityId);
   if(!r||r.publicationHash!==t.publicationHash||!sha(r.publicationHash)||r.comparisonVersion!==1||!sha(r.comparisonHash)||!r.sourceUrls.includes(t.sourceUrl)){
    skipped.push(t.recordId);continue;
   }
   const b={version:1,publicationHash:t.publicationHash,comparisonHash:r.comparisonHash};
   if(!t.comparisonBinding||Object.entries(b).some(([k,v])=>t.comparisonBinding[k]!==v)){
    t.comparisonBinding={...b,enrolledAt:new Date(now).toISOString()};enrolled.push(t.recordId);
   }
  }
 }
 return {catalog:next,enrolled,skipped};
}
