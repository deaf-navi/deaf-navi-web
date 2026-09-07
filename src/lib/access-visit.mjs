export function injectAccessVisit(html) {
  if (typeof html !== 'string' || html.includes('src="/access-visit.js"')) return html;
  return html.replace(/<\/body\s*>/i, '<script src="/access-visit.js" defer></script>\n</body>');
}
