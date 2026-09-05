const start=document.querySelector('#map-start');
const status=document.querySelector('#map-status');
let atlas;
if(start){
  start.hidden=false;
  const load=()=>atlas??=import('./world.js?v=2').then(m=>m.mount()).catch(error=>{
    atlas=null;start.disabled=false;start.textContent='もう一度3Dを試す';
    status.textContent='この環境では3Dを表示できませんでした。下のHTML一覧をご利用ください。';
    document.querySelector('#map-stage').dataset.state='error';
    return null;
  });
  start.addEventListener('click',()=>{start.disabled=true;start.textContent='地図を読み込み中…';load();});
  document.querySelectorAll('[data-map-select]').forEach(button=>{
    button.hidden=false;
    button.addEventListener('click',async()=>{
      start.disabled=true;start.textContent='地図を読み込み中…';
      const map=await load();if(!map)return;
      map.select(button.dataset.mapSelect);
      document.querySelector('#map-stage').scrollIntoView({block:'center',behavior:'auto'});
    });
  });
}
