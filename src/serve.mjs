/**
 * ローカル確認用の簡易サーバ（docs/ を配信）。
 * 使い方: npm run serve → http://localhost:5173
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(join(__dirname, '..', 'docs'));
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = url.endsWith('/') ? `${url}index.html` : url;
  const filePath = resolve(join(DOCS, normalize(path)));

  // docs/ の外へ出るパスは拒否（パストラバーサル対策）
  if (filePath !== DOCS && !filePath.startsWith(DOCS + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error('not file');
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}).listen(PORT, () => {
  console.log(`Preview server: http://localhost:${PORT}`);
});
