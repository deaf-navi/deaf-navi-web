import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'docs');

const VARIANT = getVariant();
const IS_DEV = VARIANT === 'dev';
const USE_EXPANDED_PROFILE = process.env.CURATION_PROFILE === 'legacy' ? IS_DEV : true;
const SUFFIX = IS_DEV ? '-dev' : '';
const DATA_FILE = join(DATA_DIR, `articles${SUFFIX}.json`);
const OLD_DATA_FILE = join(DATA_DIR, `articles-old${SUFFIX}.json`);

const MAX_ARTICLES = 400;
const EXTRA_VISIBLE_CATEGORIES = new Set(['relay']);
const MAX_OLD_ARTICLES = 5000;
const DEV_MIN_SCORE = 5;
const MAX_CURRENT_AGE_DAYS = 180;
const FALLBACK_RETENTION_DAYS = 45;
const FUTURE_TOLERANCE_HOURS = 24;
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_ATTEMPTS = 3;
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const KEYWORD_GROUPS = [
  { query: '聴覚障害 OR 難聴', defaultCategory: 'general' },
  { query: 'ろう者 OR ろうあ者 OR 中途失聴', defaultCategory: 'general' },
  { query: '手話 OR 情報保障', defaultCategory: 'accessibility' },
  { query: '(聴覚障害 OR 難聴 OR ろう者 OR 手話) (情報保障 OR アクセシビリティ OR 合理的配慮)', defaultCategory: 'accessibility' },
  { query: '(聴覚障害 OR 難聴 OR ろう者 OR 手話) (手話通訳 OR 要約筆記 OR 字幕 OR バリアフリー)', defaultCategory: 'accessibility' },
  { query: '聴覚障害 制度 OR 聴覚障害 支援', defaultCategory: 'policy' },
  { query: 'site:jfd.or.jp', defaultCategory: 'general' },
  { query: 'site:asahi.com 聴覚障害', defaultCategory: 'general' },
  { query: 'site:yomiuri.co.jp 聴覚障害', defaultCategory: 'general' },
  { query: 'site:prtimes.jp 聴覚障害', defaultCategory: 'general' },
  { query: 'site:rehab.go.jp 聴覚障害', defaultCategory: 'medical' },
  { query: 'ろう者 演劇 OR ろう劇団', defaultCategory: 'culture' },
  { query: '手話 舞台 OR 手話パフォーマンス', defaultCategory: 'culture' },
  { query: 'ろう芸術 OR ろう映画 OR デフシアター', defaultCategory: 'culture' },
  { query: '手話映画 OR 手話 監督 OR ろう者 ドキュメンタリー', defaultCategory: 'culture' },
  { query: '聴覚障害 AI OR 難聴 AI OR 手話 AI OR 自動字幕 OR 音声認識 字幕', defaultCategory: 'technology' },
  { query: '聴覚障害 防災 OR ろう者 防災 OR 難聴 災害 OR 聴覚障害 避難', defaultCategory: 'safety' },
  { query: '聴覚障害 イベント OR ろう者 講座 OR 難聴者 セミナー OR 手話講座', defaultCategory: 'event' },
  { query: 'デフリンピック', defaultCategory: 'sports' },
  { query: 'デフスポーツ OR ろう者 スポーツ OR 聴覚障害 選手', defaultCategory: 'sports' },
  { query: 'デフバスケ OR デフテニス OR デフサッカー OR デフバレー OR デフ柔道 OR デフ陸上', defaultCategory: 'sports' },
];

const DEV_KEYWORD_GROUPS = [
  ...KEYWORD_GROUPS,
  { query: '盲ろう OR 盲ろう者 OR 盲ろう児', defaultCategory: 'policy' },
  { query: '手話通訳 OR 要約筆記 OR 情報保障', defaultCategory: 'accessibility' },
  { query: '電話リレー OR 遠隔手話 OR 手話リンク', defaultCategory: 'policy' },
  { query: '人工内耳 OR 補聴器 OR 新生児聴覚スクリーニング', defaultCategory: 'medical' },
  { query: 'ろう学校 OR 聴覚特別支援学校 OR 難聴児 教育', defaultCategory: 'education' },
  { query: '字幕 バリアフリー OR UDCast OR 音声認識 字幕', defaultCategory: 'accessibility' },
  { query: 'AI字幕 OR リアルタイム字幕 OR 手話翻訳 OR 音声認識アプリ', defaultCategory: 'technology' },
  { query: '聴覚障害 緊急通報 OR ろう者 避難所 OR 難聴者 災害情報', defaultCategory: 'safety' },
  { query: '手話 研修会 OR 手話体験 OR ろう者 交流会 OR 難聴者 相談会', defaultCategory: 'event' },
];

