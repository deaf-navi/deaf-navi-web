import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLOUDFLARE_ANALYTICS_BEACON_URL,
  injectCloudflareAnalytics,
  isCloudflareAnalyticsEnabled,
  renderCloudflareAnalyticsBeacon,
} from '../src/lib/analytics.mjs';

const enabled = {
  provider: 'cloudflare',
  enabled: true,
  token: '0123456789abcdef0123456789abcdef',
};

test('Cloudflare Analytics: 公式のmodule Beaconを生成する', () => {
  const beacon = renderCloudflareAnalyticsBeacon(enabled);
  assert.ok(beacon.includes('type="module"'));
  assert.ok(beacon.includes(`src="${CLOUDFLARE_ANALYTICS_BEACON_URL}"`));
  assert.ok(beacon.includes(`data-cf-beacon='{"token":"${enabled.token}"}'`));
});

test('Cloudflare Analytics: 無効・未設定・不正tokenでは挿入しない', () => {
  assert.equal(renderCloudflareAnalyticsBeacon({ ...enabled, enabled: false }), '');
  assert.equal(renderCloudflareAnalyticsBeacon({ ...enabled, token: '' }), '');
  assert.equal(renderCloudflareAnalyticsBeacon({ ...enabled, token: "bad'token" }), '');
  assert.equal(isCloudflareAnalyticsEnabled({ ...enabled, provider: 'other' }), false);
});

test('Cloudflare Analytics: </body>直前へ1回だけ挿入する', () => {
  const source = '<!doctype html><html><body><main>ok</main></body></html>';
  const once = injectCloudflareAnalytics(source, enabled);
  const twice = injectCloudflareAnalytics(once, enabled);
  assert.equal(twice, once, '二重挿入されました');
  assert.equal((once.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) ?? []).length, 1);
  assert.ok(once.indexOf(CLOUDFLARE_ANALYTICS_BEACON_URL) < once.indexOf('</body>'));
});

test('Cloudflare Analytics: 無効時と不正HTMLは入力を変更しない', () => {
  const html = '<html><body>ok</body></html>';
  assert.equal(injectCloudflareAnalytics(html, { ...enabled, enabled: false }), html);
  assert.equal(injectCloudflareAnalytics('<html>bodyなし</html>', enabled), '<html>bodyなし</html>');
});
