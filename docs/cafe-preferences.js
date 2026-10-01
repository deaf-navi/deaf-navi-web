// Apply the existing display preference before paint, within the cafe CSP.
(() => {
  try {
    const theme = localStorage.getItem('dn-theme');
    const font = localStorage.getItem('dn-font');
    if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
    if (font === 'large' || font === 'xlarge') document.documentElement.setAttribute('data-font', font);
  } catch { /* Storage may be unavailable; the standard display stays usable. */ }
})();
