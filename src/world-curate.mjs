import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'docs');
const DATA_FILE = join(DATA_DIR, 'articles-world.json');

const MAX_ARTICLES = 600;
const MIN_SCORE = 8;
const FETCH_TIMEOUT = 18_000;
const FETCH_CONCURRENCY = 8;
const TRANSLATE_BATCH_CHARS = 1600;
const TRANSLATE_DELAY_MS = 220;
const TRANSLATION_PROVIDER = 'translate.googleapis.com + Deaf Navi glossary v2';

const REGIONS = {
  asia_oceania: 'アジア・オセアニア',
  americas: '北米・中南米',
  europe_cis: 'ヨーロッパ・CIS',
  middle_east_africa: '中東・アフリカ',
};

const TOPICS = {
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

const SOURCE_GROUPS = [
  {
    region: 'asia_oceania',
    sources: [
      ['abc.net.au', 'ABC News Australia', 95],
      ['sbs.com.au', 'SBS News', 85],
      ['smh.com.au', 'The Sydney Morning Herald', 80],
      ['theage.com.au', 'The Age', 78],
      ['news.com.au', 'news.com.au', 72],
      ['theguardian.com', 'The Guardian', 88],
      ['rnz.co.nz', 'RNZ', 86],
      ['nzherald.co.nz', 'The New Zealand Herald', 80],
      ['stuff.co.nz', 'Stuff', 78],
      ['straitstimes.com', 'The Straits Times', 82],
      ['channelnewsasia.com', 'CNA', 84],
      ['scmp.com', 'South China Morning Post', 80],
      ['japantimes.co.jp', 'The Japan Times', 82],
      ['timesofindia.indiatimes.com', 'The Times of India', 76],
      ['hindustantimes.com', 'Hindustan Times', 76],
      ['indianexpress.com', 'The Indian Express', 76],
      ['koreaherald.com', 'The Korea Herald', 74],
      ['koreatimes.co.kr', 'The Korea Times', 72],
      ['taipeitimes.com', 'Taipei Times', 72],
    ],
  },
  {
    region: 'americas',
    sources: [
      ['apnews.com', 'AP News', 98],
      ['reuters.com', 'Reuters', 98],
      ['npr.org', 'NPR', 92],
      ['nytimes.com', 'The New York Times', 92],
      ['washingtonpost.com', 'The Washington Post', 90],
      ['cnn.com', 'CNN', 88],
      ['usatoday.com', 'USA Today', 78],
      ['nbcnews.com', 'NBC News', 86],
      ['cbsnews.com', 'CBS News', 84],
      ['abcnews.go.com', 'ABC News', 84],
      ['latimes.com', 'Los Angeles Times', 82],
      ['cbc.ca', 'CBC News', 90],
      ['ctvnews.ca', 'CTV News', 82],
      ['theglobeandmail.com', 'The Globe and Mail', 84],
      ['globalnews.ca', 'Global News', 78],
      ['elpais.com', 'El Pais', 84],
      ['bbc.com', 'BBC Mundo', 88],
      ['infobae.com', 'Infobae', 76],
      ['clarin.com', 'Clarin', 74],
      ['folha.uol.com.br', 'Folha de S.Paulo', 76],
      ['oglobo.globo.com', 'O Globo', 74],
      ['eluniversal.com.mx', 'El Universal', 74],
    ],
  },
  {
    region: 'europe_cis',
    sources: [
      ['bbc.com', 'BBC News', 96],
      ['theguardian.com', 'The Guardian', 92],
      ['reuters.com', 'Reuters', 98],
      ['apnews.com', 'AP News', 96],
      ['dw.com', 'Deutsche Welle', 88],
      ['france24.com', 'France 24', 88],
      ['euronews.com', 'Euronews', 86],
      ['politico.eu', 'POLITICO Europe', 82],
      ['rte.ie', 'RTE', 78],
      ['sky.com', 'Sky News', 82],
      ['independent.co.uk', 'The Independent', 78],
      ['ft.com', 'Financial Times', 82],
      ['lemonde.fr', 'Le Monde', 84],
      ['elpais.com', 'El Pais', 84],
      ['ansa.it', 'ANSA', 76],
      ['swissinfo.ch', 'SWI swissinfo.ch', 76],
      ['rferl.org', 'Radio Free Europe/Radio Liberty', 80],
      ['kyivindependent.com', 'The Kyiv Independent', 78],
    ],
  },
  {
    region: 'middle_east_africa',
    sources: [
      ['aljazeera.com', 'Al Jazeera', 92],
      ['thenationalnews.com', 'The National', 82],
      ['arabnews.com', 'Arab News', 78],
      ['timesofisrael.com', 'The Times of Israel', 78],
      ['haaretz.com', 'Haaretz', 76],
      ['jpost.com', 'The Jerusalem Post', 74],
      ['trtworld.com', 'TRT World', 78],
      ['africanews.com', 'Africanews', 80],
      ['allafrica.com', 'AllAfrica', 78],
      ['news24.com', 'News24', 82],
      ['dailymaverick.co.za', 'Daily Maverick', 78],
      ['nation.africa', 'Nation Africa', 78],
      ['monitor.co.ug', 'Daily Monitor', 74],
      ['punchng.com', 'The Punch', 72],
      ['guardian.ng', 'The Guardian Nigeria', 72],
      ['egyptindependent.com', 'Egypt Independent', 72],
      ['moroccoworldnews.com', 'Morocco World News', 70],
    ],
  },
];

const TOPIC_QUERIES = [
  { topic: 'rights', query: 'deaf OR "hard of hearing" OR "hearing impaired" OR deafblind' },
  { topic: 'accessibility', query: '"sign language" OR "sign-language" OR captioning OR subtitles OR "deaf interpreter"' },
  { topic: 'health', query: '"cochlear implant" OR "hearing aid" OR audiology OR "hearing loss"' },
  { topic: 'education', query: '"deaf school" OR "deaf students" OR "deaf education" OR "deaf children"' },
  { topic: 'sports', query: 'Deaflympics OR "deaf sports" OR "deaf athlete" OR "deaf football"' },
  { topic: 'culture', query: '"deaf actor" OR "deaf artist" OR "deaf culture" OR "deaf community"' },
  { topic: 'technology', query: '"AI captioning" OR "live caption" OR "speech to text" deaf OR "speech-to-text" deaf' },
];

const BROAD_REGION_QUERIES = [
  {
    region: 'asia_oceania',
    gl: 'AU',
    hl: 'en-AU',
    ceid: 'AU:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR Deaflympics) (Australia OR "New Zealand" OR India OR Singapore OR "South Korea" OR Philippines OR Pacific)',
  },
  {
    region: 'americas',
    gl: 'US',
    hl: 'en-US',
    ceid: 'US:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR Deaflympics) ("United States" OR Canada OR Mexico OR Brazil OR Argentina OR Chile)',
  },
  {
    region: 'americas',
    gl: 'MX',
    hl: 'es-419',
    ceid: 'MX:es-419',
    query: '(sordo OR sordos OR sordera OR "discapacidad auditiva" OR "lengua de señas" OR "implante coclear" OR audífonos)',
  },
  {
    region: 'americas',
    gl: 'BR',
    hl: 'pt-BR',
    ceid: 'BR:pt-419',
    query: '(surdo OR surdez OR "deficiência auditiva" OR "língua de sinais" OR libras OR "implante coclear" OR auditivo)',
  },
  {
    region: 'europe_cis',
    gl: 'GB',
    hl: 'en-GB',
    ceid: 'GB:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR Deaflympics) (Europe OR Britain OR Germany OR France OR Ukraine OR Ireland)',
  },
  {
    region: 'europe_cis',
    gl: 'FR',
    hl: 'fr',
    ceid: 'FR:fr',
    query: '(sourd OR sourds OR surdité OR "langue des signes" OR "implant cochléaire" OR "appareil auditif")',
  },
  {
    region: 'europe_cis',
    gl: 'DE',
    hl: 'de',
    ceid: 'DE:de',
    query: '(gehörlos OR gehörlose OR gebärdensprache OR hörgerät OR cochlea-implantat)',
  },
  {
    region: 'middle_east_africa',
    gl: 'ZA',
    hl: 'en-ZA',
    ceid: 'ZA:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR Deaflympics) (Africa OR "South Africa" OR Kenya OR Nigeria OR Egypt OR "Middle East" OR UAE OR Israel)',
  },
  {
    region: 'middle_east_africa',
    gl: 'AE',
    hl: 'en-AE',
    ceid: 'AE:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "hearing loss" OR "cochlear implant") ("Middle East" OR Gulf OR UAE OR Saudi OR Qatar OR Israel)',
  },
];

const TERM_WEIGHTS = [
  ['deafblind', 10], ['deaf-blind', 10], ['hard of hearing', 10], ['hearing impaired', 9],
  ['hearing impairment', 9], ['deaf community', 9], ['deaf people', 9], ['deaf student', 9],
  ['deaf child', 9], ['deaf children', 9], ['deaf school', 9], ['sign language', 9],
  ['interpreter', 6], ['captioning', 7], ['captions', 6], ['subtitles', 6], ['accessibility', 6],
  ['cochlear implant', 9], ['hearing aid', 9], ['hearing loss', 8], ['audiology', 7],
  ['deaflympics', 10], ['deaf sports', 9], ['deaf athlete', 8],
  ['sordo', 9], ['sordos', 9], ['sordera', 8], ['discapacidad auditiva', 9], ['lengua de señas', 9],
  ['implante coclear', 9], ['audífono', 8], ['audífonos', 8],
  ['surdo', 9], ['surdez', 8], ['deficiência auditiva', 9], ['língua de sinais', 9], ['libras', 8],
  ['sourd', 8], ['sourds', 8], ['surdité', 8], ['langue des signes', 9], ['implant cochléaire', 9],
  ['appareil auditif', 8], ['gehörlos', 9], ['gehörlose', 9], ['gebärdensprache', 9], ['hörgerät', 8],
  ['聴覚障害', 9], ['難聴', 8], ['ろう者', 9], ['手話', 7], ['人工内耳', 8], ['補聴器', 8],
];

const STRONG_CONTEXT = [
  'disability', 'disabled', 'rights', 'court', 'law', 'policy', 'access', 'inclusive',
  'school', 'university', 'hospital', 'health', 'medical', 'technology', 'ai', 'emergency',
  'election', 'broadcast', 'television', 'sports', 'film', 'theatre', 'music',
  'derechos', 'educación', 'salud', 'accesibilidad', 'inclusión',
  'direitos', 'educação', 'saúde', 'acessibilidade', 'inclusão',
  'droits', 'éducation', 'santé', 'accessibilité', 'inclusion',
];

const NOISE_PATTERNS = [
  /\btone deaf\b/i,
  /\bdeaf ears\b/i,
  /\bfall(?:s|ing|en)? on deaf ears\b/i,
  /\bturn(?:s|ed|ing)? a deaf ear\b/i,
  /\bdeafening\b/i,
  /\bhearing\b.{0,24}\b(court|senate|congress|committee|trial|inquiry)\b/i,
];

const NON_NOISE_HINT = /(sign language|hard of hearing|hearing impaired|hearing loss|hearing aid|cochlear|deafblind|deaf community|deaf student|deaf child|caption|interpreter|accessibility|sordo|sordera|surdo|surdez|sourd|surdité|gehörlos|gebärdensprache)/i;

const NON_NEWS_SOURCE_PATTERN = /(help\s*centre|help\s*center|help\s*forum|community|support|customer care|forum)/i;
const NON_NEWS_DOMAIN_PATTERN = /(^|\.)helpforum\.|(^|\.)support\.|(^|\.)community\.|(^|\.)forum\.|helpcentre|helpcenter/i;

const DOMAIN_REGION = new Map();
const DOMAIN_META = new Map();
for (const group of SOURCE_GROUPS) {
  for (const [domain, name, priority] of group.sources) {
    DOMAIN_REGION.set(domain, group.region);
    DOMAIN_META.set(domain, { name, priority, region: group.region });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildGoogleNewsUrl(query, { gl = 'US', hl = 'en-US', ceid = 'US:en' } = {}) {
  const encoded = encodeURIComponent(`${query} when:730d`);
  return `https://news.google.com/rss/search?q=${encoded}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
}

function buildQueryJobs() {
  const jobs = [];
  for (const group of SOURCE_GROUPS) {
    const sourceChunks = chunk(group.sources, 5);
    for (const sources of sourceChunks) {
      const siteQuery = sources.map(([domain]) => `site:${domain}`).join(' OR ');
      for (const topic of TOPIC_QUERIES) {
        jobs.push({
          region: group.region,
          topic: topic.topic,
          query: `(${siteQuery}) (${topic.query})`,
          sourceMode: 'major-media',
          url: buildGoogleNewsUrl(`(${siteQuery}) (${topic.query})`),
        });
      }
    }
  }

  for (const broad of BROAD_REGION_QUERIES) {
    for (const topic of TOPIC_QUERIES.slice(0, 4)) {
      const query = `(${broad.query}) (${topic.query})`;
      jobs.push({
        region: broad.region,
        topic: topic.topic,
        query,
        sourceMode: 'regional-broad',
        url: buildGoogleNewsUrl(query, broad),
      });
    }
  }

  return jobs;
}

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DeafNaviWorld/1.0 (+https://github.com/tamas-hub/deaf-navi-web)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return plain?.[1]?.trim() ?? '';
}

function decodeEntities(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function cleanHtml(text) {
  let decoded = text ?? '';
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractActualUrl(description, fallback) {
  const match = description.match(/href="(https?:\/\/(?!news\.google\.com\/)[^"]+)"/i);
  return match?.[1] ?? fallback;
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function findKnownDomain(url) {
  const domain = domainFromUrl(url);
  if (!domain) return '';
  if (DOMAIN_META.has(domain)) return domain;
  return [...DOMAIN_META.keys()].find((known) => domain === known || domain.endsWith(`.${known}`)) ?? domain;
}

function cleanNewsTitle(title, sourceName) {
  let clean = cleanHtml(title);
  if (sourceName) {
    const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(`\\s+[-|–—]\\s+${escaped}\\s*$`, 'i'), '');
  }
  return clean.replace(/\s+[-|–—]\s+Google News\s*$/i, '').trim();
}

function parseItems(xml, job) {
  const out = [];
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  for (const match of itemMatches) {
    const block = match[1];
    const sourceMatch = block.match(/<source\s+url="([^"]*)"[^>]*>([^<]*)<\/source>/i);
    const sourceUrl = sourceMatch?.[1]?.trim() ?? 'https://news.google.com/';
    const sourceName = cleanHtml(sourceMatch?.[2] ?? 'Google News');
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const rawDescription = extractTag(block, 'description');
    const articleUrl = extractActualUrl(rawDescription, link);
    const originalTitle = cleanNewsTitle(extractTag(block, 'title'), sourceName);
    const originalSummary = cleanHtml(rawDescription)
      .replace(originalTitle, '')
      .replace(sourceName, '')
      .trim()
      .slice(0, 360);
    const pubDate = extractTag(block, 'pubDate');

    if (!originalTitle || !articleUrl) continue;
    if (isNonNewsSource(sourceName, sourceUrl || articleUrl)) continue;

    const knownDomain = findKnownDomain(sourceUrl || articleUrl);
    const sourceMeta = DOMAIN_META.get(knownDomain);
    const region = sourceMeta?.region ?? job.region;
    const topic = inferTopic(`${originalTitle} ${originalSummary}`, job.topic);
    const scoreInfo = scoreArticle({
      originalTitle,
      originalSummary,
      sourceName,
      sourceUrl,
      knownDomain,
      sourceMode: job.sourceMode,
      topic,
    });

    const isKnownMajorSource = DOMAIN_META.has(knownDomain);
    const isBroadOnlySource = job.sourceMode !== 'major-media' && !isKnownMajorSource;
    if (scoreInfo.isNoise || scoreInfo.relevanceHits === 0 || scoreInfo.score < MIN_SCORE) continue;
    if (isBroadOnlySource && scoreInfo.score < 18) continue;

    let publishedAt;
    const parsedDate = new Date(pubDate);
    publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    out.push({
      id: articleUrl,
      title: originalTitle,
      summary: originalSummary || originalTitle,
      originalTitle,
      originalSummary: originalSummary || originalTitle,
      sourceName,
      sourceUrl,
      publishedAt,
      region,
      regionLabel: REGIONS[region],
      topic,
      topicLabel: TOPICS[topic],
      curationScore: scoreInfo.score,
      curationSignals: scoreInfo.signals,
      sourceDomain: knownDomain,
      sourcePriority: sourceMeta?.priority ?? 50,
      sourceMode: job.sourceMode,
      translationProvider: TRANSLATION_PROVIDER,
      _dedupeKey: normalizeTitleKey(originalTitle),
    });
  }
  return out;
}

function isNonNewsSource(sourceName, url) {
  const domain = domainFromUrl(url);
  return NON_NEWS_SOURCE_PATTERN.test(sourceName) || NON_NEWS_DOMAIN_PATTERN.test(domain);
}

function normalizeForSearch(text) {
  return String(text).normalize('NFKC').toLowerCase();
}

function scoreArticle(article) {
  const text = normalizeForSearch(`${article.originalTitle} ${article.originalSummary}`);
  const signals = [];
  const hasNoise = NOISE_PATTERNS.some((pattern) => pattern.test(text));
  const hasNonNoiseHint = NON_NOISE_HINT.test(text);
  if (hasNoise && !hasNonNoiseHint) return { score: 0, signals: ['noise'], isNoise: true };

  let score = 0;
  let relevanceHits = 0;
  for (const [term, weight] of TERM_WEIGHTS) {
    if (text.includes(normalizeForSearch(term))) {
      score += weight;
      relevanceHits += 1;
      signals.push(term);
    }
  }

  let context = 0;
  for (const term of STRONG_CONTEXT) {
    if (text.includes(normalizeForSearch(term))) context += 2;
  }
  score += Math.min(context, 8);

  if (DOMAIN_META.has(article.knownDomain)) {
    score += 7;
    signals.push('major-media');
  }
  if (article.sourceMode === 'major-media') score += 3;
  if (article.topic !== 'general') score += 2;
  if (/news\.google\.com/.test(article.id)) score -= 2;

  return {
    score: Math.max(0, score),
    signals: [...new Set(signals)].slice(0, 14),
    relevanceHits,
    isNoise: false,
  };
}

function inferTopic(text, hint = 'general') {
  const value = normalizeForSearch(text);
  if (/(deaflympics|deaf sports|deaf athlete|deaf football|paralympic|olympic|sport|athlete|tournament|championship|fútbol|football|basketball)/i.test(value)) return 'sports';
  if (/(ai caption|live caption|speech-to-text|speech to text|automatic caption|technology|app|device|startup|artificial intelligence)/i.test(value)) return 'technology';
  if (/(school|student|education|teacher|university|classroom|college|children|deaf education|escuela|educación|école|bildung)/i.test(value)) return 'education';
  if (/(law|court|lawsuit|rights|policy|government|election|vote|discrimination|settlement|legislation|derechos|tribunal|loi|gesetz)/i.test(value)) return 'rights';
  if (/(sign language|interpreter|caption|subtitle|accessibility|accessible|broadcast|television|theatre access|lengua de señas|langue des signes|gebärdensprache|libras)/i.test(value)) return 'accessibility';
  if (/(cochlear|hearing aid|hearing loss|audiology|implant|hospital|doctor|medical|health|screening|audífono|implante coclear|surdité|hörgerät)/i.test(value)) return 'health';
  if (/(film|movie|actor|artist|culture|community|festival|music|theatre|theater|book|museum|art|documentary)/i.test(value)) return 'culture';
  if (/(emergency|disaster|earthquake|war|conflict|evacuation|police|fire|safety|alert)/i.test(value)) return 'safety';
  return hint && TOPICS[hint] ? hint : 'general';
}

function normalizeTitleKey(title) {
  return normalizeForSearch(title)
    .replace(/\s+[-|–—]\s+.+$/u, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠가-힣ñáéíóúüçãõâêîôûäößа-яё]+/giu, '')
    .slice(0, 120);
}

function dedupeArticles(articles) {
  const byUrl = new Map();
  for (const article of articles) {
    const existing = byUrl.get(article.id);
    if (!existing || article.curationScore > existing.curationScore) byUrl.set(article.id, article);
  }

  const selected = [];
  const titleKeys = new Map();
  for (const article of [...byUrl.values()].sort(preferredSort)) {
    const key = article._dedupeKey;
    if (!key) {
      selected.push(article);
      continue;
    }
    const existingIndex = titleKeys.get(key);
    if (existingIndex === undefined) {
      titleKeys.set(key, selected.length);
      selected.push(article);
      continue;
    }
    if (preferredSort(article, selected[existingIndex]) < 0) selected[existingIndex] = article;
  }

  return selected.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function preferredSort(a, b) {
  const score = b.curationScore - a.curationScore;
  if (score !== 0) return score;
  const priority = (b.sourcePriority ?? 50) - (a.sourcePriority ?? 50);
  if (priority !== 0) return priority;
  return new Date(b.publishedAt) - new Date(a.publishedAt);
}

async function loadTranslationCache() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const cache = new Map();
    for (const article of data.articles ?? []) {
      if (article.originalTitle && article.title) cache.set(article.originalTitle, article.title);
      if (article.originalSummary && article.summary) cache.set(article.originalSummary, article.summary);
    }
    return cache;
  } catch {
    return new Map();
  }
}

function fallbackJapanese(text) {
  return `海外メディアの記事: ${String(text).trim()}`;
}

function makeTranslationBatches(texts) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const text of texts) {
    const size = text.length + 48;
    if (current.length && chars + size > TRANSLATE_BATCH_CHARS) {
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

function collectTranslation(json) {
  return Array.isArray(json?.[0]) ? json[0].map((part) => part?.[0] ?? '').join('') : '';
}

async function translateBatch(texts) {
  if (!texts.length) return [];
  const separator = '\n<<<DEAF_NAVI_WORLD_SPLIT>>>\n';
  const joined = texts.join(separator);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(joined)}`;
  const res = await fetchWithTimeout(url, 20_000);
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const json = await res.json();
  const translated = collectTranslation(json)
    .replace(/\n?\s*<<<\s*DEAF_NAVI_WORLD_SPLIT\s*>>>\s*\n?/g, '<<<DEAF_NAVI_WORLD_SPLIT>>>');
  const parts = translated.split('<<<DEAF_NAVI_WORLD_SPLIT>>>').map(polishJapanese);
  if (parts.length !== texts.length) throw new Error(`translation split mismatch ${parts.length}/${texts.length}`);
  return parts;
}

function polishJapanese(text) {
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
    .trim();
}

async function applyTranslations(articles) {
  const cache = await loadTranslationCache();
  const missing = [];

  for (const article of articles) {
    const cachedTitle = cache.get(article.originalTitle);
    const cachedSummary = cache.get(article.originalSummary);
    if (cachedTitle) article.title = cachedTitle;
    else missing.push(article.originalTitle);
    if (cachedSummary) article.summary = cachedSummary;
    else missing.push(article.originalSummary);
  }

  const uniqueMissing = [...new Set(missing.filter(Boolean))];
  const translated = new Map();
  const batches = makeTranslationBatches(uniqueMissing);

  console.log(`[translate] missing texts: ${uniqueMissing.length}, batches: ${batches.length}`);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      const result = await translateBatch(batch);
      result.forEach((value, index) => translated.set(batch[index], value));
    } catch (err) {
      console.warn(`[translate] batch ${i + 1}/${batches.length} failed: ${err.message}`);
      batch.forEach((value) => translated.set(value, fallbackJapanese(value)));
    }
    if (i < batches.length - 1) await sleep(TRANSLATE_DELAY_MS);
  }

  for (const article of articles) {
    article.title = polishJapanese(cache.get(article.originalTitle) ?? translated.get(article.originalTitle) ?? fallbackJapanese(article.originalTitle));
    article.summary = polishJapanese(cache.get(article.originalSummary) ?? translated.get(article.originalSummary) ?? fallbackJapanese(article.originalSummary));
  }
}

function stripInternal(article) {
  const { _dedupeKey, ...clean } = article;
  return clean;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function loadWorldNews() {
  const jobs = buildQueryJobs();
  const all = [];
  console.log(`[world] query jobs: ${jobs.length}`);

  await mapConcurrent(jobs, FETCH_CONCURRENCY, async (job) => {
    try {
      const res = await fetchWithTimeout(job.url);
      if (!res.ok) {
        console.warn(`[skip] ${job.region}/${job.topic}: HTTP ${res.status}`);
        return;
      }
      const xml = await res.text();
      const items = parseItems(xml, job);
      console.log(`[google-world] ${job.region}/${job.topic}/${job.sourceMode}: ${items.length}`);
      all.push(...items);
    } catch (err) {
      console.warn(`[fail] ${job.region}/${job.topic}: ${err.message}`);
    }
  });

  if (!all.length) throw new Error('No world articles fetched.');

  const deduped = dedupeArticles(all).slice(0, MAX_ARTICLES);
  await applyTranslations(deduped);

  return {
    articles: deduped,
    report: {
      version: 'world-v2',
      rawCount: all.length,
      dedupedCount: deduped.length,
      maxArticles: MAX_ARTICLES,
      minScore: MIN_SCORE,
      queryCount: jobs.length,
      translationProvider: TRANSLATION_PROVIDER,
      regionCounts: countBy(deduped, 'region'),
      topicCounts: countBy(deduped, 'topic'),
      sourceCounts: countBy(deduped, 'sourceName'),
      sourceModeCounts: countBy(deduped, 'sourceMode'),
    },
  };
}

async function main() {
  console.log('Deaf Navi World: curation start');
  const { articles, report } = await loadWorldNews();
  await mkdir(DATA_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    variant: 'world',
    count: articles.length,
    regions: REGIONS,
    topics: TOPICS,
    quality: report,
    articles: articles.map(stripInternal),
  };
  await writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Deaf Navi World: wrote ${articles.length} articles to ${DATA_FILE}`);
}

main().catch((err) => {
  console.error('Deaf Navi World curation failed:', err);
  process.exit(1);
});
