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
