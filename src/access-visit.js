(() => {
  // No cookies/storage, query values, referrers, text, audio or persistent identifiers.
  if (window.__dnVisitSent || !['deafnavi.com', '127.0.0.1', 'localhost'].includes(location.hostname)
      || /^\/(admin|submit|_backend|_access|app)(\/|$)/.test(location.pathname)
      || /\/(404|offline)\.html$/.test(location.pathname)) return;
  window.__dnVisitSent = true;
  const marker = new URLSearchParams(location.search).get('dn_client');
  const headers = {'Content-Type': 'application/json'};
  if (marker === 'codex') headers['X-DeafNavi-Client'] = 'codex';
  fetch('/_access/visit', {
    method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    keepalive: true, headers,
    body: JSON.stringify({path: location.pathname, automated: navigator.webdriver === true}),
  }).catch(() => {});
})();
