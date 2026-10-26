/**
 * キュレーションの中核ロジック（純関数のみ・I/Oなし）。
 * 語彙・しきい値は config/ 配下で管理する。
 */

import { newsContext } from './news-context.mjs';
import {newsArticleHash,savedNewsAssistanceIsCurrent,stampNewsAssistance} from './news-assistance.mjs';
import {
  CATEGORY_RULES,
  DEFAULT_CATEGORY,
} from '../../config/categories.mjs';
import {
  AGGREGATOR_SOURCES,
  CONTEXT_SCORE_CAP,
  CONTEXT_TERMS,
  CONTEXTUAL_RELEVANT_KEYWORDS,
  CURATION_LIMITS,
  PREFERRED_SOURCES,
  RELEVANCE_CONTEXT_KEYWORDS,
  RELEVANT_KEYWORDS,
  SCORE_TERMS,
  SOFT_NOISE_TERMS,
  PUBLICATION_NOISE_RULES,
} from '../../config/scoring.mjs';
import { PREFECTURES } from '../../config/regions.mjs';
import {
  countBy,
  diceSimilarity,
  normalizeForSearch,
  normalizeTitleKey,
  cleanSummaryText,
  cleanArticleTitle,
} from './text.mjs';

const {
  MAX_ARTICLES,
  EXTRA_VISIBLE_CATEGORIES,
  MAX_OLD_ARTICLES,
  DEFAULT_MIN_SCORE,
  MAX_CURRENT_AGE_DAYS,
  FALLBACK_RETENTION_DAYS,
  FUTURE_TOLERANCE_HOURS,
} = CURATION_LIMITS;

export const QUALITY_VERSION = 'publication-quality-v11';

/* ---------- 分類 ---------- */

export function classifyCategory(title, summary) {
  // A performer's nickname alone is not a medical topic.
  const text = (title + ' ' + summary).replace(/補聴器(?:を)?つけた天使/gu, '').toLowerCase();
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return DEFAULT_CATEGORY;
}

/** タイトル・要約から都道府県と地域ブロックを推定する（見つからなければ null） */
export function detectRegion(title, summary) {
  // A headline's location takes precedence over incidental places in the summary.
  for (const value of [title, summary]) {
    const text = String(value ?? '').normalize('NFKC');
    const explicit = PREFECTURES.filter((pref) => text.includes(pref.name));
    if (explicit.length > 1) return null;
    if (explicit.length === 1) return { region: explicit[0].region, prefecture: explicit[0].name };
    const matches = PREFECTURES.flatMap((pref) => pref.matchers
      .filter((word) => word === '津市' ? /(?<![\p{Script=Han}々])津市/u.test(text) : text.includes(word))
      .map((word) => ({ pref, word })));
    // 大津市 / 草津市 must not also match 津市; multi-prefecture stories stay unlabelled.
    const specific = matches.filter((match) => !matches.some((other) =>
      other.word.length > match.word.length && other.word.includes(match.word)));
    const places = [...new Map(specific.map(({ pref }) => [pref.name, pref])).values()];
    if (places.length > 1) return null;
    if (places.length === 1) return { region: places[0].region, prefecture: places[0].name };
  }
  return null;
}

export function isRelevantArticle(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (RELEVANT_KEYWORDS.filter((kw) => !['デフ', 'deaf'].includes(kw)).some((kw) => text.includes(kw.toLowerCase()))) return true;
  if (/デフ(?!レ|ォ|ラグ)|\bdeaf\b/iu.test(text)) return true;
  if (/サインエール|みみカレッジ|聞こえの|きこえの/u.test(text)) return true;
  if (/音声認識/u.test(text) && /字幕|文字起こし/u.test(text)) return true;
  if (/udcast|hellomovie|バリアフリー字幕|日本語字幕|リアルタイム字幕|自動字幕|ai字幕|音声文字変換|音声認識アプリ|きこえない|きこえにくい|聞こえない|聞こえにくい|聾|盲ろう/iu.test(text)) return true;
  const hasContextualTerm = CONTEXTUAL_RELEVANT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  if (!hasContextualTerm) return false;
  return RELEVANCE_CONTEXT_KEYWORDS.filter((kw) => !['耳', 'ろう', 'デフ', 'deaf'].includes(kw))
    .some((kw) => text.includes(kw.toLowerCase()));
}

