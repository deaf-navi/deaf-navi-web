import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWorldPublication,prepareDomesticPublication,prepareDomesticArchivePublication} from '../src/lib/publication-quality.mjs';
import {isWeakJapaneseTranslation, createTranslationCache} from '../src/lib/world-translation.mjs';
import {isHardNoiseWorldText} from '../src/lib/world-relevance.mjs';
import {explicitUnrelatedReason} from '../src/lib/curation.mjs';
import {sameNewsTopic} from '../src/lib/news-topics.mjs';
import {worldLocation} from '../src/lib/world-location.mjs';
import {mergePublicationLedger, mergePublicationLedgers, sourceFingerprint, translationFingerprint} from '../src/lib/publication-ledger.mjs';

test('lowercase Libras and pound transliteration cannot survive publication or cache reuse', () => {
  const original = 'Pioneirismo na inclusão: crianças da educação infantil criam coral de libras em São Sebastião';
  const a = {id:'libras-fixture', originalTitle:original, originalSummary:original, title:'幼児教育の子どもたちがパウンド合唱団を結成', summary:'パウンド合唱団'};
  assert.equal(isWeakJapaneseTranslation(original,a.title),true);
  assert.equal(createTranslationCache([a]).articles.size,0);
  assert.equal(prepareWorldPublication({articles:[a]}).articles.length,0);
  assert.equal(isWeakJapaneseTranslation('Libras esterlinas na educação','教育費を英ポンドで支払う'),false);
});

test('a known clinical mistranslation is held rather than automatically rewritten', () => {
  const a={id:'medical-fixture', originalTitle:'청신경 아예 안 보이는 선천성 난청이라도 인공와우 수술로 청각 발달 가능성', originalSummary:'청신경과 인공와우 연구', title:'青神経が見えなくても人工内耳手術で聴覚発達の可能性', summary:'青神経と人工内耳の研究'};
  assert.equal(isWeakJapaneseTranslation(a.originalTitle,a.title),true);
  assert.equal(prepareWorldPublication({articles:[a]}).articles.length,0);
  assert.equal(isWeakJapaneseTranslation('청신경 연구','聴神経の研究'),false);
  assert.equal(isWeakJapaneseTranslation('The character 青神経','架空の登場人物「青神経」'),false);
});

