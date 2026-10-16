(()=>{
 const article=document.querySelector('[data-event-detail]');if(!article)return;
 function update(){
  const d=article.dataset,now=Date.now(),today=new Date(now+9*3600000).toISOString().slice(0,10),verified=Date.parse(d.verified);
  const past=d.end<today,stale=d.verification!=='verified'||!Number.isFinite(verified)||verified>now||now-verified>=Number(d.recheckMs);
  const state=d.status==='cancelled'?'cancelled':past?'past':stale?'review':d.status==='closed'?'closed':'upcoming';
  const copy={cancelled:['中止の告知','主催者による中止の告知があります。最新の案内をご確認ください。'],past:['過去の開催告知','日程を過ぎた告知の記録です。開催の実施や次回の日程を示すものではありません。'],review:['再確認中','情報の再確認が必要なため、開催予定としての案内を停止しています。以下は前回確認時の情報です。最新の告知をご確認ください。'],closed:['受付終了の告知','申込受付が終了した旨の告知があります。追加募集などは公式案内をご確認ください。'],upcoming:['開催予定','日時・参加条件は変更される場合があります。申込・お出かけ前に公式案内をご確認ください。']}[state];
  article.querySelector('[data-detail-status]').textContent=copy[0];article.querySelector('[data-detail-notice]').textContent=copy[1];
  if(['review','past','cancelled'].includes(state))for(const el of document.querySelectorAll('script[type="application/ld+json"]')){
   try{const data=JSON.parse(el.textContent);if(Array.isArray(data))el.textContent=JSON.stringify(data.filter(item=>item['@type']!=='Event'));}catch{}
  }
  const retryNote=article.querySelector('[data-source-retry]');if(retryNote)retryNote.hidden=state==='past'||state==='cancelled';
  if(state==='review')document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,follow');
 }
 update();document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});setInterval(()=>{if(!document.hidden)update()},60000);
})();
