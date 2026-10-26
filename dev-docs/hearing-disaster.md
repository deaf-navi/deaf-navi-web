# 聞こえと防災

- URL: `/guide/hearing-disaster/`。資料・ニュースを紹介する特集。警報配信、避難先・避難判断、救援受付などの機能を持たせない。
- 資料正本: `src/hearing-disaster-data.mjs`。実読した公式資料だけを掲載し、発行元・資料の時期/対象・歴史的情報の注意を持つ。`reviewedAt` は資料を実読した日であり、ビルドのたびに更新しない。本文を転載しない。
- ニュース: `src/build.mjs` が既存の `prepareDomesticPublication` 適用後の掲載中スナップショットを渡す。防災語と既存カテゴリ/聞こえとの関連を合わせて選び、日付順・URL重複除去・既存の同一話題グループで最大12話題。新規クロール・API生成・掲載承認・ニュース分類の変更は行わない。防犯や一般の救急講座は safety カテゴリだけで採用しない。
- 定期更新: 既存ニュース更新の build で再生成。新しいcronや手動の日次処理は不要。古い記事を現在の被災状況・開催予定として表示しない。
- 下書き: 編集DB内の①「災害時、聞こえない人には何が届かなくなるのか」、②「避難所の『情報保障』とは。放送、掲示、手話通訳を考える」。原稿は私有領域、`stories:import` のdry-run・整合バックアップ・transactionで draft 保存。今回の特集公開で記事を公開しない。
- 読みもの導線: 記事の related に特集URLを登録。既存の `stories-related.js` と公開済み限定feedで、後日ユーザーが記事を公開した場合に関連読みものとして表示する。下書きの題名や本文を静的HTMLへ埋め込まない。
- 公開文の内部メモチェックは既存 `assertPublicCopy` と `verify-public-copy` に従う。利用者に必要な資料の対象時期・受付終了等の注意を残す。
- 検証: `node --test test/hearing-disaster.test.mjs test/search-pages.test.mjs`、`npm run build`、`npm run verify`。PC/スマホ、文字拡大/ダーク、公式資料リンク、公開前記事の非露出を確認。
