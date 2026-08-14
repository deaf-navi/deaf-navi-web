/**
 * 「Deaf Naviについて」ページ。
 */

import {
  APP_STORE_URL,
  SITE_NAME,
  SITE_URL,
} from '../../config/site.mjs';
import { GUIDE_LAST_REVIEWED } from '../guide-data.mjs';
import { escapeHtml } from '../lib/text.mjs';
import {
  EXTERNAL_ARROW_SVG,
  jsonLdScript,
  renderFooter,
  renderHead,
  renderSkipLink,
  renderSiteHeader,
} from './partials.mjs';

export function renderAboutPage({ generatedAt, isDev, files }) {
  const aboutTitle = `${isDev ? '[DEV] ' : ''}Deaf Naviについて | ${SITE_NAME}`;
  const aboutUrl = `${SITE_URL}${files.about}`;
  const indexHref = isDev ? './index-dev.html' : './';
  const robots = isDev ? 'noindex,nofollow,noarchive' : 'index,follow';
  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': aboutUrl,
    url: aboutUrl,
    name: aboutTitle,
    description: 'Deaf Navi Web と Deaf Navi World-JP/Original のコンセプト・情報源・更新頻度・運営者情報。',
    inLanguage: 'ja-JP',
    dateModified: generatedAt,
    lastReviewed: GUIDE_LAST_REVIEWED,
    isPartOf: { '@id': `${SITE_URL}#website` },
    mainEntity: {
      '@type': 'MobileApplication',
      name: 'Deaf Navi',
      operatingSystem: 'iOS',
      applicationCategory: 'LifestyleApplication',
      url: APP_STORE_URL,
      image: `${SITE_URL}deaf-navi-ios-app-icon.png`,
      description: '聴覚障害のある方、ろう者・難聴者、その家族や支援者のために、制度・イベント・ニュースとコミュニケーション支援をまとめたiOSアプリ。',
    },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({
    title: aboutTitle,
    description: 'Deaf Navi Web、Deaf Navi World、iOSアプリ「Deaf Navi」の機能、コンセプト、情報源、更新頻度、運営者についてのご案内。',
    canonical: isDev ? `${SITE_URL}about.html` : aboutUrl,
    robots,
    ogType: 'article',
    ogUrl: aboutUrl,
    stylesFile: files.styles,
    feedUrl: `${SITE_URL}${files.feed}`,
    jsonLd: jsonLdScript(aboutJsonLd),
  })}
</head>
<body>
  ${renderSkipLink()}

