/**
 * Deaf Navi WebMCP integration.
 *
 * The tools call the same client facades used by the visible controls. Browsers
 * without document.modelContext skip registration and keep the normal UI.
 */
(function () {
  'use strict';

  var activity = document.getElementById('agent-activity');
  var activityLog = document.getElementById('agent-activity-log');
  var activityStatus = document.getElementById('agent-activity-status');
  var undoButton = document.getElementById('agent-activity-undo');
  if (!activity || !activityLog || !activityStatus || !undoButton) return;

  var app = window.DeafNaviApp;
  var display = window.DeafNaviDisplay;
  var undoStack = [];
  var highlightedIds = [];
  var MAX_ACTIVITY_ITEMS = 6;

  var CATEGORY_LABELS = {
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
  var SOURCE_LABELS = {
    all: 'すべての情報源',
    official: '一次情報のみ',
    specialist: '専門情報のみ',
    primary: '一次・専門',
    news: '報道・発見',
    other: '関連媒体',
  };
  var PERIOD_LABELS = {
    all: '全期間',
    '1': '24時間以内',
    '7': '1週間以内',
    '30': '1ヶ月以内',
    '24h': '24時間以内',
    '7d': '1週間以内',
    '30d': '1ヶ月以内',
  };
  var REGION_LABELS = {
    all: 'すべての地域',
    hokkaido_tohoku: '北海道・東北',
    kanto: '関東',
    chubu: '中部',
    kinki: '近畿',
    nara: '奈良県（近畿フィルター）',
    chugoku_shikoku: '中国・四国',
    kyushu_okinawa: '九州・沖縄',
  };

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function setStatus(status, label) {
    activityStatus.setAttribute('data-status', status);
    activityStatus.textContent = label;
  }

  function syncUndoButton() {
    undoButton.disabled = undoStack.length === 0;
    if (undoStack.length) {
      undoButton.removeAttribute('title');
    }
  }

  function addActivity(message, actor) {
    var empty = activityLog.querySelector('[data-agent-activity-empty]');
    if (empty) empty.remove();
    var item = document.createElement('li');
    item.textContent = String(message || '').slice(0, 240);
    item.setAttribute('data-actor', actor === 'human' ? 'human' : 'agent');
    activityLog.appendChild(item);
    while (activityLog.children.length > MAX_ACTIVITY_ITEMS) {
      activityLog.removeChild(activityLog.firstElementChild);
    }
  }

  function getActivities() {
    return Array.prototype.slice.call(activityLog.querySelectorAll('li'))
      .filter(function (item) { return !item.hasAttribute('data-agent-activity-empty'); })
      .map(function (item) { return item.textContent.trim(); });
  }

  function captureSnapshot() {
    return {
      filters: app.getState(),
      preferences: display.getPreferences(),
      highlightedIds: highlightedIds.slice(),
    };
  }

  function pushUndo(label) {
    var entry = { label: label, snapshot: captureSnapshot() };
    undoStack.push(entry);
    if (undoStack.length > 10) undoStack.shift();
    syncUndoButton();
    return entry;
  }

  function removeUndo(entry) {
    var index = undoStack.lastIndexOf(entry);
    if (index !== -1) undoStack.splice(index, 1);
    syncUndoButton();
  }

  function clearHighlights() {
    Array.prototype.slice.call(document.querySelectorAll('.card.is-agent-highlighted')).forEach(function (card) {
      card.classList.remove('is-agent-highlighted');
      card.removeAttribute('data-agent-highlighted');
      var marker = card.querySelector('.agent-highlight-marker');
      if (marker) marker.remove();
    });
    highlightedIds = [];
  }

  function cardResult(card) {
    var titleLink = card.querySelector('.card__title a');
    var sourceLink = card.querySelector('.card__source');
    return {
      id: titleLink ? titleLink.href : '',
      title: titleLink ? titleLink.textContent.trim() : '',
      category: card.getAttribute('data-category') || 'general',
      sourceType: card.getAttribute('data-source-tier') || 'news',
      sourceName: sourceLink ? sourceLink.textContent.trim() : '',
    };
  }

  function highlightResults(ids, count, scroll) {
    var requestedIds = (ids || []).map(function (id) {
      try { return new URL(String(id), window.location.href).href; } catch (error) { return ''; }
    }).filter(Boolean);
    var cards = Array.prototype.slice.call(document.querySelectorAll('#articles .card'))
      .filter(function (card) { return !card.hidden; });
    var selected;
    if (requestedIds.length) {
      selected = cards.filter(function (card) {
        var link = card.querySelector('.card__title a');
        return link && requestedIds.indexOf(link.href) !== -1;
      });
    } else {
      selected = cards.slice(0, Math.max(1, Math.min(5, Number(count) || 3)));
    }
    if (!selected.length) throw new Error('現在表示中の結果に、指定された記事がありません');

    clearHighlights();
    selected.slice(0, 5).forEach(function (card) {
      var marker = document.createElement('span');
      marker.className = 'agent-highlight-marker';
      marker.textContent = 'Agentが重要として選択';
      card.insertBefore(marker, card.firstChild);
      card.classList.add('is-agent-highlighted');
      card.setAttribute('data-agent-highlighted', 'true');
    });
    highlightedIds = selected.slice(0, 5).map(function (card) { return cardResult(card).id; });

    if (scroll !== false) {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      selected[0].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    return selected.slice(0, 5).map(cardResult);
  }

  async function restoreSnapshot(snapshot) {
    await app.restoreState(snapshot.filters);
    display.setPreferences(snapshot.preferences);
    clearHighlights();
    if (snapshot.highlightedIds.length) {
      highlightResults(snapshot.highlightedIds, snapshot.highlightedIds.length, false);
    }
  }

  async function rollbackFailedChange(entry) {
    removeUndo(entry);
    try {
      await restoreSnapshot(entry.snapshot);
    } catch (rollbackError) {
      setStatus('error', '復元エラー');
    }
  }

  function ensureNotAborted(options) {
    if (options && options.signal && options.signal.aborted) {
      throw options.signal.reason || new Error('Tool execution was cancelled');
    }
  }

  function summarizeSearch(input, view) {
    var details = [];
    if (hasOwn(input, 'query')) details.push('検索「' + String(input.query).slice(0, 50) + '」');
    if (hasOwn(input, 'category')) details.push('カテゴリ: ' + (CATEGORY_LABELS[input.category] || input.category));
    if (hasOwn(input, 'region')) details.push('地域: ' + (REGION_LABELS[input.region] || input.region));
    if (hasOwn(input, 'sourceType')) details.push('情報源: ' + (SOURCE_LABELS[input.sourceType] || input.sourceType));
    if (hasOwn(input, 'period')) details.push('期間: ' + (PERIOD_LABELS[input.period] || input.period));
    return (details.length ? details.join(' / ') : '現在の検索条件を再適用') + ' — ' + view.matchedResultCount + '件';
  }

  function applyNaraSearchTerm(input) {
    var args = Object.assign({}, input);
    if (args.region !== 'nara') return args;
    var currentQuery = hasOwn(args, 'query') ? args.query : app.getState().q;
    var query = String(currentQuery == null ? '' : currentQuery).trim();
    if (!/奈良/u.test(query)) query = (query ? query + ' ' : '') + '奈良';
    args.query = query;
    return args;
  }

  async function executeSearch(input, options) {
    ensureNotAborted(options);
    var args = applyNaraSearchTerm(input && typeof input === 'object' ? input : {});
    var undoEntry = pushUndo('検索・絞り込み');
    try {
      clearHighlights();
      var view = await app.setFilters(args);
      ensureNotAborted(options);
      addActivity(summarizeSearch(args, view));
      return {
        ok: true,
        action: 'search_deaf_info',
        appliedFilters: view.filters,
        regionInterpretation: args.region === 'nara' ? '既存の近畿地域フィルターと、画面に見える「奈良」検索語を併用' : null,
        visibleResultCount: view.visibleResultCount,
        matchedResultCount: view.matchedResultCount,
        results: view.results,
      };
    } catch (error) {
      await rollbackFailedChange(undoEntry);
      throw error;
    }
  }

  async function executeShowResults(input, options) {
    ensureNotAborted(options);
    var args = input && typeof input === 'object' ? input : {};
    var undoEntry = pushUndo('重要な結果の強調');
    try {
      var results = highlightResults(args.articleIds, args.count, true);
      addActivity('重要な結果を' + results.length + '件、画面上で強調');
      return {
        ok: true,
        action: 'show_results',
        highlightedCount: results.length,
        highlightedResults: results,
      };
    } catch (error) {
      await rollbackFailedChange(undoEntry);
      throw error;
    }
  }

  async function executeEmergency(input, options) {
    ensureNotAborted(options);
    var args = input && typeof input === 'object' ? input : {};
    var filters = {
      query: args.region === 'nara' ? '奈良' : '',
      category: 'safety',
      sourceType: 'all',
      period: args.period || '30d',
      region: args.region || 'all',
    };
    var undoEntry = pushUndo('緊急・防災情報の表示');
    try {
      clearHighlights();
      var view = await app.setFilters(filters);
      ensureNotAborted(options);
      var regionLabel = REGION_LABELS[filters.region] || filters.region;
      addActivity('緊急・防災: ' + regionLabel + ' / ' + view.matchedResultCount + '件（緊急通報ガイドへの入口あり）');
      return {
        ok: true,
        action: 'get_emergency_resources',
        appliedFilters: view.filters,
        regionInterpretation: filters.region === 'nara' ? '既存の近畿地域フィルターと、画面に見える「奈良」検索語を併用' : null,
        emergencyGuideUrl: new URL('./guide.html#guide-emergency', window.location.href).href,
        matchedResultCount: view.matchedResultCount,
        results: view.results,
        note: '緊急通報ガイドは全国共通の入口です。制度や受付方法はリンク先で最新情報を確認してください。',
      };
    } catch (error) {
      await rollbackFailedChange(undoEntry);
      throw error;
    }
  }

  async function executePreferences(input, options) {
    ensureNotAborted(options);
    var args = input && typeof input === 'object' ? input : {};
    if (!hasOwn(args, 'textSize') && !hasOwn(args, 'theme')) {
      throw new Error('textSize または theme を1つ以上指定してください');
    }
    var undoEntry = pushUndo('表示設定');
    try {
      var preferences = display.setPreferences(args);
      var details = [];
      if (hasOwn(args, 'textSize')) details.push('文字サイズ: ' + args.textSize);
      if (hasOwn(args, 'theme')) details.push('テーマ: ' + args.theme);
      addActivity(details.join(' / '));
      return { ok: true, action: 'set_accessibility_preferences', preferences: preferences };
    } catch (error) {
      await rollbackFailedChange(undoEntry);
      throw error;
    }
  }

  function scheduleNavigation(url) {
    window.setTimeout(function () { window.location.assign(url); }, 180);
  }

  async function executeLifeGuide(input, options) {
    ensureNotAborted(options);
    var args = input && typeof input === 'object' ? input : {};
    var topics = ['all', 'emergency', 'medical', 'education', 'employment', 'phone', 'life'];
    var topic = hasOwn(args, 'topic') ? args.topic : 'all';
    if (topics.indexOf(topic) === -1) throw new Error('topic must be a supported life-guide section.');
    var url = new URL('./guide.html', window.location.href);
    if (topic !== 'all') url.hash = 'guide-' + topic;
    addActivity('暮らしのガイドを開く: ' + (topic === 'all' ? 'すべて' : topic));
    scheduleNavigation(url.href);
    return { ok: true, action: 'open_life_guide', topic: topic, url: url.href };
  }

  async function executeAccessibilityTool(input, options) {
    ensureNotAborted(options);
    var args = input && typeof input === 'object' ? input : {};
    var routes = {
      captions: { hash: 'captions', label: 'リアルタイム字幕' },
      writing_board: { hash: 'board', label: '筆談ボード' },
      sound_visualizer: { hash: 'sound', label: '音の可視化' },
    };
    var selected = routes[args.tool];
    if (!selected) throw new Error('tool は captions、writing_board、sound_visualizer のいずれかを指定してください');
    var url = new URL('./otomado/#/' + selected.hash, window.location.href);
    addActivity('情報保障ツールを開く: ' + selected.label);
    scheduleNavigation(url.href);
    return { ok: true, action: 'open_accessibility_tool', tool: args.tool, label: selected.label, url: url.href };
  }

  async function executeCurrentState(input, options) {
    ensureNotAborted(options);
    var view = app.getViewState();
    return {
      ok: true,
      action: 'get_current_view_state',
      filters: view.filters,
      preferences: display.getPreferences(),
      visibleResultCount: view.visibleResultCount,
      matchedResultCount: view.matchedResultCount,
      results: view.results,
      highlightedArticleIds: highlightedIds.slice(),
      recentAgentActivity: getActivities(),
    };
  }

  undoButton.addEventListener('click', function () {
    var previous = undoStack.pop();
    if (!previous) return;
    syncUndoButton();
    undoButton.disabled = true;
    Promise.resolve(restoreSnapshot(previous.snapshot))
      .then(function () {
        addActivity('人が元に戻しました: ' + previous.label, 'human');
      })
      .catch(function () {
        undoStack.push(previous);
        addActivity('元に戻せませんでした。もう一度お試しください', 'human');
      })
      .finally(syncUndoButton);
  });

  function clearUndoAfterHumanInput(event) {
    if (!event.isTrusted || !undoStack.length) return;
    var target = event.target;
    if (!target || !target.closest) return;
    if (!target.closest('#news-search, #news-search-clear, #source-filter, #period-filter, #region-filter, #filter-reset, #load-more-btn, button.filter, #theme-toggle, #font-toggle, [data-quick-filter]')) return;
    undoStack = [];
    syncUndoButton();
    undoButton.title = '手動操作後は、その操作を上書きしないためAgentのUndo履歴をクリアしました';
  }
  document.addEventListener('click', clearUndoAfterHumanInput, true);
  document.addEventListener('change', clearUndoAfterHumanInput, true);
  document.addEventListener('input', clearUndoAfterHumanInput, true);

  if (!app || !display) {
    setStatus('error', '連携準備エラー');
    return;
  }

  if (!document.modelContext || typeof document.modelContext.registerTool !== 'function') {
    setStatus('unavailable', '通常ブラウザ');
    return;
  }

  if (window.__deafNaviWebMcpController) window.__deafNaviWebMcpController.abort();
  var registrationController = new AbortController();
  window.__deafNaviWebMcpController = registrationController;

  var searchProperties = {
    query: { type: 'string', maxLength: 200, description: 'Literal search words. Omit to keep the current query; use an empty string to clear it.' },
    category: {
      type: 'string',
      enum: ['all', 'policy', 'accessibility', 'relay', 'medical', 'education', 'technology', 'culture', 'sports', 'safety', 'event', 'local', 'general'],
      description: 'Use accessibility for sign-language and information-access topics.',
    },
    region: {
      type: 'string',
      enum: ['all', 'hokkaido_tohoku', 'kanto', 'chubu', 'kinki', 'nara', 'chugoku_shikoku', 'kyushu_okinawa'],
      description: 'Existing regional block. nara visibly combines the Kinki control with a Nara search term.',
    },
    sourceType: {
      type: 'string',
      enum: ['all', 'official', 'specialist', 'primary', 'news', 'other'],
      description: 'Visible source-quality tier. official means first-party/public-body information; primary means official plus specialist.',
    },
    period: {
      type: 'string',
      enum: ['all', '24h', '7d', '30d'],
      description: 'Publication period. Omit to keep the current period.',
    },
  };
  var emergencyPeriodProperty = Object.assign({}, searchProperties.period, {
    description: 'Publication period. Omit to use the emergency view default of 30 days.',
  });

  var tools = [
    {
      name: 'search_deaf_info',
      title: 'Deaf Naviの検索・絞り込み',
      description: 'Update the visible Deaf Navi search and filter controls. Omitted fields keep the current human-visible state, so follow-up requests can refine the same view.',
      inputSchema: { type: 'object', properties: searchProperties, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: executeSearch,
    },
    {
      name: 'show_results',
      title: '重要な検索結果を強調',
      description: 'Highlight up to five articles in the current visible results and scroll the first one into view. With no articleIds, highlights the first count results.',
      inputSchema: {
        type: 'object',
        properties: {
          articleIds: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 2048 } },
          count: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: executeShowResults,
    },
    {
      name: 'get_emergency_resources',
      title: '緊急・防災情報を表示',
      description: 'Show safety and disaster information in the current UI and return the nationwide emergency-call guide link. Regional filtering uses the existing visible region blocks.',
      inputSchema: {
        type: 'object',
        properties: {
          region: searchProperties.region,
          period: emergencyPeriodProperty,
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: executeEmergency,
    },
    {
      name: 'open_life_guide',
      title: '暮らしのガイドを開く',
      description: 'Navigate the current tab to the requested Deaf Navi life-guide section. This leaves the current page, so same-page Undo is not offered for the navigation.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['all', 'emergency', 'medical', 'education', 'employment', 'phone', 'life'], default: 'all' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: executeLifeGuide,
    },
    {
      name: 'set_accessibility_preferences',
      title: '表示設定を変更',
      description: 'Immediately update Deaf Navi text size and/or light/dark theme using the same persisted settings as the visible buttons.',
      inputSchema: {
        type: 'object',
        properties: {
          textSize: { type: 'string', enum: ['standard', 'large', 'xlarge'] },
          theme: { type: 'string', enum: ['light', 'dark'] },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: executePreferences,
    },
    {
      name: 'open_accessibility_tool',
      title: '情報保障ツールを開く',
      description: 'Navigate the current tab directly to an existing OtoMado accessibility tool: live captions, writing board, or sound visualizer.',
      inputSchema: {
        type: 'object',
        properties: {
          tool: { type: 'string', enum: ['captions', 'writing_board', 'sound_visualizer'] },
        },
        required: ['tool'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: executeAccessibilityTool,
    },
    {
      name: 'get_current_view_state',
      title: '現在の共有画面状態を確認',
      description: 'Read the current human-visible filters, accessibility preferences, result summary, highlighted articles, and recent Agent Activity without changing the page.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: executeCurrentState,
    },
  ];

  Promise.all(tools.map(function (tool) {
    return document.modelContext.registerTool(tool, { signal: registrationController.signal });
  })).then(function () {
    setStatus('ready', 'Site tools: ' + tools.length);
  }).catch(function () {
    registrationController.abort();
    setStatus('error', '登録エラー');
  });
})();