const DIRECT_FEEDS = [
  {
    url: 'https://www.jfd.or.jp/feed',
    sourceName: '全日本ろうあ連盟',
    sourceUrl: 'https://www.jfd.or.jp/',
    defaultCategory: 'general',
    sourceTier: 'official',
    passThrough: true,
  },
  {
    url: 'https://www.jfd.or.jp/category/sl-act/feed',
    sourceName: '全日本ろうあ連盟（手話言語法）',
    sourceUrl: 'https://www.jfd.or.jp/',
    defaultCategory: 'policy',
    sourceTier: 'official',
    passThrough: true,
  },
  {
    // 旧 /feed/ は2012年で停止。イベントフィードに切替（稼働中）
    url: 'https://shikaku.in/feed/event/',
    sourceName: 'しかくタイムズ（イベント）',
    sourceUrl: 'https://shikaku.in/',
    defaultCategory: 'event',
    sourceTier: 'specialist',
    passThrough: true,
  },
  {
    url: 'https://www.tfd.deaf.tokyo/feed/',
    sourceName: '東京都聴覚障害者連盟',
    sourceUrl: 'https://www.tfd.deaf.tokyo/',
    defaultCategory: 'local',
    sourceTier: 'official',
    passThrough: true,
  },
  {
    // マガジンハウス運営の福祉クリエイティブマガジン。devでは関連スコアで絞る
    url: 'https://co-coco.jp/feed/',
    sourceName: 'こここ',
    sourceUrl: 'https://co-coco.jp/',
    defaultCategory: 'culture',
    sourceTier: 'broad',
    minScore: 7,
  },
  {
    // 日本ろう者劇団（アメブロ）
    url: 'https://rssblog.ameba.jp/jtd2009/rss20.xml',
    sourceName: '日本ろう者劇団',
    sourceUrl: 'https://ameblo.jp/jtd2009/',
    defaultCategory: 'culture',
    sourceTier: 'specialist',
    passThrough: true,
  },
  {
    // 全日本ろうあ連盟スポーツ委員会 - 国内デフスポーツ大会・選手団情報
    url: 'https://www.jfd.or.jp/sc/feed',
    sourceName: '全日本ろうあ連盟スポーツ委員会',
    sourceUrl: 'https://www.jfd.or.jp/sc/',
    defaultCategory: 'sports',
    sourceTier: 'official',
    passThrough: true,
  },
  {
    // 日本デフバスケットボール協会
    url: 'https://jdba.sakura.ne.jp/feed',
    sourceName: '日本デフバスケットボール協会',
    sourceUrl: 'https://jdba.sakura.ne.jp/',
    defaultCategory: 'sports',
    sourceTier: 'specialist',
    passThrough: true,
  },
  {
    // 日本デフ水泳協会
    url: 'https://www.deafswim.or.jp/feed',
    sourceName: '日本デフ水泳協会',
    sourceUrl: 'https://www.deafswim.or.jp/',
    defaultCategory: 'sports',
    sourceTier: 'specialist',
    passThrough: true,
  },
];

const DEV_DIRECT_FEEDS = [
  {
    url: 'https://www.zennancho.or.jp/feed/',
    sourceName: '全日本難聴者・中途失聴者団体連合会',
    sourceUrl: 'https://www.zennancho.or.jp/',
    defaultCategory: 'policy',
    sourceTier: 'official',
    minScore: 6,
  },
  {
    url: 'https://www.com-sagano.com/feed/',
    sourceName: '全国手話研修センター',
    sourceUrl: 'https://www.com-sagano.com/',
    defaultCategory: 'education',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://www.jyoubun-center.or.jp/feed/',
    sourceName: '聴力障害者情報文化センター',
    sourceUrl: 'https://www.jyoubun-center.or.jp/',
    defaultCategory: 'culture',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://shigajou.or.jp/feed/',
    sourceName: '滋賀県立聴覚障害者センター',
    sourceUrl: 'https://shigajou.or.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://www.tokyo-shuwacenter.or.jp/feed/',
    sourceName: '東京手話通訳等派遣センター',
    sourceUrl: 'https://www.tokyo-shuwacenter.or.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://www.nftrs.or.jp/rss.xml',
    sourceName: '電話リレーサービス',
    sourceUrl: 'https://www.nftrs.or.jp/',
    defaultCategory: 'policy',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://www.nf-denwa-relay.jp/rss.xml',
    sourceName: '日本財団電話リレーサービス',
    sourceUrl: 'https://www.nf-denwa-relay.jp/',
    defaultCategory: 'policy',
    sourceTier: 'official',
    minScore: 7,
  },
  {
    url: 'https://zentsuken.cocolog-nifty.com/blog/rss.xml',
    sourceName: '全通研NOW!!',
    sourceUrl: 'https://www.zentsuken.net/',
    defaultCategory: 'policy',
    sourceTier: 'specialist',
    minScore: 5,
  },
  {
    url: 'https://audiology-japan.jp/feed/',
    sourceName: '日本聴覚医学会',
    sourceUrl: 'https://audiology-japan.jp/',
    defaultCategory: 'medical',
    sourceTier: 'specialist',
    minScore: 6,
  },
  {
    url: 'https://www.hokurouren.jp/feed/',
    sourceName: '北海道聴覚障がい者情報センター',
    sourceUrl: 'https://www.hokurouren.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 5,
  },
  {
    url: 'https://www.sapporo-deaf.jp/feed/',
    sourceName: '札幌聴覚障害者協会',
    sourceUrl: 'https://www.sapporo-deaf.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 5,
  },
  {
    url: 'https://hyogocenter.jp/feed/',
    sourceName: '兵庫県立聴覚障害者情報センター',
    sourceUrl: 'https://hyogocenter.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 5,
  },
  {
    url: 'https://shichocenter.kagoshima.kagoshima.jp/feed/',
    sourceName: '鹿児島県視聴覚障害者情報センター',
    sourceUrl: 'https://shichocenter.kagoshima.kagoshima.jp/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 5,
  },
  {
    url: 'https://www.otjc.org/feed/',
    sourceName: '沖縄聴覚障害者情報センター',
    sourceUrl: 'https://www.otjc.org/',
    defaultCategory: 'local',
    sourceTier: 'official',
    minScore: 5,
  },
];

