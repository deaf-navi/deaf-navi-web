(() => {
  const form=document.querySelector('[data-story-editor]');if(!form)return;
  const body=form.elements.body,status=form.querySelector('[data-save-status]');let dirty=false,saving=false,previewTimer,previewSequence=0;
  const changed=()=>{dirty=true;status.textContent='未保存の変更があります';};form.addEventListener('input',changed);form.addEventListener('change',changed);
  window.addEventListener('beforeunload',e=>{if(dirty&&!saving){e.preventDefault();e.returnValue='';}});
  const insert=text=>{body.setRangeText(text,body.selectionStart,body.selectionEnd,'end');body.focus();changed();queuePreview();};
  form.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{
    const selection=body.value.slice(body.selectionStart,body.selectionEnd),word=selection||'ここに本文';
    const lines=(prefix)=>'\n'+word.split('\n').map(x=>prefix+x).join('\n')+'\n';
    const templates={h2:'\n## '+word+'\n',h3:'\n### '+word+'\n',bold:'**'+word+'**',italic:'*'+word+'*',ul:lines('- '),ol:lines('1. '),quote:lines('> '),hr:'\n\n---\n\n'};
    if(button.dataset.format==='link'){const url=prompt('リンク先URL（https:// またはサイト内の /パス）');if(url)insert('['+(selection||'リンクの説明')+']('+url+')');}
    else insert(templates[button.dataset.format]);
  }));
  async function request(data){const response=await fetch('/admin/stories/',{method:'POST',body:data,credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok){const text=await response.text();const error=new DOMParser().parseFromString(text,'text/html').querySelector('.dn-error');throw Error(error?.textContent||'保存できませんでした。ログイン状態と入力内容を確認してください。');}return response;}
  async function previewBody(manual=false){const sequence=++previewSequence,data=new FormData();data.set('csrf',form.elements.csrf.value);data.set('action','preview');data.set('body',body.value);try{const result=await(await request(data)).json();if(sequence!==previewSequence)return;form.querySelector('[data-editor-preview]').innerHTML=result.html;if(manual)status.textContent='編集中の本文をプレビューしました（未保存）';}catch(e){if(manual)status.textContent=e.message;}}
  function queuePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(()=>previewBody(),800);}
  body.addEventListener('input',queuePreview);
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
  form.addEventListener('submit',async e=>{e.preventDefault();if(saving)return;saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='保存しています…';
    try{const result=await(await request(new FormData(form))).json();if(typeof result.redirect!=='string'||!result.redirect.startsWith('/admin/?view=stories&'))throw Error('保存結果を確認できません。入力を保持しています。');dirty=false;location.assign(result.redirect);}
    catch(err){saving=false;button.disabled=false;status.textContent=err.message;}
  });
})();
