export function injectAccessVisit(html) {
  if (typeof html !== 'string' || html.includes('src="/access-visit.js"')) return html;
  return html.replace(/<\/body\s*>/i, '<script src="/access-visit.js" defer></script><script src="/access-engagement.js?v=20261019a" defer></script>\n</body>');
}
