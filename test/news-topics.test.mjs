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

test('photo pages group without treating page number as an event date', () => {
  const prefix = '佳子さま 全国中途失聴者・難聴者福祉大会ご出席 功労者と懇談';
  assert.equal(sameNewsTopic(a('1', prefix + ' [写真特集1/8]'), a('2', prefix + ' [写真特集6/8]')), true);
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
