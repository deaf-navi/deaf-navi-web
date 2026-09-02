/**
 * Deaf Navi Web Service Worker。
 *
 * 方針:
 * - ページ・データ(JSON)はネットワーク優先。オフライン時のみキャッシュを返す
 *   （古いニュースを「最新」と誤認させない。鮮度表示はページ側の最終更新時刻が担う）
 * - 静的アセット(CSS/JS/画像)はキャッシュ優先 + 背景更新
 * - 暮らしのガイドは災害時利用を想定してプリキャッシュ
 *
 * 2026-09-02T22:58:34.530Z-8290626cb856 と 8290626cb856 はビルド時に置換され、キャッシュ世代を切り替える。
 */

const BUILD_ID = '2026-09-02T22:58:34.530Z-8290626cb856';
const ASSET_VERSION = '8290626cb856';
const CACHE_NAME = `deaf-navi-${BUILD_ID}`;

const PRECACHE_URLS = [
  './',
  `./styles.css?v=${ASSET_VERSION}`,
  `./ui-controls.js?v=${ASSET_VERSION}`,
  `./app.js?v=${ASSET_VERSION}`,
  `./webmcp.js?v=${ASSET_VERSION}`,
  './guide.html',
  './guide.js',
  './otomado/',
  './offline.html',
  './favicon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 1件の失敗で全体を止めない（addAllは使わない）
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('deaf-navi-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached ?? (await refresh) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // フォント等の外部リソースはブラウザ任せ

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './offline.html'));
    return;
  }

  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(request));
});