const DEV_SOCIAL_FEEDS = [
  {
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEL-kFxU_6EnoEB4sj4DBTg',
    sourceName: '全日本ろうあ連盟 YouTube',
    sourceUrl: 'https://www.youtube.com/@JFDVideo',
    defaultCategory: 'general',
    sourceTier: 'official',
    sourceType: 'video',
    minScore: 6,
  },
  {
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCv-RELKOhMzxV6wBbIKpbhA',
    sourceName: '全国手話研修センター YouTube',
    sourceUrl: 'https://www.youtube.com/@%E5%85%A8%E5%9B%BD%E6%89%8B%E8%A9%B1%E7%A0%94%E4%BF%AE%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC',
    defaultCategory: 'education',
    sourceTier: 'official',
    sourceType: 'video',
    minScore: 5,
  },
  {
    url: 'https://note.com/ontelope/rss',
    sourceName: 'ONTELOPE note',
    sourceUrl: 'https://note.com/ontelope',
    defaultCategory: 'general',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 7,
  },
  {
    url: 'https://note.com/psy_article/rss',
    sourceName: 'うりぼー note',
    sourceUrl: 'https://note.com/psy_article',
    defaultCategory: 'general',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 8,
  },
  {
    url: 'https://udcast.net/feed/',
    sourceName: 'UDCast',
    sourceUrl: 'https://udcast.net/',
    defaultCategory: 'culture',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 7,
  },
  {
    url: 'https://udcast.net/workslist/feed/',
    sourceName: 'UDCast 作品情報',
    sourceUrl: 'https://udcast.net/workslist/',
    defaultCategory: 'culture',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 7,
  },
  {
    url: 'https://palabra-i.co.jp/feed/',
    sourceName: 'Palabra',
    sourceUrl: 'https://palabra-i.co.jp/',
    defaultCategory: 'culture',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 7,
  },
  {
    url: 'https://silentvoice.co.jp/feed/',
    sourceName: 'Silent Voice',
    sourceUrl: 'https://silentvoice.co.jp/',
    defaultCategory: 'education',
    sourceTier: 'broad',
    sourceType: 'social',
    minScore: 7,
  },
];

const RELEVANT_KEYWORDS = [
  '聴覚障害', '難聴', 'ろう者', 'ろうあ者', 'ろうあ', '聾者', '聾唖',
  'デフ', 'deaf', '手話', '情報保障', '補聴器', '人工内耳',
  '新生児スクリーニング', '手話言語', '手話通訳', '要約筆記',
  '電話リレー', '手話翻訳', '聴力', '聴覚', '耳が聞こえ',
  '中途失聴', '難聴者', 'ろう学校', '聴覚特別支援',
  '手話講座', '手話研修', '手話体験',
  // 文化・芸能系
  'ろう文化', 'ろう劇団', '手話演劇', '手話狂言', '手話能', 'ろう映画',
  '手話落語', 'ろう芸術', 'デフシアター', '手話パフォーマンス',
  'ろう映画祭', '手話詩', 'ろうアーティスト', '手話文学',
  '手話映画', 'ろう者ドキュメンタリー',
  // デフスポーツ系
  'デフリンピック', 'デフスポーツ', 'デフアスリート',
  '聴覚障害者スポーツ', 'ろう者スポーツ', '聴障スポーツ',
  'デフバスケ', 'デフテニス', 'デフサッカー', 'デフバレー',
  'デフ柔道', 'デフ陸上', 'デフ水泳',
  '全国ろうあ者体育大会', 'ろうあ者体育大会', 'ICSD',
  // 関連する包含的表現
  '耳の聞こえない', '耳の聞こえ',
];

