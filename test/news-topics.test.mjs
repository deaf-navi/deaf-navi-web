import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNewsTopics, sameNewsTopic } from '../src/lib/news-topics.mjs';
import { renderHomePage } from '../src/templates/home.mjs';

const a = (id, title, rest = {}) => ({ id: `https://example.org/${id}`, title, summary: '',
  sourceName: '掲載元', sourceUrl: 'https://example.org', category: 'general', sourceTier: 'news',
  publishedAt: '2026-10-18T10:00:00Z', ...rest });
const headline = '全国中途失聴者・難聴者福祉大会を京都市で開催';

test('topics retain every source and original field while promoting a primary source', () => {
  const news = a('news', headline);
  const official = a('official', headline, { sourceTier: 'official', publishedAt: '2026-10-18T09:00:00Z' });
  const other = a('other', '字幕メガネの新しいサービスを発表');
  const input = [news, other, official], before = structuredClone(input);
  const groups = groupNewsTopics(input);
  assert.deepEqual(input, before);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].lead.id, official.id);
  assert.deepEqual(groups.flatMap(g => g.articles.map(x => x.id)).sort(), input.map(x => x.id).sort());
});

test('separate regions, dates, numbers and announcement/report even for similar headlines', () => {
  assert.equal(sameNewsTopic(a('a', headline, { prefecture: '京都府' }), a('b', headline, { prefecture: '東京都' })), false);
  assert.equal(sameNewsTopic(a('a', headline), a('b', headline, { publishedAt: '2026-10-22T10:00:00Z' })), false);
  assert.equal(sameNewsTopic(a('a', '第3回オンライン手話講座の開催について'), a('b', '第4回オンライン手話講座の開催について')), false);
  assert.equal(sameNewsTopic(a('a', headline, { newsContext: 'announcement' }), a('b', headline, { newsContext: 'report' })), false);
  assert.equal(sameNewsTopic(a('a', headline), a('b', headline, { publishedAt: null })), false);
  assert.equal(sameNewsTopic(a('a', '2026年11月1日 手話カフェ交流会のお知らせ'), a('b', '2026年11月8日 手話カフェ交流会のお知らせ')), false);
  assert.equal(sameNewsTopic(a('a', headline), a('b', headline + ' 中止')), false);
});

test('same visitor and convention are a topic; other events and associated products remain distinct', () => {
  const visit = a('a', '佳子さまが難聴者大会に初出席 共生社会を願う');
  assert.equal(sameNewsTopic(visit, a('b', '佳子さま 京都で中途失聴者・難聴者福祉大会に出席')), true);
  assert.equal(sameNewsTopic(visit, a('b', '佳子さま 全国高校生手話パフォーマンス甲子園に出席')), false);
  assert.equal(sameNewsTopic(visit, a('b', '難聴者大会で新しい字幕アプリを紹介')), false);
  assert.equal(sameNewsTopic(visit, a('b', '佳子さまが難聴者大会に出席', { publishedAt: '2026-10-19T10:00:00Z' })), false);
});

test('unknown region cannot bridge two different confirmed regions', () => {
  const groups = groupNewsTopics([a('a', headline), a('b', headline, { prefecture: '京都府' }), a('c', headline, { prefecture: '東京都' })]);
  assert.equal(groups.length, 2);
});

test('short visitor headlines use specific event evidence, not generic short-title similarity', () => {
  const visit = a('a', '佳子さま 京都で中途失聴者・難聴者福祉大会に出席', { prefecture: '京都府' });
  const short = a('b', '佳子さま、難聴者大会出席');
  assert.equal(sameNewsTopic(visit, short), true);
  assert.equal(sameNewsTopic(visit, { ...short, prefecture: '東京都' }), false);
  assert.equal(sameNewsTopic(visit, { ...short, publishedAt: '2026-10-19T10:00:00Z' }), false);
  assert.equal(sameNewsTopic(visit, { ...short, title: '佳子さま、難聴者大会出席中止' }), false);
  assert.equal(sameNewsTopic(a('c', 'イベントのお知らせ'), a('d', 'イベントのお知らせ')), false);
});

test('photo pages group without treating page number as an event date', () => {
  const prefix = '佳子さま 全国中途失聴者・難聴者福祉大会ご出席 功労者と懇談';
  assert.equal(sameNewsTopic(a('1', prefix + ' [写真特集1/8]'), a('2', prefix + ' [写真特集6/8]')), true);
});

