/**
 * テキスト処理ユーティリティ（純関数のみ）。
 */

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, '・')
    .replace(/&amp;/g, '&'); // &amp; は最後（多重エンコード対応）
}

export function cleanHtml(text) {
  // 1) 多重エンコード対策: 変化しなくなるまで最大3回デコード（例: &amp;nbsp; -> &nbsp; -> 空白）
  let decoded = text;
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  // 2) タグ除去・URL除去・残存する名前付きエンティティの除去・空白正規化
  return decoded
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&[a-zA-Z][a-zA-Z0-9]{1,20};/g, '') // デコード漏れのnamed entityを排除
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeForSearch(text) {
  return String(text).normalize('NFKC').toLowerCase();
}

export function normalizeTitleKey(title) {
  return String(title)
    .normalize('NFKC')
    .replace(/\s+[-－―]\s+[^-－―|｜]+$/u, '')
    .replace(/(20\d{2}|令和\d+)年\d{1,2}月\d{1,2}日(掲載)?/gu, '')
    .replace(/https?:\/\/\S+/gu, '')
    .replace(/[!！?？。、「」『』“”"'\s・…:：;；｜|【】［］\[\]（）()]/gu, '')
    .toLowerCase();
}

export function cleanSummaryText(summary, title, sourceName) {
  const cleaned = String(summary ?? '')
    .replace(/\s+The post[\s\S]*?first appeared on[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const withoutSource = sourceName
    ? cleaned.replace(new RegExp(escapeRegExp(sourceName), 'giu'), '').trim()
    : cleaned;
  const summaryKey = normalizeTitleKey(withoutSource);
  const titleKey = normalizeTitleKey(title);

  if (!summaryKey || summaryKey === titleKey) return '';
  if (summaryKey.startsWith(titleKey) && summaryKey.length - titleKey.length <= 8) return '';
  return cleaned.substring(0, 220);
}

export function bigrams(text) {
  const s = normalizeTitleKey(text);
  const result = new Set();
  for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2));
  return result;
}

export function diceSimilarity(a, b) {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const x of aa) {
    if (bb.has(x)) overlap += 1;
  }
  return (2 * overlap) / (aa.size + bb.size);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
