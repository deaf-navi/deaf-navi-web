// The server remains authoritative; these controls only prevent conflicting selections.
(() => {
  const form = document.querySelector('form[data-pref-regions]');
  if (!form) return;
  const region = form.elements.namedItem('region');
  const prefecture = form.elements.namedItem('prefecture');
  if (!region || !prefecture) return;
  let regions;
  try { regions = JSON.parse(form.dataset.prefRegions); } catch { return; }
  const sync = () => {
    if (region.value && prefecture.value && regions[prefecture.value] !== region.value) prefecture.value = '';
    for (const option of prefecture.options) {
      option.disabled = Boolean(option.value && region.value && regions[option.value] !== region.value);
      option.hidden = option.disabled;
    }
  };
  // Do not silently rewrite a bookmarked, conflicting query on arrival.
  region.addEventListener('change', sync);
  prefecture.addEventListener('change', () => {
    if (prefecture.value && region.value) region.value = regions[prefecture.value] || '';
    sync();
  });
  const query = form.elements.namedItem('q');
  if (query) query.placeholder = '例：東京 手話（空白で区切る）';
})();
