import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const APP_DIR = join(DOCS, 'app', 'v1');

const SITE_URL = 'https://tamas-hub.github.io/deaf-navi-web/';
const APP_BASE_URL = `${SITE_URL}app/v1/`;
const UPDATE_SCHEDULE_JST = ['06:00', '12:00', '18:00'];
const SCHEMA_VERSION = 'deaf-navi-app-sync.v1';
const IOS_ARTICLE_COMPAT_VERSION = 'deaf-navi-ios-article.v1';
const IOS_ARTICLE_EXPANDED_VERSION = 'deaf-navi-ios-article.v2';

const DOMESTIC_CATEGORIES = {
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

const DOMESTIC_CATEGORY_ORDER = [
  'all',
  'policy',
  'accessibility',
  'medical',
  'education',
  'technology',
  'culture',
  'sports',
  'safety',
  'event',
  'relay',
  'local',
  'general',
];

const LEGACY_DOMESTIC_CATEGORY = {
  all: 'all',
  policy: 'policy',
  accessibility: 'policy',
  relay: 'policy',
  medical: 'medical',
  education: 'education',
  technology: 'general',
  culture: 'culture',
  sports: 'sports',
  safety: 'policy',
  event: 'culture',
  local: 'local',
  general: 'general',
};

const WORLD_REGIONS = {
  asia_oceania: 'アジア・オセアニア',
  americas: '北米・中南米',
  europe_cis: 'ヨーロッパ・CIS',
  middle_east_africa: '中東・アフリカ',
};

const WORLD_TOPICS = {
  accessibility: 'アクセシビリティ・情報保障',
  rights: '権利・制度',
  health: '医療・補聴',
  education: '教育',
  technology: '技術・AI',
  culture: '文化・社会',
  sports: 'デフスポーツ',
  safety: '災害・安全',
  general: '一般',
};

const WORLD_TOPIC_ORDER = [
  'all',
  'accessibility',
  'rights',
  'health',
  'education',
  'technology',
  'culture',
  'sports',
  'safety',
  'general',
];

const LEGACY_WORLD_CATEGORY = {
  accessibility: 'policy',
  rights: 'policy',
  health: 'medical',
  education: 'education',
  technology: 'general',
  culture: 'culture',
  sports: 'sports',
  safety: 'policy',
  general: 'general',
};

const IOS_COMPAT_EXCLUDED_DOMESTIC_CATEGORIES = new Set(['relay']);

const IOS_V2_WORLD_CATEGORY = {
  accessibility: 'accessibility',
  rights: 'policy',
  health: 'medical',
  education: 'education',
  technology: 'technology',
  culture: 'culture',
  sports: 'sports',
  safety: 'safety',
  general: 'general',
};

function appUrl(file) {
  return `${APP_BASE_URL}${file}`;
}

function siteUrl(file = '') {
  return `${SITE_URL}${file}`;
}

function stableId(prefix, url) {
  const hash = createHash('sha256').update(String(url ?? '')).digest('hex').slice(0, 20);
  return `${prefix}_${hash}`;
}

function isoSeconds(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject);
  }
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    if (Array.isArray(item) && item.length === 0) continue;
    out[key] = compactObject(item);
  }
  return out;
}

