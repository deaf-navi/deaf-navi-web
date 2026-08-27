# Deaf Navi Web 2.0

聴覚障害・難聴・ろう者・中途失聴者コミュニティのための情報ポータル。
信頼できる情報源からニュースを自動収集・分類し、緊急通報・制度などの公式情報への入口とあわせて届ける。

- **URL**: https://deaf-navi.github.io/deaf-navi-web/
- **更新**: GitHub Actions が1日3回（JST 6:00 / 12:00 / 18:00ごろ）自動更新
- **ホスティング**: GitHub Pages（月額0円・SSL付き）
- **スタック**: Node 20+（標準ライブラリのみ・依存パッケージゼロ）+ 静的 HTML/CSS/JS
- **アプリ連携**: `docs/app/v1/` に iOS アプリ「Deaf Navi」向け同期JSONを生成（後方互換を保証）

## 2.0 の主な機能

| 機能 | 内容 |
|---|---|
| 情報設計 | クイックアクセス（緊急通報・防災・制度・ガイド）と「注目」（公式・専門団体の新着）をトップに配置 |
| 検索・絞り込み | フリーワード / カテゴリ12種 / 情報源区分 / 期間 / 地域ブロック。全条件をURLに同期（共有可能） |
| 情報源の透明性 | 全記事に「一次情報 / 専門情報 / 報道・発見 / 関連媒体」の選定区分と取得方法を表示 |
| 表示設定 | ダーク表示（OS連動＋手動）・文字サイズ3段階（高齢ユーザー配慮） |
| PWA | ホーム画面追加・オフライン閲覧（暮らしのガイドをプリキャッシュ）・最終更新時刻の明示 |
| 情報保障ツール | `otomado/` で音の可視化・リアルタイム字幕・筆談ボードを提供。React/Vite依存はツール配下に隔離 |
| 軽量化 | トップは初期60件のみサーバ生成し全件はJSONを遅延取得（v1比 約1/5 の容量） |
| アクセシビリティ | WCAG 2.2 AA コントラスト達成・タッチターゲット44px・キーボード操作・スキップリンク |

## ディレクトリ構成

```
deaf-navi-web/
├── config/                    # ★編集はここから（情報源・語彙・分類の定義）
│   ├── site.mjs               # サイトURL・ブランド文言・外部サービス設定
│   ├── sources.domestic.mjs   # 国内RSS/Atomフィード・Google Newsクエリ定義
│   ├── scoring.mjs            # 関連度スコア語彙・しきい値・優先情報源
│   ├── categories.mjs         # カテゴリ定義・自動分類ルール（判定順が仕様）
│   └── regions.mjs            # 都道府県→地域ブロック判定テーブル
├── src/
│   ├── curate.mjs             # 国内キュレーション実行（取得→選定→JSON出力）
│   ├── build.mjs              # 静的サイトビルド（articles.json→HTML群）
│   ├── app-api-build.mjs      # iOSアプリ同期JSON生成（互換レイヤー・原則変更しない）
│   ├── world-curate.mjs       # World版キュレーション（翻訳・Codex後編集含む）
│   ├── world-build.mjs        # World版HTML生成
│   ├── lib/                   # 純関数ライブラリ（I/Oなし・テスト対象）
│   │   ├── text.mjs           #   テキスト正規化・エスケープ・類似度
│   │   ├── feed-parser.mjs    #   RSS/Atomパーサ（不正日付はnull化）
│   │   ├── fetch-retry.mjs    #   タイムアウト・指数バックオフ付きfetch
│   │   ├── curation.mjs       #   分類・地域検出・スコア・重複除去・選定
│   │   └── dates.mjs          #   JST日時表示
│   ├── templates/             # ページテンプレート（home/archive/about/guide/feeds/partials）
│   ├── assets/                # PWAアセット（manifest/sw.js/offline/アイコン/OGP画像）
│   ├── styles.css             # デザインシステム2.0（World版と共通）
│   ├── app.js                 # トップページのクライアント（検索・フィルタ・表示設定）
│   ├── guide.js               # 暮らしのガイド検索
│   ├── guide-data.mjs         # 暮らしのガイド掲載データ
│   └── serve.mjs              # ローカル確認サーバ
├── scripts/
│   ├── verify-site.mjs        # 国内版の公開前検証（スキーマ・UI・PWA・アーカイブ）
│   ├── verify-world.mjs       # World版の公開前検証（fail-soft）
│   └── codex-app-server*.mjs  # VPS側 Codex App Server（World-JP日本語後編集用・本体はVPSで稼働）
├── test/                      # node --test（unit/integration/iOS互換regression）
├── tools/otomado/             # 情報保障PWA「おとまど」（React/Vite・独立package）
├── docs/                      # ★GitHub Pages 公開ルート（自動生成物・直接編集しない）
│   ├── index.html             # トップ（初期60件SSR）
│   ├── articles.json          # 国内キュレーション結果（iOS API の入力・スキーマ互換必須）
│   ├── articles-old.json      # 過去アーカイブデータ（最大5000件）
│   ├── index-old.html         # アーカイブ目次 → archive/YYYY-MM.html へ月別分割
│   ├── app/v1/                # iOSアプリ同期JSON（互換契約: dev-docs/architecture.md）
│   ├── manifest.webmanifest / sw.js / offline.html / icons/  # PWA
│   ├── otomado/               # tools/otomado の本番ビルド出力
│   └── deaf-navi-world-*.html # World版ページ
├── dev-docs/                  # 開発者向けドキュメント（docs/はPages公開用のため分離）
│   ├── architecture.md        # アーキテクチャと互換契約
│   ├── data-pipeline.md       # データ収集・品質ゲートの詳細
│   └── operations.md          # 運用・障害対応
└── .github/workflows/
    ├── curate.yml             # 本番更新（1日3回cron: 国内+World+アプリJSON→commit）
    ├── curate-world.yml       # World単独の手動更新
    ├── app-sync.yml           # アプリJSON単独の手動更新
    └── ci.yml                 # PR検証（test/build/verify・書き込み権限なし）
```

