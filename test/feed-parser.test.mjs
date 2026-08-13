import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractActualUrl, parseDateToIso, parseFeedEntries } from '../src/lib/feed-parser.mjs';

const RSS_SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[手話言語条例が成立]]></title>
    <link>https://news.google.com/rss/articles/abc?oc=5</link>
    <pubDate>Mon, 11 Aug 2026 09:00:00 GMT</pubDate>
    <description>&lt;a href="https://example.com/article1"&gt;記事&lt;/a&gt; 条例の概要説明がここに入ります。</description>
    <source url="https://example.com">サンプル新聞</source>
  </item>
  <item>
    <title>日付が壊れている記事</title>
    <link>https://example.com/broken-date</link>
    <pubDate>not-a-date</pubDate>
    <description>説明</description>
  </item>
  <item>
    <title></title>
    <link>https://example.com/no-title</link>
    <pubDate>Mon, 11 Aug 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM_SAMPLE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>新しい動画</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=xyz"/>
    <id>yt:video:xyz</id>
    <published>2026-08-10T00:00:00+00:00</published>
    <media:description>手話に関する動画の説明</media:description>
    <author><name>公式チャンネル</name><uri>https://www.youtube.com/@example</uri></author>
  </entry>
</feed>`;

test('RSS: Google News経由は元記事URLを抽出する', () => {
  const entries = parseFeedEntries(RSS_SAMPLE, null);
  const first = entries[0];
  assert.equal(first.id, 'https://example.com/article1');
  assert.equal(first.title, '手話言語条例が成立');
  assert.equal(first.sourceName, 'サンプル新聞');
  assert.ok(first.publishedAt.startsWith('2026-08-11T09:00:00'));
});

test('RSS: 直接フィードはlinkをそのまま使いsourceを上書きする', () => {
  const feedDef = { sourceName: '公式団体', sourceUrl: 'https://official.example/', sourceType: 'rss' };
  const entries = parseFeedEntries(RSS_SAMPLE, feedDef);
  assert.equal(entries[0].id, 'https://news.google.com/rss/articles/abc?oc=5');
  assert.equal(entries[0].sourceName, '公式団体');
});

test('RSS: 不正な日付は null になる（v1の「現在時刻すり替え」を廃止）', () => {
  const entries = parseFeedEntries(RSS_SAMPLE, null);
  const broken = entries.find((e) => e.id === 'https://example.com/broken-date');
  assert.equal(broken.publishedAt, null);
});

test('RSS: タイトルのない項目はスキップされる', () => {
  const entries = parseFeedEntries(RSS_SAMPLE, null);
  assert.equal(entries.length, 2);
});

test('Atom: entry を解析し published を使う', () => {
  const entries = parseFeedEntries(ATOM_SAMPLE, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'https://www.youtube.com/watch?v=xyz');
  assert.equal(entries[0].sourceName, '公式チャンネル');
  assert.ok(entries[0].publishedAt.startsWith('2026-08-10'));
});

test('extractActualUrl: news.google.com 以外の最初のhrefを返す', () => {
  assert.equal(
    extractActualUrl('<a href="https://news.google.com/x">g</a> <a href="https://real.example/a">r</a>', 'fb'),
    'https://real.example/a',
  );
  assert.equal(extractActualUrl('リンクなし', 'https://fallback.example/'), 'https://fallback.example/');
});

test('parseDateToIso: 妥当な日付のみISOへ', () => {
  assert.equal(parseDateToIso('garbage'), null);
  assert.equal(parseDateToIso(''), null);
  assert.ok(parseDateToIso('Mon, 11 Aug 2026 09:00:00 GMT').endsWith('Z'));
});
