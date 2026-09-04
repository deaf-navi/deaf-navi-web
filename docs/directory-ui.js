// Progressive enhancement only: server-rendered links and individual pages work without JS.
(() => {
  const table = document.querySelector('.dn-cafe-table');
  if (table) {
    const body = table.tBodies[0];
    const pairs = [...body.querySelectorAll('.dn-cafe-row')].map(row => [row, row.nextElementSibling]);
    const collator = new Intl.Collator('ja');
    table.querySelectorAll('[data-cafe-expand]').forEach(button => {
      const detail = document.getElementById(button.dataset.cafeExpand);
      if (!detail) return;
      button.hidden = false;
      button.addEventListener('click', () => {
        detail.hidden = !detail.hidden;
        button.setAttribute('aria-expanded', String(!detail.hidden));
        button.textContent = detail.hidden ? '詳細を開く ＋' : '詳細を閉じる −';
      });
    });
    const links = [...table.querySelectorAll('[data-cafe-sort]')];
    links.forEach(link => link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const key = link.dataset.cafeSort;
      const direction = table.dataset.sort === key && table.dataset.dir === 'asc' ? 'desc' : 'asc';
      const sign = direction === 'asc' ? 1 : -1;
      pairs.sort(([a], [b]) => sign * (collator.compare(a.getAttribute('data-sort-' + key), b.getAttribute('data-sort-' + key)) || a.dataset.slug.localeCompare(b.dataset.slug)));
      for (const [row, detail] of pairs) body.append(row, detail);
      table.dataset.sort = key; table.dataset.dir = direction;
      const url = new URL(location.href);
      url.searchParams.set('sort', key); url.searchParams.set('dir', direction);
      // Replace rather than add history entries; reloading keeps the selected order.
      history.replaceState(null, '', url);
      links.forEach(other => {
        const active = other.dataset.cafeSort === key;
        other.parentElement.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
        other.querySelector('span').textContent = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        const fallback = new URL(location.href);
        fallback.searchParams.set('sort', other.dataset.cafeSort);
        fallback.searchParams.set('dir', active && direction === 'asc' ? 'desc' : 'asc');
        other.href = fallback.pathname + fallback.search;
      });
      const form = document.querySelector('.dn-filter');
      for (const [name, value] of [['sort', key], ['dir', direction]]) {
        let input = form?.querySelector('[name="' + name + '"]');
        if (form && !input) { input = document.createElement('input'); input.type = 'hidden'; input.name = name; form.append(input); }
        if (input) input.value = value;
      }
      document.querySelector('[data-cafe-announcement]').textContent = '一覧を' + link.textContent.replace(/[↑↓↕]/g, '').trim() + 'の' + (direction === 'asc' ? '昇順' : '降順') + 'で並べ替えました。';
    }));
  }
  document.querySelectorAll('[data-password-limit]').forEach(input => {
    const count = document.getElementById(input.getAttribute('aria-describedby'))?.querySelector('[data-password-count]');
    if (!count) return;
    const update = () => {
      const length = [...input.value].length;
      const bytes = new TextEncoder().encode(input.value).length;
      count.textContent = '（現在 ' + length + '文字・' + bytes + 'バイト）';
      input.setCustomValidity(length > 0 && (length < 8 || bytes > 128) ? '8文字以上・128バイト以内で入力してください。' : '');
    };
    input.addEventListener('input', update); update();
  });
})();
