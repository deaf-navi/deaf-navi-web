/**
 * RSS 2.0 / Atom フィードのパーサ（正規表現ベース・依存ゼロ）。
 *
 * ここでは「取得したXMLから記事エントリを取り出す」ことだけを行い、
 * カテゴリ分類・スコアリング・情報源区分の推定は lib/curation.mjs が担当する。
 *
 * 日付が解釈できないエントリは publishedAt: null とする（v1 は取得時刻に
 * すり替えていたが、古い記事が「新着」として居座る原因だったため 2.0 で廃止）。
 */

import { cleanHtml, cleanSummaryText } from './text.mjs';

export function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return plain?.[1]?.trim() ?? '';
}

export function extractAttr(xml, tag, attr, attrPattern = '') {
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*${attrPattern})[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i');
  return xml.match(pattern)?.[1]?.trim() ?? '';
}

/** Google News の description 内から元記事URLを取り出す */
export function extractActualUrl(description, fallback) {
  const match = description.match(/href="(https?:\/\/(?!news\.google\.com\/)[^"]+)"/i);
  return match?.[1] ?? fallback;
}

/** 日付文字列 → ISO 8601。解釈できなければ null */
export function parseDateToIso(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function parseRssItems(xml, sourceOverride) {
  const results = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of itemMatches) {
    const block = match[1];
    const title = cleanHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const rawDescription = extractTag(block, 'description');
    const rawSummary = cleanHtml(rawDescription);
    const articleUrl = sourceOverride ? link : extractActualUrl(rawDescription, link);

    let sourceName;
    let sourceUrl;
    if (sourceOverride) {
      sourceName = sourceOverride.sourceName;
      sourceUrl = sourceOverride.sourceUrl;
    } else {
      const sourceMatch = block.match(/<source\s+url="([^"]*)"[^>]*>([^<]*)<\/source>/i);
      sourceName = sourceMatch?.[2]?.trim() ?? 'Google News';
      sourceUrl = sourceMatch?.[1]?.trim() ?? 'https://news.google.com/';
    }

    if (!title || !link) continue;

    results.push({
      id: articleUrl,
      title,
      summary: cleanSummaryText(rawSummary, title, sourceName),
      sourceName,
      sourceUrl,
      publishedAt: parseDateToIso(pubDate),
      sourceType: sourceOverride?.sourceType ?? 'rss',
    });
  }

  return results;
}

function parseAtomEntries(xml, sourceOverride) {
  const results = [];
  const entryMatches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)];

  for (const match of entryMatches) {
    const block = match[1];
    const title = cleanHtml(extractTag(block, 'title') || extractTag(block, 'media:title'));
    const rawSummary = extractTag(block, 'summary')
      || extractTag(block, 'content')
      || extractTag(block, 'media:description');
    const cleanedSummary = cleanHtml(rawSummary);
    const alternateLink = extractAttr(block, 'link', 'href', 'rel=["\']alternate["\']')
      || extractAttr(block, 'link', 'href');
    const id = extractTag(block, 'id') || alternateLink;
    const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');
    const articleUrl = alternateLink || id;

    if (!title || !articleUrl) continue;

    const authorName = cleanHtml(extractTag(block, 'name'));
    const authorUri = extractTag(block, 'uri');
    const sourceName = sourceOverride?.sourceName ?? (authorName || 'Atom Feed');
    const sourceUrl = sourceOverride?.sourceUrl ?? (authorUri || articleUrl);

    results.push({
      id: articleUrl,
      title,
      summary: cleanSummaryText(cleanedSummary, title, sourceName),
      sourceName,
      sourceUrl,
      publishedAt: parseDateToIso(pubDate),
      sourceType: sourceOverride?.sourceType ?? 'atom',
    });
  }

  return results;
}

/**
 * RSS と Atom の両形式を試して結合する。
 * @param {string} xml フィード本文
 * @param {object|null} sourceOverride 直接フィードの定義（Google News発見系は null）
 * @returns {Array<{id, title, summary, sourceName, sourceUrl, publishedAt, sourceType}>}
 */
export function parseFeedEntries(xml, sourceOverride = null) {
  return [
    ...parseRssItems(xml, sourceOverride),
    ...parseAtomEntries(xml, sourceOverride),
  ];
}
