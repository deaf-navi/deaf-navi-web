import {sharePresentation} from './content-share.js?v=20261114icons1';

function wrap(ctx,text,width) {
  const lines=[];let line='';
  for(const char of String(text)) { if(char==='\n'){lines.push(line);line='';continue;} if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char; }
  if(line)lines.push(line);return lines;
}
function withSuffix(ctx,line,suffix,width) {
  const chars=[...line];while(chars.length&&ctx.measureText(chars.join('')+suffix).width>width)chars.pop();
  return chars.join('')+suffix;
}
export function drawShareImage(canvas,presentation) {
  canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('このブラウザーでは画像を作れません。紹介文とリンクをコピーしてください。');
  ctx.fillStyle='#f7faf8';ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle='#163f37';ctx.fillRect(0,0,1080,16);
  ctx.font='bold 38px sans-serif';ctx.fillText('Deaf Navi',64,92);
  ctx.font='30px sans-serif';ctx.fillText(presentation.state || 'ニュース',64,166);
  let size=56,lines;
  do{ctx.font=`bold ${size}px sans-serif`;lines=wrap(ctx,presentation.title,952);if(lines.length<=7&&lines.length*size*1.45<=340)break;size-=2;}while(size>=30);
  // Extremely long headlines are kept in full in the caption, never silently clipped.
  if(lines.length>7)lines=[...lines.slice(0,6),withSuffix(ctx,lines[6],'…（全文は紹介文へ）',952)];
  let y=243;for(const line of lines){ctx.fillText(line,64,y);y+=size*1.45;}
  y+=32;
  for(const [label,value] of presentation.facts){
    ctx.font='26px sans-serif';ctx.fillStyle='#46635c';ctx.fillText(label,64,y);y+=38;
    ctx.font='34px sans-serif';ctx.fillStyle='#163f37';
    const rows=wrap(ctx,value,952);
    const visible=rows.length>2?[rows[0],withSuffix(ctx,rows[1],'…（詳細はリンク先へ）',952)]:rows;
    for(const row of visible){if(y>1040)break;ctx.fillText(row,64,y);y+=45;}y+=22;
    if(y>1040)break;
  }
  ctx.fillStyle='#163f37';ctx.fillRect(64,1120,952,2);ctx.font='28px sans-serif';
  y=1170;for(const line of wrap(ctx,presentation.note,952).slice(0,3)){ctx.fillText(line,64,y);y+=40;}
  ctx.font='24px sans-serif';ctx.fillText('リンク・出典は紹介文へ  /  deafnavi.com',64,1300);
}
const panels=new WeakMap();
let panelSequence=0;
let appSharePending=false;
function current(root) { return sharePresentation(JSON.parse(root.dataset.contentShare)); }
function supportsAppSharing() { return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&typeof File==='function'; }
export function shareImageFile(presentation) {
  const canvas=document.createElement('canvas');drawShareImage(canvas,presentation);
  // Keep file creation synchronous: Safari needs the original click activation.
  const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));
  return new File([bytes],'deafnavi-share.png',{type:'image/png'});
}
function openPanel(root) {
  for(const other of document.querySelectorAll('[data-content-share]'))if(other!==root)closePanel(other);
  initialize(root).get();root.querySelector('.dn-share-panel').hidden=false;
  root.querySelector('[data-share-instagram]').setAttribute('aria-expanded','true');
}
async function shareToApps(root) {
  if(!supportsAppSharing())return false;
  const status=root.querySelector('.dn-share-status');
  if(appSharePending){status.textContent='開いている共有画面で操作してください。';return true;}
  let file;
  try{file=shareImageFile(current(root));if(!navigator.canShare({files:[file]}))return false;}catch{return false;}
  appSharePending=true;
  try{
    // Files only: some targets reject mixed link/text + image payloads.
    await navigator.share({files:[file]});
    openPanel(root);status.textContent='画像を共有先へ渡しました。必要に応じて紹介文をコピーし、投稿はInstagramで確定してください。';
  }catch(error){
    if(error?.name==='AbortError')status.textContent='共有をキャンセルしました。';
    else{openPanel(root);status.textContent='アプリへ画像を渡せませんでした。画像を保存してInstagramで選んでください。';}
  }finally{appSharePending=false;}
  return true;
}
function closePanel(root,focus=false) {
  root.querySelector('.dn-share-panel').hidden=true;
  const trigger=root.querySelector('[data-share-instagram]');trigger.setAttribute('aria-expanded','false');
  if(focus)trigger.focus();
}
function initialize(root) {
  if(panels.has(root))return panels.get(root);
  const panel=root.querySelector('.dn-share-panel'),status=root.querySelector('.dn-share-status');
  panel.id='dn-instagram-'+(++panelSequence);
  root.querySelector('[data-share-instagram]').setAttribute('aria-controls',panel.id);
  const heading=document.createElement('div');heading.className='dn-share-panel-head';
  const title=document.createElement('strong');title.textContent='Instagramで紹介';heading.append(title);
  const close=document.createElement('button');close.type='button';close.className='dn-share-close';close.textContent='閉じる';close.addEventListener('click',()=>closePanel(root,true));heading.append(close);
  const help=document.createElement('p');help.textContent=supportsAppSharing()?'共有先にInstagramが表示される場合は選んでください。表示されない場合は画像を保存して投稿画面で選べます。紹介文は別にコピーできます。':'紹介文をコピーし、画像を保存してInstagramの投稿画面で選んでください。';
  const label=document.createElement('label');label.textContent='紹介文';
  const text=document.createElement('textarea');text.readOnly=true;text.rows=4;label.append(text);
  const actions=document.createElement('div');actions.className='dn-share-actions';
  const canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('role','img');
  const get=()=>{const p=current(root);text.value=p.text;root.querySelector('[data-share-x]').href=p.xUrl;return p;};
  const button=(name,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',async()=>{status.textContent='';try{await handler(b);}catch{status.textContent='操作できませんでした。紹介文を選択してコピーしてください。';}});actions.append(b);return b;};
  if(supportsAppSharing())button('アプリに画像を送る',async()=>{if(!await shareToApps(root))status.textContent='この端末では画像の共有に対応していません。画像を保存してInstagramで選んでください。';});
  button('紹介文をコピー',async()=>{const p=get();try{await navigator.clipboard.writeText(p.text);status.textContent='紹介文とリンクをコピーしました。';}catch{text.focus();text.select();status.textContent='選択された紹介文を手動でコピーしてください。';}});
  button('画像を保存',async b=>{
    b.disabled=true;
    try{const p=get();drawShareImage(canvas,p);canvas.hidden=false;canvas.setAttribute('aria-label',p.title+'。'+p.note);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('画像の作成に失敗しました。');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='deafnavi-share.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent='画像の保存を開始しました。Instagramの投稿画面で画像を選んでください。';
    }finally{b.disabled=false;}
  });
  const open=document.createElement('a');open.href='https://www.instagram.com/';open.textContent='Instagramを開く';open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label','Instagramを開く（新しいタブ）');actions.append(open);
  const note=document.createElement('p');note.className='dn-share-note';note.textContent='投稿の確定はInstagramで行います。リンクはストーリーズのリンクスタンプなどに使えます。';
  panel.append(heading,help,label,actions,canvas,note);panels.set(root,{get,text});return panels.get(root);
}
if(typeof document!=='undefined') {
  const updateX=event=>{const x=event.target.closest?.('[data-share-x]');if(x)try{x.href=current(x.closest('[data-content-share]')).xUrl;}catch{}};
  for(const type of ['pointerover','focusin','contextmenu'])document.addEventListener(type,updateX);
  // Delegation also covers news pagination and cafes loaded from the public feed.
  document.addEventListener('click',async event=>{
    const control=event.target.closest?.('[data-share-x],[data-share-instagram],[data-share-copy]');
    const root=control?.closest('[data-content-share]');if(!root)return;
    const status=root.querySelector('.dn-share-status');status.textContent='';
    try {
      if(control.matches('[data-share-x]')){control.href=current(root).xUrl;return;}
      if(control.matches('[data-share-instagram]')){
        const panel=root.querySelector('.dn-share-panel');
        if(!panel.hidden){closePanel(root);return;}
        if(!await shareToApps(root))openPanel(root);
        return;
      }
      try{await navigator.clipboard.writeText(current(root).url);status.textContent='リンクをコピーしました。';}
      catch{const {text}=initialize(root);text.value=current(root).url;root.querySelector('.dn-share-panel').hidden=false;root.querySelector('[data-share-instagram]').setAttribute('aria-expanded','true');text.focus();text.select();status.textContent='選択されたリンクを手動でコピーしてください。';}
    }catch{if(control.matches('[data-share-x]'))event.preventDefault();status.textContent='情報を読み込めませんでした。ページのリンクをコピーしてください。';}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const root=event.target.closest?.('[data-content-share]')||document.querySelector('[data-share-instagram][aria-expanded="true"]')?.closest('[data-content-share]');if(root&&!root.querySelector('.dn-share-panel').hidden){closePanel(root,true);event.preventDefault();}}});
  const refresh=()=>{if(!document.hidden)for(const root of document.querySelectorAll('[data-content-share]'))if(!root.querySelector('.dn-share-panel').hidden)panels.get(root)?.get();};
  document.addEventListener('visibilitychange',refresh);setInterval(refresh,60000);
}
