import {readFile,writeFile} from 'node:fs/promises';
const land=JSON.parse(await readFile('src/assets/cafe-map/japan.json','utf8'));
const paths=land.geometry.coordinates.map(poly=>poly.map(ring=>ring.map(([lon,lat],i)=>`${i?'L':'M'}${((lon-122)*21).toFixed(1)},${((46-lat)*20).toFixed(1)}`).join(' ')+'Z').join(' '));
await writeFile('src/assets/cafe-map/japan-poster.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 440"><title>日本列島の概形 / Natural Earth</title><g fill="#d9c5a0" stroke="#a98a5d" stroke-width=".5" fill-rule="evenodd">${paths.map(d=>`<path d="${d}"/>`).join('')}</g></svg>\n`);
