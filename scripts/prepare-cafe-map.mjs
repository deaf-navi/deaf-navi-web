// Reproducible, explicit research/asset preparation; never run during normal builds.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const research=JSON.parse(await readFile('content/connect/research-20260905.json','utf8'));
const original=JSON.parse(await readFile('server/seed.json','utf8'));
const seed=structuredClone(original);
for(const {id,changes} of research.updates)Object.assign(seed.find(p=>p.id===id),changes,{last_verified_at:research.date});
for(const p of research.additions)if(!seed.some(r=>r.id===p.id))seed.push(p);
await mkdir('src/assets/cafe-map',{recursive:true});
if(process.argv.includes('--geocode')) {
  const results=[];
  for(const p of seed.filter(p=>p.publication==='public'&&['open','unknown'].includes(p.status)&&p.address)){
    // Remove building name only; retain municipality, street and block numbers.
    const address=p.address.split(' ')[0];
    const url='https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(address);
    const response=await fetch(url);if(!response.ok)throw Error('Geocoder HTTP '+response.status);
    const matches=await response.json();
    results.push({id:p.id,address,url,matches});
    console.log(JSON.stringify({id:p.id,address,matches}));
    await new Promise(r=>setTimeout(r,350));
  }
  await writeFile('content/connect/coordinate-research-20260905.json',JSON.stringify(results,null,2)+'\n');
  process.exit(0);
}
const coords=JSON.parse(await readFile('content/connect/coordinates-approved-20260905.json','utf8'));
for(const c of coords){const p=seed.find(p=>p.id===c.id);Object.assign(p,{latitude:c.latitude,longitude:c.longitude,coordinate_accuracy:'address_vicinity',coordinate_source_url:c.url});}
await writeFile('server/seed.json',JSON.stringify(seed,null,2)+'\n');
const updates=research.updates.map(u=>({...u,expected_revision:1,changes:{...u.changes,last_verified_at:research.date}}));
for(const c of coords){let u=updates.find(u=>u.id===c.id);if(!u){u={id:c.id,expected_revision:1,changes:{}};updates.push(u);}Object.assign(u.changes,{latitude:c.latitude,longitude:c.longitude,coordinate_accuracy:'address_vicinity',coordinate_source_url:c.url});}
// New records are inserted separately, never treated as existing-record updates.
const additions=seed.filter(p=>research.additions.some(a=>a.id===p.id));
await writeFile('content/connect/import-20260905.json',JSON.stringify({date:research.date,updates:updates.filter(u=>!additions.some(p=>p.id===u.id)),additions},null,2)+'\n');
const url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson';
const response=await fetch(url);if(!response.ok)throw Error('Geometry HTTP '+response.status);
const raw=await response.text();const feature=JSON.parse(raw).features.find(f=>f.properties.ADMIN==='Japan');
if(feature?.geometry?.type!=='MultiPolygon'||feature.geometry.coordinates.length<4)throw Error('Invalid Japan geometry');
await writeFile('src/assets/cafe-map/japan.json',JSON.stringify({type:'Feature',properties:{source:'Natural Earth 5.1.2, 1:50m',license:'Public domain'},geometry:feature.geometry})+'\n');
await writeFile('src/assets/cafe-map/credits.json',JSON.stringify({geometry:{url,sha256:createHash('sha256').update(raw).digest('hex'),terms:'https://www.naturalearthdata.com/about/terms-of-use/'},three:{version:'0.180.0',license:'MIT'},coordinates:{source:'国土地理院 住所検索',accuracy:'住所付近の概略位置。道案内用途ではありません。'}},null,2)+'\n');
console.log('PREPARATION_OK',seed.length,coords.length);
