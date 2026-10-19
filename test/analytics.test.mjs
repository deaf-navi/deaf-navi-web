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

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('verification marker preserves POST destinations with named action controls and GET filters', () => {
  const handlers = {};
  const location = new URL('https://deafnavi.com/admin/?view=edit&dn_client=codex');
  runInNewContext(readFileSync(new URL('../src/access-visit.js', import.meta.url), 'utf8'), {
    window: {}, location, URL, URLSearchParams, navigator: {},
    document: { referrer: '', querySelectorAll: () => [], addEventListener: (name, fn) => {handlers[name]=fn;}, createElement: () => ({}) },
  });
  function form(action, method) {
    const attrs = {action, method}; const fields=[];
    return {tagName:'FORM', action:{toString:()=> '[object HTMLInputElement]'}, method:{}, attrs, fields,
      getAttribute:key=>attrs[key],setAttribute:(key,value)=>{attrs[key]=value;},querySelector:()=>fields[0],append:field=>fields.push(field)};
  }
  for (const action of [null, '', '/admin/']) {
    const f=form(action,'post'); handlers.submit({target:f});
    const target=new URL(f.attrs.action);
    assert.equal(target.pathname,'/admin/');assert.equal(target.searchParams.get('dn_client'),'codex');assert.equal(f.fields.length,0);
  }
  const get=form('/connect/sign-cafe/','get');handlers.submit({target:get});handlers.submit({target:get});
  assert.equal(get.fields.length,1);assert.equal(get.fields[0].value,'codex');
  const external=form('https://example.org/submit','post');handlers.submit({target:external});
  assert.equal(external.attrs.action,'https://example.org/submit');
});
