import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'docs');
const DATA_FILE = join(DATA_DIR, 'articles-world.json');

const MAX_ARTICLES = 600;
const MIN_SCORE = 8;
const FRESH_LOOKBACK = '45d';
const RECENT_LOOKBACK = '120d';
const STANDARD_LOOKBACK = '365d';
const FETCH_TIMEOUT = 18_000;
const FETCH_CONCURRENCY = 8;
const TRANSLATE_BATCH_CHARS = 1600;
const TRANSLATE_DELAY_MS = 220;
const CODEX_POST_EDIT_BATCH_SIZE = envInt('WORLD_JP_CODEX_BATCH_SIZE', 20, 1, 50);
const CODEX_POST_EDIT_MAX_ITEMS = envInt('WORLD_JP_CODEX_MAX_ITEMS', MAX_ARTICLES, 0, MAX_ARTICLES);
const CODEX_POST_EDIT_TIMEOUT_MS = envInt('CODEX_APP_SERVER_TIMEOUT_SECONDS', 120, 5, 600) * 1000;
const CODEX_POST_EDIT_DELAY_MS = envInt('WORLD_JP_CODEX_DELAY_MS', 250, 0, 5000);
const CODEX_APP_SERVER_URL = process.env.CODEX_APP_SERVER_URL?.trim() || (process.env.GITHUB_ACTIONS ? '' : 'http://127.0.0.1:8787');
const CODEX_APP_SERVER_TOKEN = process.env.CODEX_APP_SERVER_TOKEN?.trim() ?? '';
const CODEX_POST_EDIT_ENABLED = process.env.WORLD_JP_CODEX_POST_EDIT !== '0';
const CODEX_POST_EDIT_PROVIDER = 'Codex App Server Japanese news editor v1';
const TRANSLATION_PROVIDER = 'translate.googleapis.com + Deaf Navi glossary v2 + optional Codex App Server post-edit';

const REGIONS = {
  asia_oceania: 'アジア・オセアニア',
  americas: '北米・中南米',
  europe_cis: 'ヨーロッパ・CIS',
  middle_east_africa: '中東・アフリカ',
};

const REGION_ORDER = Object.keys(REGIONS);

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
  { topic: 'rights', query: 'deaf OR "hard of hearing" OR "hearing impaired" OR deafblind OR "deaf rights" OR "sign language law" OR "accessibility law"' },
  { topic: 'accessibility', query: '"sign language" OR "sign-language" OR captioning OR subtitles OR "deaf interpreter" OR Auslan OR BSL OR ASL OR NZSL OR "closed captions"' },
  { topic: 'health', query: '"cochlear implant" OR "hearing aid" OR audiology OR "hearing loss" OR "newborn hearing screening" OR tinnitus' },
  { topic: 'education', query: '"deaf school" OR "deaf students" OR "deaf education" OR "deaf children" OR "sign language class"' },
  { topic: 'sports', query: 'Deaflympics OR "deaf sports" OR "deaf athlete" OR "deaf football" OR "deaf basketball"' },
  { topic: 'culture', query: '"deaf actor" OR "deaf artist" OR "deaf culture" OR "deaf community" OR "deaf theatre" OR "deaf film"' },
  { topic: 'technology', query: '"AI captioning" OR "live caption" OR "speech to text" deaf OR "speech-to-text" deaf OR "sign language avatar" OR "hearing accessibility"' },
  { topic: 'safety', query: '"deaf emergency" OR "accessible alert" OR "emergency interpreter" OR "deaf evacuation" OR "sign language alert"' },
];

const CORE_RECENT_QUERY = [
  'deaf',
  '"hard of hearing"',
  '"hearing impaired"',
  '"hearing loss"',
  '"sign language"',
  '"cochlear implant"',
  '"hearing aid"',
  'Deaflympics',
  'Auslan',
  'BSL',
  'ASL',
  'captioning',
].join(' OR ');

