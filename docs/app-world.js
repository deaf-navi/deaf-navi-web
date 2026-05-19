(function () {
  'use strict';

  const INITIAL_VISIBLE = 150;

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

  let currentRegion = 'all';
  let currentTopic = 'all';
  let limit = INITIAL_VISIBLE;

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
    return regionMatch && topicMatch;
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

  function apply() {
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

    if (loadMoreBtn) {
      const remaining = matched - shown;
      loadMoreBtn.hidden = remaining <= 0;
      if (loadMoreRemainEl) loadMoreRemainEl.textContent = remainingText(Math.max(0, remaining));
    }
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
      limit = Number.POSITIVE_INFINITY;
      apply();
      loadMoreBtn.blur();
    });
  }

  apply();
})();