## ローカル開発

```bash
npm run curate        # 国内RSS取得 → docs/articles.json（要ネットワーク）
npm run build         # HTML生成（コミット済みJSONがあればオフラインで可）
npm run verify        # 公開前検証
npm test              # テスト一式（node --test・ネットワーク不要）
npm run serve         # http://localhost:5173 で確認
npm run generate      # curate + build + verify（Actionsと同じ）
npm run generate:world # World版一式（Codex App Serverなしでも動作、後編集はスキップされる）
npm run build:app-api # docs/app/v1 のアプリ同期JSON生成
npm ci --prefix tools/otomado  # おとまど依存を初回セットアップ
npm run test:otomado           # おとまどのVitest
npm run build:otomado          # おとまどを docs/otomado/ へビルド
npm run preview:otomado        # おとまどを含むdocs/をローカル配信
```

## 情報源・カテゴリの追加方法

1. **RSSフィードを増やす**: `config/sources.domestic.mjs` の `DIRECT_FEEDS`（または `EXPANDED_DIRECT_FEEDS`）に追記。`sourceTier`（official/specialist/broad）と、必要なら `minScore` / `passThrough` を設定
2. **Google News検索語を増やす**: 同ファイルの `KEYWORD_GROUPS` に追記
3. **関連語・スコアの調整**: `config/scoring.mjs`
4. **カテゴリ判定の調整**: `config/categories.mjs` の `CATEGORY_RULES`（**判定順が仕様**。relay→culture→sports の順序は変更しない）
5. PRを出すと CI（test/build/verify）が走る。マージすると次回cronから反映

**注意**: カテゴリ id の追加・変更は iOS アプリ互換（`src/app-api-build.mjs` と `dev-docs/architecture.md`）の確認が必須。

## Analytics

公開HTMLの利用状況と表示性能は [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) で確認する。GitHub Pagesは維持し、Cloudflare Pages・Worker・独自のアクセス解析DBは使用しない。

- 設定場所: `config/site.mjs` の `ANALYTICS`
- 有効化: `provider: 'cloudflare'`、`enabled: true`、`token` にWeb AnalyticsのBeacon Tokenを設定
- 無効化: `enabled: false`（token未設定・不正時もfail-softでBeaconを出力しない）
- Tokenは最終的に公開HTMLへ含まれるサイト識別子であり、API Secretではない。GitHub Actions Secretや環境変数は使わない
- 国内版・About・ガイド・サイトマップ・アーカイブ・オフラインページは `npm run build`、World 4ページは `npm run build:world`、おとまどは `npm run build:otomado` で同じ設定から生成される
- `npm run verify` / `npm run verify:world` は、対象HTMLごとにBeaconがちょうど1個あることを確認する。Analytics無効時はBeaconなしを正常状態として扱う

Tokenの登録・変更手順（Cloudflare Dashboardの2026年8月時点の案内）:

