import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanHtml,
  cleanSummaryText,
  decodeEntities,
  diceSimilarity,
  escapeHtml,
  normalizeTitleKey,
} from '../src/lib/text.mjs';

test('decodeEntities: 基本エンティティと数値参照', () => {
  assert.equal(decodeEntities('&lt;a&gt; &amp; &quot;b&quot;'), '<a> & "b"');
  assert.equal(decodeEntities('&#12354;&#x3044;'), 'あい');
});

test('cleanHtml: 多重エンコード・タグ・URLを除去する', () => {
  assert.equal(cleanHtml('&amp;nbsp;テスト'), 'テスト');
  assert.equal(cleanHtml('<p>手話<b>ニュース</b></p>'), '手話ニュース');
  assert.equal(cleanHtml('詳細は https://example.com/x を参照'), '詳細は を参照');
  assert.equal(cleanHtml('残存&unknownentity;除去'), '残存除去');
});

test('escapeHtml: XSSベクタを無害化する', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
  );
});

test('normalizeTitleKey: 末尾の媒体名・日付・記号を除去する', () => {
  assert.equal(normalizeTitleKey('手話言語条例が成立 - 朝日新聞'), '手話言語条例が成立');
  assert.equal(normalizeTitleKey('お知らせ 2026年8月1日掲載'), 'お知らせ');
});

test('cleanSummaryText: タイトルと同一の要約は空にする', () => {
  assert.equal(cleanSummaryText('手話ニュース', '手話ニュース', 'X'), '');
  assert.equal(cleanSummaryText('手話ニュース 朝日新聞', '手話ニュース', '朝日新聞'), '');
  const distinct = cleanSummaryText('全く別の説明文です。詳しい内容がここに入ります。', '手話ニュース', 'X');
  assert.ok(distinct.length > 0);
});

test('diceSimilarity: 類似タイトルが高スコアになる', () => {
  assert.ok(diceSimilarity('デフリンピック開幕式が開催', 'デフリンピック開幕式が開催された') > 0.8);
  assert.ok(diceSimilarity('手話講座のお知らせ', '補聴器購入助成の締切') < 0.3);
});
