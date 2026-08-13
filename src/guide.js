(() => {
  // Service Worker 登録・表示設定は ui-controls.js が担当
  const input = document.querySelector('#guide-search');
  const sections = [...document.querySelectorAll('[data-guide-section]')];
  const items = [...document.querySelectorAll('[data-guide-item]')];
  const visibleCount = document.querySelector('#guide-visible-count');
  const empty = document.querySelector('#guide-empty');

  if (!input || !items.length) return;

  const normalize = (value) => String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/\s+/g, ' ')
    .trim();

  const update = () => {
    const query = normalize(input.value);
    let count = 0;

    for (const item of items) {
      const matches = !query || normalize(item.dataset.guideSearch).includes(query);
      item.hidden = !matches;
      if (matches) count += 1;
    }

    for (const section of sections) {
      const sectionCount = section.querySelectorAll('[data-guide-item]:not([hidden])').length;
      section.hidden = sectionCount === 0;
      const countLabel = section.querySelector('[data-guide-section-count]');
      if (countLabel) countLabel.textContent = `${sectionCount}件`;
    }

    visibleCount.textContent = String(count);
    empty.hidden = count !== 0;
  };

  input.addEventListener('input', update);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !input.value) return;
    input.value = '';
    update();
  });

  update();
})();
