document.querySelector('[data-story-share]')?.addEventListener('click',async e=>{
  const url=e.currentTarget.dataset.url,status=document.querySelector('[data-share-status]');
  try{if(navigator.share)await navigator.share({title:document.title,url});else {await navigator.clipboard.writeText(url);status.textContent='リンクをコピーしました。';}}catch(err){if(err.name!=='AbortError')status.textContent='共有できませんでした。アドレス欄のURLをコピーしてください。';}
});