const at = (id, title, publishedAt, rest = {}) => a(id, title, { publishedAt, ...rest });
const appleTv = [
  at('tv1', '実写の手話通訳をストリーミングのネイティブトラックに！Apple TV+、オリジナル作品に「ASL/BSL手話通訳」レイヤー機能を導入', '2026-11-11T09:49:29.000Z'),
  at('tv2', '「Apple TV」が手話通訳に対応、オリジナル映画などから順次展開', '2026-11-11T01:50:00.000Z'),
  at('tv3', '｢Apple TV｣で手話通訳機能が利用可能に——アメリカ手話とイギリス手話に対応', '2026-11-10T22:45:43.000Z'),
  at('tv4', 'Apple TVアプリ、手話通訳に対応。11月13日から利用可能に', '2026-11-10T22:13:15.000Z', { category: 'technology' }),
  at('tv5', 'Apple TV、一部の作品に手話通訳を追加', '2026-11-10T09:08:00.000Z'),
];
const runs = [
  at('run1', '世界陸上・デフリンピックから1年、KK線に2,970人 記念イベント「RUNS:INTO KK」開催', '2026-11-11T07:59:59.000Z'),
  at('run2', '総勢2,970名が熱狂！ 東京2025世界陸上・デフリンピック1周年記念イベント「RUNS：INTO KK」開催（FUNQ）', '2026-11-11T06:22:23.000Z'),
];
const earlyReport = at('run3', '日本一早いマラソンレポート。東京2025世界陸上・東京2025デフリンピック1周年記念イベント「RUNS: INTO KK©」', '2026-11-07T18:22:45.000Z');
const medalist = at('run4', '世界陸上・デフリンピック1周年イベント、銅メダルの勝木隼人「何層にもなった応援は初めてだった」', '2026-11-11T05:00:00.000Z');

test('differently worded coverage of one announcement or held event is one topic, keeping every article', () => {
  const input = [appleTv[0], runs[0], runs[1], ...appleTv.slice(1), earlyReport, medalist], before = structuredClone(input);
  const groups = groupNewsTopics(input);
  assert.deepEqual(input, before);
  const ids = g => g.articles.map(x => x.id).sort();
  assert.deepEqual(groups.map(ids).sort(), [appleTv, runs, [earlyReport], [medalist]].map(g => g.map(x => x.id).sort()).sort());
  assert.deepEqual(groups.flatMap(g => g.articles).sort((x, y) => x.id.localeCompare(y.id)),
    [...input].sort((x, y) => x.id.localeCompare(y.id)));
});

test('the same service, sign language or person alone does not make a rollout topic', () => {
  const [, , languages, dated, added] = appleTv;
  const on = (title, rest) => at('x', title, '2026-11-10T12:00:00.000Z', rest);
  assert.equal(sameNewsTopic(dated, on('Apple TV、手話通訳に対応。11月20日から利用可能に')), false);
  assert.equal(sameNewsTopic(dated, on('Apple TV、手話通訳に対応。11/20から利用可能に')), false);
  assert.equal(sameNewsTopic(dated, on('Apple TV、手話通訳に対応。11/13から利用可能に')), true);
  assert.equal(sameNewsTopic(added, on('Apple TV+『コーダ あいのうた』に手話通訳を追加')), false);
  assert.equal(sameNewsTopic(added, on('Apple TV、手話通訳の支援中止')), false);
  assert.equal(sameNewsTopic(added, on('Apple TV、手話通訳への対応を終了')), false);
  assert.equal(sameNewsTopic(added, on('Netflix、一部の作品に手話通訳を追加')), false);
  assert.equal(sameNewsTopic(added, on('Apple TV+の新作ドラマ、手話通訳者役の俳優を追加発表')), false);
  assert.equal(sameNewsTopic(added, on('Apple TV+でろう者の俳優が主演、手話で演じる新作')), false);
  assert.equal(sameNewsTopic(languages, on('Apple TV、日本手話の手話通訳に対応')), false);
  assert.equal(sameNewsTopic(added, on('Apple TV、一部の作品に手話通訳を追加へ', { publishedAt: '2026-11-13T10:00:00.000Z' })), false);
  assert.equal(sameNewsTopic(added, on('アップルTV＋、手話通訳を一部作品に導入')), true);
});

test('a conflicting rollout date cannot be bridged through an undated headline', () => {
  const other = at('x', 'Apple TV、手話通訳に対応。11月20日から利用可能に', '2026-11-10T12:00:00.000Z');
  for (const input of [[appleTv[4], other, appleTv[3]], [appleTv[3], appleTv[4], other]]) {
    const groups = groupNewsTopics(input);
    assert.equal(groups.length, 2);
    assert.ok(!groups.some(g => g.articles.includes(other) && g.articles.includes(appleTv[3])));
  }
});