export function inferDiscoverySourceTier(sourceName, sourceUrl) {
  const target = `${sourceName ?? ''} ${sourceUrl ?? ''}`;
  if (/(?:\.go\.jp|\.lg\.jp|\.ac\.jp)(?:[/:]|$)|\b(?:city|pref|town)\./iu.test(target)) {
    return 'official';
  }
  if (/PR TIMES|アットプレス|共同通信PRワイヤー|クラウドファンディング|READYFOR|キャンプファイヤー|valuepress|newscast\.jp/iu.test(target)) {
    return 'broad';
  }
  if (/福祉新聞|日本医事新報|CareNet|教育新聞|リセマム|パラサポ|医療政策|聴覚|ろう|手話/iu.test(sourceName ?? '')) {
    return 'specialist';
  }
  return 'google';
}

/**
 * フィードパーサの出力（エントリ）をキュレーション対象の記事オブジェクトへ変換する。
 * @param {object} entry parseFeedEntries の1件
 * @param {object|null} feedDef 直接フィード定義（発見系は null）
 */
export function buildArticle(entry, feedDef = null) {
  entry = { ...entry, title: cleanArticleTitle(entry.title, entry.sourceName) };
  const category = classifyCategory(entry.title, entry.summary);
  const location = detectRegion(entry.title, entry.summary);
  return {
    ...entry,
    _sourceContentHash:newsArticleHash(entry),
    ...(feedDef?.linkOnlySummary?{summary:'聴覚・手話に関わる取り組みについてのお知らせです。内容は公式記事をご確認ください。'}:{}),
    _requiresTopicMatch:Boolean(feedDef?.requireTopicMatch),
    _topicMatched:isRelevantArticle(entry.title,entry.summary),
    category,
    ...(location ? { region: location.region, prefecture: location.prefecture } : {}),
    _sourceTier: feedDef?.sourceTier ?? inferDiscoverySourceTier(entry.sourceName, entry.sourceUrl),
    _passThrough: Boolean(feedDef?.passThrough),
    _minScore: feedDef?.minScore,
    _feedUrl: feedDef?.url,
  };
}

/* ---------- 鮮度 ---------- */

export function articleAgeDays(article, now = Date.now()) {
  const published = new Date(article.publishedAt).getTime();
  if (!Number.isFinite(published)) return Number.POSITIVE_INFINITY;
  return (now - published) / 86_400_000;
}

export function hasAcceptablePublishedAt(article, now = Date.now()) {
  if (!article.publishedAt) return false;
  const ageDays = articleAgeDays(article, now);
  return ageDays >= -(FUTURE_TOLERANCE_HOURS / 24) && ageDays <= MAX_CURRENT_AGE_DAYS;
}

export function isWithinFallbackWindow(article, now = Date.now()) {
  if (!article.publishedAt) return false;
  const ageDays = articleAgeDays(article, now);
  return ageDays >= -(FUTURE_TOLERANCE_HOURS / 24) && ageDays <= FALLBACK_RETENTION_DAYS;
}

/* ---------- スコアリング ---------- */

