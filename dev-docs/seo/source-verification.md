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