test('held-event topics need the same name, year, attendance and phase', () => {
  const [short, long] = runs;
  const on = title => at('x', title, '2026-11-11T08:00:00.000Z');
  assert.equal(sameNewsTopic(short, long), true);
  assert.equal(sameNewsTopic(long, on('総勢２，９７０名が熱狂！ 東京2025世界陸上・デフリンピック1周年記念イベント『RUNS:INTO KK』開催')), true);
  assert.equal(sameNewsTopic(long, on('総勢2970名が熱狂！ 東京2025世界陸上・デフリンピック1周年記念イベント「RUNS:INTO KK」開催')), true);
  assert.equal(sameNewsTopic(short, on('世界陸上・デフリンピックから1年、KK線に3,000人 記念イベント「RUNS:INTO KK」開催')), false);
  assert.equal(sameNewsTopic(short, on('世界陸上・デフリンピックから2年、KK線に2,970人 記念イベント「RUNS:INTO KK」開催')), false);
  assert.equal(sameNewsTopic(long, on('総勢2,970名が熱狂！ 東京2027世界陸上・デフリンピック記念イベント「RUNS:INTO KK」開催')), false);
  assert.equal(sameNewsTopic(long, on('総勢2,970名が熱狂！ 記念イベント「RUNS:INTO KK 2027」開催')), false);
  // A missing attendance is unknown, not agreement.
  assert.equal(sameNewsTopic(long, on('世界陸上・デフリンピックから1年 記念イベント「RUNS:INTO KK」開催')), false);
  assert.equal(sameNewsTopic(long, on('東京2025世界陸上・デフリンピック1周年記念イベント「RUNS:INTO KK」開催へ 2,970人を募集')), false);
  assert.equal(sameNewsTopic(short, on('世界陸上・デフリンピックから1年、KK線に2,970人 記念イベント「RUNS:INTO KK」開催 中止')), false);
  assert.equal(sameNewsTopic(short, medalist), false);
  // The short window is kept even for the same named event.
  assert.equal(sameNewsTopic(long, earlyReport), false);
});

test('explicit contradictions are rejected before the similarity fallback', () => {
  const same = (x, y) => sameNewsTopic(...[x, y].map((title, i) =>
    at(`n${i}`, title, '2026-11-11T08:00:00Z', { sourceName: 'example' })));
  const added = 'Apple TV、一部の作品に手話通訳を追加', run = runs[0].title;
  assert.equal(same('Apple TV、日本手話の手話通訳に対応', 'Apple TV、英国手話の手話通訳に対応'), false);
  assert.equal(same('Apple TV+『コーダ あいのうた』に手話通訳を追加', 'Apple TV+『セヴェランス』に手話通訳を追加'), false);
  assert.equal(same(added, 'Apple TV、一部の作品の手話通訳を廃止'), false);
  assert.equal(same(added, 'Apple TV、一部の作品に手話通訳を追加 提供終了へ'), false);
  assert.equal(same(added, 'Apple TV、一部の作品に手話通訳を追加 不具合も'), false);
  assert.equal(same('Apple TV、手話通訳に対応 オリジナル映画から', 'Apple TV 4K、手話通訳に対応 オリジナル映画から'), false);
  assert.equal(same('Apple TV、手話通訳に対応 オリジナル映画から', '新型Apple TV、手話通訳に対応 オリジナル映画から'), false);
  assert.equal(same('Apple TV 第3世代、手話通訳に対応 オリジナル映画から', 'Apple TV 第4世代、手話通訳に対応 オリジナル映画から'), false);
  assert.equal(same(added, added), true);
  assert.equal(same(run, run + '予定'), false);
  assert.equal(same(run, run + ' 予定'), false);
  assert.equal(same(run, run.replace('開催', '開催へ')), false);
  assert.equal(same(run, '第2回 ' + run), false);
  assert.equal(same(run, run.replace('KK」', 'KK 2027」')), false);
  assert.equal(same(run, run.replace('2,970', '3,000')), false);
  assert.equal(same(run, run), true);
  assert.equal(same(run, '総勢2970名が熱狂！1周年記念イベント RUNS INTO KK 開催'), true);
  // The held-event rule is limited to the confirmed event name.
  assert.equal(same('「DEAF FES TOKYO」開催、手話フェスに2,970人が来場', '総勢2,970名が熱狂！記念イベント「DEAF FES TOKYO」開催'), false);
});

test('digit grouping is one figure; articles without IDs are not the same article', () => {
  assert.equal(sameNewsTopic(a('a', '手話フェスティバルに2,970人が来場しました'), a('b', '手話フェスティバルに2970人が来場しました')), true);
  assert.equal(sameNewsTopic(a('a', '手話フェスティバルに2,970人が来場しました'), a('b', '手話フェスティバルに2,971人が来場しました')), false);
  for (const id of [undefined, null, '']) {
    const x = { ...a('x', headline), id }, y = { ...a('y', '字幕メガネの新しいサービスを発表'), id };
    assert.equal(sameNewsTopic(x, y), false);
    assert.equal(groupNewsTopics([x, y]).length, 2);
  }
});

test('SSR related coverage is accessible without scripts and retains escaped source links', () => {
  const articles = [a('a', headline), a('b', headline, { sourceName: '<script>bad</script>' })];
  const html = renderHomePage({ generatedAt: '2026-10-18', articles }, { now: Date.parse('2026-10-18'), files: {
    articlesJson: 'articles.json', app: 'app.js', styles: 'styles.css', feed: 'feed.xml', about: 'about.html', guide: 'guide.html', oldIndex: 'index-old.html', sitemapHtml: 'sitemap.html',
  } });
  assert.match(html, /<details class="topic-related"><summary>同じ話題の報道 <span>1件<\/span>/);
  assert.ok(html.includes('href="https://example.org/b"'));
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!html.includes('<script>bad</script>'));
  assert.match(html, /id="total-count">1<\/strong>/);
  assert.match(html, /id="news-count-unit">話題/);
  assert.match(html, /最新1話題/);
});