export function scoreArticle(article) {
  const text = normalizeForSearch(`${article.title} ${article.summary}`);
  let score = 0;
  const signals = [];

  for (const [term, weight] of SCORE_TERMS) {
    if (text.includes(normalizeForSearch(term))) {
      score += weight;
      signals.push(term);
    }
  }

  let contextScore = 0;
  for (const [term, weight] of CONTEXT_TERMS) {
    if (text.includes(normalizeForSearch(term))) {
      contextScore += weight;
      signals.push(term);
    }
  }
  score += Math.min(contextScore, CONTEXT_SCORE_CAP);

  for (const [term, weight] of SOFT_NOISE_TERMS) {
    if (text.includes(normalizeForSearch(term))) score += weight;
  }

  if (article._sourceTier === 'official') score += 5;
  if (article._sourceTier === 'specialist') score += 4;
  if (article.sourceType === 'video') score += 1;
  if (article.sourceType === 'social') score -= 1;
  if (/\.(go|lg)\.jp\b/.test(article.sourceUrl)) score += 2;
  if (AGGREGATOR_SOURCES.has(article.sourceName)) score -= 2;

  return {
    score: Math.max(0, score),
    signals: [...new Set(signals)].slice(0, 12),
  };
}

export function sourcePriority(article) {
  let priority = PREFERRED_SOURCES.get(article.sourceName) ?? 50;
  const sourceTier = article._sourceTier ?? (article.sourceTier === 'news' ? 'google' : article.sourceTier);

  if (sourceTier === 'official') priority += 45;
  if (sourceTier === 'specialist') priority += 35;
  if (sourceTier === 'broad') priority -= 10;
  if (article.sourceType === 'video') priority -= 5;
  if (article.sourceType === 'social') priority -= 8;
  if (AGGREGATOR_SOURCES.has(article.sourceName)) priority -= 45;
  if (/\.go\.jp\b|\.lg\.jp\b|pref\./.test(article.sourceUrl)) priority += 12;
  if (/news\.google\.com/.test(article.id)) priority -= 4;

  return priority;
}

export function preferredRank(article) {
  const published = new Date(article.publishedAt).getTime();
  const recency = Number.isFinite(published) ? published / 86_400_000 : 0;
  return sourcePriority(article) * 1000 + (article.curationScore ?? 0) * 20 + recency;
}

/* ---------- 重複除去 ---------- */

export function isNearDuplicate(a, b) {
  if (a.id && b.id && a.id === b.id) return true;
  if (a.prefecture && b.prefecture && a.prefecture !== b.prefecture) return false;
  const gap = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  if (Number.isFinite(gap) && gap > 3 * 86_400_000) return false;
  // Normalize publisher wrappers only for comparison, never overwrite the headline.
  const comparisonTitle = article => cleanArticleTitle(article.title, article.sourceName)
    .normalize('NFKC')
    .replace(/\s*\((?:[^()]{0,30}(?:新聞|テレビ|通信|ニュース|放送|オンライン)|NOSWEB|スポニチアネックス)\)\s*$/u, '')
    .replace(/消防本部/gu, '消防').replace(/市の消防/gu, '市消防');
  const ak = normalizeTitleKey(comparisonTitle(a));
  const bk = normalizeTitleKey(comparisonTitle(b));
  if (!ak || !bk) return false;
  const aNumbers = comparisonTitle(a).match(/\d+/g)?.join('|') ?? '';
  const bNumbers = comparisonTitle(b).match(/\d+/g)?.join('|') ?? '';
  if (aNumbers && bNumbers && aNumbers !== bNumbers) return false;
  if (ak === bk) return true;
  if (Math.min(ak.length, bk.length) >= 24 && (ak.includes(bk) || bk.includes(ak))) return true;
  return diceSimilarity(ak, bk) >= 0.94;
}

export function dedupeNearArticles(articles) {
  const selected = [];
  const duplicates = [];
  const ranked = [...articles].sort((a, b) => preferredRank(b) - preferredRank(a));

  for (const article of ranked) {
    const duplicateIndex = selected.findIndex((existing) => isNearDuplicate(article, existing));
    if (duplicateIndex === -1) {
      selected.push(article);
      continue;
    }
    duplicates.push({
      kept: selected[duplicateIndex].title,
      dropped: article.title,
      droppedSource: article.sourceName,
      droppedId: article.id,
      keptId: selected[duplicateIndex].id,
    });
    if (preferredRank(article) > preferredRank(selected[duplicateIndex])) {
      selected[duplicateIndex] = article;
    }
  }

  return { articles: selected, duplicates };
}