const BROAD_REGION_QUERIES = [
  {
    region: 'asia_oceania',
    gl: 'AU',
    hl: 'en-AU',
    ceid: 'AU:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR Auslan OR "New Zealand Sign Language" OR "cochlear implant" OR Deaflympics) (Australia OR "New Zealand" OR Pacific)',
  },
  {
    region: 'asia_oceania',
    gl: 'IN',
    hl: 'en-IN',
    ceid: 'IN:en',
    query: '(deaf OR "hard of hearing" OR "hearing impaired" OR "sign language" OR "cochlear implant" OR "hearing aid") (India OR Sri Lanka OR Bangladesh OR Nepal)',
  },
  {
    region: 'asia_oceania',
    gl: 'SG',
    hl: 'en-SG',
    ceid: 'SG:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "hearing loss" OR "cochlear implant") (Singapore OR Malaysia OR Philippines OR Indonesia OR Thailand)',
  },
  {
    region: 'asia_oceania',
    gl: 'KR',
    hl: 'ko',
    ceid: 'KR:ko',
    query: '(청각장애 OR 청각 장애 OR 농인 OR 농아인 OR 수어 OR 수화 OR 보청기 OR 인공와우 OR 난청)',
  },
  {
    region: 'asia_oceania',
    gl: 'TW',
    hl: 'zh-TW',
    ceid: 'TW:zh-Hant',
    query: '(聽障 OR 听障 OR 聾人 OR 聋人 OR 手語 OR 手语 OR 助聽器 OR 助听器 OR 人工耳蝸 OR 人工耳蜗 OR 失聰 OR 失聪)',
  },
  {
    region: 'americas',
    gl: 'US',
    hl: 'en-US',
    ceid: 'US:en',
    query: '(deaf OR "hard of hearing" OR ASL OR "American Sign Language" OR "cochlear implant" OR "hearing aid" OR Deaflympics) ("United States" OR Canada)',
  },
  {
    region: 'americas',
    gl: 'MX',
    hl: 'es-419',
    ceid: 'MX:es-419',
    query: '(sordo OR sordos OR sordera OR "discapacidad auditiva" OR "lengua de señas" OR "lengua de signos" OR "implante coclear" OR audífonos) (México OR Colombia OR Argentina OR Chile OR Perú)',
  },
  {
    region: 'americas',
    gl: 'BR',
    hl: 'pt-BR',
    ceid: 'BR:pt-419',
    query: '(surdo OR surdez OR "deficiência auditiva" OR "língua de sinais" OR libras OR "implante coclear" OR auditivo OR "aparelho auditivo")',
  },
  {
    region: 'europe_cis',
    gl: 'GB',
    hl: 'en-GB',
    ceid: 'GB:en',
    query: '(deaf OR "hard of hearing" OR "British Sign Language" OR BSL OR "Irish Sign Language" OR "cochlear implant" OR "hearing aid") (Britain OR UK OR Ireland)',
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
    query: '(gehörlos OR gehörlose OR gebärdensprache OR hörgerät OR hörverlust OR schwerhörig OR cochlea-implantat)',
  },
  {
    region: 'europe_cis',
    gl: 'ES',
    hl: 'es',
    ceid: 'ES:es',
    query: '(sordo OR sordos OR sordera OR "lengua de signos" OR "lengua de señas" OR "implante coclear" OR audífonos)',
  },
  {
    region: 'europe_cis',
    gl: 'IT',
    hl: 'it',
    ceid: 'IT:it',
    query: '(sordo OR sordi OR sordità OR "lingua dei segni" OR "impianto cocleare" OR "apparecchio acustico")',
  },
  {
    region: 'europe_cis',
    gl: 'TR',
    hl: 'tr',
    ceid: 'TR:tr',
    query: '("işitme engelli" OR sağır OR "işaret dili" OR "koklear implant" OR "işitme cihazı")',
  },
  {
    region: 'middle_east_africa',
    gl: 'ZA',
    hl: 'en-ZA',
    ceid: 'ZA:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR "hearing aid" OR Deaflympics) ("South Africa" OR Zimbabwe OR Namibia OR Botswana)',
  },
  {
    region: 'middle_east_africa',
    gl: 'KE',
    hl: 'en-KE',
    ceid: 'KE:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "cochlear implant" OR "hearing loss") (Kenya OR Uganda OR Tanzania OR Nigeria OR Ghana)',
  },
  {
    region: 'middle_east_africa',
    gl: 'AE',
    hl: 'en-AE',
    ceid: 'AE:en',
    query: '(deaf OR "hard of hearing" OR "sign language" OR "hearing loss" OR "cochlear implant") ("Middle East" OR Gulf OR UAE OR Saudi OR Qatar OR Israel)',
  },
  {
    region: 'middle_east_africa',
    gl: 'AE',
    hl: 'ar',
    ceid: 'AE:ar',
    query: '(الصم OR أصم OR "ضعاف السمع" OR "ضعف السمع" OR "لغة الإشارة" OR "زراعة القوقعة" OR "سماعة طبية")',
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
  ['schwerhörig', 8], ['hörverlust', 8],
  ['sordi', 8], ['sordità', 8], ['lingua dei segni', 9], ['impianto cocleare', 9],
  ['apparecchio acustico', 8],
  ['işitme engelli', 9], ['sağır', 8], ['işaret dili', 9], ['koklear implant', 9], ['işitme cihazı', 8],
  ['청각장애', 9], ['청각 장애', 9], ['농인', 9], ['농아인', 9], ['수어', 8], ['수화', 7],
  ['보청기', 8], ['인공와우', 9], ['난청', 8],
  ['聽障', 9], ['听障', 9], ['聾人', 9], ['聋人', 9], ['手語', 8], ['手语', 8],
  ['助聽器', 8], ['助听器', 8], ['人工耳蝸', 9], ['人工耳蜗', 9], ['失聰', 8], ['失聪', 8],
  ['الصم', 9], ['أصم', 8], ['ضعاف السمع', 9], ['ضعف السمع', 8], ['لغة الإشارة', 9],
  ['زراعة القوقعة', 9], ['سماعة طبية', 8],
  ['बधिर', 9], ['सांकेतिक भाषा', 9], ['श्रवण बाधित', 9], ['कॉक्लियर इम्प्लांट', 9],
  ['聴覚障害', 9], ['難聴', 8], ['ろう者', 9], ['手話', 7], ['人工内耳', 8], ['補聴器', 8],
];

const STRONG_CONTEXT = [
  'disability', 'disabled', 'rights', 'court', 'law', 'policy', 'access', 'inclusive',
  'school', 'university', 'hospital', 'health', 'medical', 'technology', 'ai', 'emergency',
  'election', 'broadcast', 'television', 'sports', 'film', 'theatre', 'music',
  'derechos', 'educación', 'salud', 'accesibilidad', 'inclusión',
  'direitos', 'educação', 'saúde', 'acessibilidade', 'inclusão',
  'droits', 'éducation', 'santé', 'accessibilité', 'inclusion',
  'inklusion', 'barrierefreiheit', 'educación inclusiva', 'inclusión',
  'inclusione', 'accessibilità', '교육', '복지', '권리', '접근성',
  '無障礙', '无障碍', '教育', '權利', '权利', 'صحة', 'تعليم', 'حقوق', 'إتاحة',
];

const NOISE_PATTERNS = [
  /\btone deaf\b/i,
  /\bdeaf ears\b/i,
  /\bfall(?:s|ing|en)? on deaf ears\b/i,
  /\bturn(?:s|ed|ing)? a deaf ear\b/i,
  /\bdeafening\b/i,
  /\bhearing\b.{0,24}\b(court|senate|congress|committee|trial|inquiry)\b/i,
  /\b(earbuds|earphones|headphones|headset|airpods|bluetooth|noise[-\s]?cancell(?:ing|ation)|hi-res)\b/i,
  /\b(audífonos|auriculares)\b.{0,80}\b(hi-res|bluetooth|inalámbric|baratos|tablet|realme|xiaomi|samsung|sony)\b/i,
  /\b(audífonos|auriculares)\b.{0,100}\b(amazon|descuento|precio|gratis|comprar|costar|pesos|batería|modelo|marca)\b/i,
  /\b(realme|razer|sennheiser)\b.{0,100}\b(audífonos|auriculares|headphones|earbuds)\b/i,
];

const HARD_NOISE_PATTERNS = [
  /dialogue de sourds/i,
];

const NON_NOISE_HINT = /(sign language|hard of hearing|hearing impaired|hearing loss|hearing aid|cochlear|deafblind|deaf community|deaf student|deaf child|caption|interpreter|accessibility|sordo|sordera|surdo|surdez|sourd|surdité|gehörlos|gebärdensprache|sordità|lingua dei segni|işitme engelli|işaret dili|청각장애|농인|수어|聽障|听障|手語|手语|لغة الإشارة|ضعاف السمع|बधिर)/i;

const NON_NEWS_SOURCE_PATTERN = /(help\s*centre|help\s*center|help\s*forum|community|support|customer care|forum|facebook|wikimedia|pressreader|starbucks|disneyphile|iphone in canada|sennheiser)/i;
const NON_NEWS_DOMAIN_PATTERN = /(^|\.)helpforum\.|(^|\.)support\.|(^|\.)community\.|(^|\.)forum\.|helpcentre|helpcenter|(^|\.)facebook\.com$|(^|\.)wikimedia\.org$|(^|\.)pressreader\.com$/i;

const DOMAIN_REGION = new Map();
const DOMAIN_META = new Map();
for (const group of SOURCE_GROUPS) {
  for (const [domain, name, priority] of group.sources) {
    DOMAIN_REGION.set(domain, group.region);
    DOMAIN_META.set(domain, { name, priority, region: group.region });
  }
}

function envInt(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildGoogleNewsUrl(query, { gl = 'US', hl = 'en-US', ceid = 'US:en' } = {}, lookback = STANDARD_LOOKBACK) {
  const when = lookback ? ` when:${lookback}` : '';
  const encoded = encodeURIComponent(`${query}${when}`);
  return `https://news.google.com/rss/search?q=${encoded}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
}

function buildQueryJobs() {
  const jobs = [];
  for (const group of SOURCE_GROUPS) {
    const sourceChunks = chunk(group.sources, 5);
    for (const sources of sourceChunks) {
      const siteQuery = sources.map(([domain]) => `site:${domain}`).join(' OR ');
      const freshQuery = `(${siteQuery}) (${CORE_RECENT_QUERY})`;
      jobs.push({
        region: group.region,
        topic: 'general',
        query: freshQuery,
        sourceMode: 'major-media-fresh',
        lookback: FRESH_LOOKBACK,
        url: buildGoogleNewsUrl(freshQuery, undefined, FRESH_LOOKBACK),
      });
      for (const topic of TOPIC_QUERIES) {
        jobs.push({
          region: group.region,
          topic: topic.topic,
          query: `(${siteQuery}) (${topic.query})`,
          sourceMode: 'major-media',
          lookback: STANDARD_LOOKBACK,
          url: buildGoogleNewsUrl(`(${siteQuery}) (${topic.query})`, undefined, STANDARD_LOOKBACK),
        });
      }
    }
  }

  for (const broad of BROAD_REGION_QUERIES) {
    jobs.push({
      region: broad.region,
      topic: 'general',
      query: broad.query,
      sourceMode: 'regional-fresh',
      lookback: FRESH_LOOKBACK,
      url: buildGoogleNewsUrl(broad.query, broad, FRESH_LOOKBACK),
    });
    for (const topic of TOPIC_QUERIES) {
      const query = `(${broad.query}) (${topic.query})`;
      jobs.push({
        region: broad.region,
        topic: topic.topic,
        query,
        sourceMode: 'regional-multilingual',
        lookback: RECENT_LOOKBACK,
        url: buildGoogleNewsUrl(query, broad, RECENT_LOOKBACK),
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

async function fetchRequestWithTimeout(url, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
    const region = job.region;
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
    const isMajorMode = job.sourceMode.startsWith('major-media');
    const isRegionalDiscovery = job.sourceMode === 'regional-multilingual' || job.sourceMode === 'regional-fresh';
    const isBroadOnlySource = !isMajorMode && !isKnownMajorSource;
    const broadThreshold = isRegionalDiscovery ? 16 : 18;
    if (scoreInfo.isNoise || scoreInfo.relevanceHits === 0 || scoreInfo.score < MIN_SCORE) continue;
    if (isBroadOnlySource && scoreInfo.score < broadThreshold) continue;

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
  if (HARD_NOISE_PATTERNS.some((pattern) => pattern.test(text))) return { score: 0, signals: ['hard-noise'], isNoise: true };
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
  if (article.sourceMode.startsWith('major-media')) score += 3;
  if (article.sourceMode === 'regional-multilingual' || article.sourceMode === 'regional-fresh') {
    score += 2;
    signals.push('multilingual');
  }
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
  if (/(deaflympics|deaf sports|deaf athlete|deaf football|paralympic|olympic|sport|athlete|tournament|championship|fútbol|futsal|football|basketball|deporte|esporte|sportif|운동선수|体育|體育|رياضة)/i.test(value)) return 'sports';
  if (/(ai caption|live caption|speech-to-text|speech to text|automatic caption|technology|app|device|startup|artificial intelligence|avatar|tecnología|tecnologia|기술|人工智能|ai字幕|تقنية|تطبيق|teknoloji)/i.test(value)) return 'technology';
  if (/(school|student|education|teacher|university|classroom|college|children|deaf education|escuela|educación|école|bildung|scuola|educazione|학교|학생|교육|學校|学校|教育|مدرسة|تعليم|okul|öğrenci)/i.test(value)) return 'education';
  if (/(law|court|lawsuit|rights|policy|government|election|vote|discrimination|settlement|legislation|derechos|tribunal|loi|gesetz|diritti|법|권리|차별|法律|權利|权利|歧視|歧视|حقوق|قانون|mahkeme|hakları)/i.test(value)) return 'rights';
  if (/(sign language|interpreter|caption|subtitle|accessibility|accessible|broadcast|television|theatre access|lengua de señas|lengua de signos|langue des signes|gebärdensprache|libras|lingua dei segni|işaret dili|수어|수화|통역|手語|手语|字幕|無障礙|无障碍|لغة الإشارة|ترجمة|إتاحة)/i.test(value)) return 'accessibility';
  if (/(cochlear|hearing aid|hearing loss|audiology|implant|hospital|doctor|medical|health|screening|audífono|implante coclear|surdité|hörgerät|impianto cocleare|apparecchio acustico|보청기|인공와우|난청|助聽器|助听器|人工耳蝸|人工耳蜗|زراعة القوقعة|سماعة طبية|ضعف السمع|koklear|işitme cihazı)/i.test(value)) return 'health';
  if (/(film|movie|actor|artist|culture|community|festival|music|theatre|theater|book|museum|art|documentary|cultura|comunidad|영화|배우|문화|社群|文化|فيلم|ثقافة|مسرح|kültür|film)/i.test(value)) return 'culture';
  if (/(emergency|disaster|earthquake|war|conflict|evacuation|police|fire|safety|alert|emergencia|desastre|災害|灾害|緊急|紧急|재난|비상|طوارئ|كوارث|acil|afet)/i.test(value)) return 'safety';
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

function displaySort(a, b) {
  const time = new Date(b.publishedAt) - new Date(a.publishedAt);
  if (time !== 0) return time;
  const score = (b.curationScore ?? 0) - (a.curationScore ?? 0);
  if (score !== 0) return score;
  return (b.sourcePriority ?? 50) - (a.sourcePriority ?? 50);
}

function ageDays(article, now = Date.now()) {
  const published = new Date(article.publishedAt).getTime();
  if (Number.isNaN(published)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - published) / 86_400_000);
}

function interleaveByRegion(articles) {
  const groups = new Map(REGION_ORDER.map((region) => [region, []]));
  for (const article of [...articles].sort(displaySort)) {
    const key = groups.has(article.region) ? article.region : REGION_ORDER[0];
    groups.get(key).push(article);
  }

  const selected = [];
  while ([...groups.values()].some((items) => items.length)) {
    const active = REGION_ORDER
      .map((region) => ({ region, items: groups.get(region) }))
      .filter(({ items }) => items?.length)
      .sort((a, b) => displaySort(a.items[0], b.items[0]));
    for (const { items } of active) selected.push(items.shift());
  }
  return selected;
}

function selectFreshBalancedArticles(articles) {
  const now = Date.now();
  const buckets = [
    (article) => ageDays(article, now) <= 7,
    (article) => ageDays(article, now) <= 30,
    (article) => ageDays(article, now) <= 90,
    (article) => ageDays(article, now) <= 365,
    () => true,
  ];
  const remaining = [...articles];
  const selected = [];

  for (const matchBucket of buckets) {
    const bucket = [];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (matchBucket(remaining[i])) bucket.push(...remaining.splice(i, 1));
    }
    selected.push(...interleaveByRegion(bucket));
  }

  return selected;
}

async function loadTranslationCache() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const text = new Map();
    const articles = new Map();
    for (const article of data.articles ?? []) {
      const postEdited = article.japanesePostEditProvider === CODEX_POST_EDIT_PROVIDER;
      if (article.originalTitle && article.title && !isWeakJapaneseTranslation(article.originalTitle, article.title)) {
        text.set(article.originalTitle, article.title);
      }
      if (article.originalSummary && article.summary && !isWeakJapaneseTranslation(article.originalSummary, article.summary)) {
        text.set(article.originalSummary, article.summary);
      }
      if (article.originalTitle && article.originalSummary && article.title && article.summary) {
        articles.set(articleCacheKey(article), {
          title: article.title,
          summary: article.summary,
          postEdited,
        });
      }
    }
    return { text, articles };
  } catch {
    return { text: new Map(), articles: new Map() };
  }
}

function articleCacheKey(article) {
  return `${article.originalTitle ?? ''}\n${article.originalSummary ?? ''}`;
}

function containsJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text ?? ''));
}

function isWeakJapaneseTranslation(original, translated) {
  const source = String(original ?? '').trim();
  const value = String(translated ?? '').trim();
  if (!value) return true;
  if (value === source) return true;
  if (!containsJapanese(value) && /[a-z]/i.test(source)) return true;
  return false;
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
    .replace(/Auslan（Auslan（オーストラリア手話））/g, 'Auslan（オーストラリア手話）')
    .replace(/Auslan（オーストラリア手話）のAuslan/g, 'Auslan（オーストラリア手話）')
    .replace(/(?:Auslan（)+オーストラリア手話(?:）)+/g, 'Auslan（オーストラリア手話）')
    .trim();
}

function codexEndpoint(baseUrl = CODEX_APP_SERVER_URL) {
  if (!baseUrl) return '';
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('CODEX_APP_SERVER_URL must start with http:// or https://');
  return `${baseUrl.replace(/\/+$/, '')}/generate`;
}

function authHeaders() {
  const headers = { 'content-type': 'application/json' };
  if (CODEX_APP_SERVER_TOKEN) {
    headers.authorization = `Bearer ${CODEX_APP_SERVER_TOKEN}`;
    headers['x-codex-app-token'] = CODEX_APP_SERVER_TOKEN;
  }
  return headers;
}

function stripJsonFence(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJsonObject(text) {
  const stripped = stripJsonFence(text);
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const json = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeCodexPostEditItems(json) {
  const directItems = Array.isArray(json?.items) ? json.items : [];
  const validDirect = directItems
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? '').trim(),
      title: String(item.title ?? '').trim(),
      summary: String(item.summary ?? item.body_excerpt ?? item.body ?? item.text ?? '').trim(),
    }))
    .filter((item) => item.id && item.title);
  if (validDirect.length) return validDirect;

  const candidates = [
    json?.text,
    json?.raw_text,
    ...directItems.flatMap((item) => [item?.body, item?.text, item?.body_md, item?.title]),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseJsonObject(candidate);
    const items = Array.isArray(parsed?.items) ? parsed.items : parsed?.id ? [parsed] : [];
    const normalized = items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id ?? '').trim(),
        title: String(item.title ?? '').trim(),
        summary: String(item.summary ?? item.body_excerpt ?? item.body ?? item.text ?? '').trim(),
      }))
      .filter((item) => item.id && item.title);
    if (normalized.length) return normalized;
  }

  return [];
}

async function requestCodexPostEdit(batch) {
  const endpoint = codexEndpoint();
  const requestItems = batch.map((article, index) => ({
    id: String(index),
    source: article.sourceName,
    region: article.regionLabel,
    topic: article.topicLabel,
    original_title: article.originalTitle,
    original_summary: article.originalSummary,
    current_title_ja: article.title,
    current_summary_ja: article.summary,
  }));

  const body = {
    type: 'world_jp_post_edit',
    tone: 'news-curation',
    platform: 'deaf-navi-world-jp',
    count: requestItems.length,
    source_text: JSON.stringify({ items: requestItems }),
    metadata: {
      site: 'deaf-navi-world-jp',
      article_count: requestItems.length,
    },
    system_prompt: [
      'あなたはDeaf Navi World-JPの日本語ニュース編集者です。',
      '海外ニュースのタイトルと短い要約を、事実を変えずに自然な日本語へ整えます。',
      '聴覚障害、ろう者、難聴、手話、補聴器、人工内耳、情報保障などの用語を正確に扱ってください。',
      '固有名詞、国名、団体名、人物名、競技名、数字、日付は原文の意味を保持します。',
      '誇張、推測、本文にない情報の追加は禁止です。',
      '返答はJSONのみ。Markdownや説明文は不要です。',
    ].join('\n'),
    user_prompt: [
      '# Task',
      '以下のitemsについて、current_title_ja/current_summary_jaをニュース見出しとして自然な日本語に整えてください。',
      'タイトルは35文字から80文字程度を目安に、要約は1文で簡潔にしてください。',
      '原文が英語以外でも、出力は日本語にしてください。',
      '',
      '# Output JSON shape',
      '{"success":true,"provider":"codex_app_server","items":[{"id":"0","title":"自然な日本語タイトル","summary":"自然な日本語の短い要約"}]}',
      '',
      '# Items',
      JSON.stringify({ items: requestItems }, null, 2),
    ].join('\n'),
  };

  const res = await fetchRequestWithTimeout(endpoint, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }, CODEX_POST_EDIT_TIMEOUT_MS);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.replace(/\s+/g, ' ').trim().slice(0, 600)}`);

  const json = JSON.parse(text);
  if (json.success === false) throw new Error(String(json.error ?? 'Codex App Server returned success=false'));
  return normalizeCodexPostEditItems(json);
}

async function applyCodexJapanesePostEdit(articles, cacheArticles) {
  const cached = articles.filter((article) => cacheArticles.get(articleCacheKey(article))?.postEdited).length;
  if (!CODEX_POST_EDIT_ENABLED || !CODEX_APP_SERVER_URL || CODEX_POST_EDIT_MAX_ITEMS <= 0) {
    return { checked: 0, updated: 0, cached, skipped: Math.max(0, articles.length - cached), failed: 0, enabled: false };
  }

  let endpoint;
  try {
    endpoint = codexEndpoint();
  } catch (err) {
    console.warn(`[codex-postedit] skipped: ${err.message}`);
    return { checked: 0, updated: 0, cached, skipped: Math.max(0, articles.length - cached), failed: 0, enabled: false };
  }

  const targets = articles
    .filter((article) => !cacheArticles.get(articleCacheKey(article))?.postEdited)
    .slice(0, CODEX_POST_EDIT_MAX_ITEMS);
  if (!targets.length) return { checked: 0, updated: 0, cached, skipped: 0, failed: 0, enabled: true };

  try {
    const healthUrl = endpoint.replace(/\/generate$/, '/health');
    const health = await fetchRequestWithTimeout(healthUrl, { method: 'GET', headers: authHeaders() }, 3000);
    const healthText = await health.text();
    const healthJson = parseJsonObject(healthText);
    if (!health.ok) throw new Error(`health HTTP ${health.status}`);
    if (healthJson?.provider !== 'codex_app_server') {
      throw new Error('health response is not Codex App Server');
    }
  } catch (err) {
    console.warn(`[codex-postedit] skipped: Codex App Server is not available (${err.message})`);
    return { checked: 0, updated: 0, cached, skipped: Math.max(0, articles.length - cached), failed: 0, enabled: false };
  }

  let updated = 0;
  let failed = 0;
  const batches = chunk(targets, CODEX_POST_EDIT_BATCH_SIZE);
  console.log(`[codex-postedit] target articles: ${targets.length}, batches: ${batches.length}`);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      const edited = await requestCodexPostEdit(batch);
      const byId = new Map(edited.map((item) => [item.id, item]));
      batch.forEach((article, index) => {
        const item = byId.get(String(index));
        if (!item?.title) return;
        article.title = polishJapanese(item.title);
        article.summary = polishJapanese(item.summary || item.title);
        article.japanesePostEditProvider = CODEX_POST_EDIT_PROVIDER;
        updated += 1;
      });
    } catch (err) {
      failed += batch.length;
      console.warn(`[codex-postedit] batch ${i + 1}/${batches.length} failed: ${err.message}`);
    }
    if (i < batches.length - 1 && CODEX_POST_EDIT_DELAY_MS > 0) await sleep(CODEX_POST_EDIT_DELAY_MS);
  }

  return {
    checked: targets.length,
    updated,
    cached,
    skipped: Math.max(0, articles.length - cached - targets.length),
    failed,
    enabled: true,
  };
}

