# Deaf Navi Web

聴覚障害・難聴・ろう者コミュニティ向けのニュースキュレーションサイト。Deaf Navi アプリで利用している選定条件を流用し、静的サイトとして公開する。

## 概要

- **URL**: `https://tamas-hub.github.io/deaf-navi-web/`
- **更新**: GitHub Actions が1日3回（JST 6:00 / 12:00 / 18:00）RSS を取得し `docs/` 配下を自動更新
- **ホスティング**: GitHub Pages（完全無料・SSL 付き）
- **スタック**: Node 20（標準 fetch のみ）+ 静的 HTML/CSS/JS
- **アプリ同期**: `docs/app/v1/` に Deaf Navi iOS アプリ参照用の同期JSONを生成

## 情報源

### 直接 RSS フィード

- 全日本ろうあ連盟 (一般)
- 全日本ろうあ連盟 / 手話言語法カテゴリ
- しかくタイムズ
- 東京都聴覚障害者連盟
- 全日本難聴者・中途失聴者団体連合会
- 全国手話研修センター
- 聴力障害者情報文化センター
- 北海道・札幌・兵庫・鹿児島・沖縄の聴覚障害者情報センター、地域団体
- 電話リレーサービス / 日本財団電話リレーサービス
- 全通研NOW!!
- 日本聴覚医学会
- デフスポーツ関連団体、YouTube公式チャンネル、note、UDCast、Palabra、Silent Voice など

### Google News RSS

- `聴覚障害 OR 難聴` / `ろう者 OR ろうあ者 OR 中途失聴` / `手話 OR 情報保障`
- `情報保障` / `アクセシビリティ` / `合理的配慮` / `手話通訳` / `要約筆記` / `字幕`
- `制度・政策` / `医療` / `教育` / `技術・AI` / `防災・安全` / `イベント・講座`
- `デフリンピック` / `デフスポーツ` / `ろう文化・芸能`
- `site:jfd.or.jp` / `site:asahi.com 聴覚障害` / `site:yomiuri.co.jp 聴覚障害`
- `site:prtimes.jp 聴覚障害` / `site:rehab.go.jp 聴覚障害`

### フィルタ

- **関連性**: 関連語スコアで本文・タイトルを照合（公式・専門の一部はパス）
- **情報源の透明性**: 一次情報 / 専門情報 / 報道・発見 / 関連媒体の4段階と、直接フィード・Google News経由の取得方法を表示
- **鮮度**: 原則180日以内に限定し、取得障害時は45日以内の前回データをフォールバック
- **カテゴリ自動分類**: policy / accessibility / relay / medical / education / technology / culture / sports / safety / event / local / general
- **重複除去**: 記事 URL キー、数字を保護した高精度の近似タイトル判定で dedupe
- **取得耐性**: 一時的なHTTPエラーやタイムアウトを指数バックオフ付きで再試行
- **並び**: `publishedAt` 降順
- **old退避**: 400件を超えた記事を `articles-old.json` / `index-old.html` に蓄積

## ディレクトリ構成

```
deaf-navi-web/
├── .github/workflows/curate.yml  # 1日3回 cron + 失敗時 Issue 自動作成
├── src/
│   ├── curate.mjs                # RSS 取得 → docs/articles.json
│   ├── build.mjs                 # docs/articles.json → docs/index.html
│   ├── guide-data.mjs            # 暮らしのガイド掲載データ
│   ├── guide.js                  # ガイド検索用クライアント JS
│   ├── styles.css                # UI スタイル
│   ├── app.js                    # フィルタボタン用クライアント JS
│   └── serve.mjs                 # ローカル確認用簡易サーバー
├── docs/                         # ← GitHub Pages 公開ディレクトリ
│   ├── index.html                # 自動生成
│   ├── index-old.html            # 400件超過分の過去アーカイブ
│   ├── guide.html                # 緊急通報・医療・教育・就労などのガイド
│   ├── articles.json             # 自動生成
│   ├── articles-old.json         # 400件超過分の蓄積データ
│   ├── app/v1/                   # iOSアプリ同期用JSON
│   ├── styles.css                # build でコピー
│   └── app.js                    # build でコピー
├── scripts/verify-site.mjs       # データ・SEO・主要UIの静的検証
├── package.json
└── README.md
```

## アプリ同期JSON

Web版の国内ニュース / World-JP / World-Original と同じ生成物から、iOS アプリが参照しやすい静的JSONを出力する。