/* ---------- 選定 ---------- */

export function isLowValueDiscoveryPage(article) {
  if (article._feedUrl) return false;
  const title=String(article.title??'').normalize('NFKC');
  return /(?:\d+\s*枚目の)?(?:写真・画像|写真一覧|画像一覧)|フォトギャラリー/iu.test(title)
    || /^画像\s*\d+\s*\/\s*\d+\s*>/u.test(title);
}

/** Explicit mismatches also apply to archives; missing keywords alone do not. */
export function explicitUnrelatedReason(article) {
  const title = cleanArticleTitle(article.title, article.sourceName).normalize('NFKC');
  let host = '';
  try { host = new URL(article.sourceUrl || article.url || article.id).hostname.toLowerCase(); } catch {}
  // These discovered pages reuse unrelated headlines with injected names/IDs.
  if (host === 'media.unisba.ac.id') return 'unverified-republished-source';
  // Japanese-language editions of foreign coverage need World source review.
  // Keep explicit Japan-related coverage; do not move articles into World automatically.
  if (/(?:^|\.)(?:vietnam\.vn|sortiraparis\.com)$/u.test(host)
    && !/日本|東京|大阪|北海道|沖縄|Japan/iu.test(`${title} ${article.summary || ''}`)) return 'foreign-coverage-review-required';
  const substantive = /いじめ|葛藤|当事者|差別|情報保障|合理的配慮|インタビュー|障害.*(?:語|経験|支援)|手話.*(?:活動|交流)/u;
  if (/補聴器(?:を)?つけた天使/u.test(title)
    && /彼女感|前かがみ|ミニ丈|グラビア|もん絶|メロメロ/u.test(title)
    && !substantive.test(`${title} ${article.summary || ''}`)) return 'incidental-disability-nickname';
  if (/ツボ/u.test(title) && /難聴|耳鳴り/u.test(title) && /治す|改善|軽減|効く|解消/u.test(title)
    && !/臨床試験|系統的レビュー|効果.*(?:不明|認められ|ない)|根拠.*(?:ない|乏しい)|検証/u.test(`${title} ${article.summary || ''}`)) return 'health-claim-evidence-required';
  if (/YouTube/iu.test(article.sourceName || '') && /大失態|パクる/u.test(title)
    && /疑惑|目撃/u.test(title)) return 'speculative-celebrity-gossip';
  for (const rule of PUBLICATION_NOISE_RULES) {
    if (rule.pattern.test(title) && !rule.unless.test(`${title} ${article.summary || ''}`)) return rule.reason;
  }
  // In this crowdfunding template the association is a poster recipient, not the subject.
  const poster = title.match(/^.+?\s+様\s*ポスター報告\s+by\s+(.+)$/iu);
  if (poster && !isRelevantArticle(poster[1], cleanSummaryText(article.summary, title, article.sourceName))) {
    return 'incidental-organization-mention';
  }
  return null;
}

/** Relevance is a gate, not a score boost. Trusted community feeds retain routine notices. */
export function publicationExclusionReason(article) {
  if(article._assistanceInvalid)return 'review-expired-or-changed';
  const title = cleanArticleTitle(article.title, article.sourceName).normalize('NFKC');
  if (!title || /^(?:工事中|準備中|作成中|テスト投稿|under construction|coming soon)[。.!！\s]*$/iu.test(title)) return 'placeholder';
  if (isLowValueDiscoveryPage(article)) return 'low-value-page';
  if (/市場規模|市場予測/u.test(title) && /レポート|成長率|予測|CAGR/iu.test(title)) return 'market-report';
  const explicit = explicitUnrelatedReason(article);
  if (explicit) return explicit;
  if(article._requiresTopicMatch&&!article._topicMatched&&!article._assistedRelevance)return 'source-topic-unconfirmed';
  const communityFeed = article._feedUrl && ['official', 'specialist'].includes(article._sourceTier);
  if (!article._passThrough && !communityFeed && !article._assistedRelevance && !isRelevantArticle(title, article.summary)) return 'unrelated';
  return null;
}

