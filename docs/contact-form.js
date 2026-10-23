// Reuse the live cafe form, including its session-bound CSRF token. The static page
// retains a working form link without JavaScript or when the backend is unavailable.
const slot = document.querySelector('[data-contact-form]');
if (slot) {
  const endpoint = new URL('/submit/?form=contact&scope=site', location.origin);
  if (new URLSearchParams(location.search).get('dn_client') === 'codex') endpoint.searchParams.set('dn_client', 'codex');
  fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error('Form unavailable');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const form = doc.querySelector('#contact');
      if (!form?.querySelector('input[name="csrf"]')) throw new Error('Form missing');
      // Avoid replacing a link that a keyboard user has already focused.
      const focused = slot.contains(document.activeElement);
      slot.replaceChildren(document.importNode(form, true));
      const embedded = slot.querySelector('form');
      const pendingSafety = event => event.preventDefault();
      embedded.addEventListener('submit', pendingSafety);
      const safety = document.createElement('script');
      safety.src = '/directory-safety.js';
      safety.onload = () => embedded.removeEventListener('submit', pendingSafety);
      safety.onerror = () => {
        const notice = document.createElement('p');
        notice.setAttribute('role', 'alert');
        notice.textContent = '送信の準備ができませんでした。ページを再読み込みするか、専用フォームから送信してください。';
        const link = document.createElement('a');
        link.href = endpoint.href;
        link.textContent = '専用フォームを開く';
        notice.append(' ', link);
        embedded.append(notice);
      };
      document.head.append(safety);
      if (focused) slot.querySelector('summary')?.focus();
    })
    .catch(() => {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'このページ内でフォームを読み込めませんでした。上のリンクから開いてください。';
      slot.append(message);
    });
}
