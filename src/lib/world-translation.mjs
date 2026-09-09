const SEPARATOR = '<<<DEAF_NAVI_WORLD_SPLIT>>>';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A Japanese prefix must never turn an untranslated source into a cache hit.
export function isWeakJapaneseTranslation(original, translated) {
  const source = String(original ?? '').trim();
  const value = String(translated ?? '').trim();
  if (!value || /海外メディアの記事\s*[:：]|<<<|DEAF_NAVI_WORLD_SPLIT/.test(value)) return true;
  if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(value)) return true;
  // Kana may legitimately be unchanged when the source is already Japanese.
  if (value === source && !/[\u3041-\u3096\u30a1-\u30fa]/.test(source)) return true;
  return false;
}

export function articleCacheKey(article) {
  return `${article.originalTitle ?? ''}\n${article.originalSummary ?? ''}`;
}

export function createTranslationCache(articles, postEditProvider) {
  const text = new Map();
  const cachedArticles = new Map();
  for (const article of articles) {
    const titleOk = !isWeakJapaneseTranslation(article.originalTitle, article.title);
    const summaryOk = !isWeakJapaneseTranslation(article.originalSummary, article.summary);
    if (titleOk && article.originalTitle) text.set(article.originalTitle, article.title);
    if (summaryOk && article.originalSummary) text.set(article.originalSummary, article.summary);
    if (titleOk && summaryOk && article.originalTitle && article.originalSummary) {
      cachedArticles.set(articleCacheKey(article), {
        title: article.title, summary: article.summary,
        postEdited: article.japanesePostEditProvider === postEditProvider,
      });
    }
  }
  return { text, articles: cachedArticles };
}

export function assertJapaneseTranslations(articles) {
  const invalid = articles.filter((article) =>
    isWeakJapaneseTranslation(article.originalTitle, article.title)
    || isWeakJapaneseTranslation(article.originalSummary, article.summary));
  if (invalid.length) {
    throw new Error(`World-JP has ${invalid.length}/${articles.length} untranslated articles; keep the previous published snapshot.`);
  }
}

export function makeTranslationBatches(texts, maxChars = 1600) {
  const batches = [];
  let current = [], chars = 0;
  for (const text of texts) {
    const size = text.length + SEPARATOR.length + 2;
    if (current.length && chars + size > maxChars) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function translationError(message, retryable = false, retryAfterMs = 0) {
  return Object.assign(new Error(message), { retryable, retryAfterMs });
}

function retryAfterMs(value) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - Date.now()) || 0;
}

/** Bounded retries for 429/5xx/network failures; split only malformed successful batches. */
export async function translateBatch(texts, { fetchImpl = fetch, sleep = wait, retries = 2 } = {}) {
  if (!texts.length) return [];
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(texts.join(`\n${SEPARATOR}\n`))}`;
  let result;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { 'User-Agent': 'DeafNaviWorld/1.0 (+https://github.com/deaf-navi/deaf-navi-web)' },
      });
      if (!response.ok) {
        throw translationError(`translate HTTP ${response.status}`, response.status === 429 || response.status >= 500, retryAfterMs(response.headers?.get('retry-after')));
      }
      const json = await response.json();
      const value = Array.isArray(json?.[0]) ? json[0].map((part) => part?.[0] ?? '').join('') : '';
      result = value.replace(/\n?\s*<<<\s*DEAF_NAVI_WORLD_SPLIT\s*>>>\s*\n?/g, SEPARATOR).split(SEPARATOR).map(polishJapanese);
      break;
    } catch (error) {
      const retryable = error.retryable ?? (error instanceof TypeError || ['AbortError', 'TimeoutError'].includes(error.name));
      if (!retryable || attempt >= retries) throw error;
      // Do not retry earlier than Retry-After; a long cooldown is deferred to the next scheduled run.
      if (error.retryAfterMs > 30_000) throw error;
      await sleep(Math.max(error.retryAfterMs || 0, 1500 * 2 ** attempt));
    }
  }
  if (result.length === texts.length && result.every((value, i) => !isWeakJapaneseTranslation(texts[i], value))) return result;
  if (texts.length === 1) throw translationError('translate returned untranslated or malformed content');
  const middle = Math.ceil(texts.length / 2);
  await sleep(220);
  const left = await translateBatch(texts.slice(0, middle), { fetchImpl, sleep, retries });
  await sleep(220);
  const right = await translateBatch(texts.slice(middle), { fetchImpl, sleep, retries });
  return [...left, ...right];
}

export function polishJapanese(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/\s+([、。！？])/g, '$1')
    .replace(/（ /g, '（')
    .replace(/ ）/g, '）')
    .replace(/オーストラリア手話/g, 'Auslan（オーストラリア手話）')
    .replace(/オースラン語/g, 'Auslan')
    .replace(/オースラン/g, 'Auslan')
    .replace(/デフコミュニティ/g, 'ろう者コミュニティ')
    .replace(/聴覚障害者コミュニティ/g, 'ろう者コミュニティ')
    .replace(/聴覚障害者および難聴の/g, 'ろう・難聴の')
    .replace(/聴覚障害者および難聴者/g, 'ろう・難聴者')
    .replace(/どれほど耳が遠いのか知りませんでした/g, 'どれほど聞こえていなかったのか気づいていませんでした')
    .replace(/ニュースを「見逃す」のではないかと懸念/g, 'ニュースから取り残される懸念')
    .replace(/6月に最終回を放送する/g, '6月に最終回を迎える')
    .replace(/この物語は(.+?)で解釈されています。?/g, 'この記事は$1で通訳されています。')
    .replace(/キウイの 6 人に 1 人/g, 'ニュージーランド人の6人に1人')
    .replace(/SA の学校/g, '南アフリカの学校')
    .replace(/AI WhatsApp ボット/g, 'WhatsApp対応AIボット')
    .replace(/手話のロックで/g, '手話通訳で')
    .replace(/リオの手話のロック/g, 'ロック・イン・リオの手話通訳')
    .replace(/聞く手: 手話を使ってギャップを埋める/g, '聞こえる手: 手話で隔たりを埋める')
    .replace(/聴覚障害者のための/g, 'ろう者のための')
    .replace(/聴覚障害者向け/g, 'ろう者向け')
    .replace(/Auslan（Auslan（オーストラリア手話））/g, 'Auslan（オーストラリア手話）')
    .replace(/Auslan（オーストラリア手話）のAuslan/g, 'Auslan（オーストラリア手話）')
    .replace(/(?:Auslan（)+オーストラリア手話(?:）)+/g, 'Auslan（オーストラリア手話）')
    .trim();
}