async function applyTranslations(articles) {
  const cache = await loadTranslationCache();
  const textCache = cache.text;
  const missing = [];

  for (const article of articles) {
    const cachedTitle = textCache.get(article.originalTitle);
    const cachedSummary = textCache.get(article.originalSummary);
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
    article.title = polishJapanese(textCache.get(article.originalTitle) ?? translated.get(article.originalTitle) ?? fallbackJapanese(article.originalTitle));
    article.summary = polishJapanese(textCache.get(article.originalSummary) ?? translated.get(article.originalSummary) ?? fallbackJapanese(article.originalSummary));
    if (cache.articles.get(articleCacheKey(article))?.postEdited) {
      article.japanesePostEditProvider = CODEX_POST_EDIT_PROVIDER;
    }
  }

  return applyCodexJapanesePostEdit(articles, cache.articles);
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

  const dedupedAll = dedupeArticles(all);
  const selected = selectFreshBalancedArticles(dedupedAll).slice(0, MAX_ARTICLES);
  const postEditReport = await applyTranslations(selected);

  return {
    articles: selected,
    report: {
      version: 'world-v4',
      rawCount: all.length,
      dedupedCount: dedupedAll.length,
      selectedCount: selected.length,
      maxArticles: MAX_ARTICLES,
      minScore: MIN_SCORE,
      freshLookback: FRESH_LOOKBACK,
      recentLookback: RECENT_LOOKBACK,
      standardLookback: STANDARD_LOOKBACK,
      queryCount: jobs.length,
      translationProvider: TRANSLATION_PROVIDER,
      japanesePostEditProvider: CODEX_POST_EDIT_PROVIDER,
      japanesePostEdit: postEditReport,
      freshnessCounts: {
        last7d: selected.filter((article) => ageDays(article) <= 7).length,
        last30d: selected.filter((article) => ageDays(article) <= 30).length,
        last90d: selected.filter((article) => ageDays(article) <= 90).length,
      },
      regionCounts: countBy(selected, 'region'),
      topicCounts: countBy(selected, 'topic'),
      sourceCounts: countBy(selected, 'sourceName'),
      sourceModeCounts: countBy(selected, 'sourceMode'),
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
