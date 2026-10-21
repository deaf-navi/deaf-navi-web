document.querySelectorAll('[data-story-sharing]').forEach(section=>{
  const status=section.querySelector('[data-share-status]');
  const instagram=section.querySelector('[data-instagram-help]');
  const link=section.querySelector('[data-share-link]');
  const showManualCopy=(message='自動コピーができませんでした。選択されたリンクを手動でコピーしてください。')=>{
    instagram.open=true;
    link.focus();
    link.select();
    status.textContent=message;
  };
  const copy=async()=>{
    status.textContent='';
    try{
      await navigator.clipboard.writeText(link.value);
      status.textContent='リンクをコピーしました。';
    }catch{showManualCopy();}
  };
  section.querySelector('[data-story-copy]')?.addEventListener('click',copy);
  section.querySelector('[data-story-share]')?.addEventListener('click',async()=>{
    status.textContent='';
    if(!navigator.share){await copy();return;}
    try{await navigator.share({title:section.dataset.title,url:link.value});}
    catch(err){if(err.name!=='AbortError')showManualCopy('共有画面を開けませんでした。選択されたリンクを手動でコピーしてください。');}
  });
});
