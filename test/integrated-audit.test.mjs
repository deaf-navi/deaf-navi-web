import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitUnrelatedReason, classifyCategory } from '../src/lib/curation.mjs';
import { cleanArticleTitle, cleanSummaryText } from '../src/lib/text.mjs';
import { isHardNoiseWorldText } from '../src/lib/world-relevance.mjs';
import { polishJapaneseWithSource } from '../src/lib/world-translation.mjs';
import { prepareWorldPublication } from '../src/lib/publication-quality.mjs';
import { groupNewsTopics } from '../src/lib/news-topics.mjs';

test('appearance-only nicknames and unsupported health claims do not suppress lived-experience or evidence reporting', () => {
  const reason = title => explicitUnrelatedReason({ title });
  assert.equal(reason('補聴器つけた天使、ピタピタミニ丈に反響'), 'incidental-disability-nickname');
  assert.equal(reason('補聴器をつけた天使、いじめや葛藤を乗り越え活動'), null);
  assert.notEqual(classifyCategory('補聴器をつけた天使、いじめや葛藤を乗り越え活動', ''), 'medical');
  assert.equal(classifyCategory('人工内耳の手術と診断について', ''), 'medical');
  assert.equal(reason('耳鳴りや難聴を軽減するツボ'), 'health-claim-evidence-required');
  assert.equal(reason('難聴に効くツボ？臨床試験で検証'), null);
  assert.equal(reason('難聴のある政治家が支援制度を提案'), null);
});

test('foreign editions require contextual review; unrelated host substrings and domestic coverage remain', () => {
  const base = { title: 'ハノイの手話カフェ', sourceUrl: 'https://www.vietnam.vn' };
  assert.equal(explicitUnrelatedReason(base), 'foreign-coverage-review-required');
  assert.equal(explicitUnrelatedReason({ ...base, title: '日本の手話カフェを紹介' }), null);
  assert.equal(explicitUnrelatedReason({ ...base, sourceUrl: 'https://vietnam.vn.example.org' }), null);
  assert.equal(explicitUnrelatedReason({ ...base, sourceUrl: 'https://media.unisba.ac.id' }), 'unverified-republished-source');
});

test('a Spanish surname alone is noise, but actual Deaf reporting involving that person remains', () => {
  for (const title of ['Sordo (CCOO) reclama reformas', 'Sordo y Álvarez proponen cambios', 'Unai Sordo habla de empleo', 'UNAI SORDO habla de empleo']) {
    assert.equal(isHardNoiseWorldText(title), true, title);
    assert.equal(isHardNoiseWorldText(title + ': intérpretes de lengua de signos para sordos'), false);
  }
  assert.equal(isHardNoiseWorldText('Equipo de béisbol para sordos'), false);
});

test('Korean source corrections preserve unrelated Japanese and original source/provenance', () => {
  const source = '전주시정 시정·생활 정보 수어영상';
  assert.equal(polishJapaneseWithSource(source, '全州是正の是正・生活情報受語映像'), '全州市政の市政・生活情報手話動画');
  assert.equal(polishJapaneseWithSource('청각장애인 수어 영상', 'スア映像'), '手話動画');
  assert.equal(polishJapaneseWithSource('手語映像', '手語映像'), '手語映像');
  assert.equal(polishJapaneseWithSource('環境問題', '是正措置'), '是正措置');
  const article = { id: 'fixture', title: 'スア映像', summary: 'スア映像', originalTitle: source, originalSummary: source,
    japanesePostEditEngine: 'google', publishedAt: '2026-10-22T00:00:00Z' };
  const result = prepareWorldPublication({ generatedAt: '2026-10-23T00:00:00Z', articles: [article] });
  assert.equal(result.articles[0].title, '手話動画');
  assert.equal(result.articles[0].originalTitle, source);
  assert.equal(result.articles[0].japanesePostEditEngine, 'google');
  assert.equal(result.generatedAt, '2026-10-23T00:00:00Z');
  assert.equal(article.title, 'スア映像');
});

test('specific syndicated headlines group across days without deleting sources or recurring events', () => {
  const a = { id: 'a', title: '誰もがコミュニケーションを取れるような職場へ 日本管財環境サービスの日野事業所が社内研修「手話講座」を開催',
    sourceName: 'PR TIMES', publishedAt: '2026-10-23T00:00:00Z' };
  const b = { ...a, id: 'b', sourceName: '時事通信', publishedAt: '2026-10-26T01:00:00Z' };
  assert.equal(groupNewsTopics([a, b]).length, 1);
  assert.equal(groupNewsTopics([a, b])[0].articles.length, 2);
  assert.equal(groupNewsTopics([a, { ...b, publishedAt: '2026-11-10T00:00:00Z' }]).length, 2);
  assert.equal(groupNewsTopics([a, { ...b, prefecture: '大阪府' }, { ...a, id: 'c', prefecture: '東京都' }]).length, 2);
  assert.equal(groupNewsTopics([{ ...a, title: '定例手話カフェ' }, { ...b, title: '定例手話カフェ' }]).length, 2);
});

test('feed furniture and mixed-width dates are cleaned without inventing missing text', () => {
  assert.equal(cleanArticleTitle('ニュース :: 【2026年1２月開催】社会生活教室 –'), '【2026年12月開催】社会生活教室');
  assert.equal(cleanSummaryText('本文の説明。 続きを読む ›', '別題'), '本文の説明。');
  assert.equal(cleanSummaryText('同じ題名', '同じ題名'), '');
  assert.equal(cleanSummaryText('団体名の途中 […]', '別題'), '団体名の途中…');
});
