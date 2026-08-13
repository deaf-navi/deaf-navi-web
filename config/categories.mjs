/**
 * カテゴリ定義（国内版）。
 *
 * - CATEGORY_RULES は判定順が仕様。relay → culture → sports の順序は
 *   「デフリンピック文化プログラム」等の誤分類を防ぐため変更しないこと。
 * - id を追加・変更する場合は docs/app/v1（iOSアプリ互換）への影響を
 *   src/app-api-build.mjs 側で必ず確認する。
 */

export const CATEGORY_ORDER = [
  'all', 'policy', 'accessibility', 'medical', 'education', 'technology',
  'culture', 'sports', 'safety', 'event', 'relay', 'local', 'general',
];

export const CATEGORY_UI = {
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

/** モバイルのチップ表示用の短縮ラベル（正式名称は CATEGORY_UI） */
export const CATEGORY_UI_SHORT = {
  all: 'すべて',
  policy: '制度・政策',
  accessibility: '情報保障',
  relay: '電話リレー',
  medical: '医療',
  education: '教育',
  technology: '技術・AI',
  culture: '文化・芸能',
  sports: 'デフスポーツ',
  safety: '防災・安全',
  event: 'イベント',
  local: '地域',
  general: '一般',
};

/** 「すべて」表示から除外するカテゴリ（専用フィルタでのみ表示） */
export const EXCLUDED_FROM_ALL = new Set(['relay']);

/**
 * カテゴリ自動判定ルール。上から順に評価し、最初に一致した id を返す。
 * ここの正規表現・順序は curate.mjs v1 の guessCategory と同一（挙動互換）。
 */
export const CATEGORY_RULES = [
  ['relay', /電話リレー|ヨメテル|文字表示電話|手話リンク|手話フォン|遠隔手話/],
  // culture は最優先（「ろう演劇」「手話映画」等が他カテゴリに誤判定されるのを防ぐ）
  ['culture', /ろう[文劇芸映]|手話[演舞映落狂詩]|デフシアター|ろう映画|ろう芸術|手話パフォーマンス|手話能|手話狂言|手話文学|ろうアーティスト|デフリンピック.*(文化|芸術|プログラム)/],
  // sports は culture の次（「デフリンピック文化プログラム」は culture に流れる）
  ['sports', /デフリンピック|デフスポーツ|デフアスリート|デフ(バスケ|テニス|サッカー|バレー|柔道|剣道|陸上|水泳|ボウリング|ゴルフ|サーフィン|卓球|野球|バドミントン|ラグビー|ハンドボール|フットサル|ホッケー|スケート|スキー|ビリヤード|空手|レスリング)|聴覚障害者スポーツ|ろう者スポーツ|聴障スポーツ|全国ろうあ者体育大会|ろうあ者体育大会|聴覚障害.{0,6}(選手|代表|五輪|金メダル|銀メダル|銅メダル)/],
  ['technology', /ai字幕|自動字幕|リアルタイム字幕|音声認識|音声文字変換|speech.?to.?text|手話翻訳|手話アバター|支援技術|アクセシビリティ技術|アプリ|\bai\b|人工知能/],
  ['safety', /防災|災害|地震|台風|豪雨|避難|避難所|緊急通報|緊急情報|災害情報|119番|110番|消防|警察|救急|アラート/],
  ['accessibility', /情報保障|アクセシビリティ|合理的配慮|バリアフリー|字幕|要約筆記|手話通訳|遠隔通訳|UDCast|UDトーク|窓口対応|コミュニケーション支援/],
  ['event', /手話講座|講座|講演会|セミナー|研修会|勉強会|体験会|交流会|相談会|説明会|見学会|上映会|公演|発表会|フォーラム|シンポジウム|ワークショップ|参加者募集|参加募集|受講者募集|開催案内|申込|申し込み/],
  ['policy', /制度|政策|法律|条例|給付|支援|雇用|助成|補助|手当/],
  ['medical', /医療|病院|治療|手術|補聴器|人工内耳|診断|検査|耳鼻/],
  ['education', /学校|教育|就学|大学|授業|入試|保育|幼稚|研究/],
  ['local', /都|道|府|県|市|区|町|村|地域|地方/],
];

export const DEFAULT_CATEGORY = 'general';

/** 情報源の選定区分（透明性表示） */
export const SOURCE_TIER_UI = {
  official: { label: '一次情報', description: '公式団体・公的機関が発信した情報' },
  specialist: { label: '専門情報', description: '専門団体・専門媒体が発信した情報' },
  news: { label: '報道・発見', description: 'Google News等から発見した報道・公開情報' },
  broad: { label: '関連媒体', description: '関連分野を扱う媒体が発信した情報' },
};
