/* おとまど Service Worker
   - アプリシェル: install 時にプリキャッシュ、更新は stale-while-revalidate
   - AIモデル等の外部静的資産: 専用キャッシュにキャッシュ優先（初回取得後はオフライン動作）
   キャッシュはアプリ用とモデル用を分離する:
   デプロイごとに APP_CACHE のバージョンを上げて旧アセットを掃除しても、
   約4MBのモデルキャッシュ（オフライン動作の要）は巻き添えにしない。
*/
const APP_CACHE = 'otomado-app-v3'
const MODEL_CACHE = 'otomado-model-v1'
const KEEP_CACHES = [APP_CACHE, MODEL_CACHE]
const CACHE_PREFIX = 'otomado-'
const PRECACHE = ['./', './index.html', './manifest.webmanifest']
const STATIC_REMOTE_HOSTS = ['tfhub.dev', 'storage.googleapis.com', 'raw.githubusercontent.com']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && !KEEP_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // ページ遷移: ネットワーク優先、オフライン時はキャッシュ済み index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 404 ページやキャプティブポータルの応答でアプリシェルを上書きしない
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(APP_CACHE).then((cache) => cache.put('./index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // AIモデル・クラスマップ: キャッシュ優先（実質 immutable）
  if (STATIC_REMOTE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(MODEL_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // 同一オリジンの静的資産: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(APP_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          })
          .catch(() => hit)
        return hit || network
      }),
    )
  }
})
