// Read-only public-release evidence. All requests identify verification traffic.
import assert from 'node:assert/strict';
import { resolve4, resolve6 } from 'node:dns/promises';
import { writeFile } from 'node:fs/promises';

const base = new URL(process.argv.find(a => a.startsWith('--base='))?.slice(7) ?? 'https://deafnavi.com/');
const output = process.argv.find(a => a.startsWith('--output='))?.slice(9);
const verify = process.argv.includes('--verify-release');
assert.ok(base.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(base.hostname), 'HTTPS or local preview required');
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([\da-f]+));/gi, (entity, decimal, hex) => {
  if (decimal || hex) {
    const code = Number.parseInt(decimal ?? hex, hex ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }
  return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#39;': "'" }[entity.toLowerCase()] ?? entity;
});
const plain = html => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1].toLowerCase(), decode(m[3])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => attrs(m[0]));
const meta = (html, name) => tags(html, 'meta').find(m => m.name === name)?.content ?? null;
const requests = new Map();
async function read(path) {
  if (requests.has(path)) return requests.get(path);
  const url = new URL(path, base);
  url.searchParams.set('dn_client', 'codex');
  const response = await fetch(url, { headers: { 'User-Agent': 'Codex-DeafNavi-Verification', 'X-DeafNavi-Client': 'codex' }, signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  const value = { path, response, body };
  requests.set(path, value);
  return value;
}
function htmlEvidence({ path, response, body }) {
  const schemas = [...body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => {
    try { return JSON.parse(m[1]); } catch { return { invalid: true }; }
  });
  const links = tags(body, 'a').filter(a => a.href).map(a => a.href);
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? body;
  return {
    path, status: response.status, finalUrl: response.url, title: plain(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    description: meta(body, 'description'), robots: meta(body, 'robots'), canonical: tags(body, 'link').find(l => l.rel === 'canonical')?.href ?? null,
    viewport: meta(body, 'viewport'), headings: [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ level: Number(m[1]), text: plain(m[2]) })),
    schemas, mainText: plain(main).slice(0, 5000), internalLinks: [...new Set(links.filter(href => !/^(?:https?:|mailto:|tel:)/.test(href)))],
    imagesWithoutAlt: tags(body, 'img').filter(img => !Object.hasOwn(img, 'alt')).length,
    cacheControl: response.headers.get('cache-control'),
  };
}

if (process.argv.includes('--changed-only')) {
  const inspected = await Promise.all(['/sitemap.xml', '/sitemap.html', '/guide/', '/connect/sign-cafe/'].map(read));
  for (const item of inspected) assert.equal(item.response.status, 200, item.path);
  const [xml, sitemap, guide, directory] = inspected;
  assert.ok(![...xml.body.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].some(m => new URL(decode(m[1])).pathname === '/submit/'), 'noindex form absent from sitemap');
  const sitemapPage = htmlEvidence(sitemap);
  for (const path of ['/connect/sign-cafe/overseas/', '/connect/sign-cafe/events/']) {
    assert.ok(sitemapPage.internalLinks.some(href => new URL(href, new URL('/sitemap.html', base)).pathname === path), path + ' discoverable');
  }
  assert.ok(htmlEvidence(guide).canonical === new URL('/guide.html',base).href, 'guide reaches existing content');
  const candidates = tags(directory.body, 'a').filter(a => a.class?.split(/\s+/).includes('dn-cafe-name')).map(a => a.href);
  let detail;
  for (const path of [...new Set(candidates)]) {
    const record = await read(path);
    const page = htmlEvidence(record);
    // A signing store is deliberately outside this title change. Find a changed cafe.
    if (!page.title.endsWith('｜手話カフェ | Deaf Navi')) continue;
    const name = page.headings.find(h => h.level === 1)?.text;
    const location = plain(record.body.match(/<p class="dn-location">([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/\s*\/\s*/g, ' ').trim();
    assert.equal(record.response.status, 200, path);
    assert.equal(page.title, name + (location ? '（' + location + '）' : '') + '｜手話カフェ | Deaf Navi', 'title uses displayed locality');
    assert.equal(page.canonical, new URL(path, 'https://deafnavi.com/').href, 'detail canonical retained');
    detail = page;
    break;
  }
  assert.ok(detail, 'a public domestic cafe reflects the approved title');
  const report = { checkedAt: new Date().toISOString(), pages: [sitemapPage, htmlEvidence(guide), detail].map(({path,status,title,canonical,internalLinks}) => ({path,status,title,canonical,internalLinks})), sitemap: {path:xml.path,status:xml.response.status,submitExcluded:true}, productionWrites:false };
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log('SEO_APPROVED_RELEASE ' + JSON.stringify(report));
  console.log('SEO_PUBLIC_RELEASE_OK');
} else {
const pages = [];
for (const path of ['/', '/index-old.html', '/deaf-navi-world-jp.html', '/deaf-navi-world-original.html', '/connect/sign-cafe/', '/connect/sign-cafe/overseas/', '/connect/sign-cafe/events/', '/guide/', '/guide.html', '/otomado/', '/about/', '/about.html', '/sitemap.html']) {
  pages.push(htmlEvidence(await read(path)));
}
const cafeHtml = (await read('/connect/sign-cafe/')).body;
const detailPath = tags(cafeHtml, 'a').find(a => a.class?.split(/\s+/).includes('dn-cafe-name'))?.href;
if (detailPath && new URL(detailPath, base).origin === base.origin) pages.push(htmlEvidence(await read(detailPath)));
const archivePath = tags((await read('/index-old.html')).body, 'a').map(a => new URL(a.href ?? '', new URL('/index-old.html', base))).find(url => url.origin === base.origin && /^\/archive\/[^/]+\.html$/.test(url.pathname))?.pathname;
if (archivePath) pages.push(htmlEvidence(await read(archivePath)));
const resources = [];
for (const path of ['/robots.txt', '/sitemap.xml', '/sitemap-world.xml', '/directory-sitemap.xml', '/manifest.webmanifest', '/sw.js', '/app/v1/manifest.json']) {
  const { response, body } = await read(path);
  resources.push({ path, status: response.status, contentType: response.headers.get('content-type'), bytes: Buffer.byteLength(body),
    ...(path.includes('sitemap') ? { urls: [...body.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(m => decode(m[1])) } : {}),
    ...(path.endsWith('robots.txt') ? { text: body } : {}),
    ...(path.endsWith('.webmanifest') || path === '/app/v1/manifest.json' ? { data: JSON.parse(body) } : {}),
  });
}
const missing = htmlEvidence(await read('/deafnavi-seo-verification-missing-20261012/'));
const dns = { A: null, AAAA: null };
for (const [key, lookup] of [['A', resolve4], ['AAAA', resolve6]]) {
  try { dns[key] = await lookup(base.hostname); } catch (error) { dns[key] = { unavailable: error.code }; }
}
const report = { checkedAt: new Date().toISOString(), base: base.href, dns, pages, resources, missing,
  fieldMetrics: { GSC: null, GA4: null, coreWebVitals: null }, browserInteractionTested: false };
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log('SEO_PUBLIC_AUDIT ' + JSON.stringify(report));
if (verify) {
  for (const item of [...pages, ...resources]) assert.equal(item.status, 200, item.path);
  assert.equal(missing.status, 404, 'missing page must return HTTP 404');
  assert.match(missing.robots ?? '', /noindex/, '404 page excluded from search');
  const sitemap = resources.find(r => r.path === '/sitemap.xml');
  assert.ok(!sitemap.urls.some(url => new URL(url).pathname === '/submit/'), 'noindex form absent from XML sitemap');
  const htmlSitemap = pages.find(p => p.path === '/sitemap.html');
  for (const path of ['/connect/sign-cafe/overseas/', '/connect/sign-cafe/events/']) {
    assert.ok(htmlSitemap.internalLinks.some(href => new URL(href, new URL('/sitemap.html', base)).pathname === path), path + ' discoverable');
  }
  assert.ok(pages.find(p => p.path === '/guide/').canonical === new URL('/guide.html',base).href, 'guide entry reaches existing content');
  console.log('SEO_PUBLIC_RELEASE_OK');
}
}
