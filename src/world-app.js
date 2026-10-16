(function () {
  'use strict';

  const INITIAL_VISIBLE = 40;

  const regionButtons = Array.from(document.querySelectorAll('[data-filter-region]'));
  const topicButtons = Array.from(document.querySelectorAll('[data-filter-topic]'));
  const articlesContainer = document.getElementById('articles');
  const articles = Array.from(document.querySelectorAll('.world-card'));
  const emptyMsg = document.getElementById('empty-msg');
  const visibleCountEl = document.getElementById('visible-count');
  const totalCountEl = document.getElementById('total-count');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreRemainEl = document.getElementById('load-more-remain');
  const isEnglish = document.documentElement.lang === 'en';
  const search = document.getElementById('world-search');
  const filterSummary = document.getElementById('world-filter-summary');
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().trim();
  const searchText = new Map(articles.map(card => [card, normalize(card.textContent)]));
  const relative = new Intl.RelativeTimeFormat(isEnglish ? 'en' : 'ja', { numeric: 'auto' });
  function updateTimes() {
    articles.filter(card => !card.hidden).forEach(card => {
      const time = card.querySelector('time[datetime]');
      if (!time) return;
      const seconds = Math.max(0, (Date.now() - Date.parse(time.dateTime)) / 1000);
      if (!Number.isFinite(seconds)) return;
      const [unit, divisor] = seconds >= 86400 ? ['day', 86400] : seconds >= 3600 ? ['hour', 3600] : ['minute', 60];
      time.textContent = relative.format(-Math.floor(seconds / divisor), unit);
    });
  }

  let currentRegion = 'all';
  let currentTopic = 'all';
  let limit = INITIAL_VISIBLE;
  let query = '';

  function setActive(buttons, activeButton) {
    buttons.forEach((button) => {
      const active = button === activeButton;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function matchesFilters(card) {
    const region = card.getAttribute('data-region');
    const topic = card.getAttribute('data-topic');
    const regionMatch = currentRegion === 'all' || region === currentRegion;
    const topicMatch = currentTopic === 'all' || topic === currentTopic;
    return regionMatch && topicMatch && normalize(query).split(/\s+/).filter(Boolean).every(word => searchText.get(card).includes(word));
  }

  function cardIndex(card) {
    const value = Number.parseInt(card.getAttribute('data-index') || '', 10);
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  function balanceAllRegionCards(cards) {
    const regionOrder = ['asia_oceania', 'americas', 'europe_cis', 'middle_east_africa'];
    const groups = new Map(regionOrder.map((region) => [region, []]));
    const fallbackRegion = regionOrder[0];

    cards
      .slice()
      .sort((a, b) => cardIndex(a) - cardIndex(b))
      .forEach((card) => {
        const region = card.getAttribute('data-region');
        const key = groups.has(region) ? region : fallbackRegion;
        groups.get(key).push(card);
      });

    const ordered = [];
    while ([...groups.values()].some((items) => items.length)) {
      const active = regionOrder
        .map((region) => groups.get(region))
        .filter((items) => items?.length)
        .sort((a, b) => cardIndex(a[0]) - cardIndex(b[0]));
      active.forEach((items) => ordered.push(items.shift()));
    }
    return ordered;
  }

  function orderedMatches() {
    const matchedCards = articles.filter(matchesFilters);
    if (currentRegion === 'all') return balanceAllRegionCards(matchedCards);
    return matchedCards.sort((a, b) => cardIndex(a) - cardIndex(b));
  }

  function remainingText(count) {
    return isEnglish ? `(${count} more)` : `（あと ${count} 件）`;
  }

  function apply(updateUrl = true) {
    const matchedCards = orderedMatches();
    const visibleCards = new Set(matchedCards.slice(0, limit));
    const matched = matchedCards.length;
    const shown = visibleCards.size;

    articles.forEach((card) => {
      card.hidden = !visibleCards.has(card);
    });

    if (articlesContainer) {
      matchedCards.forEach((card) => articlesContainer.appendChild(card));
      articles
        .filter((card) => !matchesFilters(card))
        .sort((a, b) => cardIndex(a) - cardIndex(b))
        .forEach((card) => articlesContainer.appendChild(card));
    }

    if (visibleCountEl) visibleCountEl.textContent = String(shown);
    if (totalCountEl) totalCountEl.textContent = String(matched);
    if (emptyMsg) emptyMsg.hidden = matched > 0;
    const active = [currentRegion !== 'all', currentTopic !== 'all'].filter(Boolean).length;
    if (filterSummary) filterSummary.textContent = isEnglish ? `Region / topic${active ? ` (${active} active)` : ''}` : `地域・カテゴリ${active ? `（${active}件選択中）` : ''}`;
    const params = new URLSearchParams(location.search);
    for (const [key, value] of [['region', currentRegion], ['topic', currentTopic], ['q', query]]) {
      if (value && value !== 'all') params.set(key, value); else params.delete(key);
    }
    if (updateUrl) history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    document.querySelectorAll('.world-language-switch a').forEach(link => {
      const url = new URL(link.href); url.search = params.toString(); link.href = url.href;
    });

    if (loadMoreBtn) {
      const remaining = matched - shown;
      loadMoreBtn.hidden = remaining <= 0;
      if (loadMoreRemainEl) loadMoreRemainEl.textContent = remainingText(Math.max(0, remaining));
    }
    updateTimes();
  }

  regionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentRegion = button.getAttribute('data-filter-region') || 'all';
      limit = INITIAL_VISIBLE;
      setActive(regionButtons, button);
      apply();
    });
  });

  topicButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentTopic = button.getAttribute('data-filter-topic') || 'all';
      limit = INITIAL_VISIBLE;
      setActive(topicButtons, button);
      apply();
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      limit += INITIAL_VISIBLE;
      apply();
    });
  }

  function restore() {
    const params = new URLSearchParams(location.search);
    currentRegion = regionButtons.some(b => b.dataset.filterRegion === params.get('region')) ? params.get('region') : 'all';
    currentTopic = topicButtons.some(b => b.dataset.filterTopic === params.get('topic')) ? params.get('topic') : 'all';
    query = (params.get('q') || '').slice(0, 200);
    if (search) search.value = query;
    setActive(regionButtons, regionButtons.find(b => b.dataset.filterRegion === currentRegion));
    setActive(topicButtons, topicButtons.find(b => b.dataset.filterTopic === currentTopic));
    limit = INITIAL_VISIBLE;
    apply(false);
  }
  search?.addEventListener('input', () => { query = search.value; limit = INITIAL_VISIBLE; apply(); });
  document.querySelectorAll('[data-world-reset]').forEach(button => button.addEventListener('click', () => {
    currentRegion = currentTopic = 'all'; query = ''; if (search) search.value = '';
    setActive(regionButtons, regionButtons[0]); setActive(topicButtons, topicButtons[0]);
    limit = INITIAL_VISIBLE; apply(); search?.focus();
  }));
  window.addEventListener('popstate', restore);
  restore();
  setInterval(() => { if (!document.hidden) updateTimes(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateTimes(); });
})();
