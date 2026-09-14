// Pure helpers shared by feed parsing, metadata collection and HTML rendering.
export function publicUrl(value, base) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null;
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || (url.port && !['80', '443'].includes(url.port))
      || !host.includes('.') || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function imageUrl(value, base) {
  const url = publicUrl(value, base);
  if (!url || !url.startsWith('https:')) return null;
  const parsed = new URL(url);
  if (parsed.port || parsed.hostname === 'news.google.com'
    || /(?:logo|favicon|placeholder|no[-_]?image|default[-_]?image|GoogleDiscoverThumbnail)/i.test(parsed.pathname.split('/').pop())
    || /(?:^|[\/_.-])(?:logo|favicon|sprite|placeholder|no[-_]?image|default[-_]?image)(?:[\/_.-]|$)/i.test(parsed.pathname)
    || /\.svg$/i.test(parsed.pathname)) return null;
  return url;
}

function entities(value) {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[\da-f]+|\d+);/gi, (match) => {
    const names = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (names[match.toLowerCase()]) return names[match.toLowerCase()];
    const n = match[2].toLowerCase() === 'x' ? parseInt(match.slice(3), 16) : parseInt(match.slice(2), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}

export function tagAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = entities(match[2] ?? match[3] ?? match[4]);
  }
  return attrs;
}

export function feedThumbnail(block, base) {
  const candidates = [];
  for (const match of block.matchAll(/<(media:content|media:thumbnail|enclosure|link)\b[^>]*>/gi)) {
    const a = tagAttributes(match[0]);
    const tag = match[1].toLowerCase();
    if (tag === 'link' && a.rel !== 'enclosure') continue;
    if (a.type && !a.type.startsWith('image/')) continue;
    if (a.medium && a.medium !== 'image') continue;
    if ((a.width && Number(a.width) < 100) || (a.height && Number(a.height) < 60)) continue;
    const url = imageUrl(a.url || a.href, base);
    if (url) candidates.push({ url, source: 'rss', pageUrl: publicUrl(base) });
  }
  return candidates[0] || null;
}

export function pageThumbnails(html, pageUrl) {
  if (!publicUrl(pageUrl) || new URL(pageUrl).hostname === 'news.google.com') return [];
  const head = html.split(/<\/head\s*>/i)[0]
    .replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  const meta = new Map();
  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }
  const results = [];
  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    if (key.startsWith('og:') && ((meta.has('og:image:width') && Number(meta.get('og:image:width')) < 100)
      || (meta.has('og:image:height') && Number(meta.get('og:image:height')) < 60))) continue;
    const url = imageUrl(meta.get(key), pageUrl);
    if (url && !results.some((item) => item.url === url)) {
      results.push({ url, source: key.startsWith('og:') ? 'og:image' : 'twitter:image', pageUrl });
    }
  }
  return results;
}