async function readJson(file) {
  const raw = await readFile(join(DOCS, file), 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, payload) {
  await writeFile(join(APP_DIR, file), `${JSON.stringify(compactObject(payload), null, 2)}\n`, 'utf8');
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    if (!value) return acc;
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function domesticFilters() {
  return DOMESTIC_CATEGORY_ORDER.map((id) => ({
    id,
    label: DOMESTIC_CATEGORIES[id],
    legacyCategory: LEGACY_DOMESTIC_CATEGORY[id],
    excludedFromAll: id === 'relay',
  }));
}

function worldRegionFilters(regions = WORLD_REGIONS) {
  const entries = Object.entries(regions);
  return [
    { id: 'all', label: 'すべての地域' },
    ...entries.map(([id, label]) => ({ id, label })),
  ];
}

function worldTopicFilters(topics = WORLD_TOPICS) {
  return WORLD_TOPIC_ORDER.map((id) => ({
    id,
    label: id === 'all' ? 'すべてのカテゴリ' : topics[id] ?? WORLD_TOPICS[id] ?? id,
    legacyCategory: id === 'all' ? 'all' : LEGACY_WORLD_CATEGORY[id] ?? 'general',
  }));
}

function qualitySummary(quality) {
  if (!quality) return null;
  return {
    version: quality.version,
    rawCount: quality.rawCount,
    scoredCount: quality.scoredCount,
    filteredCount: quality.filteredCount,
    dedupedCount: quality.dedupedCount,
    selectedCount: quality.selectedCount,
    primaryCategoryLimit: quality.primaryCategoryLimit,
    primaryVisibleCount: quality.primaryVisibleCount,
    extraVisibleCount: quality.extraVisibleCount,
    extraVisibleCategoryCounts: quality.extraVisibleCategoryCounts,
    overflowCount: quality.overflowCount,
    minScore: quality.minScore,
    maxArticles: quality.maxArticles,
    regionCounts: quality.regionCounts,
    topicCounts: quality.topicCounts,
    categoryCountsVisible: quality.categoryCountsVisible,
    translationProvider: quality.translationProvider,
    japanesePostEditProvider: quality.japanesePostEditProvider,
    japanesePostEdit: quality.japanesePostEdit,
  };
}

function detectOriginalLang(text) {
  const value = String(text ?? '');
  if (/[\u0600-\u06ff]/.test(value)) return 'ar';
  if (/[\uac00-\ud7af]/.test(value)) return 'ko';
  if (/[\u3400-\u9fff]/.test(value)) return 'zh';
  if (/[ぁ-んァ-ヶ]/.test(value)) return 'ja';
  if (/[а-яё]/i.test(value)) return 'ru';
  if (/[ğışİöüç]/i.test(value)) return 'tr';
  if (/[äöüß]/i.test(value)) return 'de';
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(value)) return 'fr';
  if (/[ãõáéíóúâêô]/i.test(value)) return 'pt';
  if (/[ñ¿¡]/i.test(value)) return 'es';
  if (/[àèéìíîòóùú]/i.test(value)) return 'it';
  return 'en';
}

function domesticArticle(article) {
  const category = DOMESTIC_CATEGORIES[article.category] ? article.category : 'general';
  const url = article.id;
  return {
    id: url,
    stableId: stableId('domestic', url),
    url,
    title: cleanText(article.title),
    summary: cleanText(article.summary),
    language: 'ja-JP',
    publishedAt: isoSeconds(article.publishedAt),
    sourceName: cleanText(article.sourceName || 'Unknown'),
    sourceURL: article.sourceUrl,
    sourceUrl: article.sourceUrl,
    sourceType: article.sourceType ?? 'rss',
    category,
    categoryLabel: DOMESTIC_CATEGORIES[category],
    legacyCategory: LEGACY_DOMESTIC_CATEGORY[category] ?? 'general',
    curationScore: article.curationScore,
    curationSignals: article.curationSignals,
  };
}

function iosCompatibleArticle(article, legacyCategory) {
  const url = article.id || article.url;
  return {
    id: url,
    title: cleanText(article.title),
    summary: cleanText(article.summary),
    url,
    publishedAt: isoSeconds(article.publishedAt),
    sourceName: cleanText(article.sourceName || 'Unknown'),
    sourceURL: article.sourceURL || article.sourceUrl,
    category: legacyCategory,
  };
}

function buildDomesticPayload(data, { variant, sourceFile, pageFile }) {
  const articles = (data.articles ?? []).map(domesticArticle);
  const sourceGeneratedAt = isoSeconds(data.generatedAt);
  return {
    schemaVersion: SCHEMA_VERSION,
    feedId: 'deaf-navi-domestic',
    title: 'Deaf Navi Web',
    variant,
    profile: data.profile,
    generatedAt: sourceGeneratedAt,
    sourceGeneratedAt,
    count: articles.length,
    language: 'ja-JP',
    refresh: {
      scheduleTimezone: 'Asia/Tokyo',
      scheduleJst: UPDATE_SCHEDULE_JST,
      recommendedTtlSeconds: 21600,
      staleAfterSeconds: 86400,
    },
    source: {
      webPageUrl: siteUrl(pageFile),
      rawJsonUrl: siteUrl(sourceFile),
      rssUrl: siteUrl('feed.xml'),
    },
    display: {
      defaultFilter: 'all',
      excludedFromAll: ['relay'],
      categories: domesticFilters(),
    },
    compatibility: {
      currentIosArticleUrl: appUrl('ios-news-v2.json'),
      currentIosArticleSchema: IOS_ARTICLE_EXPANDED_VERSION,
      legacyIosArticleUrl: appUrl('ios-news-v1.json'),
      legacyIosArticleSchema: IOS_ARTICLE_COMPAT_VERSION,
      note: 'currentIosArticleUrl keeps expanded web categories for the current iOS app. legacyIosArticleUrl maps categories for older app builds.',
    },
    quality: qualitySummary(data.quality),
    counts: {
      byCategory: countBy(articles, 'category'),
      byLegacyCategory: countBy(articles, 'legacyCategory'),
    },
    articles,
  };
}

function buildDomesticCompatArray(data) {
  return (data.articles ?? [])
    .filter((article) => !IOS_COMPAT_EXCLUDED_DOMESTIC_CATEGORIES.has(article.category))
    .map((article) => {
      const normalized = domesticArticle(article);
      return iosCompatibleArticle(normalized, normalized.legacyCategory);
    });
}

function buildDomesticExpandedArray(data) {
  return (data.articles ?? [])
    .map((article) => {
      const normalized = domesticArticle(article);
      return iosCompatibleArticle(normalized, normalized.category);
    });
}

function worldTranslation(article) {
  return {
    provider: article.translationProvider,
    postEditProvider: article.japanesePostEditProvider,
    postEdited: Boolean(article.japanesePostEditProvider),
    policy: 'base machine translation via translate.googleapis.com with Deaf Navi glossary; Codex App Server post-edit is used when available and required in the production World workflow.',
  };
}

function worldArticle(article, mode) {
  const url = article.id;
  const originalTitle = cleanText(article.originalTitle || article.title);
  const originalSummary = cleanText(article.originalSummary || article.summary || originalTitle);
  const originalLanguage = detectOriginalLang(`${originalTitle} ${originalSummary}`);
  const japanese = {
    title: cleanText(article.title || originalTitle),
    summary: cleanText(article.summary || originalSummary),
    language: 'ja-JP',
    translation: worldTranslation(article),
  };
  const original = {
    title: originalTitle,
    summary: originalSummary,
    language: originalLanguage,
  };
  const topic = article.topic || 'general';
  const base = {
    id: url,
    stableId: stableId('world', url),
    url,
    publishedAt: isoSeconds(article.publishedAt),
    sourceName: cleanText(article.sourceName || 'Unknown'),
    sourceURL: article.sourceUrl,
    sourceUrl: article.sourceUrl,
    sourceDomain: article.sourceDomain,
    sourceMode: article.sourceMode,
    sourcePriority: article.sourcePriority,
    region: article.region,
    regionLabel: article.regionLabel ?? WORLD_REGIONS[article.region],
    topic,
    topicLabel: article.topicLabel ?? WORLD_TOPICS[topic],
    legacyCategory: LEGACY_WORLD_CATEGORY[topic] ?? 'general',
    curationScore: article.curationScore,
    curationSignals: article.curationSignals,
    originalLanguage,
  };

  if (mode === 'original') {
    return {
      ...base,
      title: original.title,
      summary: original.summary,
      language: original.language,
      translated: japanese,
    };
  }

  if (mode === 'multilingual') {
    return {
      ...base,
      title: japanese.title,
      summary: japanese.summary,
      language: 'ja-JP',
      defaultLocale: 'ja-JP',
      localized: {
        ja: japanese,
        original,
      },
    };
  }

  return {
    ...base,
    title: japanese.title,
    summary: japanese.summary,
    language: 'ja-JP',
    original,
    translation: japanese.translation,
  };
}

function buildWorldPayload(data, mode) {
  const isOriginal = mode === 'original';
  const isMultilingual = mode === 'multilingual';
  const articles = (data.articles ?? []).map((article) => worldArticle(article, mode));
  const sourceGeneratedAt = isoSeconds(data.generatedAt);
  return {
    schemaVersion: SCHEMA_VERSION,
    feedId: isMultilingual ? 'deaf-navi-world-multilingual' : isOriginal ? 'deaf-navi-world-original' : 'deaf-navi-world-jp',
    title: isMultilingual ? 'Deaf Navi World Multilingual' : isOriginal ? 'Deaf Navi World-Original' : 'Deaf Navi World-JP',
    variant: data.variant ?? 'world',
    mode,
    generatedAt: sourceGeneratedAt,
    sourceGeneratedAt,
    count: articles.length,
    language: isOriginal ? 'und' : 'ja-JP',
    refresh: {
      scheduleTimezone: 'Asia/Tokyo',
      scheduleJst: UPDATE_SCHEDULE_JST,
      recommendedTtlSeconds: 21600,
      staleAfterSeconds: 86400,
    },
    source: {
      webPageUrl: siteUrl(isOriginal ? 'deaf-navi-world-original.html' : 'deaf-navi-world-jp.html'),
      rawJsonUrl: siteUrl('articles-world.json'),
      rssUrl: siteUrl(isOriginal ? 'feed-world-original.xml' : 'feed-world.xml'),
    },
    translation: {
      provider: data.quality?.translationProvider,
      japanesePostEditProvider: data.quality?.japanesePostEditProvider,
      japanesePostEdit: data.quality?.japanesePostEdit,
      basePolicy: 'World-JP uses free/base Google translation first, then Deaf Navi glossary normalization and Codex App Server post-edit when available.',
    },
    display: {
      defaultRegion: 'all',
      defaultTopic: 'all',
      regions: worldRegionFilters(data.regions),
      topics: worldTopicFilters(data.topics),
    },
    compatibility: {
      currentIosArticleUrl: appUrl(isOriginal ? 'ios-world-original-v2.json' : 'ios-world-jp-v2.json'),
      currentIosArticleSchema: IOS_ARTICLE_EXPANDED_VERSION,
      legacyIosArticleUrl: appUrl(isOriginal ? 'ios-world-original-v1.json' : 'ios-world-jp-v1.json'),
      legacyIosArticleSchema: IOS_ARTICLE_COMPAT_VERSION,
      note: 'currentIosArticleUrl keeps expanded World topics where the current iOS app supports them. legacyIosArticleUrl maps topics for older app builds.',
    },
    quality: qualitySummary(data.quality),
    counts: {
      byRegion: countBy(articles, 'region'),
      byTopic: countBy(articles, 'topic'),
      byLegacyCategory: countBy(articles, 'legacyCategory'),
      byOriginalLanguage: countBy(articles, 'originalLanguage'),
    },
    articles,
  };
}

function buildWorldCompatArray(data, mode) {
  return (data.articles ?? [])
    .map((article) => {
      const normalized = worldArticle(article, mode);
      return iosCompatibleArticle(normalized, normalized.legacyCategory);
    });
}

function buildWorldExpandedArray(data, mode) {
  return (data.articles ?? [])
    .map((article) => {
      const normalized = worldArticle(article, mode);
      return iosCompatibleArticle(normalized, IOS_V2_WORLD_CATEGORY[normalized.topic] ?? 'general');
    });
}

function latestIsoSecond(...values) {
  const valid = values
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  if (!valid.length) return null;
  return isoSeconds(Math.max(...valid));
}

function buildManifest({ domestic, world }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: latestIsoSecond(domestic?.generatedAt, world?.generatedAt),
    siteUrl: SITE_URL,
    appBaseUrl: APP_BASE_URL,
    refresh: {
      scheduleTimezone: 'Asia/Tokyo',
      scheduleJst: UPDATE_SCHEDULE_JST,
      recommendedTtlSeconds: 21600,
      staleAfterSeconds: 86400,
    },
    endpoints: {
      domestic: {
        title: 'Deaf Navi Web',
        url: appUrl('domestic.json'),
        rawJsonUrl: siteUrl('articles.json'),
        iosCompatibleUrl: appUrl('ios-news-v2.json'),
        legacyIosCompatibleUrl: appUrl('ios-news-v1.json'),
        count: domestic?.articles?.length ?? 0,
        sourceGeneratedAt: isoSeconds(domestic?.generatedAt),
        categories: domesticFilters(),
        excludedFromAll: ['relay'],
      },
      worldJp: {
        title: 'Deaf Navi World-JP',
        url: appUrl('world-jp.json'),
        rawJsonUrl: siteUrl('articles-world.json'),
        iosCompatibleUrl: appUrl('ios-world-jp-v2.json'),
        legacyIosCompatibleUrl: appUrl('ios-world-jp-v1.json'),
        count: world?.articles?.length ?? 0,
        sourceGeneratedAt: isoSeconds(world?.generatedAt),
        language: 'ja-JP',
        regions: worldRegionFilters(world?.regions),
        topics: worldTopicFilters(world?.topics),
        translation: {
          provider: world?.quality?.translationProvider,
          japanesePostEditProvider: world?.quality?.japanesePostEditProvider,
          japanesePostEdit: world?.quality?.japanesePostEdit,
        },
      },
      worldOriginal: {
        title: 'Deaf Navi World-Original',
        url: appUrl('world-original.json'),
        rawJsonUrl: siteUrl('articles-world.json'),
        iosCompatibleUrl: appUrl('ios-world-original-v2.json'),
        legacyIosCompatibleUrl: appUrl('ios-world-original-v1.json'),
        count: world?.articles?.length ?? 0,
        sourceGeneratedAt: isoSeconds(world?.generatedAt),
        language: 'und',
        regions: worldRegionFilters(world?.regions),
        topics: worldTopicFilters(world?.topics),
      },
      worldMultilingual: {
        title: 'Deaf Navi World Multilingual',
        url: appUrl('world-multilingual.json'),
        rawJsonUrl: siteUrl('articles-world.json'),
        count: world?.articles?.length ?? 0,
        sourceGeneratedAt: isoSeconds(world?.generatedAt),
        defaultLocale: 'ja-JP',
        regions: worldRegionFilters(world?.regions),
        topics: worldTopicFilters(world?.topics),
      },
    },
    compatibility: {
      currentIosArticleSchema: IOS_ARTICLE_EXPANDED_VERSION,
      legacyIosArticleSchema: IOS_ARTICLE_COMPAT_VERSION,
      dateFormat: 'ISO 8601 UTC without fractional seconds, compatible with JSONDecoder.DateDecodingStrategy.iso8601.',
      sourceURLKey: 'Swift Article.sourceURL is emitted as sourceURL; sourceUrl is also kept in rich sync payloads.',
      legacyCategoryMapping: {
        domestic: LEGACY_DOMESTIC_CATEGORY,
        worldTopics: LEGACY_WORLD_CATEGORY,
      },
      expandedCategoryMapping: {
        domestic: DOMESTIC_CATEGORY_ORDER.filter((category) => category !== 'all'),
        worldTopics: IOS_V2_WORLD_CATEGORY,
      },
    },
    sourcePolicy: {
      domestic: 'The app sync data is built from the same curated domestic JSON used by Deaf Navi Web.',
      world: 'The app sync data is built from the same world JSON used by Deaf Navi World-JP and Deaf Navi World-Original.',
      worldJpTranslation: 'Japanese text is Google-translation based with Deaf Navi glossary normalization; Codex App Server post-edit is reflected when present in articles-world.json.',
    },
  };
}