test('a hold survives rebuild, refetch and changed machine translation; approval binds exact content', () => {
  const article={id:'held-fixture',originalTitle:'청신경 연구',originalSummary:'청신경 연구',title:'青神経の研究',summary:'青神経の研究'};
  const input={articles:[article]};
  const filtered=prepareWorldPublication(input);
  const ledger=mergePublicationLedger(undefined,input,filtered,{now:'2026-10-29T00:00:00Z'});
  assert.equal(ledger.entries[0].article.originalTitle,article.originalTitle);
  assert.deepEqual(mergePublicationLedger(ledger,filtered,filtered),ledger,'hold kept when feed no longer contains item');
  const repaired={...article,title:'聴神経の研究',summary:'聴神経の研究'};
  assert.equal(prepareWorldPublication({articles:[repaired]},{ledger}).count,0);
  assert.equal(prepareWorldPublication({articles:[{...repaired,id:'new-feed-id'}]},{ledger}).count,0,'a changed feed ID does not clear the same-source hold');
  const approved={entries:[{...ledger.entries[0],status:'approved',reviewedBy:'human',reviewedAt:'2026-10-29T01:00:00Z',sourceFingerprint:sourceFingerprint(repaired),translationFingerprint:translationFingerprint(repaired)}]};
  assert.equal(prepareWorldPublication({articles:[repaired]},{ledger:approved}).articles.length,1);
  assert.equal(prepareWorldPublication({articles:[{...repaired,summary:'別の訳文'}]},{ledger:approved}).count,0);
});
test('workflow recovery unions holds and preserves conflicting source evidence',()=>{
 const a={id:'same',status:'held',reason:'translation-review',article:{id:'same',originalTitle:'Source',title:'old'}};
 const b={id:'same',status:'approved',reviewedBy:'human',article:{id:'same',originalTitle:'Source',title:'new'}};
 const result=mergePublicationLedgers({entries:[a,{...a,id:'remote-only'}]},{entries:[b,{...a,id:'local-only'}]});
 assert.equal(result.entries.length,3);assert.equal(result.entries[0].status,'held');assert.equal(result.entries[0].observations[0].title,'new');
 assert.deepEqual(mergePublicationLedgers(result,result),result);
});
test('human approval survives source-grounded polishing and preserves audit history when expired',()=>{
 const raw={id:'polish',originalTitle:'전주시정 수어 영상 제공',originalSummary:'전주시정 수어 영상 제공',title:'全州是正スア映像の提供',summary:'全州是正スア映像の提供'};
 const approval={id:raw.id,status:'approved',reason:'translation-review',reviewedBy:'human',reviewedAt:'2026-10-29T00:00:00Z',sourceFingerprint:sourceFingerprint(raw),translationFingerprint:translationFingerprint(raw),article:raw};
 const ledger={version:1,entries:[approval]},once=prepareWorldPublication({articles:[raw]},{ledger});
 assert.equal(once.articles.length,1);assert.equal(prepareWorldPublication(once,{ledger}).articles.length,1);
 const changed={...raw,originalTitle:'別の原文',title:'別の訳文'};const result=prepareWorldPublication({articles:[changed]},{ledger});
 const saved=mergePublicationLedger(ledger,{articles:[changed]},result);
 assert.equal(saved.entries[0].reviewHistory[0].reviewedAt,approval.reviewedAt);
 assert.equal(saved.entries[0].originalReason,'translation-review');
 const conflict=mergePublicationLedgers(saved,ledger);
 assert.equal(conflict.entries[0].reviewHistory[0].reviewedAt,approval.reviewedAt);
 assert.deepEqual(mergePublicationLedgers(conflict,ledger),conflict);
 const invalid={entries:[{...approval,reviewedAt:'invalid-date'}]};
 assert.equal(prepareWorldPublication({articles:[raw]},{ledger:invalid}).articles.length,0);
});
test('a canonical human correction replaces refetched machine text but never a changed source',()=>{
 const raw={id:'correction-fixture',originalTitle:'청신경 연구',originalSummary:'청신경 연구',title:'青神経の研究',summary:'青神経の研究'};
 const corrected={...raw,title:'聴神経の研究',summary:'聴神経の研究'};
 const ledger={entries:[{id:raw.id,status:'approved',reviewedBy:'human',reviewedAt:'2000-01-01T00:00:00Z',sourceFingerprint:sourceFingerprint(corrected),translationFingerprint:translationFingerprint(corrected),article:corrected}]};
 const result=prepareWorldPublication({articles:[raw]},{ledger});assert.equal(result.articles[0].title,corrected.title);assert.equal(result.articles[0].japanesePostEditEngine,'human-review');
 assert.equal(prepareWorldPublication(result,{ledger}).articles[0].title,corrected.title);
 assert.equal(prepareWorldPublication({articles:[{...raw,originalSummary:'別の研究'}]},{ledger}).articles.length,0);
 assert.equal(prepareWorldPublication({articles:[]},{ledger}).articles.length,0);
});
test('location matching respects Unicode boundaries and ambiguous names',()=>{
 for(const title of ['Sordos en Perú','Personnes sourdes au Canadá','Deaf people in the U.S.','Deaf festival in Bogotá'])assert.equal(worldLocation({originalTitle:title}).region,'americas',title);
 for(const title of ['La escuela usa lengua de señas','Sydney is a deaf actor','Israel sings in sign language','アメリカ手話の入門','مصرف لغة الإشارة'])assert.equal(worldLocation({originalTitle:title}).region,'unknown',title);
 for(const title of ['Sourds au Maroc بالمغرب','الصم في بورسعيد','手話の催し الجونة'])assert.equal(worldLocation({originalTitle:title}).region,'middle_east_africa',title);
 assert.equal(worldLocation({originalTitle:'La Provincia promueve el uso de la Lengua de Señas Argentina'}).region,'unknown');
});
test('location confirmation binds source material and survives a rebuild',()=>{
 const article={id:'review-fixture',originalTitle:'Sign language at Campus Z',originalSummary:'Campus Z'};
 const reviews=[{id:article.id,region:'asia_oceania',reviewedBy:'human',reviewedAt:'2000-01-01T00:00:00Z',sourceFingerprint:sourceFingerprint(article),evidence:'Campus Z'}];
 assert.equal(worldLocation(article,{reviews}).regionEvidence.status,'reviewed');
 assert.equal(worldLocation({...article,originalTitle:'A different campus'},{reviews}).region,'unknown');
 assert.equal(worldLocation(article,{reviews:reviews.map(x=>({...x,reviewedBy:'AI'}))}).region,'unknown');
});
test('domestic holds also survive current and archive publication gates',()=>{
 const a={id:'domestic-held',title:'手話の講座',summary:'手話の講座',sourceName:'全日本ろうあ連盟',sourceUrl:'https://www.jfd.or.jp/',publishedAt:'2026-10-29T00:00:00Z'};
 const ledger={entries:[{id:a.id,status:'held',reason:'review-required',sourceFingerprint:sourceFingerprint(a)}]};
 for(const prepare of [prepareDomesticPublication,prepareDomesticArchivePublication]){
  const result=prepare({articles:[a]},{ledger});assert.equal(result.articles.length,0);assert.equal(result.publicationReview.removed[0].reason,'review-required');
 }
});
test('source-checked subtitle and shop false positives retain accessibility positives',()=>{
 const titles=['Vijay Deverakonda Responds To Trolls After Koffee With Karan Appearance: Needs Subtitles','Entraste a TikTok para pasar el tiempo y saliste con unos audífonos en camino: así crece su tienda en México'];
 for(const title of titles){assert.equal(isHardNoiseWorldText(title),true);assert.equal(isHardNoiseWorldText(title+' — accessibility for deaf people'),false);}
 for(const title of ['Mejores audífonos: los nominados en los Premios Xataka México 2026','Sony y Sanrio presentan edición especial de audífonos con Hello Kitty']){assert.equal(isHardNoiseWorldText(title),true);assert.equal(isHardNoiseWorldText(title+' para personas sordas'),false);}
 const suspect=[['المعرفة الشرعية بلغة الإشارة','手話の法的知識'],['niños sordos cuando falla la comunicación','通信障害が発生した聴覚障害の子ども'],['Les Montalbanais sourds','聴覚障害のモンタルバニアの人々']];
 for(const [originalTitle,title]of suspect)assert.equal(prepareWorldPublication({articles:[{id:originalTitle,originalTitle,title}]}).articles.length,0);
 assert.equal(prepareWorldPublication({articles:[{id:'program',originalTitle:'programa São Paulo São Libras',title:'サンリングア・ブラジレイラ・デ・シナイプログラム'}]}).articles.length,0);
 assert.equal(prepareWorldPublication({articles:[{id:'source-context',originalTitle:'Hearing Loss, News Breakdown, Science Latest, Travel Ideas, Mighty Challenge',title:'難聴、ニュースの内訳、科学の最新情報'}]}).publicationReview.removed[0].reason,'source-context-review');
});

