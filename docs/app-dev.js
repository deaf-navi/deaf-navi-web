(function () {
  'use strict';

  const INITIAL_VISIBLE = 150;

  const buttons = document.querySelectorAll('button.filter');
  const articles = Array.from(document.querySelectorAll('.card'));
  const emptyMsg = document.getElementById('empty-msg');
  const visibleCountEl = document.getElementById('visible-count');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreRemainEl = document.getElementById('load-more-remain');

  let currentFilter = 'all';
  let limit = INITIAL_VISIBLE;

  function apply() {
    let matched = 0;
    let shown = 0;
    articles.forEach((el) => {
      const cat = el.getAttribute('data-category');
      const matches = currentFilter === 'all' || cat === currentFilter;
      if (matches) {
        const show = shown < limit;
        el.hidden = !show;
        if (show) shown += 1;
        matched += 1;
      } else {
        el.hidden = true;
      }
    });

    if (visibleCountEl) visibleCountEl.textContent = String(shown);
    if (emptyMsg) emptyMsg.hidden = matched > 0;

    if (loadMoreBtn) {
      const remaining = matched - shown;
      if (remaining > 0) {
        loadMoreBtn.hidden = false;
        if (loadMoreRemainEl) loadMoreRemainEl.textContent = `（あと ${remaining} 件）`;
      } else {
        loadMoreBtn.hidden = true;
      }
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      currentFilter = btn.getAttribute('data-filter');
      limit = INITIAL_VISIBLE; // フィルタ切替時は表示件数をリセット
      apply();
      // 切替後、記事リストの先頭へ軽くスクロール（既に上にいれば動かない）
      const articlesEl = document.getElementById('articles');
      if (articlesEl) {
        const rect = articlesEl.getBoundingClientRect();
        if (rect.top < 0) articlesEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      limit = Number.POSITIVE_INFINITY; // 一度クリックで全展開
      apply();
      loadMoreBtn.blur();
    });
  }

  // 初期表示を整える（サーバーがhidden属性を付けている前提だが、JSで再計算して一貫させる）
  apply();
})();
