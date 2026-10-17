import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDomesticPublication, prepareDomesticArchivePublication, prepareWorldPublication } from '../src/lib/publication-quality.mjs';
import { publicationExclusionReason, detectRegion, isNearDuplicate, mergeOldArticles } from '../src/lib/curation.mjs';
import { cleanArticleTitle, cleanSummaryText, normalizeTitleKey } from '../src/lib/text.mjs';
import { selectEditorialNotes } from '../src/lib/editorial.mjs';
import { hasMistranslatedLibras, createTranslationCache } from '../src/lib/world-translation.mjs';
import { isHardNoiseWorldText } from '../src/lib/world-relevance.mjs';
import { newsContext } from '../src/lib/news-context.mjs';

test('news context distinguishes reports without using old dates or report topics', () => {
  for (const title of ['9月20日の学習会', '実態調査の報告に基づく学習会', '開催報告会', '参加者募集終了']) {
    assert.equal(newsContext({ title }), null, title);
  }
  assert.equal(newsContext({title:'【開催報告】手話の集い'}),'report');
  assert.equal(newsContext({title:'学習会',summary:'手話の学習会を開催しました。'}),'report');
  assert.equal(newsContext({title:'手話の集い 開催のお知らせ'}),'announcement');
  assert.equal(newsContext({title:'学習会',summary:'昨年は講座を開催しました。今年も講座を開催します。'}),null);
  assert.equal(newsContext({id:'http://zentsuken.cocolog-nifty.com/blog/2026/10/post-f151b2.html',title:'9月20日の学習会'}),'report');
});

test('explicit unrelated notices do not inherit a community feed exemption', () => {
  const trusted={_passThrough:true,_feedUrl:'https://example.org/feed',_sourceTier:'official'};
  assert.equal(publicationExclusionReason({...trusted,title:'【視覚部門】音訳奉仕員養成講習会について',summary:'音訳の講習会'}),'unrelated-visual-section');
  assert.equal(publicationExclusionReason({...trusted,title:'【視覚部門】情報センターだより10月号',summary:'視覚部門のお知らせ'}),null);
  assert.equal(publicationExclusionReason({...trusted,title:'【視覚部門】盲ろう者の情報保障を学ぶ',summary:''}),null);
  assert.equal(publicationExclusionReason({title:'妻が親族チャットにボーナス自慢、義母から「補聴器代出せ」と要求',summary:''}),'incidental-hearing-keyword');
  for(const title of ['補聴器購入費助成制度の実現を','難聴の当事者が家族との暮らしを語る','【視覚部門】手話通訳付き交流会'])assert.equal(publicationExclusionReason({...trusted,title,summary:''}),null,title);
});

test('syndicated wrappers and typographic variants merge, but dates, areas and numbers remain distinct', () => {
  const article=(id,title,extra={})=>({id,title,summary:'',publishedAt:'2026-10-16T00:00:00Z',...extra});
  assert.equal(isNearDuplicate(article('a','聴覚障害者向け「NET119」不正アクセスで情報漏えいか 石川・能美市消防本部'),article('b','聴覚障害者向け「NET119」不正アクセスで情報漏えいか 石川・能美市の消防')),true);
  assert.equal(isNearDuplicate(article('a','手話で接客「ありがとう」 ろう・難聴の３人が挑戦〈平塚市・大磯町・二宮町・中井町〉'),article('b','手話で接客｢ありがとう｣ ろう・難聴の３人が挑戦 平塚市・大磯町・二宮町・中井町')),true);
  assert.equal(isNearDuplicate(article('a','障スポ会場に移動手話交番、青森県警が設置 警察官ら8人が勤務へ'),article('b','障スポ会場に移動手話交番、青森県警が設置 警察官ら8人が勤務へ（朝日新聞）')),true);
  assert.equal(isNearDuplicate(article('a','手話講座（大阪会場）'),article('b','手話講座（京都会場）')),false);
  assert.equal(isNearDuplicate(article('a','第３回 手話でつながる市民交流会の開催について'),article('b','第４回 手話でつながる市民交流会の開催について')),false);
  assert.equal(isNearDuplicate(article('a','手話交流会'),article('b','手話交流会',{publishedAt:'2026-10-23T00:00:00Z'})),false);
  assert.equal(isNearDuplicate(article('a','手話交流会',{prefecture:'東京都'}),article('b','手話交流会',{prefecture:'神奈川県'})),false);
});