${renderSiteHeader({
    subLabel: `について${isDev ? ' DEV' : ''}`,
    lead: 'Web版・World・iOSアプリの役割、選定方針、更新の仕組みをご案内します。',
    current: 'about',
    nav: {
      newsHref: indexHref,
      guideHref: `./${files.guide}`,
      aboutHref: `./${files.about}`,
    },
  })}

  <main id="main" class="container about" role="main">
    <section aria-labelledby="about-concept">
      <h2 id="about-concept" class="about__h2">このサイトについて</h2>
      <p>Deaf Navi Web は、<strong>聴覚障害・難聴・ろう者・中途失聴者</strong>のコミュニティに関わる情報を、信頼できる情報源から自動収集・分類してお届けする無料ニュースキュレーションサイトです。</p>
      <p>国内ニュースを扱う Deaf Navi Web に加え、海外ニュースを扱う <a href="./deaf-navi-world-jp.html">Deaf Navi World-JP</a>（日本語翻訳版）と <a href="./deaf-navi-world-original.html">Deaf Navi World-Original</a>（原文版）を公開しています。情報保障・手話・制度・医療・教育・技術・防災・文化・デフスポーツなど、暮らしと権利に直結するトピックを幅広くカバーします。</p>
      <p><a href="./${files.guide}">暮らしのガイド</a>では、アプリ版と同じ方針で、緊急通報・医療・教育・就労・電話サービスなどの公式情報を探せます。</p>
      <p><a href="./otomado/">おとまど</a>は、周囲の音の可視化、リアルタイム字幕、筆談ボードをひとつにまとめた、Deaf Navi Web の無料情報保障ツールです。</p>
    </section>

    <section id="ios-app" class="about-app" aria-labelledby="about-ios-app">
      <div class="about-app__intro">
        <img class="about-app__icon" src="./deaf-navi-ios-app-icon.png" width="160" height="160" loading="lazy" decoding="async" alt="Deaf Navi iOSアプリのアイコン">
        <div class="about-app__copy">
          <p class="about-app__eyebrow" lang="en">Deaf Navi for iOS</p>
          <h2 id="about-ios-app">情報とコミュニケーション支援を、いつでも手元に。</h2>
          <p class="about-app__lead">聴覚障害のある方、ろう者・難聴者、その家族や支援者のために、制度・イベント・ニュースと日常のコミュニケーション支援をひとつにまとめた情報アプリです。</p>
          <p>Deaf Navi Webで選定した国内・海外ニュースをアプリでも確認でき、暮らしのガイドや情報保障ツールは必要な場面ですぐに開けます。</p>
          <a class="about-app__store-link" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="App StoreでDeaf Naviを開く（新しいタブで開く）">
            App Storeで見る ${EXTERNAL_ARROW_SVG}
          </a>
        </div>
      </div>
      <div class="about-app__features" aria-label="iOSアプリの主な機能">
        <section class="about-app__feature" aria-labelledby="about-app-news">
          <h3 id="about-app-news">ニュース・イベント</h3>
          <p>国内ニュース、Deaf Navi World、関係団体のイベント情報をまとめて確認できます。</p>
        </section>
        <section class="about-app__feature" aria-labelledby="about-app-guide">
          <h3 id="about-app-guide">暮らしのガイド</h3>
          <p>制度、医療、教育、就労、災害・緊急時などの公式情報と、暮らしに役立つ実用ツールへすばやく移動できます。</p>
        </section>
        <section class="about-app__feature" aria-labelledby="about-app-tools">
          <h3 id="about-app-tools">情報保障ツール</h3>
          <p>緊急カード、コミュニケーションボード、筆談・音声、周囲の音などを日常の場面に合わせて使えます。</p>
        </section>
      </div>
    </section>

    <section id="updates" aria-labelledby="about-updates">
      <h2 id="about-updates" class="about__h2">アップデート情報</h2>
      <article class="release-note">
        <header class="release-note__head">
          <time datetime="2026-08-14">2026年8月14日</time>
          <h3>暮らしのガイドにCUP ORDERを追加</h3>
        </header>
        <ul>
          <li>カフェの注文内容を画面にまとめ、店員さんへ見せたり指さしたりして伝えられる注文支援ツールへの案内を追加</li>
          <li>非公式の試作ツールであること、入力内容と保存データが端末のブラウザ内で処理されることを明記</li>
        </ul>
      </article>
      <article class="release-note">
        <header class="release-note__head">
          <time datetime="2026-08-14">2026年8月14日</time>
          <h3>情報保障ツール「おとまど」を追加</h3>
        </header>
        <ul>
          <li>周囲の音を画面と振動で知らせる「おとセンサー」、リアルタイム字幕、筆談ボードを追加</li>
          <li>Deaf Navi Web の表示設計に合わせ、Aurora・ダーク・ライト・グリーンの4テーマに対応</li>
          <li>音検知は端末内処理を基本とし、字幕の音声処理方式は利用ブラウザにより異なることを画面内で案内</li>
        </ul>
      </article>
      <article class="release-note">
        <header class="release-note__head">
          <time datetime="2026-08-13">2026年8月13日</time>
          <h3>Deaf Navi Web 2.0 公開</h3>
        </header>
        <ul>
          <li>トップページを再設計。緊急通報・防災・制度への近道と「注目（公式・専門の新着）」を追加</li>
          <li>期間・地域での絞り込みを追加し、検索を高速化。ページ容量を約5分の1に軽量化</li>
          <li>ダーク表示・文字サイズ切替・ホーム画面への追加（PWA）・オフライン閲覧に対応</li>
          <li>過去アーカイブを月別ページに分割し、スマートフォンでも快適に閲覧可能に</li>
        </ul>
      </article>
      <article class="release-note">
        <header class="release-note__head">
          <time datetime="2026-08-05">2026年8月5日</time>
          <h3>暮らしのガイドと公式イベント情報を追加</h3>
        </header>
        <ul>
          <li>110番アプリ、NET118、補聴器の医療費控除、就業・生活支援センターなど、公式情報16項目をまとめた「暮らしのガイド」を追加</li>
          <li>北海道・札幌・兵庫・鹿児島・沖縄の公式フィードを追加し、地域の講座・上映会・公演・相談会などを発見しやすく改善</li>
          <li>ニュース検索、情報源区分、取得再試行、前回記事の短期補完、180日以内の鮮度判定を維持しながらWeb版とアプリ版の内容を同期</li>
        </ul>
      </article>
    </section>

    <section aria-labelledby="about-sources">
      <h2 id="about-sources" class="about__h2">情報源</h2>
      <h3 class="about__h3">国内版: 公式・専門媒体（直接RSS/Atom）</h3>
      <ul>
        <li><a href="https://www.jfd.or.jp/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟</a> — 全国規模の連盟公式情報（制度・手話言語法を含む）</li>
        <li><a href="https://www.tfd.deaf.tokyo/" target="_blank" rel="noopener noreferrer">東京都聴覚障害者連盟</a> — 地域連盟の活動情報</li>
        <li><a href="https://shikaku.in/" target="_blank" rel="noopener noreferrer">しかくタイムズ</a> — ろう者・難聴者向けイベント情報</li>
        <li><a href="https://co-coco.jp/" target="_blank" rel="noopener noreferrer">こここ</a> — マガジンハウス運営の福祉クリエイティブマガジン</li>
        <li><a href="https://ameblo.jp/jtd2009/" target="_blank" rel="noopener noreferrer">日本ろう者劇団</a> — 手話狂言・公演情報</li>
        <li><a href="https://www.jfd.or.jp/sc/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟スポーツ委員会</a>、<a href="https://jdba.sakura.ne.jp/" target="_blank" rel="noopener noreferrer">日本デフバスケットボール協会</a>、<a href="https://www.deafswim.or.jp/" target="_blank" rel="noopener noreferrer">日本デフ水泳協会</a> — 国内デフスポーツ情報</li>
        <li>北海道・札幌・兵庫・鹿児島・沖縄の聴覚障害者情報センター、地域団体の公式フィード — 講座・交流会・相談会などの地域イベント情報</li>
      </ul>
      <h3 class="about__h3">国内版: 追加公式・専門ソース</h3>
      <ul>
        <li><a href="https://www.zennancho.or.jp/" target="_blank" rel="noopener noreferrer">全日本難聴者・中途失聴者団体連合会</a>、<a href="https://www.com-sagano.com/" target="_blank" rel="noopener noreferrer">全国手話研修センター</a>、<a href="https://www.jyoubun-center.or.jp/" target="_blank" rel="noopener noreferrer">聴力障害者情報文化センター</a> ほか</li>
        <li><a href="https://www.nftrs.or.jp/" target="_blank" rel="noopener noreferrer">電話リレーサービス</a>、<a href="https://zentsuken.cocolog-nifty.com/blog/" target="_blank" rel="noopener noreferrer">全通研NOW!!</a>、<a href="https://audiology-japan.jp/" target="_blank" rel="noopener noreferrer">日本聴覚医学会</a> ほか</li>
        <li>YouTube公式チャンネル、note、UDCast、Palabra、Silent Voice などの公開RSS/Atom</li>
        <li>追加ソースとSNS系は関連語スコアが一定以上の記事のみ掲載候補にしています</li>
      </ul>
      <h3 class="about__h3">国内版: 主要報道機関・公的機関（Google News RSS）</h3>
      <ul>
        <li>朝日新聞・読売新聞・NHK系記事・自治体/公的機関・PR TIMES など、Google News RSS に掲載される国内ニュースを参照します。</li>
        <li>キーワード: 聴覚障害 / 難聴 / ろう者 / 手話 / 情報保障 / アクセシビリティ / 防災 / 技術・AI / イベント・講座 / 電話リレー / ヨメテル / 補聴器 / 人工内耳 / ろう学校 / デフスポーツ / ろう文化・芸能 ほか</li>
        <li>電話リレー・ヨメテル系の記事は専用カテゴリで表示し、トップの「すべて」からは除外しています。</li>
      </ul>

      <h3 class="about__h3">Deaf Navi World: 海外主要メディア + 多言語地域検索（Google News RSS）</h3>
      <ul>
        <li>海外版は、公式サイトの小さな更新を広く拾うのではなく、Google News RSS を入口に主要メディアの記事と多言語の地域別検索結果を収集します。</li>
        <li>アジア・オセアニア: ABC News Australia、SBS News、The Guardian、RNZ、CNA、The Japan Times、The Korea Herald ほか</li>
        <li>北米・中南米: AP News、Reuters、NPR、The New York Times、The Washington Post、CBC News、El Pais、Folha de S.Paulo ほか</li>
        <li>ヨーロッパ・CIS: BBC News、Reuters、Deutsche Welle、France 24、Euronews、POLITICO Europe、Le Monde、The Kyiv Independent ほか</li>
        <li>中東・アフリカ: Al Jazeera、The National、Arab News、Africanews、News24、Daily Maverick、Nation Africa ほか</li>
        <li>英語に加えて、スペイン語、ポルトガル語、フランス語、ドイツ語、イタリア語、トルコ語、韓国語、中国語、アラビア語などの検索語を使い、鮮度を優先しながら地域が偏りすぎないように並べています。</li>
        <li>Deaf Navi World-JP は自動翻訳後に「ろう」「難聴」「手話」「補聴器」「Auslan」などの用語補正を行い、Codex App Server が利用できる環境ではタイトル・要約をニュース見出しとして自然な日本語に整えます。Deaf Navi World-Original では翻訳せず、各ソースの原文タイトル・要約を表示します。</li>
      </ul>
    </section>

    <section id="about-policy" aria-labelledby="about-policy-heading">
      <h2 id="about-policy-heading" class="about__h2">選定方針と確実性</h2>
      <div class="policy-levels" aria-label="情報源の選定区分">
        <p><strong>一次情報</strong><span>公式団体・公的機関が発信した情報。直接フィードまたはGoogle News経由で取得</span></p>
        <p><strong>専門情報</strong><span>聴覚障害、手話、医療、教育、デフスポーツ等の専門団体・媒体が発信した情報</span></p>
        <p><strong>報道・発見</strong><span>Google News RSSを入口に発見し、関連度と出典優先度で選別した報道・公開情報</span></p>
        <p><strong>関連媒体</strong><span>周辺分野を扱う媒体から、関連度が基準を満たした記事</span></p>
      </div>
      <p>同じ話題が複数ある場合は、公式・専門ソース、公的機関、主要報道機関を優先します。タイトルの近似だけでなくURL・日付・数字も見て重複を整理し、見出しとほぼ同じ要約や配信システム由来の定型文は表示しません。</p>
      <p>自動キュレーションは記事の事実関係を独自に保証するものではありません。特に医療・制度・災害情報は、カードに表示される選定区分を参考にしつつ、必ずリンク先の公式情報・元記事で最新内容をご確認ください。</p>
    </section>

    <section aria-labelledby="about-categories">
      <h2 id="about-categories" class="about__h2">カテゴリ分類</h2>
      <p>記事はタイトル・要約から自動で以下のカテゴリに分類されます:</p>
      <ul>
        <li><strong>制度・政策</strong> — 法律・条例・給付・雇用・助成など</li>
        <li><strong>情報保障・アクセシビリティ</strong> — 手話通訳・要約筆記・字幕・合理的配慮・窓口対応など</li>
        <li><strong>電話リレー・ヨメテル</strong> — 電話リレーサービス・ヨメテル・手話リンクなど</li>
        <li><strong>医療</strong> — 病院・治療・補聴器・人工内耳・診断など</li>
        <li><strong>教育</strong> — 学校・大学・授業・入試・研究など</li>
        <li><strong>技術・AI</strong> — 音声認識・自動字幕・手話翻訳・支援技術・アプリなど</li>
        <li><strong>文化・芸能</strong> — ろう演劇・ろう映画・手話パフォーマンス・ろうアート・手話狂言など</li>
        <li><strong>デフスポーツ</strong> — デフリンピック・競技団体・選手・大会情報など</li>
        <li><strong>防災・安全</strong> — 災害情報・避難・緊急通報・警察/消防対応など</li>
        <li><strong>イベント・講座</strong> — 手話講座・講演会・セミナー・体験会・交流会など</li>
        <li><strong>地域</strong> — 都道府県・市区町村単位のローカル情報</li>
        <li><strong>一般</strong> — 上記以外の関連トピック</li>
      </ul>
      <p>2.0 から、記事タイトル・要約に含まれる都道府県名をもとにした<strong>地域の絞り込み</strong>（北海道・東北 / 関東 / 中部 / 近畿 / 中国・四国 / 九州・沖縄)にも対応しました。</p>
    </section>

    <section aria-labelledby="about-update">
      <h2 id="about-update" class="about__h2">更新頻度・仕組み</h2>
      <p>国内本番版は GitHub Actions による自動ジョブが1日3回（JST 6:00 / 12:00 / 18:00ごろ）RSSを収集します。取得時の一時エラーは再試行し、前回取得した45日以内の記事を補完候補として使います。関連性・鮮度・出典優先度・近似重複・カテゴリを判定し、公開日から180日以内の候補を中心に、電話リレー・ヨメテルを除く通常カテゴリで最大400件を保持します。初期表示は60件で、追加表示しながら閲覧できます。</p>
      <p>Deaf Navi World は1日3回（JST 6:00 / 12:00 / 18:00ごろ）に海外ニュースを収集し、最大600件を保持します。World-JP は日本語翻訳版、World-Original は翻訳なしの原文版です。</p>
      <p>記事の本文・要約は各発信元のものを抜粋し、本文リンクはすべて各元記事の原文（外部サイト）に遷移します。記事の著作権はそれぞれの発信元に帰属します。</p>
    </section>

    <section aria-labelledby="about-operator">
      <h2 id="about-operator" class="about__h2">運営</h2>
      <p>Deaf Navi Web とiOSアプリ「Deaf Navi」は <strong>TAMA</strong> が運営しています。Web版で選定したニュースや暮らしの情報をアプリと共有し、それぞれの利用場面に合った形で提供しています。</p>
    </section>

    <section aria-labelledby="about-feeds">
      <h2 id="about-feeds" class="about__h2">配信・共有</h2>
      <ul>
        <li><a href="./${files.guide}">暮らしのガイド</a>（緊急通報・医療・教育・就労・電話サービス）</li>
        <li><a href="./otomado/">おとまど</a>（音の可視化・リアルタイム字幕・筆談ボード）</li>
        <li><a href="${SITE_URL}${files.feed}">RSS フィード</a>（最新50件）</li>
        <li><a href="./deaf-navi-world-jp.html">Deaf Navi World-JP</a>（日本語翻訳版） / <a href="./deaf-navi-world-original.html">Deaf Navi World-Original</a>（原文版）</li>
        <li><a href="${SITE_URL}feed-world.xml">World-JP RSS フィード</a> / <a href="${SITE_URL}feed-world-original.xml">World-Original RSS フィード</a></li>
        <li><a href="${SITE_URL}${files.sitemapHtml}">サイトマップ</a></li>
      </ul>
    </section>

    <p class="about__back"><a href="${indexHref}">← トップページへ戻る</a></p>
  </main>

${renderFooter({
    year: new Date().getFullYear(),
    updateScheduleAt: generatedAt,
  })}

  <script src="./ui-controls.js" defer></script>
</body>
</html>
`;
}
