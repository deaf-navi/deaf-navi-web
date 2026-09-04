/**
 * GitHub Pages向け互換成果物を生成する。
 *
 * main/docs はXServerへ配置する完全サイトの正本として維持する。
 * GitHub PagesではHTMLだけを独自ドメインへ転送し、JSON/RSS/画像等は
 * 出荷済みアプリとの互換性のため実ファイルとして残す。
 */

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = join(ROOT, 'docs');
const DEFAULT_OUTPUT = join(ROOT, '_site');

export const NEW_BASE = 'https://deafnavi.com/';
export const OLD_SITE_PATH = '/deaf-navi-web';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function targetForHtml(relativePath) {
  const normalized = relativePath.split(sep).join('/');
  if (normalized === 'index.html' || normalized === '404.html') return NEW_BASE;
  if (normalized.endsWith('/index.html')) {
    return new URL(normalized.slice(0, -'index.html'.length), NEW_BASE).href;
  }
  return new URL(normalized, NEW_BASE).href;
}

export function redirectPage(target) {
  const safeTarget = escapeHtml(target);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>Deaf Naviは移転しました</title>
  <link rel="canonical" href="${safeTarget}">
  <script src="${OLD_SITE_PATH}/redirect.js"></script>
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
  <style>
    body { margin: 0; color: #162622; background: #f4f7f6; font-family: system-ui, sans-serif; }
    main { max-width: 42rem; margin: 12vh auto; padding: 2rem; border-left: 4px solid #08766d; background: #fff; }
    h1 { margin-top: 0; font-size: 1.5rem; }
    a { color: #075e57; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Deaf Naviは移転しました</h1>
    <p>新しいページへ移動しています。</p>
    <p><a data-new-location href="${safeTarget}">移動しない場合はこちらを開いてください</a></p>
  </main>
</body>
</html>
`;
}

export const REDIRECT_JS = `(() => {
  const oldBase = '${OLD_SITE_PATH}';
  let path = location.pathname;
  if (path === oldBase) path = '/';
  else if (path.startsWith(oldBase + '/')) path = path.slice(oldBase.length);
  else path = '/';

  const target = new URL(path || '/', '${NEW_BASE}');
  target.search = location.search;
  target.hash = location.hash;

  const link = document.querySelector('[data-new-location]');
  if (link) link.href = target.href;
  location.replace(target.href);
})();
`;

export const RETIRE_SERVICE_WORKER_JS = `const NEW_BASE = '${NEW_BASE}';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('deaf-navi-') || key.startsWith('otomado-'))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  const oldBase = '${OLD_SITE_PATH}';
  const source = new URL(event.request.url);
  let path = source.pathname.startsWith(oldBase)
    ? source.pathname.slice(oldBase.length)
    : '/';
  if (!path) path = '/';
  const target = new URL(path, NEW_BASE);
  target.search = source.search;
  target.hash = source.hash;
  event.respondWith(Response.redirect(target.href, 302));
});
`;

async function listHtmlFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
    }
  }
  await visit(root);
  return files;
}

export async function buildGitHubPagesCompat({
  sourceDir = DEFAULT_SOURCE,
  outputDir = DEFAULT_OUTPUT,
} = {}) {
  const source = resolve(sourceDir);
  const output = resolve(outputDir);
  if (source === output) throw new Error('互換成果物の出力先はdocs以外にしてください。');

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true, force: true });

  const htmlFiles = await listHtmlFiles(output);
  for (const file of htmlFiles) {
    const rel = relative(output, file);
    await writeFile(file, redirectPage(targetForHtml(rel)), 'utf8');
  }

  await writeFile(join(output, 'redirect.js'), REDIRECT_JS, 'utf8');
  await writeFile(join(output, 'sw.js'), RETIRE_SERVICE_WORKER_JS, 'utf8');
  await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${NEW_BASE}sitemap.xml\n`, 'utf8');

  console.log(`Built GitHub Pages compatibility artifact: ${htmlFiles.length} redirects; non-HTML files preserved.`);
  return { htmlCount: htmlFiles.length, outputDir: output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildGitHubPagesCompat({ outputDir: process.argv[2] ?? DEFAULT_OUTPUT });
}
