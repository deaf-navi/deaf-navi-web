# 出典確認記録

調査日: 2026-10-12 JST。取得日と資料の公開・更新・適用日を区別する。

| 対象 | 出典・確認方法 | 確認できた事項 | 未確認・判断 |
|---|---|---|---|
| 承認済み指示書 | Library `libfile_1af2d0bc0ecc819185ddd76647782968`、全512行を直接読取 | 30日検証、手話カフェ優先、低リスク公開権限、承認境界、未取得数値禁止、復旧・運営台帳 | materialize初回と一度の再試行が失敗。ローカル原本bytes未確認。他環境パス不使用 |
| リポジトリ・運用 | `AGENTS.md`、README、運用・イベントキュレーション資料、GitHub接続 | 保存環境HEADとリモートmainは `b5b207d93a1edbc161434f5f71c7debc37a71add`。メタデータはpush=true。XServer正規経路と原子的release切替 | 実書込用tree作成は403。GitHub App一覧はflames-hub/tamas-hubだけでdeaf-naviは返されず。シェルHTTP/GitHubも出口403。権限変更なし。サーバーSSH・本番DBは直接未読 |
| 初回公開状態 | [XServer run 38130903364](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38130903364) | 上記mainのデプロイsuccess、既存テストとHTTP確認の経路 | 実行環境からの直接HTTP/ブラウザーは到達不可。CI経由の識別付き監査を使用 |
| 国内手話カフェ | `server/cafe-seo.php`、`views.php`、`cafe-ui.php`、公開サイトの読取結果 | 一覧には既存SEOメタ、地域導線、初心者FAQ、出典、確認日がある。個別titleは従来店舗名だけ | 本番62件は検索ツールの当日取得表示。DBの全件数・検証済み比率と同一視しない |
| Signing和Cafe 西尾茶屋 | [公式トップ](https://signing-wacafe-nishiochaya.com/)、`server/seed.json` | 今回の公式読取にも火曜日定休の記載。seedは月曜定休。公開資料間の相違が残る | 公式トップの更新/適用日・最新告知とLINEの整合は未確定。営業日・時間・確認日を変更しない |
| 奈良関連の検索意図 | 公開検索、[Knot運営元の奈良企画](https://www.k-knot2018.com/p/15/)、[奈通研の2024年開催告知](https://natsuken.net/archives/2530) | 地域名と初心者・交流企画が併存する候補を発見 | 検索snippetを新規掲載の根拠にしない。2024年告知を現在の開催として扱わない。検索量・Google順位は未取得 |
| sitemapの検索対象とlastmod | [Googleのsitemap一次資料](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) | 検索結果に出したいcanonical URLを列挙し、lastmodは実質更新を表す | sitemapの提示はクロール/インデックス保証ではない |
| title | [Googleのtitle一次資料](https://developers.google.com/search/docs/appearance/title-link) | ページ固有の分かりやすいタイトルを使用する方針 | 今回のタイトル変更のCTR効果は未測定 |
| 構造化データ | [Googleの構造化データ方針](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)、既存PHPテスト | 表示内容と一致させ、非公開情報・架空レビュー等を含めない | rich resultの適用・表示を保証しない。日時不詳のイベントへEventを新設しない |

新しい営業・支援・参加条件は今回追加0件。SNS自動巡回の対象・方法は拡張していない。一次資料を再読するまで西尾茶屋の曜日相違は解消扱いにしない。

公開追記: 本人が既存Appを設定後、`deaf-navi` installation170420565で対象repoへの読取と作業ブランチへの書込が成功。PR27は最終CI success後、既存PR経路でマージされ、commit dfd13462d2f419843c502ffc2bb898209171a9beのDeploy XServer run38187812469がsuccess。Appの権限追加・新しい認証をこちらから実施していない。基本HTTPの既存公開確認は成功したが、4変更URLの内容再読は環境の接続制約で未取得。

## 2026-10-14 追記

- 本人指示書は同じLibrary IDの全512行を再取得。19840 bytes、最終更新2026-10-11T23:01:55.298096Zで継続指示を確認。materializeの過去2回の失敗を成功に置き換えず、他環境の原本パスは使わない。
- 親の正式Chromeによる10/13 08:29 JSTの本番XML観測を受領。42 loc / 3 lastmod、homeとsitemap.htmlは2026-10-12T23:24:07.941Z、guide.htmlは2026-08-14、カフェ・おとまどは日付なし、submitなし。子環境の直接取得結果とは区別する。
- PR30は本人の明示承認後に資料5ファイルだけをmain508bc1393b857933d1875f73eab0edc4396a0601へマージ済み。含まれる読取スクリプトの実行・Caddy変更は未承認。
- [Schema.org dateModified](https://schema.org/dateModified)は対象CreativeWorkの変更日、[lastReviewed](https://schema.org/lastReviewed)はそのWebPageを正確性・完全性について確認した日を表すと10/14に一次仕様で確認。AboutPageに転用するニュース生成日時・ガイド確認日は、About自身の根拠ではないため省略する。[Googleの構造化データ方針](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)の、ページ内容を正確に表す方針も再読。
- 最新main904e4d8d49449ea248b96db1e6d19bcbde2481b6の `server/cafe-ui.php` の地域・店舗タイプの絞り込みを読取。Aboutからの既存カフェ一覧への案内はこの既存機能だけを説明し、新しい営業・支援・予約条件を追加しない。

## 2026-10-16 World-Originalの操作案内

- [W3C WCAG 2.2・Language of Parts](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html)を10/16 JSTに実読。ページの既定言語と異なる表現を支援技術が判別できることが目的。今回、既存英語UIに対応する操作文言を英語へ揃える範囲を選ぶ。WCAG全項目適合や実機読み上げ音声の検証済みとは主張しない。
- main `f5bcded2aac6adc05d4ba9c6fb4d6590a06c5152` の `src/world-build.mjs`（blob `67e08906cc1ec37dfcd02be018cb907e7706d873`）とローカル原本が一致。World-Originalはhtml lang=enでRegion/Topicを表示するが、skip-linkと各2個のaria-labelが日本語。`Skip to main content` / `Filter by region` / `Filter by topic`へmodeに応じて切替。World-JPの日本語、記事本文・言語判定、収集・翻訳・PWA・URL・JSは変更しない。
- 生成物は最新main上の既存Curate & Build Worldが生成し、既存Deploy XServerへ渡す。古いローカル600記事のHTMLやアプリJSONをリモートへ上書きしない。未取得の公開HTML全文を取得済みとは報告しない。

## 2026-10-17 店舗から既存地域ページへの導線

- 正本Libraryを全文512行再読、19840bytes・更新日時2026-10-11T23:01:55.298096Zに変更なし。既存の消費側materializeは許された初回/再試行が失敗済みのため繰り返さず、native read成功とローカル原本未確認を区別。
- main `257a3cffa2ec00152c0d91d89ceb77bf7f5a906e` の554ファイルをGit blob hashで一致確認して隔離取得。元workspaceと他作業を変更しない。`server/cafe-seo.php` のCAFE_REGION_PAGES、`server/cafe-regions.php` の公開DB分類、`server/index.php` の地域route、`server/views.php` の詳細本文を実読。東京/神奈川の地域ページは既存で、個別詳細には同地域へのリンクがなかった。`SEARCH_PAGES.md`も確認。
- [Google Search Centralのリンク一次資料](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)を10/17 JSTに実読。href付きa要素と、リンク先が分かる自然な文言を使う根拠。検索順位・流入増加を保証する根拠にはしない。
- 追加するのは、公開詳細を通った国内kind=cafe/カフェ分類で、prefectureが既存地域mapに一致する場合の1リンク。表示名は「東京都/神奈川県の手話カフェ・定期交流の場所を見る」。名称・所在地・営業時間・確認日・支援条件は変更せず、県名の新しい推測もしない。既存地域ページは全国一覧と同じ公開DBを使う。
- 子の識別付き本番HTTP/Web/Gitは接続段階で取得失敗。既存SSH設定/鍵/agent/host/userなし。本番の当日title・header・PHP実行版/DB条件は未取得。PR30スクリプト実行、Caddy変更、鍵の抽出、新しい認証は行わない。

## 2026-10-18 既存実装と表示経路の照合

正本Libraryを全文512行・19840bytesで再読、更新日時は2026-10-11T23:01:55.298096Z。追加materializeは行わない。開始時main f6705d72a8da56d720c6d110a329c40eeb4bf83f、PR68後16コミットでもarea helperと呼出は存在し、CAFE_REGION_PAGESは東京/神奈川。現在のAGENTSとcheckout/workspaceの `.agents/skills` を確認し、同ディレクトリはなかった。カフェcronの--recoverと既存各更新を保護。

site-shell/pageが読む表示用12 CSS/JSを同mainから実読し、合成詳細構造へ適用して375/1180/1280pxでリンクのDOM/可視/フォーカスを確認。PHP応答や本番の再現ではなく、単純な表示処理での消失を検証した範囲に限る。`server/map.php` の公開allowlistはprefecture/city/type等でkindを返さないため、地図の存在だけで内部kindを推定しない。

親から受領した10/17 09:15〜09:16 JSTの独立本番観測では、very-you・rendeaf・tetoteの3件とも地域リンクは確認できなかった。PR68のCI/正規Deploy成功とは分け、SEO-06は未完のまま。title/OG/canonicalと所在地も読取済みとの連絡があるが、その具体文字列はこの子へ未提供であり、所在地付きtitleの反映完了とは断定しない。

## 2026-10-18 00:06〜00:07 UTC 親による独立本番照合

親の正式クラウドブラウザーが2026-10-18 00:06:13〜00:07:09 UTC（09:06:13〜09:07:09 JST）に公開URLをAXと読取専用DOMで照合。very-you/rendeafは「東京都の手話カフェ・定期交流の場所を見る」から既存東京ページ、tetoteは「神奈川県の手話カフェ・定期交流の場所を見る」から既存神奈川ページを参照していた。全リンク先はdn_client=codexを保持。10/17のリンク不在はこの再読で再現しない。所在地titleとog:titleも3件で一致し、JSON-LD addressRegionは東京都/東京都/神奈川県、addressCountryは全件JPで前後空白なし。

親の返却文字列（titleとog:titleは同一）:

- very-you: `サインカフェ ベリーユー（東京都 小平市）｜手話カフェ | Deaf Navi`
- rendeaf: `Rendeaf Coffee（東京都 文京区）｜手話カフェ | Deaf Navi`
- tetote: `UD Cafe &amp; Bar -tetote-（神奈川県 平塚市）｜手話カフェ | Deaf Navi`

東京の参照先は `https://deafnavi.com/connect/sign-cafe/area/tokyo/?dn_client=codex`。H1「東京の手話カフェ・定期交流の場所」、11件でvery-you/Rendeafの見出しと詳細リンクを確認。神奈川は `https://deafnavi.com/connect/sign-cafe/area/kanagawa/?dn_client=codex`。H1「神奈川の手話カフェ・定期交流の場所」、2件でtetoteを確認。両地域とも404案内は表示されなかったが、実HTTPステータスは未取得。

これは親から受領した本番証拠であり、子の直接取得成功や375/1180/1280pxの合成検証とは区別する。今回の本番viewportとスクリーンリーダー音声は未取得/未検証。欠落原因・反映時点・稼働PHP版は未特定で、OPcacheや県名の問題と確定しない。本日追加のプロダクト実装・再公開・Caddy/PR30操作は行わず、SEO-01と今回の東京/神奈川に限るSEO-06を完了とする。

既存3店舗・既存2地域URLの公開情報だけを照合し、DB/営業時間/出典確認日を更新していない。ブラウザー操作は読取専用でサイト変更なし。公開照合の原因説明に、未読のサーバーキャッシュや設定を付け足さない。

## 2026-10-19 既存FAQと操作項目の照合

- 正本Library全文512行・19840bytes、更新2026-10-11T23:01:55.298096Zをnative readで再確認。既存materializeの2失敗は失敗のまま保持。現在のAGENTSを読み、workspace/checkoutの .agents/skills に該当するSKILL.mdは見つからなかった。
- main `311fcc52afd0a83f57c4577372cc0dd1bb6e6587` の server/cafe-seo.php のFAQ2回答と server/cafe-ui.php の domestic_filters/domestic_matches を実読。「初心者歓迎」「筆談対応」はlegend「会話の方法・初めての方へ」内、shop_typeは「詳しい条件を追加」内のselect「店舗タイプ」。CAFE_FEATURESの選択条件は1件でも不一致なら除外する実装で、複数選択は全条件一致である。
- UIの操作先を根拠に文言だけ合わせる。新しい店舗の対応可否や予約・営業時間の情報源にはしない。未確認の対応を「なし」と扱わず、公式サイト/SNSを確認する既存案内を維持する。店舗DB/検証日時の更新はない。
- PR87〜90のmerged状態、CI39126391393/dea39fbと既存Deploy39129045309/bab7042のsuccessを読取確認。API_CURATIONの3資料試験の説明は読めたが、私有の日次比較結果・実使用量・無料枠判定は未取得。比較CLIやモデルAPIによる追加確認は行わない。
- ローカル375/1180/1280pxは現行3 CSSを使った合成FAQ部品の表示/キーボード確認。本番PHP・公開HTML・実機音声の証拠とは区別し、公開結果を別に記録する。

### FAQ修正の配布証跡

[PR97](https://github.com/deaf-navi/deaf-navi-web/pull/97)の最終head `9fe7a7d1ce447b2036376bab32277879cb181416` /CI39176242415がsuccess。通常squash `54a81c6aad5435f85c1a75341d7088be3eec6a98` の実parent/6ファイル差分と、mainのPHPが候補と一致することをGitHubで再読。XServer39176365311のPHP lint/隔離SEO130/原子的切替/基本HTTPは10/19 08:25:01 JSTにsuccess。

08:25:26 JSTの子HTTPは専用UA/headerとdn_client=codex付きでもCONNECT403、Web読取もnot accessible。本番FAQのHTMLやモバイル・音声を取得できた証拠ではなく、親の正式ブラウザー再読待ち。原因をPHPキャッシュやサイト障害と確定せず、診断だけの再公開・Caddy/PR30操作・認証変更は行わない。

## 2026-10-19 08:30:47 JST 公開QAの不一致と配布診断

親の正式ChromeでFAQ2回答を展開したAXと実画面が一致し、通常再読1回後も「詳しい条件」「営業形態」の旧案内だった。UIの現行legend/summary/selectと既存全条件一致のtipは表示済み。403表示はなく、実HTTPステータスは未計測。全文は当日日次に保存し、子の取得成功とは区別する。

最新main e75ad895と配布54a81c6のソースを再読。FAQは固定PHP文字列でDB条件による旧文言分岐がない。static入口にFAQなし。配布ログは54a81c6 checkoutとstaging PHP lintを示すが、実体のhashや稼働PHP版は未取得。対象6 PHPで正規tarを隔離再現し、_backend/cafe-seo.phpが単一収録/byte一致。Git blob6b2fb67、8062bytes、期待SHA-256 `066a8269b7e11a847b5b19c1d9fbe2752156177e0b01a8a3f4a5fdd0032338e0`。実配布archive/実サーバーのhash確認ではない。

10/19に[Caddyのphp_fastcgi一次資料](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi)と[PHPのOPcache設定一次資料](https://www.php.net/manual/en/opcache.configuration.php)を再読。symlinkの実体root解決と、timestamp検証を無効にした場合の更新反映条件は確認できるが、本番でその条件が成立する証拠はない。原因候補として保持し、設定変更や失効処理を実行する根拠へ置き換えない。

現ユーザーに既存SSH設定/標準identity/known_hosts/agent/対象host-user変数はなく、SSHツールもない。稼働current/hash/有効FastCGI・FPM設定の読取が停止点。PR30スクリプト実行・Caddy/キャッシュ/サービス操作・診断用公開・新規認証は行わない。所在地title/地域導線の既完了を再開しない。

## 2026-10-20 現行のカフェ折りたたみ入口

- 承認Library全文512行/19840bytes、更新2026-10-11T23:01:55.298096Zをnative readで再確認。現行AGENTSとremote/localの関連指示を確認。以前のmaterialize失敗は成功へ置換しない。
- main `917237c0ca0ce575ea83f7e3f085d3d03b8a5ae7` のserver/cafe-ui.php domestic_filtersとserver/cafe-seo.phpの2回答を実読。PR110（merge4fec6945）で未選択時に閉じるdetails「会話の方法・詳しい条件」が追加され、primaryFeaturesと「詳しい条件を追加」を内包している。既存のlegend/店舗タイプ/全条件一致の機能は保持されている。
- この実装を根拠に、FAQで外側を先に開くこと、店舗タイプは続いて内側を開く順序を案内する。店舗の営業・支援・予約条件の出典としては使わない。更新は2回答のみで、公式確認・未確認時の注意を保持する。
- PR108〜113/117/119/120のmerged状態とscopeを読取確認。読みもの11下書き/公開0と隔離dry-run10原稿は親受領の報告で、本番集計や公開/import承認ではない。既存機能・データを変更しない。
- 10/19親QAの旧FAQを当日の証拠として保持し、10/20の本番観測に延長しない。最新配布39297051640のcheckout/PHP lint/SEO130成功は読めたが、FAQの今日の実URL内容は未取得。親の正式QAで確定する。

## 2026-10-21 PR121の独立公開照合完了

正本Library全512行/19840bytesをnative readで再確認し、更新日時は不変。開始main3550e773と現行AGENTS/公開workflowを読取確認。PR121以降28コミットでもFAQ2回答とコントロール名は同じで、公開QA待ちを理由とする追加コード変更は不要だった。

親の正式クラウドChromeが10/21 08:13 JSTに識別付きカフェURLをAX/スクリーンショットで照合。FAQ2問の展開と本文、外側「会話の方法・詳しい条件」→内側「詳しい条件を追加」を開くと「店舗タイプ」が現れる実UIまで一致。全条件一致の説明も確認。条件送信/サイト変更なし、タブ閉鎖済み。これは親から受領した本番証拠であり、子の直接HTTP・合成部品・実機音声の証拠とは区別する。

GitHubでPR121 merged、head5cba95e3/CI39344105058と配布61aaa094/XServer39344289470のsuccessを再読。現在main3550e773のXServer39444100956も実deployがsuccess。後続39452099075はdeploy skippedであり、新配布と数えない。CI成功だけを本文反映の根拠にせず、今回の親QAと合わせて操作案内を完了とする。旧表示の原因・解消時点は未特定のまま保持する。

## 2026-10-23 FAQから一覧へ戻る導線と店舗出典

- 正本Library全文512行/19840bytesをnative readで再確認、更新日時は不変。現行AGENTS/SERVER_CURATIONと関連指示を確認。GitHub/Libraryの当日読取は成功し、過去の拒否/失敗を迂回しない。
- main a1140019/d04e78c0のserver/cafe-ui.php domestic_cafe_pageは、結果section id=cafesを常に出力し、ページ送り/関連記事の後でcafe_discovery_guideを呼ぶ。FAQ末尾に同じ結果へ戻る導線はなかった。既存IDへfragment-onlyリンクを1件追加し、queryや検索処理を変更しない。
- [W3C Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)を実読し、行き先が分かる「手話カフェの一覧へ戻る」を選ぶ。WCAG全項目適合や実機音声の検証とは主張しない。
- [西尾茶屋公式Web](https://signing-wacafe-nishiochaya.com/)の火曜定休は確認できたが、適用日の根拠は未確定。LINEの月曜休みは親提供の相違報告で今回の再取得ではない。曜日/営業時間/確認日は変更0。
- [Knot奈良企画](https://www.k-knot2018.com/p/15/)は奈良の会場と企画休止を案内し、[芦屋川店舗](https://www.k-knot2018.com/p/34/)は別の見出し/住所のページ。休止を店舗全体へ転用せず、店舗の現在の営業状態を今回新認定しない。連絡・予約・SNS収集拡張も行わない。
- 合成HTTP/現行CSS・JSの9ケースで一覧移動/次のTab/条件と識別保持を確認。公開HTML/PHPの直接確認とは区別し、正規CI/Deployと親の公開QAを別に記録する。

### 10/23 公開QAと配信整合の証拠

[PR139](https://github.com/deaf-navi/deaf-navi-web/pull/139)のhead `2818f7507b3154e59d58c0d335f786c44829f0a2` は[CI39877067946](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39877067946)全工程success（Node271、stories JS11＋隔離128、PHP SEO130、おとまど91、国内468/World600/iOS）。通常squash `0e30ab54b385b2f0647285f9cdc006038152376e` の[XServer39877282606](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39877282606)は09:18:55 JSTにsuccess。実parentはd04e78c0、差分はPHP1行＋運用5文書。

親の正式クラウドChrome/CUAでは09:21 JSTの識別付きURL、09:22 JSTの通常URLで新リンクがAX/スクリーンショットに不在。FAQ4項目の直後は掲載方針。後続main `7e2ed8bb521ff8b075e17ec51a7a893f39eca95e` の[XServer39878229270](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39878229270)も09:28:45 JSTに実deploy successだが、09:32 JSTの新規タブでも不在だった。検索条件保持/リンク移動は本番未検証、HTTPstatus未計測。タブ閉鎖済み、設定変更/キャッシュ削除なし。Deploy成功だけでは公開QAを完了としない。

配布元のcafe-seo.phpは8219bytes、Git blob `82f3acee15b21d23adcc11a62fb4cede6c6f1431`、期待SHA-256 `868972728ac88ea7fea58d4e868da781d79a47bd907decdfac78a334309a812b`。現時点では本番ファイルの実測hashではない。

本人の09:32 JSTの指示と親の追跡委任により、既存接続でcurrent/hashを読む通常Deployの整合確認を準備した。ローカルでYAMLの変更範囲（既存Activate/Verifyのrunだけ）、全Deploy shellのbash構文、正常/改変/欠落PHP、正常/不正hash入力、currentの一致/不一致、公開リンク有/無、Cookie/認証headerの非出力を検証して成功。外部通信/本番操作のないfixture検証であり、実サーバー/公開の成功ではない。既存PR CI→通常マージ→正規Deployで稼働実体と公開本文を分けて確認する。復旧は今回の検証差分だけを戻せる。

現在の消費側Linuxには既存Windows/SSHの遠隔実行ツールが露出せず、SSH設定/標準identity/known_hosts/agent/対象host-user変数もない。別のアプリを接続代理として使わず、既存Deploy内で非秘密のrelease path/hashと公開本文有無だけを取得する。新権限や設定変更が必要なら具体的な承認を求め、拒否を迂回しない。実行PHP版/有効FastCGI設定・原因は未確定。店舗曜日・営業状態・確認日と検索値は更新しない。

### 09:47 JST 実サーバーhashと公開HTTP本文

[PR141](https://github.com/deaf-navi/deaf-navi-web/pull/141)のhead `fe502e47859c98077d39d811e5792b334aa07490` /[CI39879857464](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39879857464)は全工程success。通常squash `b83508f168d98cfc8fd029c03e24246483f8d7b1` の[Deploy39880077869](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880077869)も09:47:16 JSTにsuccess。実parent092b36de、workflowと運用5文書だけで、対象PHPはPR139と同一。

09:47:10〜11 JSTの正規SSH activationで、切替前currentは `/srv/deafnavi/releases/092b36de1e7c2eeb8b00ccb2e0027298a2e4d770-39879138679-1`、切替後は `/srv/deafnavi/releases/b83508f168d98cfc8fd029c03e24246483f8d7b1-39880077869-1`。切替前PHP・staging・切替後currentの3つの実測SHA-256はすべて `868972728ac88ea7fea58d4e868da781d79a47bd907decdfac78a334309a812b` でGit原本と一致。これにより、この観測時点の配布ファイルとcurrent参照先の不一致は見つからなかった。09:18/09:28の実サーバーhashまで遡って測定したとはしない。

09:47:14 JSTの既存runnerによる識別付き公開GETはHTTP/1.1 200 OK、Content-Type text/html、Via Caddy、Cache-Controlはprivate/no-store/max-age=0とno-store/no-cache/must-revalidateを返したが、新リンクはHTML内にも不在。workflowがQA未完のwarningを記録した。これは配布元/ファイルの一致と、公開本文の不一致を同時に示す。公開実行PHPのパス・保持状態/有効設定はまだ未確定で、OPcache等の原因を確定しない。

[Caddy一次資料](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi)と[PHP OPcache一次資料](https://www.php.net/manual/en/opcache.configuration.php)を再読した。root symlinkを実体へ解決する設定とtimestamp検証条件は一般的な仕様の根拠で、本番原因の証明ではない。Git管理のdeploy/caddy/deafnavi-directory.caddyはcurrent root・専用socket・backend rewriteで、resolve_root_symlink記載なし。有効な本番設定と同一と認定しない。

次は有効なDeaf Navi専用FastCGI root/socketとPHP-FPMの関連設定を非秘密部分だけで照合する必要がある。過去のCaddy/PR30実行・cache操作の承認待ちを維持し、PR30全体の実行、設定適用、サービスreload/restart、失効は未実施。条件付きの専用resolve_root_symlink案・限定QA・復旧手順は[配信診断と承認候補](delivery-diagnosis-20261023.md)へ保存し、実設定読取と必要性の確定前に適用しない。新しい認証/権限/サービス・DNS変更は行わない。

後続の通常国内生成更新 `b50b3dae2a2975d3bfa9c3347911c4d929b7779d` の[XServer39880357771](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880357771)でも09:50:05〜06 JSTに切替前/staging/currentの同じSHA-256一致とcurrent参照先を実測。09:50:10 JSTの公開GETは再びHTTP200/no-storeでリンク不在。後続公開を待つだけでは解消を確認できていない。

### 限定読取承認とWindows担当からの結果

2026-10-23 10:14 JSTの本人「読み取りいいよ」と親の限定委任により、既存の正規接続でDeaf Naviの配信先/current実体と有効Caddy/FastCGI/PHP-FPM設定の非秘密項目を読むことは承認済み。設定変更・権限拡張・キャッシュ消去・再起動・graceful reloadは未承認のまま。PR30全体の実行やDB読取の包括承認へ広げない。

親から受領したWindows担当作業 `01a16656-a59b-7156-b02f-cb79a1f90009` の報告では、本日成功したDeployのDEPLOY_HOSTと既存SSH宛先が一致した。ただし、Windows実行環境でそのホストとdeafnavi.comの通常DNS照会が双方「アクセス拒否」error 5となり、DNS回答は未取得。照会の実施時刻はこの子に未提供で、10:14 JSTの承認時刻を照会時刻へ転用しない。

NXDOMAINやサーバー停止を確認した結果ではない。SSH認証・遠隔実行へ到達しておらず、SSH認証失敗とも扱わない。VPS内の有効Caddy/FastCGI/PHP-FPM設定・公開リクエストの実行ファイルは未取得。09:47/09:50の正規Deployで得たcurrent/hashの一致と、その時点の公開HTMLのリンク不在は従来の証拠として保持する。

これは親から受領したWindows担当の報告であり、この子がWindowsの生ログやVPS設定を直接取得した証拠ではない。DEPLOY_HOST一致は接続先の照合で、DNS回答/SSH認証/遠隔実行の成功を意味しない。秘密値や資格情報を記録しない。

状態は公開QA未完・実行環境待ち。本人への具体的な阻害要因の通知済みは親の報告として記録する。権限拒否を迂回せず、追加の再公開・設定/キャッシュ/reload・権限変更は行わない。次は既存接続で限定読取を実行できる環境が利用可能になったときに再開し、承認済みの読取を再承認待ちへ戻さない。新規接続や資格情報を追加しない。

## 2026-10-27 既存公開ログと静的ソースの照合

正本Library全512行/19840bytesをnative readで再確認し、更新2026-10-11T23:01:55.298096Zは不変。過去のmaterialize失敗を成功へ置換せず、追加再試行や他環境パスの流用はしない。最新AGENTSを実読、ローカルの関連.agents/skillsはなかった。

10/27 07:56:25 JSTの[既存Deploy40416072301](https://github.com/deaf-navi/deaf-navi-web/actions/runs/40416072301)は、main `20c1f7ed1e2058d72bd01bf948cbb599f1f03f76` の識別付きカフェ公開GETでHTTP200/no-storeと「手話カフェの一覧へ戻る」のHTML内存在を記録した。current参照先と対象PHPのstaging/current SHA-256 `3400dbe91cabbb9c5de67d92151959715adbafe18bc5315175169596fc05fc13` の一致もログで確認した。

これは既存Actionsの観測をこの作業で読んだ証拠であり、新しい直接GET・ブラウザー実表示/クリックの証拠ではない。#cafesへの実クリック、検索query・絞込条件・表示状態の保持と、初回4修正の当日公開再読は未完。CONNECT403は新たな関連証拠がないため再試行せず、別経路で迂回しない。

同じmainのsitemap.xml/sitemap-world.xmlは合計85エントリ・83固有URL。PHP配信の全国一覧/地図2URLを別扱いとし、残る静的81ページのhead全体をGitHubのソースから照合した。すべて掲載URLとcanonicalが一致し、meta noindex/refreshは検出しなかった。これは2つの静的XMLとソースheadに限る検査で、公開HTTP・Googleの選択canonical・GSC対象URL・動的directory/stories sitemapの検証ではない。

検査の入力・全81ページのmetadata・範囲を[daily/2026-10-27-source-check.json](daily/2026-10-27-source-check.json)へ保存する。[Google Search Centralのsitemap公式資料](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)も参照し、掲載URLと優先canonicalの整合を検査対象にした。Googleによる実際の登録・選択や、全動的URLの監査を証明するものではない。

10/26 20:50 JSTのnoindex/sitemap・redirect通知は親から受領した要約で、この接続の限定メール検索では原文を同定できなかった。10/26 07:09 JSTの別通知は前回の原文読取と今回の検索で確認できるが、両通知を同一視しない。対象URL・件数・クロール日とGSCレポート本体は未取得。外部AUDIT.mdの指摘は未検証の材料であり、変更権限や原因確定の根拠へ置換しない。

PR164は未確認開催回のnoindex判定とdirectory-sitemapの除外判定を同じcafe_event_periodへ揃えた既存実装で、重複変更しない。外部監査を扱ったPR181もmergedだが、外部指摘全体が独立検証済みとは認定しない。guesthouses等の別作業は静的headの読取だけに留め、内容や制度/緊急案内を編集しない。
