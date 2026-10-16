import { readFileSync } from 'node:fs';
import { SITE_URL } from '../../config/site.mjs';
import { escapeHtml as e } from '../lib/text.mjs';
export const ENTRY_REDIRECTS = JSON.parse(readFileSync(new URL('../../config/entry-redirects.json', import.meta.url), 'utf8'));
export function renderEntryRedirect({to, label}) {
  const target = JSON.stringify(to).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(label)} | Deaf Navi</title><link rel="canonical" href="${e(new URL(to,SITE_URL).href)}"><script>location.replace(${target}+location.search+location.hash)</script><meta http-equiv="refresh" content="0;url=${e(to)}"></head><body><main><h1>${e(label)}</h1><p><a href="${e(to)}">${e(label)}を開く</a></p></main></body></html>`;
}
export function renderEntryRedirectsCaddy() {
  return '# Generated from config/entry-redirects.json. Import inside the Deaf Navi route.\n' + ENTRY_REDIRECTS.map((r,i)=>`@deafnavi_entry_${i} path ${r.from.slice(0,-1)} ${r.from} ${r.from}index.html\nredir @deafnavi_entry_${i} ${r.to}{?query} 301\n`).join('\n');
}
