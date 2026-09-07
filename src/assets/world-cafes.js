'use strict';
const filters=document.querySelector('.dn-world-search');
if(filters){
 const region=filters.elements.region,country=filters.elements.country;
 const updateCountries=()=>{
  for(const option of country.options){
   const outside=option.value!==''&&region.value!==''&&!JSON.parse(option.dataset.regions||'[]').includes(region.value);
   option.hidden=outside&&!option.selected;option.disabled=outside&&!option.selected;
  }
 };
 region.addEventListener('change',()=>{country.value='';filters.elements.tag.value='';updateCountries();});
 updateCountries();
}
document.querySelector('a[href="#world-map-panel"]')?.addEventListener('click',()=>{document.querySelector('#world-map-panel').open=true;});
const start=document.querySelector('#world-map-start');
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});}
function css(href){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
if(start){start.hidden=false;start.addEventListener('click',async()=>{
 start.disabled=true;const state=document.querySelector('#world-map-status');state.textContent='地図を読み込んでいます…';
 try{
  if(!window.L){css('/cafe-map/leaflet/leaflet.css');css('/cafe-map/leaflet/MarkerCluster.css');await loadScript('/cafe-map/leaflet/leaflet.js');}
  if(!L.markerClusterGroup)await loadScript('/cafe-map/leaflet/leaflet.markercluster.js');
  const response=await fetch('/connect/sign-cafe/overseas/map.json'+location.search);if(!response.ok)throw Error('data');const {spots}=await response.json();
  document.querySelector('#world-map').hidden=false;
  const map=L.map('world-map',{scrollWheelZoom:false,minZoom:0,maxZoom:18}).setView([20,0],2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19,updateWhenIdle:true,keepBuffer:1}).addTo(map).on('tileerror',()=>{state.textContent='背景地図を取得できません。店舗一覧をご利用ください。';});
  const group=L.markerClusterGroup({chunkedLoading:true,showCoverageOnHover:false,animate:false,iconCreateFunction:c=>L.divIcon({className:'dn-world-map-cluster',html:String(c.getChildCount()),iconSize:[40,40]})});
  for(const s of spots){const popup=document.createElement('div'),a=document.createElement('a'),p=document.createElement('p');a.textContent=s.name;a.href=s.path;p.textContent=s.country+' / '+s.city;popup.append(a,p);L.marker([s.latitude,s.longitude],{title:s.name,alt:s.name,keyboard:true,icon:L.divIcon({className:'dn-world-map-pin',html:'',iconSize:[20,20]})}).bindPopup(popup).addTo(group);}
  group.addTo(map);if(spots.length)map.fitBounds(group.getBounds(),{padding:[30,30],maxZoom:12,animate:false});
  state.textContent=spots.length+'件の位置を表示しています。位置確認待ちの店舗は一覧からご覧ください。';start.hidden=true;
 }catch{state.textContent='地図を読み込めませんでした。再試行するか、下の店舗一覧をご利用ください。';start.disabled=false;}
});}

