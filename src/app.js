(function () {
  'use strict';

  const INITIAL_VISIBLE = 60;
  const LOAD_MORE_STEP = 60;
  const excludedFromAll = new Set(['relay']);
  const buttons = Array.from(document.querySelectorAll('button.filter'));
  const articles = Array.from(document.querySelectorAll('.card'));
  const emptyMsg = document.getElementById('empty-msg');
  const visibleCountEl = document.getElementById('visible-count');
  const totalCountEl = document.getElementById('total-count');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreRemainEl = document.getElementById('load-more-remain');
  const searchForm = document.getElementById('news-search-form');
  const searchInput = document.getElementById('news-search');
  const searchClear = document.getElementById('news-search-clear');
  const sourceFilter = document.getElementById('source-filter');
  const params = new URLSearchParams(window.location.search);

  let currentFilter = params.get('category') || 'all';
  let currentSource = params.get('source') || 'all';
  let currentQuery = params.get('q') || '';
  let limit = INITIAL_VISIBLE;

  const searchableArticles = articles.map((element) => ({
    element,
    searchText: (element.textContent || '').normalize('NFKC').toLowerCase(),
  }));

  function matchesSource(tier) {
    if (currentSource === 'primary') return tier === 'official' || tier === 'specialist';
    if (currentSource === 'news') return tier === 'news';
    if (currentSource === 'other') return tier !== 'official' && tier !== 'specialist' && tier !== 'news';
    return true;
  }

  function syncUrl() {
    const next = new URLSearchParams();
    if (currentQuery) next.set('q', currentQuery);
    if (currentFilter !== 'all') next.set('category', currentFilter);
    if (currentSource !== 'all') next.set('source', currentSource);
    const query = next.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }

  function apply({ updateUrl = true } = {}) {
    const queryTokens = currentQuery
      .normalize('NFKC')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    let matched = 0;
    let shown = 0;

    searchableArticles.forEach(({ element, searchText }) => {
      const category = element.getAttribute('data-category');
      const sourceTier = element.getAttribute('data-source-tier') || 'news';
      const categoryMatches = currentFilter === 'all'
        ? !excludedFromAll.has(category)
        : category === currentFilter;
      const queryMatches = queryTokens.every((token) => searchText.includes(token));
      const matches = categoryMatches && matchesSource(sourceTier) && queryMatches;

      if (matches) {
        const show = shown < limit;
        element.hidden = !show;
        if (show) shown += 1;
        matched += 1;
      } else {
        element.hidden = true;
      }
    });

    if (visibleCountEl) visibleCountEl.textContent = String(shown);
    if (totalCountEl) totalCountEl.textContent = String(matched);
    if (emptyMsg) emptyMsg.hidden = matched > 0;
    if (searchClear) searchClear.hidden = !currentQuery;

    if (loadMoreBtn) {
      const remaining = matched - shown;
      loadMoreBtn.hidden = remaining <= 0;
      if (loadMoreRemainEl) loadMoreRemainEl.textContent = `（あと ${remaining} 件）`;
    }
    if (updateUrl) syncUrl();
  }

  function activateCategory(category) {
    const targetExists = buttons.some((button) => button.getAttribute('data-filter') === category);
    currentFilter = targetExists ? category : 'all';
    buttons.forEach((button) => {
      const active = button.getAttribute('data-filter') === currentFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      activateCategory(button.getAttribute('data-filter'));
      limit = INITIAL_VISIBLE;
      apply();
      const articlesElement = document.getElementById('articles');
      if (articlesElement && articlesElement.getBoundingClientRect().top < 0) {
        articlesElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  if (searchForm) searchForm.addEventListener('submit', (event) => event.preventDefault());
  if (searchInput) {
    searchInput.value = currentQuery;
    searchInput.addEventListener('input', () => {
      currentQuery = searchInput.value.trim();
      limit = INITIAL_VISIBLE;
      apply();
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      currentQuery = '';
      limit = INITIAL_VISIBLE;
      apply();
      searchInput.focus();
    });
  }
  if (sourceFilter) {
    const validSources = new Set(['all', 'primary', 'news', 'other']);
    currentSource = validSources.has(currentSource) ? currentSource : 'all';
    sourceFilter.value = currentSource;
    sourceFilter.addEventListener('change', () => {
      currentSource = sourceFilter.value;
      limit = INITIAL_VISIBLE;
      apply();
    });
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      limit += LOAD_MORE_STEP;
      apply();
    });
  }

  activateCategory(currentFilter);
  apply({ updateUrl: false });
})();
