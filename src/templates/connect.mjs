import { SITE_NAME, SITE_URL } from '../../config/site.mjs';
import {
  jsonLdScript,
  renderFooter,
  renderHead,
  renderSiteNav,
  renderSkipLink,
  renderSubHeader,
} from './partials.mjs';

const absoluteNav = {
  newsHref: '/',
  worldHref: '/news/world/',
  connectHref: '/connect/',
  guideHref: '/guide/',
  toolHref: '/otomado/',
  aboutHref: '/about/',
};

function breadcrumbJsonLd(path, names) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: names.map((name, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: new URL(index === 0 ? '/' : path[index - 1], SITE_URL).href,
    })),
  });
}

function renderPage({
  path,
  title,
  description,
  crumbLabel,
  lead,
  current,
  body,
  breadcrumbPaths = [],
  breadcrumbNames = ['ホーム'],
  robots = 'index,follow,max-image-preview:large,max-snippet:-1',
}) {
  const canonical = new URL(path, SITE_URL).href;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title,
    description,
    canonical,
    ogUrl: canonical,
    robots,
    stylesFile: 'styles.css',
    basePath: '/',
    jsonLd: breadcrumbJsonLd(breadcrumbPaths, breadcrumbNames),
  })}
</head>
<body>
  ${renderSkipLink()}
${renderSubHeader({ crumbLabel, title: title.replace(/ \| Deaf Navi(?: Web)?$/, ''), lead, homeHref: '/' })}
  <div class="container directory-nav">${renderSiteNav({ current, ...absoluteNav })}</div>
  <main id="main" class="container directory-page" role="main">
${body}
  </main>
${renderFooter({
    year: new Date().getFullYear(),
    links: [
      { href: '/connect/sign-cafe/', label: '手話カフェ一覧' },
      { href: '/connect/sign-cafe/starbucks/', label: 'スターバックス' },
      { href: '/submit/', label: '情報提供' },
      { href: '/sitemap/', label: 'サイトマップ' },
    ],
  })}
  <script src="/ui-controls.js" defer></script>
</body>
</html>
`;
}

export function renderNotFoundPage() {
  return renderPage({
    path: '/404.html',
    title: `ページが見つかりません | ${SITE_NAME}`,
    description: '指定されたページは見つかりませんでした。Deaf Naviの主要ページから情報を探せます。',
    crumbLabel: 'ページが見つかりません',
    lead: 'URLが変更されたか、ページが移動した可能性があります。',
    current: '',
    robots: 'noindex,follow',
    breadcrumbPaths: ['/404.html'],
    breadcrumbNames: ['ホーム', 'ページが見つかりません'],
    body: `    <section class="directory-hero"><p class="eyebrow">404 NOT FOUND</p><h2>ページが見つかりません</h2><p>トップページ、つながる、暮らしのガイド、サイトマップからお探しください。</p><p><a class="primary-link" href="/">トップページへ戻る</a> <a class="secondary-link" href="/sitemap/">サイトマップを見る</a></p></section>`,
  });
}

function categoryCards(items) {
  return `<div class="directory-grid">