test('consumer collaborations are noise but deaf entertainment and accessible audio stay', () => {
  assert.equal(isHardNoiseWorldText('Sony y Hello Kitty llegan a Colombia con audífonos de edición limitada'),true);
  for(const text of ['Sony desarrolla audífonos para personas sordas','Hello Kitty ofrece lengua de señas','Sordos participan en un festival de música']) assert.equal(isHardNoiseWorldText(text),false,text);
});

test('World region is article evidence, not source language or search region', () => {
  const common={title:'ろう者に関するニュース',summary:'ろう者の暮らしについて',region:'europe_cis',regionLabel:'ヨーロッパ・CIS',originalSummary:''};
  const source={articles:[
    {...common,id:'la',originalTitle:'Roban herramientas a trabajadores sordos mientras reparaban una casa en Los Ángeles'},
    {...common,id:'ci',originalTitle:'Côte d’Ivoire-AIP/ Langue des signes: la communauté sourde réclame une reconnaissance officielle'},
    {...common,id:'none',originalTitle:'Deaf people gather to discuss accessibility'},
    {...common,id:'mixed',originalTitle:'Deaf students from France and Brazil meet'},
  ]};
  const result=prepareWorldPublication(source);
  assert.deepEqual(result.articles.map(a=>a.region),['americas','middle_east_africa','unknown','unknown']);
  assert.equal(source.articles[0].region,'europe_cis','input remains untouched');
  assert.deepEqual(prepareWorldPublication(result),result,'rebuild is idempotent');
});

test('incidental celebrity history is excluded without banning deaf artists', () => {
  assert.equal(explicitUnrelatedReason({title:'《清純派から大胆変貌》紅白4度出場歌手 突発性難聴で活動休止→グループ脱退→ラッパー転身でビキニ姿も披露した新境地'}),'incidental-celebrity-history');
  for(const title of ['難聴の歌手が音楽活動の合理的配慮を語る','ろう者のモデルがビキニ姿で出演、手話通訳つき舞台','突発性難聴で活動休止した歌手が治療経験を語る']) assert.equal(explicitUnrelatedReason({title}),null,title);
});

test('same anniversary announcement groups while distinct event dates and updates remain', () => {
  const a={id:'a',sourceName:'University',publishedAt:'2026-10-28T13:00:00Z',title:'筑波技術大学 東京2025デフリンピック1周年記念イベントを開催します'};
  const b={...a,id:'b',sourceName:'News',title:'筑波技術大学が東京2025デフリンピック1周年記念イベントを11月28日に開催へ'};
  assert.equal(sameNewsTopic(a,b),true);
  assert.equal(sameNewsTopic(b,{...b,id:'c',title:b.title.replace('11月28日','11月29日')}),false);
  assert.equal(sameNewsTopic(a,{...a,id:'d',title:a.title+'【中止】'}),false);
});