const CONTEXTUAL_RELEVANT_KEYWORDS = [
  'アクセシビリティ', '字幕', '自動字幕', 'リアルタイム字幕', 'AI字幕',
  '音声認識', '音声文字変換', '合理的配慮', 'バリアフリー',
  '防災', '災害', '避難', '避難所', '緊急通報', '119番', '110番',
  '警察', '消防', '災害情報', '緊急情報',
  '講演会', 'セミナー', '研修会', '体験会', '交流会', '相談会',
  '勉強会', 'フォーラム', 'シンポジウム',
];

const RELEVANCE_CONTEXT_KEYWORDS = [
  '聴覚', '難聴', 'ろう', '聾', '手話', '耳', '聴力',
  'デフ', 'deaf', '中途失聴', '情報保障',
];

const SCORE_TERMS = [
  ['聴覚障害', 8], ['聴覚障がい', 8], ['難聴', 8], ['ろう者', 8], ['ろうあ者', 8],
  ['中途失聴', 8], ['盲ろう', 8], ['聴覚特別支援', 8], ['ろう学校', 7],
  ['手話通訳', 8], ['要約筆記', 8], ['情報保障', 8], ['アクセシビリティ', 7],
  ['合理的配慮', 7], ['バリアフリー字幕', 7], ['UDCast', 6],
  ['電話リレー', 8], ['遠隔手話', 8], ['手話リンク', 7], ['手話言語', 7], ['手話奉仕員', 7],
  ['補聴器', 7], ['人工内耳', 7], ['新生児聴覚スクリーニング', 7],
  ['AI字幕', 7], ['自動字幕', 7], ['リアルタイム字幕', 7], ['音声認識アプリ', 6],
  ['手話翻訳', 7], ['手話アバター', 6], ['支援技術', 6],
  ['防災', 7], ['災害情報', 7], ['避難所', 7], ['緊急通報', 7],
  ['119番', 6], ['110番', 6], ['消防', 5], ['警察', 5],
  ['手話講座', 7], ['講演会', 6], ['セミナー', 6], ['研修会', 6],
  ['体験会', 6], ['交流会', 6], ['相談会', 6], ['勉強会', 5],
  ['フォーラム', 5], ['シンポジウム', 5], ['上映会', 5], ['公演', 5],
  ['デフリンピック', 8], ['デフスポーツ', 8], ['デフアスリート', 7],
  ['全国キャラバン', 6], ['標準手話', 6], ['手話練習帳', 6], ['Let’s手話', 6], ["Let's手話", 6],
  ['全国ろうあ者体育大会', 8], ['ろうあ者体育大会', 8],
  ['デフバスケ', 7], ['デフテニス', 7], ['デフサッカー', 7], ['デフバレー', 7],
  ['デフ柔道', 7], ['デフ陸上', 7], ['デフ水泳', 7],
  ['手話演劇', 7], ['手話狂言', 7], ['手話能', 7], ['手話落語', 7],
  ['ろう文化', 7], ['ろう劇団', 7], ['ろう映画', 7], ['デフシアター', 7],
  ['手話パフォーマンス', 7], ['ろう者ドキュメンタリー', 7],
  ['サインシンガー', 6], ['UDCast', 6],
  ['手話', 3], ['字幕', 3], ['音声認識', 3], ['聴力', 3], ['聴覚', 3],
  ['耳の聞こえ', 4], ['耳が聞こえ', 4], ['deaf', 4], ['デフ', 3],
];

const CONTEXT_TERMS = [
  ['制度', 2], ['政策', 2], ['法律', 2], ['条例', 2], ['支援', 2], ['助成', 2],
  ['雇用', 2], ['医療', 2], ['治療', 2], ['診断', 2], ['検査', 2], ['耳鼻', 2],
  ['教育', 2], ['学校', 2], ['授業', 2], ['入試', 2], ['保育', 2], ['研究', 2],
  ['避難', 2], ['防災', 2], ['災害', 2], ['緊急', 2], ['窓口', 2], ['講習', 2], ['相談', 2], ['研修', 2],
  ['バリアフリー', 2], ['合理的配慮', 3],
];

const SOFT_NOISE_TERMS = [
  ['Snow Man', -4], ['目黒蓮', -4], ['佐久間大介', -3], ['反響', -2], ['称賛', -2],
  ['芸能人', -2], ['熱愛', -3], ['ドラマ', -2], ['アイドル', -3],
];

const AGGREGATOR_SOURCES = new Set([
  'Yahoo!ニュース',
  'ライブドアニュース',
  'au Webポータル',
  'ｄメニューニュース',
  'dメニューニュース',
]);

const PREFERRED_SOURCES = new Map([
  ['NHKニュース', 85],
  ['朝日新聞', 75],
  ['読売新聞', 75],
  ['毎日新聞', 75],
  ['日本経済新聞', 70],
  ['東京新聞デジタル', 70],
  ['FNNプライムオンライン', 65],
  ['TBS NEWS DIG', 65],
  ['PR TIMES', 45],
]);

function getVariant() {
  if (process.env.CURATION_VARIANT === 'dev') return 'dev';
  if (process.argv.includes('--dev')) return 'dev';
  const variantArg = process.argv.find((arg) => arg.startsWith('--variant='));
  return variantArg?.split('=')[1] === 'dev' ? 'dev' : 'prod';
}