test('regional matching prefers complete city names and leaves ambiguous locations unset', () => {
  assert.deepEqual(detectRegion('大津市の手話イベント', ''), { region: 'kinki', prefecture: '滋賀県' });
  assert.deepEqual(detectRegion('津市の手話教室', ''), { region: 'kinki', prefecture: '三重県' });
  assert.equal(detectRegion('草津市の講座', ''), null);
  assert.deepEqual(detectRegion('滋賀県大津市で開催', '東京都の団体も参加'), { region: 'kinki', prefecture: '滋賀県' });
  assert.equal(detectRegion('東京都と大阪府で開催', ''), null);
});

test('publication gate rejects placeholders even from trusted feeds, but retains community notices and useful technology', () => {
  assert.equal(publicationExclusionReason({ title: '工事中', _passThrough: true }), 'placeholder');
  assert.equal(publicationExclusionReason({ title: '消防職員の水泳指導', summary: '', _sourceTier: 'official' }), 'unrelated');
  assert.equal(publicationExclusionReason({ title: 'デフレ対策の講演会', summary: '' }), 'unrelated');
  assert.equal(publicationExclusionReason({ title: '定例会報告', _passThrough: true }), null);
  assert.equal(publicationExclusionReason({ title: '社会生活教室', _sourceTier: 'official', _feedUrl: 'https://example.org/feed' }), null);
  for (const title of ['サインエールの受賞', 'みみカレッジ2026', '音声認識でライブ字幕を表示', '日本語字幕付き上映', 'UDCast対応']) {
    assert.equal(publicationExclusionReason({ title, summary: '' }), null, title);
  }
  assert.equal(publicationExclusionReason({ title: '補聴器の世界市場規模・予測レポート' }), 'market-report');
});

test('syndicated titles are cleaned without deleting meaningful parenthetical text; distinct events remain', () => {
  assert.equal(cleanSummaryText('NPRの番組が聴力の課題を扱う', 'NPRの番組が聴力の課題を扱う', 'NPR'), '');
  assert.equal(cleanArticleTitle('手話の集い（共同通信） - Yahoo!ニュース', 'Yahoo!ニュース'), '手話の集い');
  assert.equal(cleanArticleTitle('手話の集い（大阪会場）'), '手話の集い（大阪会場）');
  const a = { id: 'a', title: '手話の集い', _dedupeKey: normalizeTitleKey('手話の集い'), publishedAt: '2026-10-01' };
  assert.equal(isNearDuplicate(a, { ...a, id: 'b', publishedAt: '2026-10-10' }), false);
  assert.equal(isNearDuplicate({ ...a, prefecture: '大阪府' }, { ...a, id: 'b', prefecture: '京都府' }), false);
});

test('saved domestic snapshots are rechecked idempotently with retained IDs and dates', () => {
  const articles = [
    { id: 'https://example.org/a', title: '工事中', sourceName: '全日本ろうあ連盟', sourceTier: 'official', publishedAt: '2026-10-15T00:00:00Z' },
    { id: 'https://example.org/b', title: '大津市の手話講座', summary: '', sourceName: '地域新聞', sourceTier: 'news', region: 'chubu', prefecture: '三重県', publishedAt: '2026-10-15T00:00:00Z' },
  ];
  const before = { generatedAt: '2026-10-16T00:00:00Z', count: 2, articles };
  const after = prepareDomesticPublication(before);
  assert.equal(before.articles.length, 2);
  assert.equal(after.count, 1);
  assert.equal(after.generatedAt, before.generatedAt);
  assert.equal(after.articles[0].id, articles[1].id);
  assert.equal(after.articles[0].prefecture, '滋賀県');
  assert.equal(after.publicationReview.removed[0].reason, 'placeholder');
  assert.equal(prepareDomesticPublication(after), after);
});

test('World distinguishes entertainment headphones from Bluetooth hearing aids', () => {
  assert.equal(isHardNoiseWorldText('Audífonos para gaming con cancelación de ruido'), true);
  assert.equal(isHardNoiseWorldText('Audífonos Bluetooth para personas con pérdida auditiva'), false);
  assert.equal(isHardNoiseWorldText('Audífonos Bluetooth'), false);
});

