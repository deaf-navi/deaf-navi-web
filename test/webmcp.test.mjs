import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const source = readFileSync(join(root, 'src', 'webmcp.js'), 'utf8');

function fakeElement() {
  const attributes = new Map();
  return {
    children: [],
    disabled: false,
    textContent: '',
    title: '',
    addEventListener() {},
    appendChild(child) { this.children.push(child); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) { return attributes.has(name); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    removeAttribute(name) { attributes.delete(name); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
  };
}

async function createHarness(overrides = {}) {
  const sourceFilter = fakeElement();
  sourceFilter.options = [];
  sourceFilter.appendChild = function appendOption(child) {
    this.children.push(child);
    this.options.push(child);
  };
  const elements = new Map([
    ['agent-activity', fakeElement()],
    ['agent-activity-log', fakeElement()],
    ['agent-activity-status', fakeElement()],
    ['agent-activity-undo', fakeElement()],
    ['source-filter', sourceFilter],
  ]);
  const calls = [];
  const documentListeners = new Map();
  const appCalls = { setFilters: [], restoreState: [] };
  const document = {
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    createElement: fakeElement,
    getElementById(id) { return elements.get(id) ?? null; },
    modelContext: {
      registerTool(tool, options) {
        calls.push({ tool, options });
        return Promise.resolve();
      },
    },
    querySelectorAll() { return []; },
  };
  const app = {
    getState: () => ({ q: '', category: 'all', sourceType: 'all', period: 'all', region: 'all' }),
    getViewState: () => ({ filters: {}, visibleResultCount: 0, matchedResultCount: 0, results: [] }),
    setFilters: async (filters) => {
      appCalls.setFilters.push(filters);
      if (overrides.setFiltersError) throw overrides.setFiltersError;
      return { filters, visibleResultCount: 0, matchedResultCount: 0, results: [] };
    },
    restoreState: async (state) => { appCalls.restoreState.push(state); return state; },
  };
  const window = {
    AbortController,
    DeafNaviApp: app,
    DeafNaviDisplay: {
      getPreferences: () => ({ theme: 'light', textSize: 'standard' }),
      setPreferences: (value) => value,
    },
    location: { href: 'https://example.test/deaf-navi-web/' },
    matchMedia: () => ({ matches: true }),
    setTimeout() {},
  };

  vm.runInNewContext(source, {
    AbortController,
    URL,
    console,
    document,
    Promise,
    window,
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { calls, elements, documentListeners, appCalls };
}

async function captureRegisteredTools() {
  return (await createHarness()).calls;
}

test('WebMCP: 必須6 Toolと共有状態Toolをtop-level imperative APIで登録する', async () => {
  const calls = await captureRegisteredTools();
  const names = calls.map(({ tool }) => tool.name);
  assert.deepEqual(names, [
    'search_deaf_info',
    'show_results',
    'get_emergency_resources',
    'open_life_guide',
    'set_accessibility_preferences',
    'open_accessibility_tool',
    'get_current_view_state',
  ]);
  assert.equal(new Set(names).size, names.length, 'Tool名が重複しています');
  for (const { tool, options } of calls) {
    assert.equal(typeof tool.execute, 'function', `${tool.name} にexecuteがありません`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(options.signal instanceof AbortSignal, `${tool.name} の登録解除signalがありません`);
  }
});

test('WebMCP: inputSchemaが共有UIの対応値と副作用を正しく表す', async () => {
  const calls = await captureRegisteredTools();
  const tools = Object.fromEntries(calls.map(({ tool }) => [tool.name, tool]));
  const search = tools.search_deaf_info.inputSchema.properties;

  assert.deepEqual(Array.from(search.period.enum), ['all', '24h', '7d', '30d']);
  assert.ok(search.region.enum.includes('nara'));
  assert.ok(search.sourceType.enum.includes('official'));
  assert.ok(search.category.enum.includes('accessibility'));
  assert.deepEqual(Array.from(tools.open_accessibility_tool.inputSchema.required), ['tool']);
  assert.deepEqual(
    Array.from(tools.open_accessibility_tool.inputSchema.properties.tool.enum),
    ['captions', 'writing_board', 'sound_visualizer'],
  );
  assert.equal(tools.get_current_view_state.annotations.readOnlyHint, true);
  assert.match(tools.get_emergency_resources.inputSchema.properties.period.description, /default of 30 days/);
  for (const name of Object.keys(tools).filter((name) => name !== 'get_current_view_state')) {
    assert.equal(tools[name].annotations.readOnlyHint, false, `${name} はUIを変えるためreadOnlyではありません`);
  }
});

test('WebMCP: 非対応ブラウザ向けguardと生成経路を維持する', () => {
  assert.match(source, /!document\.modelContext \|\| typeof document\.modelContext\.registerTool !== 'function'/);
  assert.doesNotMatch(source, /innerHTML\s*=/, 'Agent由来の値をinnerHTMLへ入れないでください');

  const build = readFileSync(join(root, 'src', 'build.mjs'), 'utf8');
  const serviceWorker = readFileSync(join(root, 'src', 'assets', 'sw.js'), 'utf8');
  assert.match(build, /createHash\('sha256'\)/);
  assert.match(build, /clientAssetVersion/);
  assert.match(build, /copyAsset\(join\(__dirname, 'webmcp\.js'\), 'webmcp\.js'\)/);
  assert.match(serviceWorker, /`\.\/ui-controls\.js\?v=\$\{ASSET_VERSION\}`/);
  assert.match(serviceWorker, /`\.\/app\.js\?v=\$\{ASSET_VERSION\}`/);
  assert.match(serviceWorker, /`\.\/webmcp\.js\?v=\$\{ASSET_VERSION\}`/);
});

test('WebMCP: 奈良検索と緊急情報の既定30日を実行時の共有UIへ渡す', async () => {
  const harness = await createHarness();
  const tools = Object.fromEntries(harness.calls.map(({ tool }) => [tool.name, tool]));

  await tools.search_deaf_info.execute({ region: 'nara' });
  assert.equal(harness.appCalls.setFilters[0].region, 'nara');
  assert.equal(harness.appCalls.setFilters[0].query, '奈良');

  await tools.get_emergency_resources.execute({ region: 'nara' });
  assert.deepEqual(JSON.parse(JSON.stringify(harness.appCalls.setFilters[1])), {
    query: '奈良',
    category: 'safety',
    sourceType: 'all',
    period: '30d',
    region: 'nara',
  });
});

test('WebMCP: 専用の情報源選択肢はTool実行時だけ共有UIへ追加する', async () => {
  const harness = await createHarness();
  const search = harness.calls.find(({ tool }) => tool.name === 'search_deaf_info').tool;
  const sourceFilter = harness.elements.get('source-filter');

  assert.equal(sourceFilter.options.length, 0);
  await search.execute({ sourceType: 'official' });

  assert.equal(sourceFilter.options.length, 1);
  assert.equal(sourceFilter.options[0].value, 'official');
  assert.equal(sourceFilter.options[0].textContent, '一次情報のみ');
  assert.equal(sourceFilter.options[0].getAttribute('data-webmcp-only'), 'true');
  assert.equal(harness.appCalls.setFilters[0].sourceType, 'official');
});

test('WebMCP: 失敗した変更をrollbackし、手動クリア・もっと読む後はUndoしない', async () => {
  const failure = new Error('filter failed');
  const failedHarness = await createHarness({ setFiltersError: failure });
  const failedSearch = failedHarness.calls.find(({ tool }) => tool.name === 'search_deaf_info').tool;
  await assert.rejects(failedSearch.execute({ query: '奈良' }), /filter failed/);
  assert.equal(failedHarness.appCalls.restoreState.length, 1, '失敗前のUI状態を復元していません');
  assert.equal(failedHarness.elements.get('agent-activity-undo').disabled, true, '失敗した操作がUndo履歴に残っています');

  for (const selector of ['#news-search-clear', '#load-more-btn']) {
    const harness = await createHarness();
    const preferences = harness.calls.find(({ tool }) => tool.name === 'set_accessibility_preferences').tool;
    await preferences.execute({ textSize: 'large' });
    assert.equal(harness.elements.get('agent-activity-undo').disabled, false);
    harness.documentListeners.get('click')({
      isTrusted: true,
      target: { closest: (query) => query.includes(selector) ? {} : null },
    });
    assert.equal(harness.elements.get('agent-activity-undo').disabled, true, `${selector}の手動操作後もUndoが残っています`);
  }
});
