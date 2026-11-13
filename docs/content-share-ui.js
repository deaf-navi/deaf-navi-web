import {sharePresentation} from './content-share.js?v=20261113share1';

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
const refreshers=new WeakMap();
function initialize(root) {
  if(refreshers.has(root)){refreshers.get(root)();return;}
  const data=JSON.parse(root.dataset.contentShare),panel=root.querySelector('.dn-share-panel');
  const p=sharePresentation(data);root.dataset.shareReady='true';
  const notice=document.createElement('p');notice.textContent='自分のSNSで紹介できます。投稿は各SNSの画面で確認・確定してください。';
  const actions=document.createElement('div');actions.className='dn-share-actions';
  const status=document.createElement('p');status.className='dn-share-status';status.setAttribute('role','status');
  const label=document.createElement('label');label.textContent='紹介文とリンク';
  const text=document.createElement('textarea');text.readOnly=true;text.rows=6;label.append(text);
  const canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('role','img');
  const get=()=>{const current=sharePresentation(data);text.value=current.text;x.href=current.xUrl;return current;};
  const button=(name,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',async()=>{status.textContent='';try{await handler(b);}catch(err){status.textContent=err.message || '操作できませんでした。紹介文を手動でコピーしてください。';}});actions.append(b);return b;};
  const x=document.createElement('a');x.textContent='Xで共有';x.href=p.xUrl;x.target='_blank';x.rel='noopener noreferrer';x.setAttribute('aria-label','Xで共有（新しいタブ）');x.addEventListener('click',get);actions.append(x);
  button('紹介文をコピー',async()=>{const current=get();try{await navigator.clipboard.writeText(current.text);status.textContent='紹介文とリンクをコピーしました。';}catch{text.focus();text.select();status.textContent='自動コピーができませんでした。選択された紹介文を手動でコピーしてください。';}});
  button('リンクをコピー',async()=>{const current=get();try{await navigator.clipboard.writeText(current.url);status.textContent='リンクをコピーしました。';}catch{text.value=current.url;text.focus();text.select();status.textContent='選択されたリンクを手動でコピーしてください。';}});
  if(typeof navigator.share==='function')button('スマホなどの共有メニュー',async()=>{const current=get();try{await navigator.share({title:current.title,text:current.text.replace(current.url+'\n',''),url:current.url});}catch(err){if(err.name!=='AbortError')throw new Error('共有画面を開けませんでした。紹介文やリンクのコピーをご利用ください。');}});
  const instagram=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Instagramで紹介する';instagram.append(summary);
  const help=document.createElement('p');help.textContent='①紹介文をコピー ②画像を保存 ③Instagramで画像を選び、紹介文を貼り付けます。リンクはプロフィールやストーリーズのリンクスタンプにも使えます。共有先・利用できる機能は端末やアプリによって異なります。';instagram.append(help);
  const imageActions=document.createElement('div');imageActions.className='dn-share-actions';instagram.append(imageActions);
  const save=button('Instagram用画像を保存',async b=>{
    b.disabled=true;
    try{const current=get();drawShareImage(canvas,current);canvas.hidden=false;canvas.setAttribute('aria-label',current.title+'。'+current.note);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('画像を保存できませんでした。紹介文をコピーしてご利用ください。');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='deafnavi-share.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent='画像の保存を開始しました。Instagramで画像を選び、コピーした紹介文を貼り付けてください。';
    }finally{b.disabled=false;}
  });imageActions.append(save);
  const open=document.createElement('a');open.href='https://www.instagram.com/';open.textContent='Instagramを開く';open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label','Instagramを開く（新しいタブ）');imageActions.append(open);instagram.append(canvas);
  panel.prepend(notice,actions,label,instagram,status);refreshers.set(root,get);get();
}
if(typeof document!=='undefined')document.addEventListener('toggle',event=>{
  const root=event.target;if(!root.matches?.('[data-content-share]')||!root.open)return;
  try{initialize(root);}catch{const p=document.createElement('p');p.textContent='共有機能を読み込めませんでした。リンク先のURLをコピーしてください。';root.querySelector('.dn-share-panel').append(p);}
},true);
if(typeof document!=='undefined') {
  const refresh=()=>{if(!document.hidden)for(const root of document.querySelectorAll('[data-content-share][open]'))refreshers.get(root)?.();};
  document.addEventListener('visibilitychange',refresh);
  setInterval(refresh,60000);
}