test('poster acknowledgements do not inherit relevance from the thanked association', () => {
  const title = '八千代市聴覚障害者協会 様 ポスター報告 by 総勢500人の出演者が集うハワイアンショーを大成功させたい';
  assert.equal(publicationExclusionReason({ title, summary: title }), 'incidental-organization-mention');
  assert.equal(publicationExclusionReason({ title, summary: '全公演に手話通訳と字幕を提供します。' }), null);
  assert.equal(publicationExclusionReason({ title: '市民ホール 様 ポスター報告 by ろう者の手話劇公演を成功させたい' }), null);
  const saved = { generatedAt: '2026-10-18T00:00:00Z', count: 1, articles: [{ id: 'poster', title, summary: '' }] };
  assert.equal(prepareDomesticPublication(saved).count, 0);
});

test('archive removes explicit mismatches without treating missing keywords as proof or rewriting history', () => {
  const articles = [
    { id: 'visual', title: '【視覚部門】サピエ図書館メンテナンスについて', summary: '' },
    { id: 'access', title: '【視覚部門】盲ろう者向け手話講座', summary: '' },
    { id: 'neutral', title: '社会生活教室', summary: '', publishedAt: '2026-07-01' },
  ];
  const saved = { generatedAt: '2026-10-18T00:00:00Z', count: 3, articles };
  const after = prepareDomesticArchivePublication(saved);
  assert.equal(after.count, 2);
  assert.deepEqual(after.articles, articles.slice(1));
  assert.equal(after.generatedAt, saved.generatedAt);
  assert.equal(prepareDomesticArchivePublication(after), after);
  assert.deepEqual(new Set(mergeOldArticles([], articles).map(a => a.id)), new Set(['access', 'neutral']));
});

test('World cached unrelated articles cannot reappear on rebuild; original access reporting stays', () => {
  const saved = { generatedAt: '2026-10-18T00:00:00Z', count: 2, articles: [
    { id: 'audio', originalTitle: 'Soundcore: qué ofrecen sus nuevos audífonos premium', title: '新しい補聴器', summary: '' },
    { id: 'aid', originalTitle: 'Audífonos para personas sordas', title: 'ろう者向け補聴器', summary: '' },
  ] };
  const after = prepareWorldPublication(saved);
  assert.deepEqual(after.articles, saved.articles.slice(1));
  assert.equal(after.generatedAt, saved.generatedAt);
  assert.equal(prepareWorldPublication(after), after);
});

test('Libras mistranslations are not reused in translation caches or published snapshots', () => {
  const article = { id: 'a', originalTitle: 'Homem surdo ensina Libras', originalSummary: 'Homem surdo ensina Libras', title: 'ろう者が天秤座を教える', summary: 'ろう者が天秤座を教える', curationScore: 12 };
  assert.equal(hasMistranslatedLibras(article.originalTitle, article.title), true);
  assert.equal(hasMistranslatedLibras('Libras esterlinas na educação', '教育分野の英ポンド'), false);
  assert.equal(createTranslationCache([article]).articles.size, 0);
  const result = prepareWorldPublication({ articles: [article], count: 1 });
  assert.equal(result.count, 0);
  assert.equal(result.publicationReview.removed[0].reason, 'translation-review');
  assert.equal(prepareWorldPublication(result), result);
});

test('editorial requires a valid source and finite review window; expired/future notes do not publish', () => {
  const note = { id: 'a', title: '見出し', text: '本文', sourceName: '公式', sourceUrl: 'https://example.org/news', reviewedAt: '2026-10-16T00:00:00Z', expiresAt: '2026-10-23T00:00:00Z' };
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-16')).length, 1);
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-23')).length, 0);
  assert.equal(selectEditorialNotes([note], Date.parse('2026-10-15')).length, 0);
  assert.equal(selectEditorialNotes([{ ...note, sourceUrl: 'javascript:alert(1)' }], Date.parse('2026-10-17')).length, 0);
  assert.equal(selectEditorialNotes([{ ...note, expiresAt: '2027-10-23' }], Date.parse('2026-10-17')).length, 0);
});
