// Retire old cache-all workers before authenticated POSTs. No analytics or form data access.
(() => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  let ready = false;
  const forms = [...document.querySelectorAll('form[method="post"]')];
  for (const form of forms) form.addEventListener('submit', event => { if (!ready) event.preventDefault(); });
  const controls = forms.flatMap(form => [...form.querySelectorAll('button[type="submit"],button:not([type])')]);
  controls.forEach(button => { button.disabled = true; });
  const notice = document.createElement('p'); notice.className = 'dn-notice'; notice.setAttribute('role', 'status');
  notice.textContent = 'フォームの保護状態を確認しています…';
  document.querySelector('main')?.prepend(notice);
  function safeWorker() {
    if (!navigator.serviceWorker.controller) return Promise.resolve(true);
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 800);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data === 'NO_DIRECTORY_CACHE'); };
      navigator.serviceWorker.controller.postMessage('DEAFNAVI_DIRECTORY_SAFETY', [channel.port2]);
    });
  }
  async function purgePrivateCache() {
    if (!('caches' in window)) return;
    for (const name of await caches.keys()) {
      if (!name.startsWith('deaf-navi-')) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (/^\/(?:admin(?:\/|$)|submit(?:\/|$)|connect\/sign-cafe(?:\/|$))/.test(new URL(request.url).pathname)) await cache.delete(request);
      }
    }
  }
  (async () => {
    await purgePrivateCache();
    if (!await safeWorker()) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const own = registrations.filter(r => r.scope === location.origin + '/');
      await Promise.all(own.map(r => r.update().catch(() => null)));
      if (!await safeWorker()) {
        await Promise.all(own.map(r => r.unregister()));
        await purgePrivateCache();
        location.reload(); return;
      }
    }
    ready = true; controls.forEach(button => { button.disabled = false; }); notice.remove();
  })().catch(() => { notice.textContent = '保護状態を確認できません。ページを再読み込みしてから操作してください。'; });
})();