export function splitVisibleArticles(deduped) {
  const primaryArticles = [];
  const extraArticles = [];

  for (const article of deduped) {
    if (EXTRA_VISIBLE_CATEGORIES.has(article.category)) {
      extraArticles.push(article);
    } else if (primaryArticles.length < MAX_ARTICLES) {
      primaryArticles.push(article);
    }
  }

  const visibleIds = new Set([...primaryArticles, ...extraArticles].map((article) => article.id));
  return {
    primaryArticles,
    extraArticles,
    visibleArticles: [...primaryArticles, ...extraArticles].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    ),
    overflowArticles: deduped.filter((article) => !visibleIds.has(article.id)),
  };
}

/**
 * 収集済み記事全体をスコアリング → 鮮度/品質フィルタ → 重複除去 → 上限適用。
 * v1 の curateExpandedArticles と同じ流れ。日付不明記事の除外を追加（v4）。
 */
export function curateArticles(allArticles, context = {}, now = Date.now()) {
  const scored = allArticles.map((original) => {
    const article = { ...original, title: cleanArticleTitle(original.title, original.sourceName) };
    const { score, signals } = scoreArticle(article);
    return {
      ...article,
      curationScore: article._assistedRelevance?Math.max(score,article._minScore??DEFAULT_MIN_SCORE):score,
      curationSignals: signals,
      _dedupeKey: normalizeTitleKey(article.title),
    };
  });

  const dated = scored.filter((article) => article.publishedAt);
  const fresh = dated.filter((article) => hasAcceptablePublishedAt(article, now));
  const excluded = fresh.filter((article) => publicationExclusionReason(article));
  const eligible = fresh.filter((article) => !publicationExclusionReason(article));
  const filtered = eligible.filter((article) => {
    const minScore = article._minScore ?? DEFAULT_MIN_SCORE;
    return article._passThrough || article.curationScore >= minScore;
  });

  const { articles: deduped, duplicates } = dedupeNearArticles(filtered);

  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const {
    primaryArticles,
    extraArticles,
    visibleArticles,
    overflowArticles,
  } = splitVisibleArticles(deduped);

  return {
    articles: visibleArticles,
    oldArticles: overflowArticles,
    report: {
      version: QUALITY_VERSION,
      rawCount: allArticles.length,
      scoredCount: scored.length,
      missingDateRemoved: scored.length - dated.length,
      freshCount: fresh.length,
      staleOrInvalidRemoved: dated.length - fresh.length,
      lowValuePageRemoved: excluded.filter((article) => publicationExclusionReason(article) === 'low-value-page').length,
      publicationRemoved: excluded.length,
      publicationExclusions: excluded.map((article) => ({ id: article.id, title: article.title, reason: publicationExclusionReason(article) })),
      filteredCount: filtered.length,
      lowScoreRemoved: eligible.length - filtered.length,
      nearDuplicateRemoved: duplicates.length,
      finalCountBeforeLimit: deduped.length,
      primaryCategoryLimit: MAX_ARTICLES,
      primaryVisibleCount: primaryArticles.length,
      extraVisibleCount: extraArticles.length,
      extraVisibleCategoryCounts: countBy(extraArticles, 'category'),
      overflowCount: overflowArticles.length,
      minScore: DEFAULT_MIN_SCORE,
      maxCurrentAgeDays: MAX_CURRENT_AGE_DAYS,
      fallbackRetentionDays: FALLBACK_RETENTION_DAYS,
      fallbackCandidateCount: context.fallbackCandidateCount ?? 0,
      sourceHealth: context.sourceHealth ?? null,
      sourceCountsBefore: countBy(scored, 'sourceName'),
      sourceCountsAfter: countBy(deduped, 'sourceName'),
      categoryCountsVisible: countBy(visibleArticles, 'category'),
      regionCountsVisible: countBy(
        visibleArticles.filter((article) => article.region),
        'region',
      ),
      sourceTypeCountsAfter: countBy(deduped, (article) => article.sourceType ?? 'unknown'),
      sourceTierCountsAfter: countBy(deduped, (article) => article._sourceTier ?? 'unknown'),
      categoryCountsAfter: countBy(deduped, 'category'),
      duplicateSamples: duplicates.slice(0, 20),
      droppedSamples: eligible
        .filter((article) => !article._passThrough && article.curationScore < (article._minScore ?? DEFAULT_MIN_SCORE))
        .sort((a, b) => b.curationScore - a.curationScore)
        .slice(0, 20)
        .map((article) => ({
          title: article.title,
          sourceName: article.sourceName,
          score: article.curationScore,
          signals: article.curationSignals,
        })),
    },
  };
}

