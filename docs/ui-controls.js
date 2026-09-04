/**
 * 全ページ共通の表示設定コントロール。
 * - テーマ: ライトが既定。ダークは利用者が明示的に切り替えたときのみ（localStorage保存）
 * - 文字サイズ: 標準 → 大 → 特大 の3段階
 * - Service Worker 登録（PWA・オフライン対応）
 *
 * <head> のFOUC防止スクリプトが localStorage の保存値を先に適用している前提。
 */
(function () {
  'use strict';

  var docEl = document.documentElement;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* private mode */ }
  }

  /* ---- Service Worker ---- */
  if ('serviceWorker' in navigator
    && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      var swPath = document.querySelector('script[src*="ui-controls"]');
      var workerUrl = new URL('sw.js', swPath ? swPath.src : location.href);
      navigator.serviceWorker.register(workerUrl.href).catch(function () { /* 未対応環境は通常表示 */ });
    });
  }

  /* ---- 表示設定ボタン ---- */
  var controls = document.querySelector('[data-display-controls]');
  if (!controls) return;

  var themeBtn = document.getElementById('theme-toggle');
  var fontBtn = document.getElementById('font-toggle');

  var MOON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  var SUN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>';

  // ライトが既定: data-theme="dark" のときだけダーク
  function isDark() {
    return docEl.getAttribute('data-theme') === 'dark';
  }

  function syncThemeButton() {
    if (!themeBtn) return;
    var dark = isDark();
    themeBtn.setAttribute('aria-pressed', String(dark));
    var iconEl = themeBtn.querySelector('[data-theme-icon]');
    var labelEl = themeBtn.querySelector('[data-theme-label]');
    if (iconEl) iconEl.innerHTML = dark ? SUN_SVG : MOON_SVG;
    if (labelEl) labelEl.textContent = dark ? 'ライト表示' : 'ダーク表示';
  }

  function applyTheme(theme, persist) {
    if (theme !== 'light' && theme !== 'dark') {
      throw new Error('theme は light または dark を指定してください');
    }
    if (theme === 'dark') {
      docEl.setAttribute('data-theme', 'dark');
      if (persist !== false) storageSet('dn-theme', 'dark');
    } else {
      docEl.removeAttribute('data-theme');
      if (persist !== false) storageSet('dn-theme', null);
    }
    syncThemeButton();
  }

  var FONT_STEPS = ['standard', 'large', 'xlarge'];
  var FONT_LABELS = {
    standard: '文字を大きく',
    large: '文字をさらに大きく',
    xlarge: '文字を標準に戻す',
  };

  function currentFontStep() {
    var v = docEl.getAttribute('data-font');
    return v === 'large' || v === 'xlarge' ? v : 'standard';
  }

  function syncFontButton() {
    if (!fontBtn) return;
    var step = currentFontStep();
    fontBtn.setAttribute('aria-pressed', String(step !== 'standard'));
    var labelEl = fontBtn.querySelector('[data-font-label]');
    if (labelEl) labelEl.textContent = FONT_LABELS[step];
  }

  function applyFontStep(step, persist) {
    if (FONT_STEPS.indexOf(step) === -1) {
      throw new Error('textSize は standard、large、xlarge のいずれかを指定してください');
    }
    if (step === 'standard') {
      docEl.removeAttribute('data-font');
      if (persist !== false) storageSet('dn-font', null);
    } else {
      docEl.setAttribute('data-font', step);
      if (persist !== false) storageSet('dn-font', step);
    }
    syncFontButton();
  }

  function getPreferences() {
    return {
      theme: isDark() ? 'dark' : 'light',
      textSize: currentFontStep(),
    };
  }

  function setPreferences(next, options) {
    var input = next && typeof next === 'object' ? next : {};
    var persist = !options || options.persist !== false;
    if (Object.prototype.hasOwnProperty.call(input, 'theme')) {
      applyTheme(input.theme, persist);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'textSize')) {
      applyFontStep(input.textSize, persist);
    }
    return getPreferences();
  }

  controls.hidden = false;

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      applyTheme(isDark() ? 'light' : 'dark');
    });
  }

  if (fontBtn) {
    fontBtn.addEventListener('click', function () {
      var idx = FONT_STEPS.indexOf(currentFontStep());
      var next = FONT_STEPS[(idx + 1) % FONT_STEPS.length];
      applyFontStep(next);
    });
  }

  syncThemeButton();
  syncFontButton();

  // WebMCP 等からも、手動ボタンと同じ表示設定処理を再利用できるようにする。
  window.DeafNaviDisplay = Object.freeze({
    getPreferences: getPreferences,
    setPreferences: setPreferences,
  });
})();
