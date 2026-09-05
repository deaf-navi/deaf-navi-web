// Human/agent-reviewed result titles match the recorded addresses at block or better precision.
// Kurashi-cafe resolves only to town level: deliberately NOT approved for the map.
import {readFile,writeFile} from 'node:fs/promises';
const approved=['knot','cafe-2u','sign-with-me','very-you','lamunedou','tetote','nishiochaya','oneness','nonowa-kunitachi','anuvanda','rendeaf','hands-place','deafcafe-nagano','tabicafe'];
const research=JSON.parse(await readFile('content/connect/coordinate-research-20260905.json','utf8'));
const output=approved.map(id=>{const r=research.find(r=>r.id===id);if(r?.matches.length!==1)throw Error('Review required: '+id);const [longitude,latitude]=r.matches[0].geometry.coordinates;return {id,latitude,longitude,url:r.url,matched_address:r.matches[0].properties.title};});
await writeFile('content/connect/coordinates-approved-20260905.json',JSON.stringify(output,null,2)+'\n');
