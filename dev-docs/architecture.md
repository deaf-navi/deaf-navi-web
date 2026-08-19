# アーキテクチャ（Deaf Navi Web 2.0）

## 全体像

```
                    ┌─ config/（情報源・語彙・分類・地域の定義 = 編集ポイント）
                    ▼
RSS/Atom ──┐   src/curate.mjs ──────► docs/articles.json ──┬─► src/build.mjs ─► docs/*.html（トップ/ガイド/アーカイブ/サイトマップ/RSS/PWA）
Google News┘   （src/lib/ の純関数群）  docs/articles-old.json │
                                                            └─► src/app-api-build.mjs ─► docs/app/v1/*.json（iOSアプリ互換・無変更レイヤー）
Google News（324クエリ・多言語）
   └► src/world-curate.mjs ─► docs/articles-world.json ─► src/world-build.mjs ─► World HTML/RSS
        （翻訳: translate.googleapis.com + 用語補正 + 任意: Codex App Server 日本語後編集）
```

- **依存パッケージゼロ**（Node 20+ 標準のみ）。ビルドは数秒・サプライチェーンリスクなし
- **docs/ = GitHub Pages 公開ルート**。自動生成物なので直接編集しない
- **静的生成 + 遅延ハイドレーション**: トップは最新60件をSSR（JSなしでも閲覧可）、
  検索・61件目以降は `articles.json` をクライアントが遅延取得して描画

## レイヤー構成

| レイヤー | 場所 | ルール |
|---|---|---|
| 設定 | `config/` | データのみ。ロジックを書かない |
| 純関数 | `src/lib/` | I/O禁止。すべて `test/` の対象 |
| オーケストレータ | `src/curate.mjs`, `src/build.mjs` | I/Oとフロー制御のみ。ロジックは lib へ |
| テンプレート | `src/templates/` | 文字列を返す純関数。`escapeHtml` を必ず通す |
| クライアント | `src/app.js`, `src/guide.js` | ビルド非経由の静的JS。ラベルは config と二重管理（`test/client-labels.test.mjs` が同期を担保） |
| 互換レイヤー | `src/app-api-build.mjs` | **原則変更しない**。入力（articles*.json）のスキーマ維持で互換を保証 |

## iOS API 互換契約（最重要）

出荷済みiOSアプリが `docs/app/v1/` を参照している。以下は**破壊禁止**:

1. **URL**: 正規URL `https://deaf-navi.github.io/deaf-navi-web/app/v1/` 配下の12ファイル名
   - 出荷済みアプリ向けに、旧URL `https://tamas-hub.github.io/deaf-navi-web/app/v1/` でも同じJSONを互換配信する
2. **フラット配列**（ios-news-v1/v2, ios-world-jp-v1/v2, ios-world-original-v1/v2）:
   キーは `id, title, summary, url, publishedAt, sourceName, sourceURL, category` の8個・この順序
3. **日付形式**: ISO 8601 UTC 秒精度・ミリ秒なし（例 `2026-08-12T09:30:47Z`）。
   Swift `JSONDecoder.DateDecodingStrategy.iso8601` 互換
4. **カテゴリenum**: v1系 = `all/policy/medical/education/culture/sports/local/general` のみ。
   v2国内 = 12カテゴリ、v2World = `IOS_V2_WORLD_CATEGORY` の9種。未知カテゴリは `general` へフォールバック
5. **省略セマンティクス**: `compactObject` は null/undefined/空配列を**キーごと省略**し、空文字列は**保持**する。
   省略→null 化や空文字→省略化は Swift Codable を壊す
6. **その他**: `id === url`（記事URL）/ `stableId = 接頭辞_sha256先頭20hex` / `sourceURL` と `sourceUrl` の両方出力 /
   `manifest.json` と `index.json` は同一内容 / relay カテゴリは v1国内配列から除外
7. **generatedAt はソースJSONの生成時刻**（ビルド時刻ではない）

**担保方法**: `test/ios-api-compat.test.mjs` がコミット済みデータから再生成して全項目を検証（CIで毎PR実行）。

### articles.json（互換契約の入力側）

`src/curate.mjs` の出力スキーマも実質的な契約:

```jsonc
{
  "generatedAt": "ISO", "variant": "prod", "profile": "expanded",
  "count": 505,
  "quality": { "version": "expanded-score-v4", ... },   // レポート（アプリは主要キーのみ参照）
  "articles": [{
    "id": "https://...",         // 記事URL（キー）
    "title": "...", "summary": "",
    "sourceName": "...", "sourceUrl": "https://...",
    "publishedAt": "ISO",
    "sourceType": "rss|atom|video|social",
    "category": "policy|accessibility|relay|medical|education|technology|culture|sports|safety|event|local|general",
    "sourceTier": "official|specialist|news|broad",
    "discoveryMethod": "direct-feed|google-news",
    "region": "kanto",           // 2.0追加（任意。アプリ向け出力へは伝播しない）
    "prefecture": "東京都"        // 2.0追加（任意）
  }]
}
```

## フロントエンド設計

- **カードのクラスAPI**（`.card` `.chip` `.filter` `.source-tier` 等）は World 版と共通。
  `styles.css` は world-build により `styles-world.css` としてもコピーされる（単一ソース）
- **テーマ**: ライトのトークンを `:root`、ダークを `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) }` と
  `:root[data-theme="dark"]` の両方に定義（OS連動＋手動切替）。FOUC防止の小さなインラインスクリプトが `<head>` にある
- **文字サイズ**: `html[data-font=large|xlarge]` で rem 基準を 112.5% / 125% に拡大
- **クライアント描画**: `<template id="card-template">` を複製して差し込む（SSRカードと同一構造）。
  初期状態はSSRを尊重し、JSON取得後にカウント類を同期（`src/app.js` 初期化コメント参照）
- **アーカイブ**: `index-old.html` は月別目次。実体は `archive/YYYY-MM.html`（2024年以前と日付不明分は `archive/legacy.html` に集約）

## PWA

- `sw.js`: ページ/JSONはネットワーク優先（オフライン時のみキャッシュ）、静的アセットはキャッシュ優先＋背景更新。
  「古いニュースを最新と誤認させない」ため、鮮度はページ内の最終更新時刻表示が担う
- キャッシュ世代は `__BUILD_ID__`（build.mjs が generatedAt へ置換）で切替
- `guide.html` は災害時利用を想定してプリキャッシュ
- オフライン時は `offline.html` へフォールバック。トップにはオンライン状態の通知（`#offline-note`）あり

## セキュリティ

- 生成HTMLは全フィールドを `escapeHtml`/`escapeXml` 経由で出力（外部RSS由来テキストのXSS対策）
- Actions 権限: 公開系 = `contents: write` + `issues: write` のみ / CI = `contents: read` のみ
- 外部スクリプトは Cloudflare Web Analytics（cookieless）のみ
- `serve.mjs` はパストラバーサル対策済み（ローカル専用）
- Codex App Server（VPS側）: トークン認証・タイプ許可リスト・読み取り専用サンドボックス・エラー詳細の秘匿
