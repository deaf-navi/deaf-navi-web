// Only sources with a verified article body/date layout are eligible.
export const EDITORIAL_POLICY = Object.freeze({
  maxAgeMs: 7 * 86400000,
  recheckWithinMs: 24 * 3600000,
  maxCandidates: 6,
  budgetMs: 45000,
});

export const EDITORIAL_SOURCES = Object.freeze([
  { host: 'www.jfd.or.jp', name: '全日本ろうあ連盟', path: /^\/20\d{2}\/\d{2}\/\d{2}\/pid\d+\/?$/, layout: 'jfd' },
  { host: 'www.jyoubun-center.or.jp', name: '聴力障害者情報文化センター', path: /^\/[^/]+\/$/, layout: 'swell' },
  { host: 'shigajou.or.jp', name: '滋賀県立聴覚障害者センター', path: /^\/info\/[^/]+\.html$/, layout: 'entry' },
  { host: 'www.sapporo-deaf.jp', name: '札幌聴覚障害者協会', path: /^\/information\/[^/]+\/$/, layout: 'entry' },
]);
