import * as THREE from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';

// Local planar projection for a Japan-only illustrative atlas; not a navigation map.
const project=(lon,lat)=>[(lon-136.5)*Math.cos(36*Math.PI/180)*6,(lat-35.5)*6];
export async function mount(){
  const stage=document.querySelector('#map-stage'),card=document.querySelector('#map-card');
  const status=document.querySelector('#map-status');
  const [land,data]=await Promise.all(['./japan.json','/connect/sign-cafe/map/data.json'].map(async path=>{
    const response=await fetch(path.startsWith('/')?path:new URL(path,import.meta.url));
    if(!response.ok)throw Error('Map data unavailable');return response.json();
  }));
  if(!Array.isArray(data.spots)||land.geometry?.type!=='MultiPolygon')throw Error('Map data invalid');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(error){throw error;}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#302b25');
  const camera=new THREE.PerspectiveCamera(36,1,.1,800);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=false;controls.minDistance=3;controls.maxDistance=360;
  controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI*.46;
  controls.screenSpacePanning=true;
  scene.add(new THREE.HemisphereLight(0xfff1d3,0x655647,1.3));
  const sun=new THREE.DirectionalLight(0xffead0,1.3);sun.position.set(-25,65,-15);scene.add(sun);
  const top=new THREE.MeshStandardMaterial({color:0xc3af8c,roughness:.95});
  const side=new THREE.MeshStandardMaterial({color:0x8a6e4f,roughness:1});
  for(const polygon of land.geometry.coordinates){
    const shape=new THREE.Shape();
    polygon.forEach((ring,index)=>{
      const target=index===0?shape:new THREE.Path();
      ring.forEach(([lon,lat],i)=>{const [x,y]=project(lon,lat);i===0?target.moveTo(x,y):target.lineTo(x,y);});
      if(index>0)shape.holes.push(target);
    });
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:false,steps:1,curveSegments:1});
    geo.rotateX(-Math.PI/2);
    scene.add(new THREE.Mesh(geo,[top,side]));
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,35),new THREE.LineBasicMaterial({color:0xb39a75,transparent:true,opacity:.45}));scene.add(edges);
  }
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;
  const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,245,207,1)');gradient.addColorStop(.18,'rgba(255,209,122,.95)');gradient.addColorStop(.45,'rgba(242,155,56,.38)');gradient.addColorStop(1,'rgba(242,155,56,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(glowCanvas);
  const markers=[];
  for(const spot of data.spots){
    const [x,y]=project(spot.longitude,spot.latitude);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,opacity:spot.statusCode==='unknown'?.48:1}));
    sprite.position.set(x,1.5,-y);sprite.scale.set(2.3,2.3,1);sprite.userData=spot;sprite.renderOrder=3;scene.add(sprite);markers.push(sprite);
    if(spot.statusCode!=='unknown'){
      const dot=new THREE.Mesh(new THREE.SphereGeometry(.19,12,8),new THREE.MeshBasicMaterial({color:0xffa735,depthTest:false}));dot.position.set(x,1.7,-y);dot.renderOrder=4;scene.add(dot);
    }
    if(spot.statusCode==='unknown'){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.22,.3,24),new THREE.MeshBasicMaterial({color:0xffd28d,side:THREE.DoubleSide,depthTest:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(x,1.6,-y);scene.add(ring);
    }
  }
  const selection=new THREE.Mesh(new THREE.RingGeometry(.55,.68,40),new THREE.MeshBasicMaterial({color:0xfff6df,side:THREE.DoubleSide,depthTest:false}));
  selection.rotation.x=-Math.PI/2;selection.visible=false;scene.add(selection);
  const render=()=>renderer.render(scene,camera);
  const resize=()=>{const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
  const bounds=new THREE.Box3(),outline=[];
  for(const polygon of land.geometry.coordinates)for(const ring of polygon)for(const [lon,lat] of ring){const [x,y]=project(lon,lat),v=new THREE.Vector3(x,1,-y);bounds.expandByPoint(v);outline.push(v);}
  const center=bounds.getCenter(new THREE.Vector3());
  const home=()=>{
    controls.target.copy(center);
    // Fit all geographic extremes, including Hokkaido and Okinawa, inside the viewport.
    for(let distance=120;distance<=300;distance+=5){
      camera.position.copy(center).add(stage.clientWidth>600?new THREE.Vector3(distance*.25,distance*.95,distance*.55):new THREE.Vector3(0,distance*.9,distance*.45));camera.lookAt(center);camera.updateMatrixWorld();
      if(outline.every(point=>{const v=point.clone().project(camera);return Math.abs(v.x)<.9&&Math.abs(v.y)<.82;}))break;
    }
    controls.update();selection.visible=false;render();
  };
  const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
  function showCard(spot){
    card.replaceChildren(node('p',spot.prefecture+' / '+spot.city,'dn-eyebrow'),node('h2',spot.name),node('p',spot.type+' · '+spot.status),node('p',spot.hours,'dn-map-card-hours'),node('p',spot.description),node('p',spot.address));
    const link=node('a','店舗の詳細・公式情報を見る →');link.href=spot.path;card.append(link);
    const details=document.createElement('details');details.append(node('summary','情報源・確認日'));
    details.append(node('p','情報確認日：'+spot.verifiedAt));
    spot.sources.forEach((url,i)=>{const p=document.createElement('p'),a=node('a','情報源 '+(i+1));a.href=url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);details.append(p);});
    const source=node('a','座標確認元（住所付近）');source.href=spot.coordinateSource;source.target='_blank';source.rel='noopener noreferrer';details.append(source);card.append(details);
    const [x,y]=project(spot.longitude,spot.latitude);selection.position.set(x,1.9,-y);selection.visible=true;render();
  }
  function select(slug){const marker=markers.find(m=>m.userData.slug===slug);if(!marker)return;showCard(marker.userData);controls.target.copy(marker.position);camera.position.copy(marker.position).add(new THREE.Vector3(0,10,5));controls.update();render();}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  const onDown=event=>{down=[event.clientX,event.clientY];};
  const onUp=event=>{
    if(!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>7)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(markers).map(hit=>hit.object.userData);
    if(!hits.length)return;
    showCard(hits[0]);
    if(hits.length>1){card.append(node('p','この付近の光点（拡大して選べます）'));const list=document.createElement('ul');for(const spot of hits){const li=document.createElement('li'),button=node('button',spot.name);button.type='button';button.addEventListener('click',()=>select(spot.slug));li.append(button);list.append(li);}card.append(list);}
    status.textContent=hits[0].name+'を選択しました。情報カードをご覧ください。';
  };
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
  controls.addEventListener('change',render);
  document.querySelector('#map-home').addEventListener('click',home);
  const zoom=factor=>{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);offset.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();render();};
  document.querySelector('#map-zoom-in').addEventListener('click',()=>zoom(.7));
  document.querySelector('#map-zoom-out').addEventListener('click',()=>zoom(1.4));
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','立体の日本地図と手話スポットの光点。キーボードでは下の店舗一覧をご利用ください。');
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();stage.dataset.state='error';status.textContent='3Dの描画が停止しました。下のHTML一覧をご利用ください。';});
  stage.prepend(renderer.domElement);document.querySelector('#map-cover').hidden=true;document.querySelector('#map-toolbar').hidden=false;
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();home();stage.dataset.state='ready';
  status.textContent=data.spots.length+'地点 · 光点で情報を表示／ドラッグで回転／ピンチで拡大';
  // Render only on interaction/resize. No animation loop or automatic rotation.
  return {select};
}