1. Cloudflare Dashboardの **Analytics & Logs > Web Analytics** を開く
2. **Add a site** を選び、hostnameに `deaf-navi.github.io` を入力して候補を選択し **Done**
3. 対象サイトの **Manage site** でJS snippetを表示し、`data-cf-beacon` 内のtokenを取得
4. `config/site.mjs` の `ANALYTICS.token` だけを置き換える（hostname移転後は登録hostnameも必ず確認する）
5. `npm test`、`npm run build`、`npm run build:world`、`npm run build:otomado`、`npm run verify`、`npm run verify:world` を実行し、生成された `docs/` を公開する

アクセス数はCloudflare Dashboardの **Web Analytics** で対象サイトを開き、期間を選択して確認する。Pathでトップ、国内版、World、`/otomado/`、archive、guideを比較でき、Referer、Country、Device type、Browser、Operating systemでも絞り込める。反映には数分かかる場合があり、広告ブロッカー等でBeaconが遮断されたアクセスは集計されない。

Cloudflareの公式説明では、Web AnalyticsはCookieやlocalStorageなどのクライアント側状態を解析用途に使わず、IPアドレスやUser-Agentによる個人の継続追跡・フィンガープリントを行わない。クエリ文字列も記録しない。この導入のためのCookie同意バナーは追加していない。将来CSPを導入する場合は、`script-src` で `https://static.cloudflareinsights.com/beacon.min.js`、`connect-src` で `https://cloudflareinsights.com` を許可する。

## データ品質・検証

- `npm run generate` は curate → build → **verify** の順で実行され、verify が失敗すると公開（commit）されない
- verify の内容: articles.json スキーマ / URL・日付妥当性 / 重複 / カテゴリ・地域enum / 主要UI・SEO要素 / PWAアセット / アーカイブ整合
- 日付が解釈できない記事は取り込まない（2.0で「取得時刻すり替え」を廃止）
- 一時的な取得エラーは指数バックオフで再試行し、失敗ソースはスキップして継続（fail-soft）。全滅時のみ前回データを保持して中断
- テスト: `npm test`（37件）— 分類・重複除去・パーサ・iOS互換スキーマ・クライアントラベル同期

## iOSアプリ連携（後方互換）

`docs/app/v1/` の12ファイルは出荷済みiOSアプリが参照する**互換契約**。URL・キー構成・日付形式（ISO 8601 秒精度Z）・カテゴリenumは変更しない。
詳細: [dev-docs/architecture.md](dev-docs/architecture.md)。互換性は `test/ios-api-compat.test.mjs` が regression テストで担保する。

主要URL:
- https://deaf-navi.github.io/deaf-navi-web/app/v1/manifest.json
- https://deaf-navi.github.io/deaf-navi-web/app/v1/ios-news-v2.json （現行アプリ・国内）
- https://deaf-navi.github.io/deaf-navi-web/app/v1/ios-world-jp-v2.json （現行アプリ・World）

出荷済みアプリが参照する旧 `tamas-hub.github.io` のAPI URLは、互換リポジトリから同じJSONを継続配信する。

## 運用・障害対応

- Actions失敗時は固定タイトルのIssueに集約される（乱立しない）
- World-JP の日本語後編集（Codex App Server）が落ちても、カバレッジ85%を下回らない限り公開は継続する
- 詳細な障害対応手順: [dev-docs/operations.md](dev-docs/operations.md)

## コスト

- GitHub Pages: 無料（帯域ソフトリミット100GB/月）
- GitHub Actions: 無料枠2000分/月で十分（1日3回運用）
- 外部有料サービス: なし（Codex App Server は自前VPS上の任意コンポーネント。停止してもサイトは動く）

## アクセシビリティ方針

- 目標: WCAG 2.2 AA（2.0でコントラスト全項目4.5:1以上を実測確認）
- セマンティックHTML・キーボード完結・スキップリンク・`focus-visible`・`aria-pressed`/`aria-live`
- ダーク表示: `prefers-color-scheme` 連動＋手動切替 / アニメーション: `prefers-reduced-motion` 抑制
- 文字サイズ3段階切替・200%ズームで横スクロールなし・タッチターゲット44px
- 状態は色だけに依存しない（カテゴリ=色ドット＋テキスト、選定区分=テキストバッジ）

## ライセンス

- サイトのコード: MIT
- 記事の著作権: 各発信元に帰属（タイトル・要約・外部リンクのみ表示）