- `docs/app/v1/manifest.json`: 国内・World各フィードのURL、カテゴリ、地域、更新間隔、互換情報
- `docs/app/v1/domestic.json`: 国内版のフルカテゴリ対応データ（`relay` は `excludedFromAll` で明示）
- `docs/app/v1/world-jp.json`: World-JP表示用。Google翻訳ベース + Deaf Navi用語補正 + Codex App Server後編集メタデータ付き
- `docs/app/v1/world-original.json`: World原文表示用。日本語訳は `translated` に保持
- `docs/app/v1/world-multilingual.json`: 日本語訳と原文を `localized.ja` / `localized.original` にまとめた多言語切替向けデータ
- `docs/app/v1/ios-news-v1.json`: 現行 iOS `Article` 互換の国内ニュース配列。現行enumに合わせ、`relay` は除外
- `docs/app/v1/ios-world-jp-v1.json` / `ios-world-original-v1.json`: 現行 iOS `Article` 互換のWorld配列

公開URL例:

- `https://tamas-hub.github.io/deaf-navi-web/app/v1/manifest.json`
- `https://tamas-hub.github.io/deaf-navi-web/app/v1/domestic.json`
- `https://tamas-hub.github.io/deaf-navi-web/app/v1/world-jp.json`
- `https://tamas-hub.github.io/deaf-navi-web/app/v1/world-multilingual.json`

現行 iOS 互換JSONは `JSONDecoder.DateDecodingStrategy.iso8601` で扱いやすいよう、日時をミリ秒なしUTC（例: `2026-05-10T00:32:12Z`）で出力する。

## ローカル開発

```bash
cd deaf-navi-web
npm run curate    # RSS 取得 → docs/articles.json
npm run build     # HTML 生成
npm run verify    # データ品質・SEO・主要UIを検証
npm run build:app-api # docs/app/v1 のアプリ同期JSON生成
npm run serve     # http://localhost:5173 で確認
```

一発: `npm run generate` で curate + build + verify。

## デプロイ手順（初回）

1. **GitHub リポジトリ作成** (`deaf-navi-web`)
2. ローカルから `git push`
3. **リポジトリ Settings → Pages**:
    - Source: `Deploy from a branch`
    - Branch: `main` / `/docs`
4. **Actions 権限**: Settings → Actions → General → Workflow permissions を `Read and write permissions` に
5. 初回は Actions タブで `Curate & Build` を手動実行 (`Run workflow`)
6. 数分後、`https://<user>.github.io/deaf-navi-web/` にアクセスして確認

## 運用・メンテナンス

| 頻度 | 作業 | 担当 |
|---|---|---|
| 自動（1日3回） | RSS 取得・記事更新・コミット | GitHub Actions |
| 自動（失敗時） | 既存の障害Issueへ集約（未作成時のみ新規作成） | Actions |
| 月 1 | 情報源・キーワード辞書の見直し | rin エージェント |
| 都度 | 新カテゴリ・UI 改善 | PR |

### 情報源・キーワードの更新方法

`src/curate.mjs` を編集して PR → マージすれば、次回 cron から反映される。

- `DIRECT_FEEDS` に RSS URL を追加
- `KEYWORD_GROUPS` に Google News 検索クエリを追加
- `RELEVANT_KEYWORDS` でフィルタ語彙を調整
- `guessCategory` の正規表現でカテゴリ判定を調整

### Actions 失敗時の対応

- 同じ障害Issueへ失敗Runのリンクが集約される
- 一時的なHTTPエラーは自動再試行し、一部ソース失敗時も取得済みデータと短期フォールバックから生成を継続する
- 全体失敗が続く場合はRunログの `Source health` と対象フィードを確認する

### コスト

- **GitHub Pages**: 無料（ソフトリミット帯域 100GB/月）
- **GitHub Actions**: 無料枠 2000 分/月、本プロジェクトの使用量は1日3回運用で十分収まる
- **独自ドメイン**（オプション）: 取得費のみ（GitHub Pages 側の設定は無料）

## アクセシビリティ方針

- WCAG 2.1 AA 準拠を目標とする
- セマンティック HTML（`header` / `nav` / `main` / `article` / `time` / `footer`）
- キーボード操作完結・`focus-visible` 明示
- スキップリンク・`aria-pressed` による状態提示
- `prefers-color-scheme` でダークモード対応
- `prefers-reduced-motion` でアニメーション抑制
- 色依存に頼らずテキスト情報でも判別可能なカテゴリ表示

## ライセンス

- サイトのコード: MIT
- 記事の著作権: 各発信元に帰属（タイトル・要約・外部リンクのみ表示）
