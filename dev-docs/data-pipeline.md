# データ収集パイプライン（国内版）

`src/curate.mjs` → `docs/articles.json` の流れと品質ゲートの詳細。
定義値はすべて `config/` にあり、処理本体を触らずに調整できる。

## 1. 収集

| 入口 | 定義 | 内容 |
|---|---|---|
| 直接フィード | `config/sources.domestic.mjs` `DIRECT_FEEDS` ほか | 公式・専門団体のRSS/Atom 約30本（YouTube/note等の social 系含む） |
| 発見系 | 同 `KEYWORD_GROUPS` ほか | Google News RSS 検索 約30クエリ |

- 取得: `fetchWithTimeout`（15秒タイムアウト・3回試行・指数バックオフ・408/425/429/5xx のみ再試行）
- 失敗したソースはスキップして継続し、`sourceHealth` としてレポートに記録（fail-soft）
- 前回 `articles.json` の45日以内の記事を補完候補として常に混ぜる（単一ソース障害でサイトが痩せない）
- **全ソース0件のときだけ** エラー終了（前回の公開物はそのまま残る）

## 2. 解析（src/lib/feed-parser.mjs）

- RSS `<item>` / Atom `<entry>` を正規表現で解析（XMLライブラリ不使用）
- CDATA・多重HTMLエンティティ・タグ混入・URL混入を除去（`src/lib/text.mjs`）
- Google News 経由は description 内の最初の非 news.google.com リンクを実URLとして採用
- **日付が解釈できない場合は `publishedAt: null`**（v1は取得時刻にすり替えており、
  古い記事が「新着」として最大180日間居座るバグの温床だった。2.0では選定段階で除外し件数を記録）

## 3. 分類・地域検出（src/lib/curation.mjs）

- カテゴリ: `config/categories.mjs` `CATEGORY_RULES` を上から評価。
  **判定順が仕様**（relay → culture → sports → … → local）。
  culture が sports より先なのは「デフリンピック文化プログラム」等の誤分類防止
- 地域: `config/regions.mjs` の都道府県・主要都市テーブルでタイトル・要約を照合し、
  `region`（6ブロック）と `prefecture` を付与（見つからなければ付与しない）

## 4. スコアリング

- `SCORE_TERMS`（関連語 3〜8点）＋ `CONTEXT_TERMS`（文脈語・合計8点まで）＋ `SOFT_NOISE_TERMS`（芸能ノイズ減点）
- 情報源ボーナス: official +5 / specialist +4 / go.jp・lg.jp +2 / アグリゲータ -2 / social -1 / video +1
- 足切り: 既定 `DEFAULT_MIN_SCORE = 5`。情報源ごとに `minScore` 上書き、公式系は `passThrough: true` で免除

## 5. 鮮度フィルタ

- 公開日が **180日以内**（未来は+24時間まで許容）
- 写真ギャラリー等の低価値ページをタイトルパターンで除外（発見系のみ）

## 6. 重複除去

正規化キー（媒体名サフィックス・日付・記号除去）で比較し、以下のいずれかで重複と判定:

1. URL完全一致
2. 正規化キー完全一致
3. 片方がもう片方を包含（24文字以上）
4. bigram Dice 類似度 ≥ 0.94

ただし**タイトル中の数字列が異なる場合は重複としない**（「第3回」と「第4回」の保護）。
残す方は `sourcePriority`（official +45 / specialist +35 / 主要紙テーブル / アグリゲータ -45）→ スコア → 新しさ の順で決定。

## 7. 選定・出力

- 通常カテゴリ最大 **400件**。`relay` は上限対象外で全件表示（「すべて」からは除外）
- 溢れた記事は `articles-old.json` へ蓄積（最大5000件・URL単位マージ）
- 内部フィールド（`_`接頭辞）を除去し、`sourceTier` / `discoveryMethod` を正規化して出力
- `quality` レポート（version: `expanded-score-v4`）に各段階の除外件数・ソース健全性・カテゴリ/地域分布を記録

## 8. 検証（scripts/verify-site.mjs）

`npm run generate` の最終段。失敗すると **コミット前に** 停止する:

- スキーマ: 必須フィールド / URL形式 / sourceTier・category・region の enum / URL重複 / 日付妥当性（生成時点基準で181日以内）
- コンテンツ健全性: 写真一覧ページ混入なし / Google News経由の一次情報が存在
- UI/SEO: 検索・フィルタ・テンプレート・canonical・manifest 等の主要マーカー
- ガイド: `src/guide-data.mjs` から件数・リンクを導出して照合（ハードコードなし）
- アーカイブ: 目次に載る月別ページが実在すること
- PWA: manifest / sw.js（BUILD_ID置換済み）/ アイコン / offline.html の存在

## World版

`src/world-curate.mjs`（2.0では未改変・従来どおり）:

- Google News RSS 324クエリ（地域×主要メディア site: 指定＋多言語検索）
- スコアゲート → union-find 重複クラスタリング → 鮮度バケット×地域バランス選定（最大600件・各地域50件保証）
- 翻訳: translate.googleapis.com（gtx）→ Deaf Navi 用語補正 → 任意で Codex App Server 日本語後編集
  （リトライ・バッチ分割・連続失敗ブレーカ・カバレッジ85%未満は警告、`WORLD_JP_CODEX_FAIL_ON_LOW_COVERAGE=1` の時のみ失敗）
- 0件時は48時間以内の前回スナップショットを保持
- 2.0で `scripts/verify-world.mjs`（存在・スキーマ・導線の fail-soft 検証）を `generate:world` に追加
