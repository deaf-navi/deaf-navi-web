import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
function harness() {
  const listeners = {}, timers = new Map(), requests = [];
  let timerId = 0, idle;
  function element() {
    return {
      hidden: true, textContent: '', children: [], attrs: {},
      getAttribute(k) { return this.attrs[k] ?? null; },
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(k, fn) { this[k] = fn; },
      appendChild(e) { this.children.push(e); },
      querySelectorAll() { return []; }, querySelector() { return null; },
    };
  }
  const note = element(), articles = element();
  note.attrs['data-generated-at'] = '2026-10-20T00:00:00Z';
  const doc = {
    hidden: false,
    getElementById: id => ({ 'articles': articles, 'offline-note': note })[id] || null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: element, addEventListener(k, fn) { listeners['document:' + k] = fn; },
  };
  const window = { location: { search: '', pathname: '/' }, history: { replaceState() {} },
    addEventListener(k, fn) { listeners[k] = fn; }, requestIdleCallback(fn) { idle = fn; } };
  const navigator = { onLine: true };
  const fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ resolve, reject });
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const ctx = { document: doc, window, navigator, fetch, URLSearchParams, URL, AbortController,
    requestIdleCallback: window.requestIdleCallback,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(source, ctx);
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  return { window, navigator, note, requests, listeners, timers, start: () => idle(), flush };
}
const data = (cached = false) => new Response(JSON.stringify({
  generatedAt: '2026-10-20T01:00:00Z', articles: [{id: 'https://example.org/news', title: '手話のニュース', category: 'general'}],
}), { headers: cached ? { 'X-DeafNavi-Cache': 'fallback' } : {} });

test('news fetch failure is visible and online recovery re-fetches successfully', async () => {
  const h = harness(); h.start();
  h.requests[0].reject(new Error('temporary network failure')); await h.flush();
  assert.equal(h.note.hidden, false);
  assert.equal(h.window.DeafNaviApp.getViewState().dataMode, 'ssr-fallback');
  h.listeners.online(); await h.flush();
  assert.equal(h.requests.length, 2);
  // A connection event must not hide an unresolved server failure.
  assert.equal(h.note.hidden, false);
  h.requests[1].resolve(data()); await h.flush();
  assert.equal(h.note.hidden, true);
  assert.equal(h.window.DeafNaviApp.getViewState().dataMode, 'all-data');
});
test('cached JSON is disclosed even when the browser reports online', async () => {
  const h = harness(); h.start(); h.requests[0].resolve(data(true)); await h.flush();
  assert.equal(h.note.hidden, false);
  assert.equal(h.window.DeafNaviApp.getViewState().dataStatus, 'cached');
});
test('malformed JSON does not become a successful empty news list', async () => {
  const h = harness(); h.start();
  h.requests[0].resolve(new Response('{"message":"unavailable"}')); await h.flush();
  assert.equal(h.note.hidden, false);
  assert.equal(h.window.DeafNaviApp.getViewState().dataMode, 'ssr-fallback');
});
test('offline event is visible; successful recovery clears the notice', async () => {
  const h = harness(); h.start(); h.requests[0].resolve(data()); await h.flush();
  h.navigator.onLine = false; h.listeners.offline();
  assert.equal(h.note.hidden, false);
  h.navigator.onLine = true; h.listeners.online(); await h.flush();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(data()); await h.flush();
  assert.equal(h.note.hidden, true);
});
test('background retries stop after two attempts; manual retry still works', async () => {
  const h = harness(); h.start();
  for (let i = 0; i < 3; i++) {
    h.requests[i].reject(new Error('still unavailable')); await h.flush();
    const retry = [...h.timers.values()].find(t => t.ms !== 12000);
    if (i < 2) { assert.ok(retry); retry.fn(); await h.flush(); }
    else assert.equal(retry, undefined);
  }
  assert.equal(h.requests.length, 3);
  assert.equal(h.note.hidden, false);
  h.note.children.at(-1).click(); await h.flush();
  h.requests[3].resolve(data()); await h.flush();
  assert.equal(h.note.hidden, true);
});
test('a stalled request times out and preserves the readable fallback', async () => {
  const h = harness(); h.start();
  [...h.timers.values()].find(t => t.ms === 12000).fn(); await h.flush();
  assert.equal(h.note.hidden, false);
  assert.equal(h.window.DeafNaviApp.getViewState().dataStatus, 'error');
});
test('failed refresh preserves already loaded news and reports the failure', async () => {
  const h = harness(); h.start(); h.requests[0].resolve(data()); await h.flush();
  h.listeners.online(); h.requests[1].reject(new Error('503')); await h.flush();
  assert.equal(h.window.DeafNaviApp.getViewState().dataMode, 'all-data');
  assert.equal(h.note.hidden, false);
});
