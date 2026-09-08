// Retire old cache-all workers before authenticated POSTs. No analytics or form data access.
(() => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  let ready = false;
  const forms = [...document.querySelectorAll('form[method="post" i]')];
  for (const form of forms) form.addEventListener('submit', event => { if (!ready) event.preventDefault(); });
  const controls = new Map(forms.flatMap(form => [...form.querySelectorAll('button[type="submit"],button:not([type]),input[type="submit"],input[type="image"]')]).map(button => [button, button.disabled]));
  const busy = new Map(forms.map(form => [form, form.getAttribute('aria-busy')]));
  controls.forEach((_disabled, button) => { button.disabled = true; });
  forms.forEach(form => form.setAttribute('aria-busy', 'true'));
  // Routine checks must not insert/remove visible content or move the page.
  function restoreBusy() {
    busy.forEach((value, form) => value === null ? form.removeAttribute('aria-busy') : form.setAttribute('aria-busy', value));
  }
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
    ready = true;
    controls.forEach((disabled, button) => { button.disabled = disabled; });
    restoreBusy();
  })().catch(() => {
    restoreBusy();
    for (const target of forms.length ? forms : [document.querySelector('main')].filter(Boolean)) {
      const notice = document.createElement('p'); notice.className = 'dn-error'; notice.setAttribute('role', 'alert');
      notice.textContent = '送信の準備を完了できませんでした。ページを再読み込みしてから、もう一度お試しください。';
      target.append(notice);
    }
  });
})();
