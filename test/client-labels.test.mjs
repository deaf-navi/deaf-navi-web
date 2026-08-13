/**
 * クライアント(app.js)に埋め込んだ表示ラベルが config と同期していることを検証する。
 * app.js はビルドを介さない静的ファイルのため、ラベルの二重管理をテストで担保する。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORY_UI, SOURCE_TIER_UI } from '../config/categories.mjs';
import { REGION_ORDER } from '../config/regions.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const appJs = readFileSync(join(root, 'src', 'app.js'), 'utf8');

test('app.js のカテゴリラベルが config/categories.mjs と一致する', () => {
  for (const [id, label] of Object.entries(CATEGORY_UI)) {
    assert.ok(
      appJs.includes(`${id}: '${label}'`),
      `app.js のカテゴリ ${id} のラベルが config と不一致（期待: ${label}）`,
    );
  }
});

test('app.js の情報源区分ラベルが config と一致する', () => {
  for (const [id, meta] of Object.entries(SOURCE_TIER_UI)) {
    assert.ok(appJs.includes(`label: '${meta.label}'`), `app.js の tier ${id} ラベル不一致`);
    assert.ok(appJs.includes(`description: '${meta.description}'`), `app.js の tier ${id} 説明不一致`);
  }
});

test('app.js の地域フィルタ許容値が config/regions.mjs と一致する', () => {
  const expected = REGION_ORDER.filter((r) => r !== 'nationwide');
  for (const region of expected) {
    assert.ok(appJs.includes(`'${region}'`), `app.js に地域 ${region} がありません`);
  }
});