function isRelevantArticle(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (RELEVANT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) return true;
  const hasContextualTerm = CONTEXTUAL_RELEVANT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  if (!hasContextualTerm) return false;
  return RELEVANCE_CONTEXT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function guessCategory(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  if (/電話リレー|ヨメテル|文字表示電話|手話リンク|手話フォン|遠隔手話/.test(text)) return 'relay';
  // culture は最優先（「ろう演劇」「手話映画」等が他カテゴリに誤判定されるのを防ぐ）
  if (/ろう[文劇芸映]|手話[演舞映落狂詩]|デフシアター|ろう映画|ろう芸術|手話パフォーマンス|手話能|手話狂言|手話文学|ろうアーティスト|デフリンピック.*(文化|芸術|プログラム)/.test(text)) return 'culture';
  // sports は culture の次（「デフリンピック文化プログラム」は culture に流れる）
  if (/デフリンピック|デフスポーツ|デフアスリート|デフ(バスケ|テニス|サッカー|バレー|柔道|剣道|陸上|水泳|ボウリング|ゴルフ|サーフィン|卓球|野球|バドミントン|ラグビー|ハンドボール|フットサル|ホッケー|スケート|スキー|ビリヤード|空手|レスリング)|聴覚障害者スポーツ|ろう者スポーツ|聴障スポーツ|全国ろうあ者体育大会|ろうあ者体育大会|聴覚障害.{0,6}(選手|代表|五輪|金メダル|銀メダル|銅メダル)/.test(text)) return 'sports';
  if (/ai字幕|自動字幕|リアルタイム字幕|音声認識|音声文字変換|speech.?to.?text|手話翻訳|手話アバター|支援技術|アクセシビリティ技術|アプリ|\bai\b|人工知能/.test(text)) return 'technology';
  if (/防災|災害|地震|台風|豪雨|避難|避難所|緊急通報|緊急情報|災害情報|119番|110番|消防|警察|救急|アラート/.test(text)) return 'safety';
  if (/情報保障|アクセシビリティ|合理的配慮|バリアフリー|字幕|要約筆記|手話通訳|遠隔通訳|UDCast|UDトーク|窓口対応|コミュニケーション支援/.test(text)) return 'accessibility';
  if (/手話講座|講座|講演会|セミナー|研修会|勉強会|体験会|交流会|相談会|説明会|見学会|上映会|公演|発表会|フォーラム|シンポジウム|ワークショップ|参加者募集|参加募集|受講者募集|開催案内|申込|申し込み/.test(text)) return 'event';
  if (/制度|政策|法律|条例|給付|支援|雇用|助成|補助|手当/.test(text)) return 'policy';
  if (/医療|病院|治療|手術|補聴器|人工内耳|診断|検査|耳鼻/.test(text)) return 'medical';
  if (/学校|教育|就学|大学|授業|入試|保育|幼稚|研究/.test(text)) return 'education';
  if (/都|道|府|県|市|区|町|村|地域|地方/.test(text)) return 'local';
  return 'general';
}

function buildUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=ja&gl=JP&ceid=JP:ja`;
}

function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return plain?.[1]?.trim() ?? '';
}

function extractAttr(xml, tag, attr, attrPattern = '') {
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*${attrPattern})[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i');
  return xml.match(pattern)?.[1]?.trim() ?? '';
}

function extractActualUrl(description, fallback) {
  const match = description.match(/href="(https?:\/\/(?!news\.google\.com\/)[^"]+)"/i);
  return match?.[1] ?? fallback;
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&laquo;/g, '"')
    .replace(/&raquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, '・')
    .replace(/&amp;/g, '&'); // &amp; は最後（多重エンコード対応）
}

function cleanHtml(text) {
  // 1) 多重エンコード対策: 変化しなくなるまで最大3回デコード（例: &amp;nbsp; -> &nbsp; -> 空白）
  let decoded = text;
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  // 2) タグ除去・URL除去・残存する名前付きエンティティの除去・空白正規化
  return decoded
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&[a-zA-Z][a-zA-Z0-9]{1,20};/g, '') // デコード漏れのnamed entityを排除
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanSummaryText(summary, title, sourceName) {
  const cleaned = String(summary ?? '')
    .replace(/\s+The post[\s\S]*?first appeared on[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const withoutSource = sourceName
    ? cleaned.replace(new RegExp(escapeRegExp(sourceName), 'giu'), '').trim()
    : cleaned;
  const summaryKey = normalizeTitleKey(withoutSource);
  const titleKey = normalizeTitleKey(title);

  if (!summaryKey || summaryKey === titleKey) return '';
  if (summaryKey.startsWith(titleKey) && summaryKey.length - titleKey.length <= 8) return '';
  return cleaned.substring(0, 220);
}

function inferDiscoverySourceTier(sourceName, sourceUrl) {
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

function parseItems(xml, defaultCategory, sourceOverride) {
  const results = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of itemMatches) {
    const block = match[1];
    const title = cleanHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const rawDescription = extractTag(block, 'description');
    const rawSummary = cleanHtml(rawDescription);
    const articleUrl = sourceOverride ? link : extractActualUrl(rawDescription, link);

    let sourceName;
    let sourceUrl;
    if (sourceOverride) {
      sourceName = sourceOverride.sourceName;
      sourceUrl = sourceOverride.sourceUrl;
    } else {
      const sourceMatch = block.match(/<source\s+url="([^"]*)"[^>]*>([^<]*)<\/source>/i);
      sourceName = sourceMatch?.[2]?.trim() ?? 'Google News';
      sourceUrl = sourceMatch?.[1]?.trim() ?? 'https://news.google.com/';
    }

    if (!title || !link) continue;

    let publishedAt;
    try {
      publishedAt = new Date(pubDate).toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const description = cleanSummaryText(rawSummary, title, sourceName);
    const category = guessCategory(title, description) ?? defaultCategory;

    results.push({
      id: articleUrl,
      title,
      summary: description,
      sourceName,
      sourceUrl,
      publishedAt,
      category,
      sourceType: sourceOverride?.sourceType ?? 'rss',
      _sourceTier: sourceOverride?.sourceTier ?? inferDiscoverySourceTier(sourceName, sourceUrl),
      _passThrough: Boolean(sourceOverride?.passThrough),
      _minScore: sourceOverride?.minScore,
      _feedUrl: sourceOverride?.url,
    });
  }

  return results;
}

function parseAtomEntries(xml, defaultCategory, sourceOverride) {
  const results = [];
  const entryMatches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)];

  for (const match of entryMatches) {
    const block = match[1];
    const title = cleanHtml(extractTag(block, 'title') || extractTag(block, 'media:title'));
    const rawSummary = extractTag(block, 'summary')
      || extractTag(block, 'content')
      || extractTag(block, 'media:description');
    const cleanedSummary = cleanHtml(rawSummary);
    const alternateLink = extractAttr(block, 'link', 'href', 'rel=["\']alternate["\']')
      || extractAttr(block, 'link', 'href');
    const id = extractTag(block, 'id') || alternateLink;
    const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');
    const articleUrl = alternateLink || id;

    if (!title || !articleUrl) continue;

    let publishedAt;
    try {
      publishedAt = new Date(pubDate).toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const authorName = cleanHtml(extractTag(block, 'name'));
    const authorUri = extractTag(block, 'uri');
    const sourceName = sourceOverride?.sourceName ?? authorName ?? 'Atom Feed';
    const sourceUrl = sourceOverride?.sourceUrl ?? authorUri ?? articleUrl;
    const description = cleanSummaryText(cleanedSummary, title, sourceName);
    const category = guessCategory(title, description) ?? defaultCategory;

    results.push({
      id: articleUrl,
      title,
      summary: description,
      sourceName,
      sourceUrl,
      publishedAt,
      category,
      sourceType: sourceOverride?.sourceType ?? 'atom',
      _sourceTier: sourceOverride?.sourceTier ?? inferDiscoverySourceTier(sourceName, sourceUrl),
      _passThrough: Boolean(sourceOverride?.passThrough),
      _minScore: sourceOverride?.minScore,
      _feedUrl: sourceOverride?.url,
    });
  }

  return results;
}

function parseFeedItems(xml, defaultCategory, sourceOverride) {
  const rssItems = parseItems(xml, defaultCategory, sourceOverride);
  const atomItems = parseAtomEntries(xml, defaultCategory, sourceOverride);
  return [...rssItems, ...atomItems];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS, attempts = FETCH_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DeafNaviWeb/1.1 (+https://tamas-hub.github.io/deaf-navi-web/)' },
      });
      if (response.ok || !RETRYABLE_HTTP_STATUS.has(response.status) || attempt === attempts) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }

    await wait(400 * (2 ** (attempt - 1)));
  }

  throw lastError ?? new Error('フィード取得に失敗しました。');
}

function normalizeForSearch(text) {
  return String(text).normalize('NFKC').toLowerCase();
}

function articleAgeDays(article, now = Date.now()) {
  const published = new Date(article.publishedAt).getTime();
  if (!Number.isFinite(published)) return Number.POSITIVE_INFINITY;
  return (now - published) / 86_400_000;
}

function hasAcceptablePublishedAt(article, now = Date.now()) {
  const ageDays = articleAgeDays(article, now);
  return ageDays >= -(FUTURE_TOLERANCE_HOURS / 24) && ageDays <= MAX_CURRENT_AGE_DAYS;
}

function scoreArticle(article) {
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
  score += Math.min(contextScore, 8);

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

function normalizeTitleKey(title) {
  return String(title)
    .normalize('NFKC')
    .replace(/\s+[-－―]\s+[^-－―|｜]+$/u, '')
    .replace(/(20\d{2}|令和\d+)年\d{1,2}月\d{1,2}日(掲載)?/gu, '')
    .replace(/https?:\/\/\S+/gu, '')
    .replace(/[!！?？。、「」『』“”"'\s・…:：;；｜|【】［］\[\]（）()]/gu, '')
    .toLowerCase();
}

function bigrams(text) {
  const s = normalizeTitleKey(text);
  const result = new Set();
  for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2));
  return result;
}

function diceSimilarity(a, b) {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const x of aa) {
    if (bb.has(x)) overlap += 1;
  }
  return (2 * overlap) / (aa.size + bb.size);
}

function isNearDuplicate(a, b) {
  if (a.id && b.id && a.id === b.id) return true;
  const ak = a._dedupeKey;
  const bk = b._dedupeKey;
  if (!ak || !bk) return false;
  const aNumbers = String(a.title).match(/\d+/g)?.join('|') ?? '';
  const bNumbers = String(b.title).match(/\d+/g)?.join('|') ?? '';
  if (aNumbers && bNumbers && aNumbers !== bNumbers) return false;
  if (ak === bk) return true;
  if (Math.min(ak.length, bk.length) >= 24 && (ak.includes(bk) || bk.includes(ak))) return true;
  return diceSimilarity(ak, bk) >= 0.94;
}

function sourcePriority(article) {
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

function preferredRank(article) {
  const published = new Date(article.publishedAt).getTime();
  const recency = Number.isFinite(published) ? published / 86_400_000 : 0;
  return sourcePriority(article) * 1000 + (article.curationScore ?? 0) * 20 + recency;
}

function dedupeNearArticles(articles) {
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
    });
    if (preferredRank(article) > preferredRank(selected[duplicateIndex])) {
      selected[duplicateIndex] = article;
    }
  }

  return { articles: selected, duplicates };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function isLowValueDiscoveryPage(article) {
  if (article._feedUrl) return false;
  return /(?:\d+\s*枚目の)?(?:写真・画像|写真一覧|画像一覧)|フォトギャラリー/iu.test(article.title);
}

function splitVisibleArticles(deduped) {
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

function curateExpandedArticles(allArticles, context = {}) {
  const scored = allArticles.map((article) => {
    const { score, signals } = scoreArticle(article);
    return {
      ...article,
      curationScore: score,
      curationSignals: signals,
      _dedupeKey: normalizeTitleKey(article.title),
    };
  });

  const fresh = scored.filter((article) => hasAcceptablePublishedAt(article));
  const eligible = fresh.filter((article) => !isLowValueDiscoveryPage(article));
  const filtered = eligible.filter((article) => {
    const minScore = article._minScore ?? DEV_MIN_SCORE;
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
      version: 'expanded-score-v3',
      rawCount: allArticles.length,
      scoredCount: scored.length,
      freshCount: fresh.length,
      staleOrInvalidRemoved: scored.length - fresh.length,
      lowValuePageRemoved: fresh.length - eligible.length,
      filteredCount: filtered.length,
      lowScoreRemoved: eligible.length - filtered.length,
      nearDuplicateRemoved: duplicates.length,
      finalCountBeforeLimit: deduped.length,
      primaryCategoryLimit: MAX_ARTICLES,
      primaryVisibleCount: primaryArticles.length,
      extraVisibleCount: extraArticles.length,
      extraVisibleCategoryCounts: countBy(extraArticles, 'category'),
      overflowCount: overflowArticles.length,
      minScore: DEV_MIN_SCORE,
      maxCurrentAgeDays: MAX_CURRENT_AGE_DAYS,
      fallbackRetentionDays: FALLBACK_RETENTION_DAYS,
      fallbackCandidateCount: context.fallbackCandidateCount ?? 0,
      sourceHealth: context.sourceHealth ?? null,
      sourceCountsBefore: countBy(scored, 'sourceName'),
      sourceCountsAfter: countBy(deduped, 'sourceName'),
      categoryCountsVisible: countBy(visibleArticles, 'category'),
      sourceTypeCountsAfter: countBy(deduped, (article) => article.sourceType ?? 'unknown'),
      sourceTierCountsAfter: countBy(deduped, (article) => article._sourceTier ?? 'unknown'),
      categoryCountsAfter: countBy(deduped, 'category'),
      duplicateSamples: duplicates.slice(0, 20),
      droppedSamples: eligible
        .filter((article) => !article._passThrough && article.curationScore < (article._minScore ?? DEV_MIN_SCORE))
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

function stripInternal(article) {
  const {
    _sourceTier,
    _passThrough,
    _minScore,
    _dedupeKey,
    _feedUrl,
    ...clean
  } = article;
  const sourceTier = (_sourceTier ?? clean.sourceTier) === 'google'
    ? 'news'
    : (_sourceTier ?? clean.sourceTier ?? 'news');
  clean.summary = cleanSummaryText(clean.summary, clean.title, clean.sourceName);
  clean.sourceTier = sourceTier;
  clean.discoveryMethod = _feedUrl || clean.discoveryMethod === 'direct-feed'
    ? 'direct-feed'
    : 'google-news';
  if (!IS_DEV) {
    delete clean.curationScore;
    delete clean.curationSignals;
  }
  return clean;
}

async function loadExistingOldArticles() {
  try {
    const raw = await readFile(OLD_DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

async function loadExistingArticles() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

function hydratePreviousArticle(article, directFeedByName) {
  const directFeed = directFeedByName.get(article.sourceName);
  const savedTier = article.sourceTier === 'news' ? 'google' : article.sourceTier;
  return {
    ...article,
    _sourceTier: directFeed?.sourceTier ?? savedTier ?? 'google',
    _passThrough: Boolean(directFeed?.passThrough),
    _minScore: directFeed?.minScore,
    _feedUrl: directFeed?.url ?? (article.discoveryMethod === 'direct-feed' ? article.sourceUrl : undefined),
  };
}

function mergeOldArticles(currentOldArticles, previousOldArticles) {
  const byId = new Map();
  for (const article of [...currentOldArticles, ...previousOldArticles]) {
    if (!article?.id) continue;
    const existing = byId.get(article.id);
    if (!existing || preferredRank(article) > preferredRank(existing)) {
      byId.set(article.id, article);
    }
  }

  return [...byId.values()]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_OLD_ARTICLES);
}

async function loadNews() {
  const allArticles = [];
  const directFeeds = USE_EXPANDED_PROFILE
    ? [...DIRECT_FEEDS, ...DEV_DIRECT_FEEDS, ...DEV_SOCIAL_FEEDS]
    : DIRECT_FEEDS;
  const sourceHealth = {
    direct: { requested: directFeeds.length, succeeded: 0, failed: [] },
    discovery: { requested: 0, succeeded: 0, failed: [] },
  };

  for (const feed of directFeeds) {
    try {
      const res = await fetchWithTimeout(feed.url);
      if (!res.ok) {
        console.warn(`[skip] ${feed.sourceName}: HTTP ${res.status}`);
        sourceHealth.direct.failed.push({ sourceName: feed.sourceName, status: res.status });
        continue;
      }
      const xml = await res.text();
      const items = parseFeedItems(xml, feed.defaultCategory, feed);
      console.log(`[direct] ${feed.sourceName}: ${items.length} items`);
      sourceHealth.direct.succeeded += 1;
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] ${feed.sourceName}: ${err.message}`);
      sourceHealth.direct.failed.push({ sourceName: feed.sourceName, error: err.name ?? 'Error' });
    }
  }

  const keywordGroups = USE_EXPANDED_PROFILE ? DEV_KEYWORD_GROUPS : KEYWORD_GROUPS;
  sourceHealth.discovery.requested = keywordGroups.length;
  for (const { query, defaultCategory } of keywordGroups) {
    try {
      const res = await fetchWithTimeout(buildUrl(query));
      if (!res.ok) {
        console.warn(`[skip] "${query}": HTTP ${res.status}`);
        sourceHealth.discovery.failed.push({ query, status: res.status });
        continue;
      }
      const xml = await res.text();
      const items = parseFeedItems(xml, defaultCategory);
      console.log(`[google] "${query}": ${items.length} items`);
      sourceHealth.discovery.succeeded += 1;
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] "${query}": ${err.message}`);
      sourceHealth.discovery.failed.push({ query, error: err.name ?? 'Error' });
    }
  }

  const directFeedByName = new Map(directFeeds.map((feed) => [feed.sourceName, feed]));
  const previousArticles = await loadExistingArticles();
  const fallbackArticles = previousArticles
    .filter((article) => {
      const ageDays = articleAgeDays(article);
      return ageDays >= -(FUTURE_TOLERANCE_HOURS / 24) && ageDays <= FALLBACK_RETENTION_DAYS;
    })
    .map((article) => hydratePreviousArticle(article, directFeedByName));
  allArticles.push(...fallbackArticles);

  if (allArticles.length === 0) {
    throw new Error('全フィード取得失敗。処理を中断します。');
  }

  if (USE_EXPANDED_PROFILE) {
    return curateExpandedArticles(allArticles, {
      fallbackCandidateCount: fallbackArticles.length,
      sourceHealth,
    });
  }

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
  const previousOldArticles = USE_EXPANDED_PROFILE ? await loadExistingOldArticles() : [];
  const mergedOldArticles = USE_EXPANDED_PROFILE
    ? mergeOldArticles(oldArticles.map(stripInternal), previousOldArticles)
    : [];

  const generatedAt = new Date().toISOString();
  const payload = USE_EXPANDED_PROFILE
    ? {
      generatedAt,
      variant: VARIANT,
      profile: 'expanded',
      count: articles.length,
      quality: report,
      articles: articles.map(stripInternal),
    }
    : {
      generatedAt,
      count: articles.length,
      articles: articles.map(stripInternal),
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
        maxOldArticles: MAX_OLD_ARTICLES,
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