/* ---------- 出力整形 ---------- */

/**
 * 内部フィールド（_始まり）を落とし、公開スキーマへ整形する。
 * 出力スキーマは docs/articles.json の互換契約（iOSアプリ連携の入力）。
 */
export function stripInternal(article, { keepScores = false } = {}) {
  const {
    _sourceTier,
    _passThrough,
    _minScore,
    _dedupeKey,
    _feedUrl,
    _thumbnailCandidate,
    _reviewExcerpt,
    _sourceContentHash,
    _requiresTopicMatch,
    _topicMatched,
    _assistedRelevance,
    _assistedContext,
    _assistedReview,
    _assistanceInvalid,
    ...clean
  } = article;
  const sourceTier = (_sourceTier ?? clean.sourceTier) === 'google'
    ? 'news'
    : (_sourceTier ?? clean.sourceTier ?? 'news');
  clean.summary = cleanSummaryText(clean.summary, clean.title, clean.sourceName);
  const context = _assistedContext??newsContext(clean);
  if (context) clean.newsContext = context;
  else delete clean.newsContext;
  if(_assistedReview)clean.newsAssistance=stampNewsAssistance(clean,_assistedReview);
  clean.sourceTier = sourceTier;
  clean.discoveryMethod = _feedUrl || clean.discoveryMethod === 'direct-feed'
    ? 'direct-feed'
    : 'google-news';
  if (!keepScores) {
    delete clean.curationScore;
    delete clean.curationSignals;
  }
  return clean;
}

/** 前回実行時の公開記事を内部表現へ戻す（フォールバック補完用） */
export function hydratePreviousArticle(article, directFeedByName, {now=Date.now()}={}) {
  const directFeed = directFeedByName.get(article.sourceName);
  const savedTier = article.sourceTier === 'news' ? 'google' : article.sourceTier;
  const title = cleanArticleTitle(article.title, article.sourceName);
  const location = detectRegion(title, article.summary);
  const { region, prefecture, ...rest } = article;
  return {
    ...rest,
    ...(article.newsAssistance?(savedNewsAssistanceIsCurrent(article,now)
      ? {_assistedRelevance:true,_assistedContext:article.newsContext,_assistedReview:{articleHash:article.newsAssistance.articleHash,reviewedAt:article.newsAssistance.reviewedAt}}
      : {_assistanceInvalid:true}):{}),
    title,
    ...(location ?? {}),
    _sourceTier: directFeed?.sourceTier ?? savedTier ?? 'google',
    _passThrough: Boolean(directFeed?.passThrough),
    _minScore: directFeed?.minScore,
    _feedUrl: directFeed?.url ?? (article.discoveryMethod === 'direct-feed' ? article.sourceUrl : undefined),
  };
}

export function mergeOldArticles(currentOldArticles, previousOldArticles) {
  const byId = new Map();
  for (const article of [...currentOldArticles, ...previousOldArticles]) {
    if (!article?.id || explicitUnrelatedReason(article)) continue;
    const existing = byId.get(article.id);
    if (!existing || preferredRank(article) > preferredRank(existing)) {
      byId.set(article.id, article);
    }
  }

  return [...byId.values()]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_OLD_ARTICLES);
}
