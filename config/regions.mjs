/**
 * 地域判定の定義（2.0 新規）。
 *
 * 記事タイトル・要約から都道府県を推定し、地域フィルタに使う。
 * 判定はあくまで補助情報であり、iOSアプリ連携JSONには影響しない
 * （src/app-api-build.mjs は region 系フィールドを国内記事から出力しない）。
 */

export const REGION_ORDER = [
  'hokkaido_tohoku', 'kanto', 'chubu', 'kinki',
  'chugoku_shikoku', 'kyushu_okinawa', 'nationwide',
];

export const REGION_UI = {
  hokkaido_tohoku: '北海道・東北',
  kanto: '関東',
  chubu: '中部',
  kinki: '近畿',
  chugoku_shikoku: '中国・四国',
  kyushu_okinawa: '九州・沖縄',
  nationwide: '全国・その他',
};

/**
 * 都道府県 → 地域ブロック。
 * matchers は「この語が含まれたらその都道府県」とみなす表記ゆれ一覧。
 * 誤検出しやすい短い語（例:「東京」以外の「京」など）は入れない。
 */
export const PREFECTURES = [
  { name: '北海道', region: 'hokkaido_tohoku', matchers: ['北海道', '札幌'] },
  { name: '青森県', region: 'hokkaido_tohoku', matchers: ['青森県', '青森市'] },
  { name: '岩手県', region: 'hokkaido_tohoku', matchers: ['岩手県', '盛岡'] },
  { name: '宮城県', region: 'hokkaido_tohoku', matchers: ['宮城県', '仙台'] },
  { name: '秋田県', region: 'hokkaido_tohoku', matchers: ['秋田県', '秋田市'] },
  { name: '山形県', region: 'hokkaido_tohoku', matchers: ['山形県', '山形市'] },
  { name: '福島県', region: 'hokkaido_tohoku', matchers: ['福島県', '福島市', '郡山'] },
  { name: '茨城県', region: 'kanto', matchers: ['茨城県', '水戸'] },
  { name: '栃木県', region: 'kanto', matchers: ['栃木県', '宇都宮'] },
  { name: '群馬県', region: 'kanto', matchers: ['群馬県', '前橋'] },
  { name: '埼玉県', region: 'kanto', matchers: ['埼玉県', 'さいたま市'] },
  { name: '千葉県', region: 'kanto', matchers: ['千葉県', '千葉市'] },
  { name: '東京都', region: 'kanto', matchers: ['東京都', '東京23区', '都内'] },
  { name: '神奈川県', region: 'kanto', matchers: ['神奈川県', '横浜', '川崎市', '相模原'] },
  { name: '新潟県', region: 'chubu', matchers: ['新潟県', '新潟市'] },
  { name: '富山県', region: 'chubu', matchers: ['富山県', '富山市'] },
  { name: '石川県', region: 'chubu', matchers: ['石川県', '金沢'] },
  { name: '福井県', region: 'chubu', matchers: ['福井県', '福井市'] },
  { name: '山梨県', region: 'chubu', matchers: ['山梨県', '甲府'] },
  { name: '長野県', region: 'chubu', matchers: ['長野県', '長野市', '松本市'] },
  { name: '岐阜県', region: 'chubu', matchers: ['岐阜県', '岐阜市'] },
  { name: '静岡県', region: 'chubu', matchers: ['静岡県', '静岡市', '浜松'] },
  { name: '愛知県', region: 'chubu', matchers: ['愛知県', '名古屋'] },
  { name: '三重県', region: 'kinki', matchers: ['三重県', '津市', '四日市'] },
  { name: '滋賀県', region: 'kinki', matchers: ['滋賀県', '大津'] },
  { name: '京都府', region: 'kinki', matchers: ['京都府', '京都市'] },
  { name: '大阪府', region: 'kinki', matchers: ['大阪府', '大阪市', '堺市'] },
  { name: '兵庫県', region: 'kinki', matchers: ['兵庫県', '神戸', '姫路'] },
  { name: '奈良県', region: 'kinki', matchers: ['奈良県', '奈良市'] },
  { name: '和歌山県', region: 'kinki', matchers: ['和歌山'] },
  { name: '鳥取県', region: 'chugoku_shikoku', matchers: ['鳥取'] },
  { name: '島根県', region: 'chugoku_shikoku', matchers: ['島根県', '松江'] },
  { name: '岡山県', region: 'chugoku_shikoku', matchers: ['岡山県', '岡山市', '倉敷'] },
  { name: '広島県', region: 'chugoku_shikoku', matchers: ['広島県', '広島市'] },
  { name: '山口県', region: 'chugoku_shikoku', matchers: ['山口県', '山口市', '下関'] },
  { name: '徳島県', region: 'chugoku_shikoku', matchers: ['徳島'] },
  { name: '香川県', region: 'chugoku_shikoku', matchers: ['香川県', '高松市'] },
  { name: '愛媛県', region: 'chugoku_shikoku', matchers: ['愛媛県', '松山市'] },
  { name: '高知県', region: 'chugoku_shikoku', matchers: ['高知'] },
  { name: '福岡県', region: 'kyushu_okinawa', matchers: ['福岡県', '福岡市', '北九州'] },
  { name: '佐賀県', region: 'kyushu_okinawa', matchers: ['佐賀'] },
  { name: '長崎県', region: 'kyushu_okinawa', matchers: ['長崎'] },
  { name: '熊本県', region: 'kyushu_okinawa', matchers: ['熊本'] },
  { name: '大分県', region: 'kyushu_okinawa', matchers: ['大分県', '大分市'] },
  { name: '宮崎県', region: 'kyushu_okinawa', matchers: ['宮崎県', '宮崎市'] },
  { name: '鹿児島県', region: 'kyushu_okinawa', matchers: ['鹿児島'] },
  { name: '沖縄県', region: 'kyushu_okinawa', matchers: ['沖縄', '那覇'] },
];