async function main() {
  const [domestic, world] = await Promise.all([
    readJson('articles.json'),
    readJson('articles-world.json'),
  ]);

  await mkdir(APP_DIR, { recursive: true });

  await writeJson('domestic.json', buildDomesticPayload(domestic, {
    variant: domestic.variant ?? 'prod',
    sourceFile: 'articles.json',
    pageFile: '',
  }));
  await writeJson('ios-news-v1.json', buildDomesticCompatArray(domestic));
  await writeJson('ios-news-v2.json', buildDomesticExpandedArray(domestic));

  await writeJson('world-jp.json', buildWorldPayload(world, 'jp'));
  await writeJson('world-original.json', buildWorldPayload(world, 'original'));
  await writeJson('world-multilingual.json', buildWorldPayload(world, 'multilingual'));
  await writeJson('ios-world-jp-v1.json', buildWorldCompatArray(world, 'jp'));
  await writeJson('ios-world-original-v1.json', buildWorldCompatArray(world, 'original'));
  await writeJson('ios-world-jp-v2.json', buildWorldExpandedArray(world, 'jp'));
  await writeJson('ios-world-original-v2.json', buildWorldExpandedArray(world, 'original'));

  const manifest = buildManifest({ domestic, world });
  await writeJson('manifest.json', manifest);
  await writeJson('index.json', manifest);

  console.log(`Deaf Navi app sync: wrote app API files to ${APP_DIR}`);
}

main().catch((err) => {
  console.error('Deaf Navi app sync build failed:', err);
  process.exit(1);
});
