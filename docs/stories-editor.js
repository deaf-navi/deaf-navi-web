(() => {
  const form=document.querySelector('[data-story-editor]');if(!form)return;
  const body=form.elements.body,status=form.querySelector('[data-save-status]');let dirty=false,saving=false,previewTimer,previewSequence=0;
  const limited=[...form.querySelectorAll('[name][maxlength]')].map(el=>{const limit=el.maxLength;el.removeAttribute('maxlength');return {el,limit};});
  const counts=()=>limited.forEach(({el,limit})=>{const length=Array.from(el.value).length;el.setCustomValidity(length>limit?`${limit}文字以内で入力してください。`:'');const output=form.querySelector(`[data-count="${el.name}"]`);if(output)output.textContent=`残り ${limit-length}文字（${length} / ${limit}）`;});
  form.addEventListener('input',counts);counts();
  let slugTimer,slugSequence=0;
  form.elements.slug.addEventListener('input',()=>{clearTimeout(slugTimer);const sequence=++slugSequence;const output=form.querySelector('[data-slug-status]');output.textContent='確認中…';slugTimer=setTimeout(async()=>{const data=new FormData();data.set('csrf',form.elements.csrf.value);data.set('action','slug');data.set('slug',form.elements.slug.value);data.set('id',form.elements.id.value);try{const result=await(await request(data)).json();if(sequence===slugSequence)output.textContent=result.used?'このURLは使用済みです（別記事・旧URL）。':'このURLは使用されていません。保存時に再確認します。';}catch{if(sequence===slugSequence)output.textContent='使用状況を確認できません。保存時に確認します。';}},500);});
  const storageKey=form.dataset.storageKey,storageStatus=form.querySelector('[data-storage-status]'),recovery=form.querySelector('[data-recovery]');
  const names=['title','slug','summary','body','category','tags','author','cover','alt','sources','related','checked_at','status','featured','published_at'];
  let storageTimer,invalidLinks=[],linksChecked=false;
  function checks(){const warnings=[],summaryLength=Array.from(form.elements.summary.value).length;
    if(summaryLength<40||summaryLength>160)warnings.push(`概要は${summaryLength}文字です。目安は40〜160文字です。`);
    if(Array.from(body.value).length>3000&&!/^#{2,3}\s+\S/m.test(body.value))warnings.push('3000文字を超える本文に見出しがありません。');
    if(!form.elements.cover.value)warnings.push('カバー画像がありません。');
    if(!linksChecked)warnings.push('内部リンクは本文プレビュー時に確認します。');
    invalidLinks.forEach(link=>warnings.push('無効なリンク（未公開の記事など）：'+link));
    const list=form.querySelector('[data-check-list]');list.replaceChildren();(warnings.length?warnings:['目安に関する警告はありません。']).forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});
  }
  const snapshot=()=>Object.fromEntries(names.map(name=>[name,form.elements[name].type==='checkbox'?form.elements[name].checked:form.elements[name].value]));
  function preserve(){try{localStorage.setItem(storageKey,JSON.stringify({values:snapshot(),revision:form.elements.revision.value,savedAt:Date.now()}));storageStatus.textContent='入力をこのブラウザに退避しました（記事は未保存）。';}catch{storageStatus.textContent='このブラウザには退避できません。必要な入力をコピーして保管してください。';}}
  const changed=()=>{dirty=true;status.textContent='未保存の変更があります';counts();checks();clearTimeout(storageTimer);storageTimer=setTimeout(preserve,400);};form.addEventListener('input',changed);form.addEventListener('change',changed);
  // Never replace current server data automatically, especially across revisions.
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&saved.values&&typeof saved.savedAt==='number'){
    recovery.hidden=false;form.querySelector('[data-recovery-message]').textContent='このブラウザに退避した入力があります。'+(saved.revision!==form.elements.revision.value?'保存済み記事の版が変わっています。復元後に差分を確認してください。':'復元するか選べます。');
    form.querySelector('[data-restore]').onclick=()=>{names.forEach(name=>{const value=saved.values[name],el=form.elements[name];if(el.type==='checkbox'){if(typeof value==='boolean')el.checked=value;}else if(typeof value==='string')el.value=value;});recovery.hidden=true;changed();queuePreview();};
    form.querySelector('[data-discard]').onclick=()=>{localStorage.removeItem(storageKey);recovery.hidden=true;storageStatus.textContent='退避した入力を破棄しました。';};
  }}catch{storageStatus.textContent='ブラウザ内の退避を利用できません。';}
  checks();
  window.addEventListener('pagehide',()=>{if(dirty&&!saving){clearTimeout(storageTimer);preserve();}});
  window.addEventListener('beforeunload',e=>{if(dirty&&!saving){e.preventDefault();e.returnValue='';}});
  const insert=text=>{body.setRangeText(text,body.selectionStart,body.selectionEnd,'end');body.focus();changed();queuePreview();};
  form.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{
    const selection=body.value.slice(body.selectionStart,body.selectionEnd),word=selection||'ここに本文';
    const lines=(prefix)=>'\n'+word.split('\n').map(x=>prefix+x).join('\n')+'\n';
    const templates={h2:'\n## '+word+'\n',h3:'\n### '+word+'\n',bold:'**'+word+'**',italic:'*'+word+'*',ul:lines('- '),ol:lines('1. '),quote:lines('> '),hr:'\n\n---\n\n',table:'\n\n| 項目 | 内容 |\n| --- | --- |\n| '+word+' | 説明 |\n\n',code:String.fromCharCode(96)+word+String.fromCharCode(96),strike:'~~'+word+'~~'};
    if(button.dataset.format==='link'){const url=prompt('リンク先URL（https:// またはサイト内の /パス）');if(url)insert('['+(selection||'リンクの説明')+']('+url+')');}
    else insert(templates[button.dataset.format]);
  }));
  async function request(data){const response=await fetch('/admin/stories/',{method:'POST',body:data,credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok){const text=await response.text();const error=new DOMParser().parseFromString(text,'text/html').querySelector('.dn-error');throw Error(error?.textContent||'保存できませんでした。ログイン状態と入力内容を確認してください。');}return response;}
  async function previewBody(manual=false){const sequence=++previewSequence,data=new FormData();data.set('csrf',form.elements.csrf.value);data.set('action','preview');data.set('body',body.value);try{const result=await(await request(data)).json();if(sequence!==previewSequence)return;form.querySelector('[data-editor-preview]').innerHTML=result.html;invalidLinks=result.invalid_links||[];linksChecked=true;checks();if(manual)status.textContent='編集中の本文をプレビューしました（未保存）';}catch(e){linksChecked=false;checks();if(manual)status.textContent=e.message;}}
  function queuePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(()=>previewBody(),800);}
  body.addEventListener('input',()=>{linksChecked=false;invalidLinks=[];checks();queuePreview();});queuePreview();
  form.querySelector('[data-preview]').addEventListener('click',()=>previewBody(true));
  form.querySelector('[data-image-upload]').addEventListener('click',async e=>{
    const file=form.querySelector('[data-image-file]').files[0],alt=form.querySelector('[data-image-alt]').value.trim(),caption=form.querySelector('[data-image-caption]').value.trim(),result=form.querySelector('[data-image-result]');
    if(!file||!alt){result.textContent='画像と画像の説明を入力してください。';return;}if(file.size>2*1024*1024){result.textContent='画像は2MB以内です。';return;}
    e.target.disabled=true;result.textContent='画像を登録しています…';const data=new FormData();data.set('csrf',form.elements.csrf.value);data.set('action','upload');data.set('image',file);
    try{const saved=await(await request(data)).json();result.replaceChildren();const image=document.createElement('img');image.src=saved.url;image.alt=alt;image.className='story-upload-preview';result.append(image);
      const cover=document.createElement('button');cover.type='button';cover.textContent='カバーに設定';cover.onclick=()=>{form.elements.cover.value=saved.id;form.elements.alt.value=alt;changed();result.append(document.createTextNode(' カバーに設定しました。保存で確定します。'));};
      const inline=document.createElement('button');inline.type='button';inline.textContent='本文に挿入';inline.onclick=()=>insert('\n\n!['+alt.replace(/[\[\]\n]/g,' ')+']('+saved.url+(caption?' "'+caption.replace(/["\n]/g,' ')+'"':'')+')\n\n');result.append(cover,inline);
    }catch(err){result.textContent=err.message;}finally{e.target.disabled=false;}
  });
  form.querySelector('[data-clear-cover]').addEventListener('click',()=>{form.elements.cover.value='';form.elements.alt.value='';form.querySelectorAll('.story-upload-preview').forEach(e=>e.remove());changed();});
  form.addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const data=new FormData(form),locked=[...form.querySelectorAll('input,textarea,select,button')].map(el=>({el,disabled:el.disabled}));locked.forEach(({el})=>{el.disabled=true;});const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='保存しています…';
    try{const result=await(await request(data)).json();if(typeof result.redirect!=='string'||!result.redirect.startsWith('/admin/?view=stories&'))throw Error('保存結果を確認できません。入力を保持しています。');clearTimeout(storageTimer);try{localStorage.removeItem(storageKey);}catch{}dirty=false;location.assign(result.redirect);}
    catch(err){saving=false;locked.forEach(({el,disabled})=>{el.disabled=disabled;});button.disabled=false;status.textContent=err.message;}
  });
})();
