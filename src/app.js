/**
 * Deaf Navi Web 2.0 クライアント。
 *
 * - 初期表示はサーバ生成の60件（JSなしでも閲覧可能）
 * - articles.json を取得後はデータ駆動で全件を検索・絞り込み
 * - カテゴリ / 情報源 / 期間 / 地域 / フリーワード + URL同期
 * - テーマ・文字サイズ切替（localStorage保存）
 * - Service Worker 登録（オフライン対応）
 *
 * 表示ラベルはビルド側 config/categories.mjs・config/regions.mjs と
 * 同期させること（test/client-labels.test.mjs が整合を検証する）。
 */
(function () {
  'use strict';

  var INITIAL_VISIBLE = 60;
  var LOAD_MORE_STEP = 60;
  var EXCLUDED_FROM_ALL = { relay: true };

  var CATEGORY_UI = {
    all: 'すべて',
    policy: '制度・政策',
    accessibility: '情報保障・アクセシビリティ',
    relay: '電話リレー・ヨメテル',
    medical: '医療',
    education: '教育',
    technology: '技術・AI',
    culture: '文化・芸能',
    sports: 'デフスポーツ',
    safety: '防災・安全',
    event: 'イベント・講座',
    local: '地域',
    general: '一般',
  };

  var SOURCE_TIER_UI = {
    official: { label: '一次情報', description: '公式団体・公的機関が発信した情報' },
    specialist: { label: '専門情報', description: '専門団体・専門媒体が発信した情報' },
    news: { label: '報道・発見', description: 'Google News等から発見した報道・公開情報' },
    broad: { label: '関連媒体', description: '関連分野を扱う媒体が発信した情報' },
  };

  /* 表示設定（テーマ・文字サイズ）と Service Worker 登録は ui-controls.js が担当 */

  /* ---------- 相対時刻の更新（ビルド時刻ズレの補正） ---------- */

  function relativeTime(iso) {
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    var diff = Math.max(0, Date.now() - t);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return '今';
    if (mins < 60) return mins + '分前';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + '時間前';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + '日前';
    return Math.floor(days / 30) + 'ヶ月前';
  }

  function refreshRelativeTimes(root) {
    var times = (root || document).querySelectorAll('time[data-relative-time]');
    for (var i = 0; i < times.length; i++) {
      var el = times[i];
      var rel = relativeTime(el.getAttribute('datetime'));
      if (!rel) continue;
      var span = el.querySelector('.card__time-rel');
      if (span) span.textContent = '（' + rel + '）';
    }
  }

  refreshRelativeTimes(document);

  /* ---------- オフライン表示 ---------- */

  var offlineNote = document.getElementById('offline-note');
  function syncOfflineNote() {
    if (offlineNote) offlineNote.hidden = navigator.onLine !== false;
  }
  window.addEventListener('online', syncOfflineNote);
  window.addEventListener('offline', syncOfflineNote);
  syncOfflineNote();

  /* ---------- ニュース検索・絞り込み ---------- */

  var articlesEl = document.getElementById('articles');
  if (!articlesEl) return; // ニュース一覧のないページはここまで

  var cardTemplate = document.getElementById('card-template');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('button.filter'));
  var emptyMsg = document.getElementById('empty-msg');
  var visibleCountEl = document.getElementById('visible-count');
  var totalCountEl = document.getElementById('total-count');
  var loadMoreBtn = document.getElementById('load-more-btn');
  var loadMoreRemainEl = document.getElementById('load-more-remain');
  var searchForm = document.getElementById('news-search-form');
  var searchInput = document.getElementById('news-search');
  var searchClear = document.getElementById('news-search-clear');
  var sourceFilter = document.getElementById('source-filter');
  var periodFilter = document.getElementById('period-filter');
  var regionFilter = document.getElementById('region-filter');
  var resetBtn = document.getElementById('filter-reset');
  var params = new URLSearchParams(window.location.search);

  var state = {
    q: params.get('q') || '',
    category: params.get('category') || 'all',
    source: params.get('source') || 'all',
    period: params.get('period') || 'all',
    region: params.get('region') || 'all',
    limit: INITIAL_VISIBLE,
  };

  var allArticles = null;   // articles.json 取得後にセット
  var searchIndex = null;   // 正規化済み検索テキスト

  function normalize(text) {
    return String(text || '').normalize('NFKC').toLowerCase();
  }

  function matchesSource(tier) {
    if (state.source === 'official') return tier === 'official';
    if (state.source === 'specialist') return tier === 'specialist';
    if (state.source === 'primary') return tier === 'official' || tier === 'specialist';
    if (state.source === 'news') return tier === 'news';
    if (state.source === 'other') return tier !== 'official' && tier !== 'specialist' && tier !== 'news';
    return true;
  }

  function matchesPeriod(publishedAt) {
    if (state.period === 'all') return true;
    var days = parseInt(state.period, 10);
    if (!isFinite(days)) return true;
    var t = new Date(publishedAt).getTime();
    return isFinite(t) && Date.now() - t <= days * 86400000;
  }

  function matchesCategory(category) {
    if (state.category === 'all') return !EXCLUDED_FROM_ALL[category];
    return category === state.category;
  }

  function matchesRegion(region) {
    if (state.region === 'all') return true;
    return region === state.region;
  }

  function hasActiveFilters() {
    return Boolean(state.q) || state.category !== 'all' || state.source !== 'all'
      || state.period !== 'all' || state.region !== 'all';
  }

  function syncUrl() {
    var next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.category !== 'all') next.set('category', state.category);
    if (state.source !== 'all') next.set('source', state.source);
    if (state.period !== 'all') next.set('period', state.period);
    if (state.region !== 'all') next.set('region', state.region);
    var query = next.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  }

  /* ---- データ取得 ---- */

  var fetchPromise = null;
  var dataFailed = false;
  function ensureData() {
    if (fetchPromise) return fetchPromise;
    var src = articlesEl.getAttribute('data-src') || './articles.json';
    fetchPromise = fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        allArticles = Array.isArray(data.articles) ? data.articles : [];
        searchIndex = allArticles.map(function (a) {
          return normalize(a.title + ' ' + (a.summary || '') + ' ' + a.sourceName + ' ' + (a.prefecture || ''));
        });
        return allArticles;
      })
      .catch(function () {
        // 取得失敗時はSSR済みDOMを対象に動作継続（60件フォールバック）
        allArticles = null;
        dataFailed = true;
        return null;
      });
    return fetchPromise;
  }

  /** 全件データの取得待ちかどうか（relay等、SSRに存在しないカテゴリの誤「該当なし」防止） */
  function isDataPending() {
    return Boolean(fetchPromise) && !allArticles && !dataFailed;
  }

  /* ---- カード生成（<template id="card-template"> を複製） ---- */

  function buildCard(a) {
    var node = cardTemplate.content.firstElementChild.cloneNode(true);
    var tier = SOURCE_TIER_UI[a.sourceTier] ? a.sourceTier : 'news';
    var tierMeta = SOURCE_TIER_UI[tier];

    node.setAttribute('data-category', a.category);
    node.setAttribute('data-source-tier', tier);
    if (a.region) node.setAttribute('data-region', a.region);
    node.setAttribute('data-published', a.publishedAt);

    var chip = node.querySelector('.chip');
    chip.className = 'chip chip--' + a.category;
    chip.textContent = CATEGORY_UI[a.category] || '一般';

    var isNew = Date.now() - new Date(a.publishedAt).getTime() < 86400000;
    if (isNew) {
      var badge = document.createElement('span');
      badge.className = 'card__new-badge';
      badge.textContent = 'NEW';
      chip.insertAdjacentElement('afterend', badge);
    }

    var time = node.querySelector('.card__time');
    time.setAttribute('datetime', a.publishedAt);
    var abs = formatAbsolute(a.publishedAt);
    time.textContent = abs;
    var relSpan = document.createElement('span');
    relSpan.className = 'card__time-rel';
    relSpan.textContent = '（' + relativeTime(a.publishedAt) + '）';
    time.appendChild(relSpan);

    var titleLink = node.querySelector('.card__title a');
    titleLink.href = a.id;
    titleLink.textContent = a.title;

    var summary = node.querySelector('.card__summary');
    if (a.summary) summary.textContent = a.summary;
    else summary.parentNode.removeChild(summary);

    var tierEl = node.querySelector('.source-tier');
    tierEl.className = 'source-tier source-tier--' + tier;
    tierEl.textContent = tierMeta.label;
    tierEl.title = tierMeta.description;

    var sourceLink = node.querySelector('.card__source');
    sourceLink.href = a.sourceUrl;
    sourceLink.textContent = a.sourceName;

    var regionEl = node.querySelector('.card__region');
    if (a.prefecture) {
      regionEl.hidden = false;
      regionEl.textContent = a.prefecture;
      regionEl.title = '地域: ' + a.prefecture;
    }

    var readLink = node.querySelector('.card__read');
    readLink.href = a.id;
    readLink.setAttribute('aria-label', a.title + '（新しいタブで開く）');

    return node;
  }

  function formatAbsolute(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    // JST表示（Asia/Tokyo固定）
    var parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
    return parts.slice(0, 16);
  }

  /* ---- 描画 ---- */

  function applyFromData() {
    var tokens = normalize(state.q).split(/\s+/).filter(Boolean);
    var matched = [];
    for (var i = 0; i < allArticles.length; i++) {
      var a = allArticles[i];
      if (!matchesCategory(a.category)) continue;
      var tier = SOURCE_TIER_UI[a.sourceTier] ? a.sourceTier : 'news';
      if (!matchesSource(tier)) continue;
      if (!matchesPeriod(a.publishedAt)) continue;
      if (!matchesRegion(a.region)) continue;
      if (tokens.length) {
        var hay = searchIndex[i];
        var ok = true;
        for (var t = 0; t < tokens.length; t++) {
          if (hay.indexOf(tokens[t]) === -1) { ok = false; break; }
        }
        if (!ok) continue;
      }
      matched.push(a);
    }

    var shown = Math.min(matched.length, state.limit);
    var fragment = document.createDocumentFragment();
    for (var j = 0; j < shown; j++) fragment.appendChild(buildCard(matched[j]));
    articlesEl.textContent = '';
    articlesEl.appendChild(fragment);

    updateMeta(shown, matched.length);
  }

  function applyFromDom() {
    // articles.json 取得前・取得失敗時: SSR済みカードの表示切替のみ
    var cards = Array.prototype.slice.call(articlesEl.querySelectorAll('.card'));
    var tokens = normalize(state.q).split(/\s+/).filter(Boolean);
    var matched = 0;
    var shown = 0;

    cards.forEach(function (card) {
      var category = card.getAttribute('data-category');
      var tier = card.getAttribute('data-source-tier') || 'news';
      var region = card.getAttribute('data-region') || undefined;
      var published = card.getAttribute('data-published');
      var ok = matchesCategory(category) && matchesSource(tier)
        && matchesPeriod(published) && matchesRegion(region);
      if (ok && tokens.length) {
        var titleEl = card.querySelector('.card__title');
        var summaryEl = card.querySelector('.card__summary');
        var sourceEl = card.querySelector('.card__source');
        var hay = normalize(
          (titleEl ? titleEl.textContent : '') + ' '
          + (summaryEl ? summaryEl.textContent : '') + ' '
          + (sourceEl ? sourceEl.textContent : ''),
        );
        for (var t = 0; t < tokens.length; t++) {
          if (hay.indexOf(tokens[t]) === -1) { ok = false; break; }
        }
      }
      if (ok) {
        var show = shown < state.limit;
        card.hidden = !show;
        if (show) shown += 1;
        matched += 1;
      } else {
        card.hidden = true;
      }
    });

    updateMeta(shown, matched);
  }

  function updateMeta(shown, matched) {
    if (visibleCountEl) visibleCountEl.textContent = String(shown);
    if (totalCountEl) totalCountEl.textContent = String(matched);
    if (emptyMsg) emptyMsg.hidden = matched > 0 || isDataPending();
    if (searchClear) searchClear.hidden = !state.q;
    if (resetBtn) resetBtn.hidden = !hasActiveFilters();
    if (loadMoreBtn) {
      var remaining = matched - shown;
      loadMoreBtn.hidden = remaining <= 0;
      if (loadMoreRemainEl) loadMoreRemainEl.textContent = '（あと ' + remaining + ' 件）';
    }
  }

  function getVisibleResults(max) {
    var requested = Number(max);
    var limit = isFinite(requested) ? Math.max(1, Math.min(20, Math.floor(requested))) : 10;
    return Array.prototype.slice.call(articlesEl.querySelectorAll('.card'))
      .filter(function (card) { return !card.hidden; })
      .slice(0, limit)
      .map(function (card) {
        var titleLink = card.querySelector('.card__title a');
        var sourceLink = card.querySelector('.card__source');
        var chip = card.querySelector('.chip');
        var time = card.querySelector('.card__time');
        return {
          id: titleLink ? titleLink.href : '',
          title: titleLink ? titleLink.textContent.trim() : '',
          category: card.getAttribute('data-category') || 'general',
          categoryLabel: chip ? chip.textContent.trim() : '一般',
          sourceType: card.getAttribute('data-source-tier') || 'news',
          sourceName: sourceLink ? sourceLink.textContent.trim() : '',
          region: card.getAttribute('data-region') || null,
          publishedAt: time ? time.getAttribute('datetime') : null,
        };
      });
  }

  function getFilterState() {
    return {
      q: state.q,
      category: state.category,
      source: state.source,
      period: state.period,
      region: state.region,
      limit: state.limit,
    };
  }

  function getViewState() {
    return {
      filters: getFilterState(),
      visibleResultCount: Number(visibleCountEl ? visibleCountEl.textContent : 0) || 0,
      matchedResultCount: Number(totalCountEl ? totalCountEl.textContent : 0) || 0,
      results: getVisibleResults(10),
      dataMode: allArticles ? 'all-data' : 'ssr-fallback',
    };
  }

  function apply(options) {
    var updateUrl = !options || options.updateUrl !== false;
    if (allArticles && cardTemplate) applyFromData();
    else applyFromDom();
    if (updateUrl) syncUrl();
  }

  function activateCategory(category) {
    var exists = buttons.some(function (b) { return b.getAttribute('data-filter') === category; });
    state.category = exists ? category : 'all';
    buttons.forEach(function (button) {
      var active = button.getAttribute('data-filter') === state.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function resetLimitAndApply() {
    state.limit = INITIAL_VISIBLE;
    ensureData().then(function () { apply(); });
    apply();
  }

  function normalizeChoice(value, allowed, aliases, fieldName) {
    var key = String(value == null ? '' : value).trim().toLowerCase();
    if (aliases && aliases[key]) key = aliases[key];
    if (allowed.indexOf(key) === -1) {
      throw new Error(fieldName + ' の値が対応範囲外です: ' + value);
    }
    return key;
  }

  function setFilters(next) {
    var input = next && typeof next === 'object' ? next : {};
    var has = Object.prototype.hasOwnProperty;
    var nextState = getFilterState();

    if (has.call(input, 'query') || has.call(input, 'q')) {
      var queryValue = has.call(input, 'query') ? input.query : input.q;
      nextState.q = String(queryValue == null ? '' : queryValue).trim().slice(0, 200);
    }
    if (has.call(input, 'category')) {
      nextState.category = normalizeChoice(
        input.category,
        Object.keys(CATEGORY_UI),
        { 'sign-language': 'accessibility', sign_language: 'accessibility', sign: 'accessibility' },
        'category',
      );
    }
    if (has.call(input, 'sourceType') || has.call(input, 'source')) {
      var sourceValue = has.call(input, 'sourceType') ? input.sourceType : input.source;
      nextState.source = normalizeChoice(
        sourceValue,
        ['all', 'official', 'specialist', 'primary', 'news', 'other'],
        { authoritative: 'official' },
        'sourceType',
      );
    }
    if (has.call(input, 'period')) {
      nextState.period = normalizeChoice(
        input.period,
        ['all', '1', '7', '30'],
        { '24h': '1', '1d': '1', '7d': '7', '30d': '30', day: '1', week: '7', month: '30' },
        'period',
      );
    }
    if (has.call(input, 'region')) {
      nextState.region = normalizeChoice(
        input.region,
        ['all', 'hokkaido_tohoku', 'kanto', 'chubu', 'kinki', 'chugoku_shikoku', 'kyushu_okinawa'],
        { nara: 'kinki', '奈良': 'kinki', '奈良県': 'kinki' },
        'region',
      );
    }

    nextState.limit = Number.isFinite(Number(input.limit))
      ? Math.max(INITIAL_VISIBLE, Math.floor(Number(input.limit)))
      : INITIAL_VISIBLE;

    // すべての入力検証が済んでから状態へ反映し、途中失敗で部分更新しない。
    state.q = nextState.q;
    state.category = nextState.category;
    state.source = nextState.source;
    state.period = nextState.period;
    state.region = nextState.region;
    state.limit = nextState.limit;
    if (searchInput) searchInput.value = state.q;
    if (sourceFilter) sourceFilter.value = state.source;
    if (periodFilter) periodFilter.value = state.period;
    if (regionFilter) regionFilter.value = state.region;
    activateCategory(state.category);

    return ensureData().then(function () {
      apply();
      return getViewState();
    });
  }

  /* ---- イベント ---- */

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      activateCategory(button.getAttribute('data-filter'));
      resetLimitAndApply();
      var top = articlesEl.getBoundingClientRect().top;
      if (top < 0) {
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        articlesEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  if (searchForm) {
    searchForm.addEventListener('submit', function (event) { event.preventDefault(); });
  }
  if (searchInput) {
    searchInput.value = state.q;
    var debounceTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        state.q = searchInput.value.trim();
        resetLimitAndApply();
      }, 150);
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      state.q = '';
      resetLimitAndApply();
      searchInput.focus();
    });
  }

  function bindSelect(el, key, allowed) {
    if (!el) return;
    if (allowed.indexOf(state[key]) === -1) state[key] = 'all';
    el.value = state[key];
    el.addEventListener('change', function () {
      state[key] = el.value;
      resetLimitAndApply();
    });
  }

  bindSelect(sourceFilter, 'source', ['all', 'official', 'specialist', 'primary', 'news', 'other']);
  bindSelect(periodFilter, 'period', ['all', '1', '7', '30']);
  bindSelect(regionFilter, 'region', ['all', 'hokkaido_tohoku', 'kanto', 'chubu', 'kinki', 'chugoku_shikoku', 'kyushu_okinawa']);

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      state.q = '';
      state.source = 'all';
      state.period = 'all';
      state.region = 'all';
      if (searchInput) searchInput.value = '';
      if (sourceFilter) sourceFilter.value = 'all';
      if (periodFilter) periodFilter.value = 'all';
      if (regionFilter) regionFilter.value = 'all';
      activateCategory('all');
      resetLimitAndApply();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      state.limit += LOAD_MORE_STEP;
      ensureData().then(function () { apply(); });
      apply();
    });
  }

  // クイックアクセスのフィルタリンクはページ内で完結させる
  Array.prototype.slice.call(document.querySelectorAll('[data-quick-filter]')).forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      activateCategory(link.getAttribute('data-quick-filter'));
      resetLimitAndApply();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      articlesEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---- 初期化 ---- */

  activateCategory(state.category);

  // deep link（URLパラメータ）がある場合のみ即時フィルタを適用する。
  // 無い場合は SSR の初期表示（60件 / 全400件表記 / もっと読むボタン）を
  // そのまま使い、全件データ取得後にカウント類を同期する。
  // （DOMモードのapplyはSSRの60件しか見えず、件数表示を壊すため）
  function syncAfterData() {
    ensureData().then(function (loaded) {
      if (loaded) apply({ updateUrl: false });
    });
  }

  if (hasActiveFilters()) {
    syncAfterData(); // 先にfetchを開始してから適用（データ待ち中は「該当なし」を出さない）
    apply({ updateUrl: false });
  } else if ('requestIdleCallback' in window) {
    requestIdleCallback(syncAfterData, { timeout: 4000 });
  } else {
    setTimeout(syncAfterData, 2000);
  }

  // WebMCP は、この公開APIを通じて手動操作と同じ状態・描画処理を再利用する。
  window.DeafNaviApp = Object.freeze({
    getState: getFilterState,
    getViewState: getViewState,
    getResults: getVisibleResults,
    setFilters: setFilters,
    restoreState: setFilters,
  });
})();
