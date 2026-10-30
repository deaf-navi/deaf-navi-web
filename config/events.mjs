export const EVENT_KINDS = { exchange: '交流・体験', course: '講座・学習', theater: '手話劇・演劇', culture: '公演・文化', other: 'その他' };
export const EVENT_RECHECK_MS = 48 * 60 * 60 * 1000;
export const EVENT_COMMUNICATION = {
  sign: '手話による案内・表現',
  interpretation: '手話通訳',
  captions: '字幕',
  summary: '要約筆記',
  writing: '筆談',
  loop: 'ヒアリングループ',
};
export const EVENT_SOURCES = [
  { id: 'oioi', name: '手話エンターテイメント発信団 oioi', url: 'https://www.oioi-sign.com/events_list/', adapter: 'oioi-schedule' },
];
