const start=document.querySelector('#atlas-start'),state=document.querySelector('#atlas-state');
const items=[...document.querySelectorAll('[data-atlas-item]')];let loading;
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Library unavailable'));};document.head.append(s);});}
async function mount(){
  if(!window.L)await script('/cafe-map/leaflet/leaflet.js');
  if(!window.L.markerClusterGroup)await script('/cafe-map/leaflet/leaflet.markercluster.js');
  const response=await fetch('/connect/sign-cafe/map/data.json');if(!response.ok)throw Error('Data unavailable');
  const {spots}=await response.json(),L=window.L;
  const map=L.map('atlas-map',{zoomControl:false,minZoom:4,maxZoom:18,scrollWheelZoom:true,zoomAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches}).setView([36,137],5);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',updateWhenIdle:true,keepBuffer:1}).addTo(map);
  let tileErrors=0;tiles.on('tileerror',()=>{if(++tileErrors>=2)state.textContent='背景地図を取得できません。店舗ピンと一覧は引き続き利用できます。';});
  L.control.zoom({position:'bottomright',zoomInTitle:'拡大',zoomOutTitle:'縮小'}).addTo(map);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  const group=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:45,disableClusteringAtZoom:16,spiderfyOnMaxZoom:true,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,iconCreateFunction:cluster=>L.divIcon({className:'dn-map-cluster',html:'<span>'+cluster.getChildCount()+'</span>',iconSize:[44,44]})});
  const markers=new Map(),labels=new Map();let filtered=spots;
  spots.forEach((spot,i)=>{
    const icon=L.divIcon({className:'dn-map-pin'+(spot.statusCode==='unknown'?' is-unknown':''),html:'<span>'+(i+1)+'</span>',iconSize:[34,42],iconAnchor:[17,40]});
    const marker=L.marker([spot.latitude,spot.longitude],{icon,title:spot.name,alt:spot.name,keyboard:true,riseOnHover:true});
    const popup=document.createElement('article');popup.className='dn-map-popup';popup.append(node('p',spot.prefecture+' / '+spot.city),node('h2',spot.name),node('p',spot.type+' · '+spot.status),node('p',spot.hours),node('p',spot.address));
    const link=node('a','店舗の詳細・情報源');link.href=spot.path;link.className='dn-action-link';popup.append(link);
    marker.bindPopup(popup,{maxWidth:310,minWidth:220,autoPanPadding:[24,24]});
    const tooltip=node('span',spot.name);marker.bindTooltip(tooltip,{direction:'top',offset:[0,-38],permanent:false});
    marker.on('click',()=>{items.forEach(li=>li.classList.toggle('is-selected',li.dataset.atlasItem===spot.slug));state.textContent=spot.name+'を選択しました。';});
    markers.set(spot.slug,marker);group.addLayer(marker);labels.set(spot.slug,tooltip);
  });group.addTo(map);
  const search=document.querySelector('#atlas-search'),pref=document.querySelector('#atlas-pref'),bounds=document.querySelector('#atlas-bounds');
  const matches=li=>(!pref.value||li.dataset.prefecture===pref.value)&&li.textContent.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase());
  function updateList(){let count=0;items.forEach(li=>{const marker=markers.get(li.dataset.atlasItem);const visible=matches(li)&&(!bounds.checked||(marker&&map.getBounds().contains(marker.getLatLng())));li.hidden=!visible;if(visible)count++;});document.querySelector('#atlas-count').textContent=count+'件を表示';document.querySelector('#atlas-empty').hidden=count!==0;}
  function fit(){if(filtered.length)map.fitBounds(L.latLngBounds(filtered.map(s=>[s.latitude,s.longitude])),{padding:[50,50],maxZoom:13,animate:false});else updateList();}
  function filter(){filtered=spots.filter(s=>{const li=items.find(li=>li.dataset.atlasItem===s.slug);return li&&matches(li);});group.clearLayers();filtered.forEach(s=>group.addLayer(markers.get(s.slug)));fit();updateList();}
  search.addEventListener('input',filter);pref.addEventListener('change',filter);bounds.addEventListener('change',updateList);
  map.on('moveend zoomend',updateList);
  map.on('zoomend',()=>{markers.forEach((marker,slug)=>{marker.unbindTooltip();marker.bindTooltip(labels.get(slug),{direction:'top',offset:[0,-38],permanent:map.getZoom()>=13});});});
  document.querySelector('#atlas-fit').addEventListener('click',()=>{search.value='';pref.value='';filter();});
  const fullscreen=document.querySelector('#atlas-fullscreen'),atlas=document.querySelector('#atlas');
  if(atlas.requestFullscreen){fullscreen.hidden=false;fullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await atlas.requestFullscreen();}catch{state.textContent='この環境では全画面表示を利用できません。';}});document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'通常表示に戻す':'大きく表示';map.invalidateSize();});}
  new ResizeObserver(()=>map.invalidateSize()).observe(document.querySelector('#atlas-map'));
  document.querySelector('#atlas-cover').hidden=true;document.querySelector('.dn-atlas-controls').hidden=false;document.querySelector('.dn-atlas-bounds').hidden=false;
  map.invalidateSize();fit();updateList();atlas.dataset.state='ready';state.textContent='数字は近くの店舗数です。拡大・ピン選択で店舗情報を表示します。';
  return {select(slug){const marker=markers.get(slug);if(!marker)return;search.value='';pref.value='';filtered=spots;group.clearLayers();spots.forEach(s=>group.addLayer(markers.get(s.slug)));map.setView(marker.getLatLng(),16,{animate:false});group.zoomToShowLayer(marker,()=>{marker.openPopup();items.forEach(li=>li.classList.toggle('is-selected',li.dataset.atlasItem===slug));state.textContent=spots.find(s=>s.slug===slug).name+'を選択しました。';});updateList();}};
}
if(start){
  start.hidden=false;
  const load=()=>loading??=mount().catch(()=>{loading=null;start.disabled=false;state.textContent='地図を読み込めませんでした。店舗名のリンクから詳細をご覧ください。';document.querySelector('#atlas').dataset.state='error';return null;});
  start.addEventListener('click',()=>{start.disabled=true;state.textContent='地図を読み込んでいます。';load();});
  document.querySelectorAll('[data-atlas-select]').forEach(button=>{button.hidden=false;button.addEventListener('click',async()=>{const atlas=await load();if(!atlas)return;atlas.select(button.dataset.atlasSelect);document.querySelector('#atlas-map').scrollIntoView({block:'center',behavior:'auto'});});});
}