${items.map(({ href, title, text }) => `    <a class="directory-card" href="${href}">
      <span class="directory-card__title">${title}</span>
      <span>${text}</span>
      <span class="directory-card__arrow" aria-hidden="true">→</span>
    </a>`).join('\n')}
  </div>`;
}

function signCafeTabs(current) {
  return `<nav class="section-tabs" aria-label="手話カフェの分類">
    <a href="/connect/sign-cafe/"${current === 'cafes' ? ' aria-current="page"' : ''}>手話カフェ一覧</a>
    <a href="/connect/sign-cafe/starbucks/"${current === 'starbucks' ? ' aria-current="page"' : ''}>スターバックス</a>
  </nav>`;
}

export function renderConnectPages({ places, signCafes, starbucksEntries }) {
  const approvedCafes = signCafes.signCafes.filter((item) => item.published === true);
  const approvedEntries = starbucksEntries.entries.filter((item) => item.published === true);
  const upcoming = approvedEntries.filter((item) => ['scheduled', 'ongoing'].includes(item.event_status));
  const recurring = approvedEntries.filter((item) => item.event_status === 'recurring');
  const past = approvedEntries.filter((item) => ['ended', 'cancelled'].includes(item.event_status));
  void places;

  const pages = [];
  pages.push({
    file: 'connect/index.html',
    html: renderPage({
      path: '/connect/', title: `つながる | ${SITE_NAME}`,
      description: '手話カフェやイベントなど、ろう者・難聴者・手話に関わるつながりの入口です。',
      crumbLabel: 'つながる', lead: '地域やテーマから、交流できる場所と機会を探せます。', current: 'connect',
      breadcrumbPaths: ['/connect/'], breadcrumbNames: ['ホーム', 'つながる'],
      body: `    <section class="directory-hero"><p class="eyebrow">CONNECT</p><h2>つながる情報を、種類ごとに。</h2><p>常設の場所と単発イベントを分け、確認できた情報源を添えて掲載します。</p></section>
