(() => {
  // The exclusion flag is propagated through navigation, without cookies or storage.
  if (window.__dnVisitSent || !['deafnavi.com', '127.0.0.1', 'localhost'].includes(location.hostname)) return;
  window.__dnVisitSent = true;
  let marker = new URLSearchParams(location.search).get('dn_client');
  if (!['codex', 'automation'].includes(marker)) {
    try {
      const previous = new URL(document.referrer);
      marker = previous.origin === location.origin ? previous.searchParams.get('dn_client') : null;
    } catch { marker = null; }
  }
  if (!['codex', 'automation'].includes(marker)) marker = navigator.webdriver === true ? 'automation' : null;
  if (marker) {
    const mark = (value) => {
      try {
        const url = new URL(value || location.href, location.href);
        if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return value;
        url.searchParams.set('dn_client', marker);
        return url.href;
      } catch { return value; }
    };
    const markLink = (link) => {
      if (link && !link.hasAttribute('download')) link.setAttribute('href', mark(link.getAttribute('href')));
    };
    document.querySelectorAll('a[href]').forEach(markLink);
    for (const eventName of ['click', 'auxclick']) document.addEventListener(eventName, (event) => markLink(event.target.closest?.('a[href]')), true);
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.tagName !== 'FORM') return;
      if (new URL(form.action || location.href, location.href).origin !== location.origin) return;
      form.action = mark(form.action);
      // GET form submission replaces the action query, so retain only the known flag.
      if ((form.method || 'get').toLowerCase() === 'get') {
        let field = form.querySelector('input[name="dn_client"]');
        if (!field) { field = document.createElement('input'); field.type = 'hidden'; field.name = 'dn_client'; form.append(field); }
        field.value = marker;
      }
    }, true);
  }
  if (/^\/(admin|submit|_backend|_access|app)(\/|$)/.test(location.pathname)
      || /\/(404|offline)\.html$/.test(location.pathname)) return;
  const headers = {'Content-Type': 'application/json'};
  if (marker) headers['X-DeafNavi-Client'] = marker;
  fetch('/_access/visit', {
    method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    keepalive: true, headers,
    body: JSON.stringify({path: location.pathname, automated: navigator.webdriver === true}),
  }).catch(() => {});
})();
