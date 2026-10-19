(() => {
  if (!['deafnavi.com','localhost','127.0.0.1'].includes(location.hostname)) return;
  let marker = new URLSearchParams(location.search).get('dn_client');
  try { const ref = new URL(document.referrer); if (!marker && ref.origin === location.origin) marker = ref.searchParams.get('dn_client'); } catch {}
  if (['codex','automation'].includes(marker) || navigator.webdriver) return;
  const path = location.pathname.replace(/index\.html$/, '');
  const source = path === '/' ? 'news' : path === '/news/support/' ? 'support' : path === '/news/accessibility/' ? 'accessibility' : /^\/deaf-navi-world-(jp|original)\.html$/.test(path) ? 'world' : /^\/archive\//.test(path) ? 'archive' : path === '/connect/sign-cafe/' ? 'cafe' : null;
  if (!source) return;
  const sent = new Set();
  const send = (event, key = event) => {
    if (sent.has(key)) return;
    sent.add(key);
    fetch('/_access/visit?kind=engagement', {method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',keepalive:true,body:JSON.stringify({source,event})}).catch(() => {});
  };
  const related = document.querySelector('[data-cafe-related]');
  if (related && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(e=>e.isIntersecting && e.intersectionRatio >= .25)) {send('related_view');observer.disconnect();} }, {threshold:.25});
    observer.observe(related);
  }
  const click = event => {
    if (event.type === 'auxclick' && event.button !== 1 || event.type === 'click' && event.button !== 0) return;
    const link = event.target.closest?.('a[href]'); if (!link) return;
    let url;try {url=new URL(link.href,location.href);} catch {return;}
    if (!['https:','http:'].includes(url.protocol)) return;
    if (source === 'cafe') {
      if (link.closest('[data-cafe-related]') && url.origin === location.origin) send('related_click','related:'+url.href);
      else if (link.closest('#cafes') && url.origin === location.origin && /^\/connect\/sign-cafe\/[a-z0-9-]+\/$/.test(url.pathname) && !['map','events','overseas'].includes(url.pathname.split('/')[3])) send('cafe_detail','detail:'+url.pathname);
    } else if (url.origin !== location.origin && link.matches('.card__title a, a.card__read, .reader-news h3 a, .reader-news-related a, .topic-related a')) send('article_click','article:'+url.href);
  };
  document.addEventListener('click',click);document.addEventListener('auxclick',click);
  if(source==='cafe')document.addEventListener('submit',e=>{if(e.target.querySelector('[name="q"]'))send('cafe_search');});
})();