${categoryCards([
        { href: '/connect/sign-cafe/', title: '手話カフェ', text: '常設・限定営業・定期開催・サイニングストアを分類して探せます。スターバックスの企画は専用ページへ。' },
        { href: '/connect/events/', title: 'イベント', text: '単発の手話カフェや手話交流イベントはこちらです。' },
      ])}`,
    }),
  });

  pages.push({
    file: 'connect/sign-cafe/index.html',
    html: renderPage({
      path: '/connect/sign-cafe/', title: `全国の手話カフェ一覧 | ${SITE_NAME.replace(' Web', '')}`,
      description: '店舗や施設そのものが、手話での交流をコンセプトとして運営されている全国の常設手話カフェ一覧。単発イベントは含みません。',
      crumbLabel: 'つながる › 手話カフェ', lead: '常設の手話カフェとスターバックスでの企画は、掲載基準を分けています。', current: 'connect',
      breadcrumbPaths: ['/connect/', '/connect/sign-cafe/'], breadcrumbNames: ['ホーム', 'つながる', '手話カフェ'],
      body: `    ${signCafeTabs('cafes')}
    <section class="directory-hero directory-hero--cafe" aria-labelledby="cafe-intro">
      <p class="eyebrow">PERMANENT PLACES</p>
      <h2 id="cafe-intro">手話で過ごせる、常設の場所</h2>
      <p>店舗や施設そのものが、手話での交流をコンセプトとして運営されている場所を掲載しています。単発イベントは含みません。</p>
    </section>
    <section class="directory-section" aria-labelledby="cafe-list-heading">
      <div class="directory-section__head"><div><p class="eyebrow">VERIFIED LIST</p><h2 id="cafe-list-heading">手話カフェ一覧</h2></div><span class="count-badge">確認済み ${approvedCafes.length}件</span></div>
      ${approvedCafes.length === 0 ? '<div class="empty-state"><strong>現在、掲載基準と情報源を確認できた店舗を準備中です。</strong><p>未確認情報は断定して掲載しません。閉店した店舗も、確認後は過去の手話カフェとして残します。</p></div>' : ''}
    </section>
    <aside class="info-callout"><h2>情報をお寄せください</h2><p>常設の手話カフェ、既存情報の修正、閉店情報を受け付ける仕組みを準備しています。</p><a class="primary-link" href="/submit/?type=sign-cafe">情報提供について確認する</a></aside>`,
    }),
  });

  pages.push({
    file: 'connect/sign-cafe/starbucks/index.html',
    html: renderPage({
      path: '/connect/sign-cafe/starbucks/', title: `スターバックスの手話カフェ・手話イベント情報 | ${SITE_NAME.replace(' Web', '')}`,
      description: '全国のスターバックス店舗で実施される手話カフェ、手話交流イベント、関連企画、サイニングストア等の情報。',
      crumbLabel: 'つながる › 手話カフェ › スターバックス', lead: '開催情報と常設的な取り組みを、情報源と確認状況とともに掲載します。', current: 'connect',
      breadcrumbPaths: ['/connect/', '/connect/sign-cafe/', '/connect/sign-cafe/starbucks/'], breadcrumbNames: ['ホーム', 'つながる', '手話カフェ', 'スターバックス'],
      body: `    ${signCafeTabs('starbucks')}
    <section class="directory-hero directory-hero--starbucks" aria-labelledby="starbucks-intro">
      <p class="eyebrow">INDEPENDENT INFORMATION</p>
      <h2 id="starbucks-intro">スターバックスでの手話関連企画</h2>
      <p>全国のスターバックス店舗で実施される手話カフェや手話関連企画の情報を、公開情報および情報提供をもとに掲載しています。</p>
    </section>
    <aside class="brand-disclaimer" aria-label="非公式ページについて"><strong>非公式の情報ページです</strong><p>本ページはDeaf Naviによる非公式の情報ページです。スターバックス コーヒー ジャパン株式会社が運営・監修するものではありません。開催状況や参加方法は、掲載している情報源または各店舗・主催者へご確認ください。</p></aside>
    <section class="directory-section" aria-labelledby="upcoming-heading"><p class="section-number">01</p><h2 id="upcoming-heading">開催予定</h2>${upcoming.length === 0 ? '<div class="empty-state"><strong>現在確認できている開催予定はありません。</strong><p>情報源を確認でき次第、開催日・店舗・参加方法とともに掲載します。</p></div>' : ''}</section>
    <section class="directory-section" aria-labelledby="recurring-heading"><p class="section-number">02</p><h2 id="recurring-heading">定期開催・常設的な取り組み</h2>${recurring.length === 0 ? '<p class="muted-copy">現在掲載している確認済み情報はありません。</p>' : ''}</section>
    <section class="directory-section" aria-labelledby="region-heading"><p class="section-number">03</p><h2 id="region-heading">地域・都道府県から探す</h2><p class="muted-copy">掲載情報が追加された後、地域別に探せるようになります。</p></section>
    <section class="directory-section" aria-labelledby="history-heading"><p class="section-number">04</p><h2 id="history-heading">過去の開催履歴</h2>${past.length === 0 ? '<p class="muted-copy">現在掲載している確認済みの開催履歴はありません。</p>' : ''}</section>
    <section class="directory-section" aria-labelledby="provide-heading"><p class="section-number">05</p><h2 id="provide-heading">情報提供</h2><p>開催予定、既存情報の修正、中止情報をお寄せいただく仕組みを準備しています。</p><p><a class="primary-link" href="/submit/?type=starbucks">情報提供について確認する</a></p></section>
    <section class="directory-section" aria-labelledby="about-page-heading"><p class="section-number">06</p><h2 id="about-page-heading">このページについて</h2><p>店舗自体を常設の「手話カフェ」として扱わず、各開催回と常設的な取り組みを分けて記録します。日時・場所・開催状態を確認できない情報にはEvent構造化データを出しません。</p></section>`,
    }),
  });

  const simplePages = [
    ['connect/events/index.html', '/connect/events/', 'イベント', 'スターバックス以外の単発手話カフェや手話交流イベントを掲載するページです。', '単発イベントは常設店舗一覧と混在させません。確認済み情報を準備中です。', 'connect'],
    ['connect/places/index.html', '/connect/places/', '場所', 'ろう者・難聴者・手話利用者が利用しやすい場所を探すページです。', '掲載基準と情報源を確認した場所から順次掲載します。', 'connect'],
    ['connect/communities/index.html', '/connect/communities/', 'コミュニティ', '地域やテーマで活動するコミュニティを探すページです。', '確認済みの団体情報を準備中です。', 'connect'],
    ['news/japan/index.html', '/news/japan/', '国内ニュース', '聴覚障害・難聴・ろう者・手話に関する国内ニュースの入口です。', '最新の国内ニュースはトップページで公開しています。', 'news'],
    ['news/world/index.html', '/news/world/', '海外ニュース', '海外のろう者・難聴者・手話・アクセシビリティ関連ニュースの入口です。', '<a class="primary-link" href="/deaf-navi-world-jp.html">日本語版を読む</a> <a class="secondary-link" href="/news/world/original/">原文版を見る</a>', 'world'],
    ['news/world/original/index.html', '/news/world/original/', '海外ニュース・原文版', '海外ニュースを原文で確認するための入口です。', '<a class="primary-link" href="/deaf-navi-world-original.html">原文版を読む</a>', 'world'],
    ['guide/index.html', '/guide/', '暮らしのガイド', '制度・生活・アクセシビリティの公式情報を目的別に探す入口です。', '既存のガイド情報を新しい3分類へ整理しています。', 'guide'],
    ['guide/systems/index.html', '/guide/systems/', '制度', '聴覚障害・難聴に関わる制度の公式情報を探すページです。', '<a class="primary-link" href="/guide.html">現在の暮らしのガイドを開く</a>', 'guide'],
    ['guide/life/index.html', '/guide/life/', '生活', '医療・教育・就労など生活に関わる公式情報を探すページです。', '<a class="primary-link" href="/guide.html">現在の暮らしのガイドを開く</a>', 'guide'],
    ['guide/accessibility/index.html', '/guide/accessibility/', 'アクセシビリティ', '情報保障、電話、コミュニケーション支援の公式情報を探すページです。', '<a class="primary-link" href="/guide.html">現在の暮らしのガイドを開く</a>', 'guide'],
    ['about/index.html', '/about/', 'Deaf Naviについて', 'Deaf Naviの目的、選定方針、運営情報を案内します。', '<a class="primary-link" href="/about.html">詳しい案内を読む</a>', 'about'],
    ['sitemap/index.html', '/sitemap/', 'サイトマップ', 'Deaf Naviの主要な公開ページへの入口です。', '<a class="primary-link" href="/sitemap.html">全リンクを確認する</a>', ''],
  ];
  for (const [file, path, pageTitle, description, content, current] of simplePages) {
    pages.push({ file, html: renderPage({ path, title: `${pageTitle} | ${SITE_NAME}`, description, crumbLabel: pageTitle, lead: description, current, breadcrumbPaths: [path], breadcrumbNames: ['ホーム', pageTitle], body: `    <section class="directory-hero"><p class="eyebrow">DEAF NAVI</p><h2>${pageTitle}</h2><p>${content}</p></section>` }) });
  }

  pages.push({
    file: 'submit/index.html',
    html: renderPage({
      path: '/submit/', title: `情報提供 | ${SITE_NAME}`, description: '手話カフェ、スターバックス開催情報、既存情報の修正、閉店・中止情報の提供方法をご案内します。',
      crumbLabel: '情報提供', lead: '投稿内容は即時公開せず、確認・承認後に掲載します。', current: '', breadcrumbPaths: ['/submit/'], breadcrumbNames: ['ホーム', '情報提供'],
      body: `    <section class="directory-hero"><p class="eyebrow">SUBMIT INFORMATION</p><h2>安全な受付機能を準備しています</h2><p>常設の手話カフェ情報、スターバックス開催情報、既存情報の修正、閉店・中止情報、その他の5種類を受け付ける予定です。</p></section>
    <div class="empty-state"><strong>現在、このページから情報を送信することはできません。</strong><p>承認待ち保存、入力検証、連続送信対策を確認してから受付を開始します。氏名・メールアドレス・電話番号・住所・SNSアカウントは初期段階では収集しません。</p></div>`,
    }),
  });
  return pages;
}
