/**
 * 国内ニュースのキュレーション実行スクリプト。
 *
 * 役割: フィード取得（I/O）→ lib/curation の純関数でスコア・選定 → JSON書き出し。
 * 情報源・語彙・しきい値の定義は config/ 配下を編集する。
 *
 * 使い方:
 *   node src/curate.mjs             # 本番 (docs/articles.json)
 *   node src/curate.mjs --dev       # dev  (docs/articles-dev.json)
 *   CURATION_PROFILE=legacy         # 旧・縮小プロファイル（prodでは拡張が既定）
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CURATE_USER_AGENT } from '../config/site.mjs';
import { CURATION_LIMITS } from '../config/scoring.mjs';
import {
  DIRECT_FEEDS,
  EXPANDED_DIRECT_FEEDS,
  EXPANDED_KEYWORD_GROUPS,
  KEYWORD_GROUPS,
  SOCIAL_FEEDS,
} from '../config/sources.domestic.mjs';
import { fetchWithTimeout } from './lib/fetch-retry.mjs';
import { parseFeedEntries } from './lib/feed-parser.mjs';
import {
  buildArticle,
  curateArticles,
  hydratePreviousArticle,
  isRelevantArticle,
  isWithinFallbackWindow,
  mergeOldArticles,
  splitVisibleArticles,
  stripInternal,
} from './lib/curation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'docs');

const VARIANT = getVariant();
const IS_DEV = VARIANT === 'dev';
const USE_EXPANDED_PROFILE = process.env.CURATION_PROFILE === 'legacy' ? IS_DEV : true;
const SUFFIX = IS_DEV ? '-dev' : '';
const DATA_FILE = join(DATA_DIR, `articles${SUFFIX}.json`);
const OLD_DATA_FILE = join(DATA_DIR, `articles-old${SUFFIX}.json`);

function getVariant() {
  if (process.env.CURATION_VARIANT === 'dev') return 'dev';
  if (process.argv.includes('--dev')) return 'dev';
  const variantArg = process.argv.find((arg) => arg.startsWith('--variant='));
  return variantArg?.split('=')[1] === 'dev' ? 'dev' : 'prod';
}

function buildGoogleNewsUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=ja&gl=JP&ceid=JP:ja`;
}

async function fetchFeedXml(url) {
  return fetchWithTimeout(url, { headers: { 'User-Agent': CURATE_USER_AGENT } });
}

async function loadJsonArticles(file) {
  try {
    const raw = await readFile(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

async function collectArticles() {
  const allArticles = [];
  const directFeeds = USE_EXPANDED_PROFILE
    ? [...DIRECT_FEEDS, ...EXPANDED_DIRECT_FEEDS, ...SOCIAL_FEEDS]
    : DIRECT_FEEDS;
  const sourceHealth = {
    direct: { requested: directFeeds.length, succeeded: 0, failed: [] },
    discovery: { requested: 0, succeeded: 0, failed: [] },
  };

  for (const feed of directFeeds) {
    try {
      const res = await fetchFeedXml(feed.url);
      if (!res.ok) {
        console.warn(`[skip] ${feed.sourceName}: HTTP ${res.status}`);
        sourceHealth.direct.failed.push({ sourceName: feed.sourceName, status: res.status });
        continue;
      }
      const xml = await res.text();
      const items = parseFeedEntries(xml, feed).map((entry) => buildArticle(entry, feed));
      console.log(`[direct] ${feed.sourceName}: ${items.length} items`);
      sourceHealth.direct.succeeded += 1;
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] ${feed.sourceName}: ${err.message}`);
      sourceHealth.direct.failed.push({ sourceName: feed.sourceName, error: err.name ?? 'Error' });
    }
  }

  const keywordGroups = USE_EXPANDED_PROFILE ? EXPANDED_KEYWORD_GROUPS : KEYWORD_GROUPS;
  sourceHealth.discovery.requested = keywordGroups.length;
  for (const { query } of keywordGroups) {
    try {
      const res = await fetchFeedXml(buildGoogleNewsUrl(query));
      if (!res.ok) {
        console.warn(`[skip] "${query}": HTTP ${res.status}`);
        sourceHealth.discovery.failed.push({ query, status: res.status });
        continue;
      }
      const xml = await res.text();
      const items = parseFeedEntries(xml, null).map((entry) => buildArticle(entry, null));
      console.log(`[google] "${query}": ${items.length} items`);
      sourceHealth.discovery.succeeded += 1;
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] "${query}": ${err.message}`);
      sourceHealth.discovery.failed.push({ query, error: err.name ?? 'Error' });
    }
  }

  return { allArticles, directFeeds, sourceHealth };
}

async function loadNews() {
  const { allArticles, directFeeds, sourceHealth } = await collectArticles();

  const directFeedByName = new Map(directFeeds.map((feed) => [feed.sourceName, feed]));
  const previousArticles = await loadJsonArticles(DATA_FILE);
  const fallbackArticles = previousArticles
    .filter((article) => isWithinFallbackWindow(article))
    .map((article) => hydratePreviousArticle(article, directFeedByName));
  allArticles.push(...fallbackArticles);

  if (allArticles.length === 0) {
    throw new Error('全フィード取得失敗。処理を中断します。');
  }

  if (USE_EXPANDED_PROFILE) {
    return curateArticles(allArticles, {
      fallbackCandidateCount: fallbackArticles.length,
      sourceHealth,
    });
  }

  // 旧・縮小プロファイル: 関連キーワード一致とURL単位の重複除去のみ
  const directSourceNames = new Set(directFeeds.map((f) => f.sourceName));
  const filtered = allArticles.filter(
    (a) => directSourceNames.has(a.sourceName) || isRelevantArticle(a.title, a.summary),
  );

  const seen = new Set();
  const deduped = filtered.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const { visibleArticles } = splitVisibleArticles(deduped);

  return {
    articles: visibleArticles,
    oldArticles: [],
    report: null,
  };
}

async function main() {
  console.log(`Deaf Navi Web: キュレーション開始 (${VARIANT})`);
  const { articles, oldArticles, report } = await loadNews();
  console.log(`合計: ${articles.length}件（${USE_EXPANDED_PROFILE ? '品質フィルタ・近似重複除去後' : '重複除去・関連性フィルタ後'}）`);

  await mkdir(DATA_DIR, { recursive: true });
  const previousOldArticles = USE_EXPANDED_PROFILE ? await loadJsonArticles(OLD_DATA_FILE) : [];
  const stripOptions = { keepScores: IS_DEV };
  const mergedOldArticles = USE_EXPANDED_PROFILE
    ? mergeOldArticles(oldArticles.map((a) => stripInternal(a, stripOptions)), previousOldArticles)
    : [];

  const generatedAt = new Date().toISOString();
  const payload = USE_EXPANDED_PROFILE
    ? {
      generatedAt,
      variant: VARIANT,
      profile: 'expanded',
      count: articles.length,
      quality: report,
      articles: articles.map((a) => stripInternal(a, stripOptions)),
    }
    : {
      generatedAt,
      count: articles.length,
      articles: articles.map((a) => stripInternal(a, stripOptions)),
    };
  await writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`書き出し: ${DATA_FILE}`);

  if (USE_EXPANDED_PROFILE) {
    const oldPayload = {
      generatedAt,
      variant: VARIANT,
      profile: 'expanded',
      count: mergedOldArticles.length,
      source: {
        currentOverflowCount: oldArticles.length,
        previousOldCount: previousOldArticles.length,
        maxOldArticles: CURATION_LIMITS.MAX_OLD_ARTICLES,
      },
      articles: mergedOldArticles,
    };
    await writeFile(OLD_DATA_FILE, JSON.stringify(oldPayload, null, 2), 'utf8');
    console.log(`書き出し: ${OLD_DATA_FILE}`);
  }
}

main().catch((err) => {
  console.error('キュレーション失敗:', err);
  process.exit(1);
});
