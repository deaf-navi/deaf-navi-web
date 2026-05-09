(function () {
  'use strict';

  const INITIAL_VISIBLE = 150;

  const regionButtons = Array.from(document.querySelectorAll('[data-filter-region]'));
  const topicButtons = Array.from(document.querySelectorAll('[data-filter-topic]'));
  const articles = Array.from(document.querySelectorAll('.world-card'));
  const emptyMsg = document.getElementById('empty-msg');
  const visibleCountEl = document.getElementById('visible-count');
  const totalCountEl = document.getElementById('total-count');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreRemainEl = document.getElementById('load-more-remain');

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

  function apply() {
    let matched = 0;
    let shown = 0;

    articles.forEach((card) => {
      if (!matchesFilters(card)) {
        card.hidden = true;
        return;
      }

      matched += 1;
      const shouldShow = shown < limit;
      card.hidden = !shouldShow;
      if (shouldShow) shown += 1;
    });

    if (visibleCountEl) visibleCountEl.textContent = String(shown);
    if (totalCountEl) totalCountEl.textContent = String(matched);
    if (emptyMsg) emptyMsg.hidden = matched > 0;

    if (loadMoreBtn) {
      const remaining = matched - shown;
      loadMoreBtn.hidden = remaining <= 0;
      if (loadMoreRemainEl) loadMoreRemainEl.textContent = `（あと ${Math.max(0, remaining)} 件）`;
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
