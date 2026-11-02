# イーアスつくば店「手話カフェ」— 2026-11-02 単発更新

本人提供の案内をもとに、国内・関東／茨城県つくば市の定期企画を1件追加する。
固定ID／slugは `tsukuba-deaf-sign-cafe`。通常店舗内の企画（`recurring_program`）であり、
店舗の常時手話接客、Signing Store、具体的な開催回として登録しない。

## 掲載状態

新規データは `publication: pending`、`status/confirmation_status: needs_review`、
`verification_level: pending`。現在の開催を確認した日付は付けず、
`last_verified_at`、`schedule_verified_at`、`activity_date` は空欄。
調査日だけを `last_researched_at: 2026-11-02` とする。
新規初期化用の `server/seed.json` と、既存DB向けの同名JSONマニフェストに同じ事実を保持する。
マージだけでは既存本番DBは変わらず、このPRで公開承認・本番適用は行わない。

## 根拠と確認範囲

| 根拠 | 確認できたこと | 限界 |
| --- | --- | --- |
| 本人添付 IMG_7882.jpeg、親スレッドによる画素確認済み転記 | 基本的に毎月第3金曜日10:00〜12:00。高齢ろう者や手話がわかる高齢聴覚障害者の手話交流。参加費無料、注文任意・自己負担、参加希望者は事前連絡 | 開催年・発行日・次回日付なし。このexecutorへのLibrary転送が失敗し、ここでは画素を再確認できていない |
| [スターバックス公式店舗ページ](https://store.starbucks.co.jp/detail-870/)（2026-11-02本文確認） | イーアスつくば店。茨城県つくば市研究学園5-19 イーアスつくば | 店舗情報のみ。手話カフェ開催継続・参加条件の根拠にはしない。通常営業時間を交流会へ転用しない |
| [つくば市聾者協会公式サイト](https://deaf-tsukuba.jimdofree.com/)（同日本文確認） | 連絡先 tsukuba.deaf@gmail.com、FAX 029-879-7332 | 読めたホーム・お知らせ本文では当該企画の現行開催を確認できない |
| [茨城県聴覚障害者協会の地域団体一覧](https://ida-hp.normanet.ne.jp/productsindex2.html)（同日本文確認） | 特定非営利活動法人つくば市聾者協会の名称と地域 | 当該企画の開催根拠ではない |

協会の[お知らせ](https://deaf-tsukuba.jimdofree.com/お知らせ/)も確認。
ホームからリンクされた公開予定表は取得結果に本文がなく、日程確認済みとは扱わない。
添付画面のInstagram投稿者 shokoxo.k を主催者公式アカウントとは扱わず、
投稿URL・投稿日時も推測して登録しない。画像はコミット・転載しない。
上記URLがデータの `verification_sources` にあることは、交流会全体の公式確認を意味しない。

数値の年齢制限、初心者歓迎、筆談対応、ろう者スタッフ、手話注文、
定員、具体的な予約手段・締切、開催例外、開催開始年、次回日は不明のまま。
「事前連絡」は予約制度と同一視せず、`reservation_required` はnull。
`regular_events` も現在の継続を保証しないためnull。
会場や協会の連絡先に対するメール・電話・SNS送信は行っていない。

## 重複・差分

確認時の最新mainは `e8c9c6012eaee58483eb65ac2e94c44b8c38bdaf`。
ローカルの既存checkoutとの差25コミットをGitHubで比較し、
AGENTS.md、カフェ実装・seed・research・関連PHPテストに変更がないことを確認。
進行中のopen PRは検索結果0件。既存seed・content・researchに、
つくば／イーアス／協会名・メール・店舗URLで一致するカフェはなかった。
本番DBの非公開・新規レコードまでは取得していないため、適用前に改めて照合する。
停止済みSEO処理、定期作業、監視設定、記事、他機能は変更しない。

## 既存DBへ取り込む際の条件（今回は未実行）

`research/tsukuba-sign-cafe-20261102.json` は既存のversion 2研究マニフェスト。
新規追加は既存 `server/cafe-migrate.php` によりpendingになる。
既存項目が同一と判定される場合はID・公開状態を維持するため、
本番に同一項目が見つかったらその内容・revisionを比較してから改めて差分を作る。

同梱 `preserve_ids` は確認した既存seed全件を保護する。実際の対象DBの全対象外IDを
追加した作業用マニフェストでdry-runを行い、変更がこの1件だけであることを確認する。
それ以外を変更するplanは適用しない。今回の依頼はdraft PRまでであり、
本番のdry-run／apply、公開状態の変更、マージ、配信は実施しない。
将来の適用時は既存手順どおり、対象DBの重複・revision確認、公開root外の整合バックアップ、
完全一致plan SHA、保護テーブル・対象外レコードの不変性を確認する。

## 検証と環境上の制約

- JSON構文、seedの既存全件不変、追加1件、seedと研究マニフェストの事実一致、
  未確認属性・開催日・確認日の保持、対象外seedのpreserve_ids、公開文の既存guardをローカルで検証済み（既存29件不変・1件追加）。
- `node --test test/public-copy.test.mjs test/cafe-related-metrics.test.mjs` は23件成功。`git diff --check` 成功。
- PHPランタイムがこのexecutorにないため、ローカルPHPモデル／DB移行テストは実行不能。
  `npm run test:cafes` は `php: not found`（exit 127）で未実行。PRの既存CIにはPHP SQLiteの導入とカフェ回帰テストがある。CI結果はPRで確認する。
- Library prepare_materializeは対象画像を解決したが、現行公式helperによる転送は
  `library file transfer failed: download failed` で終了。ローカル画像は未取得。
  環境のHTTP policyは有効な許可先なし。再試行・別環境転送・推測URLによる迂回は行わない。
- executorの外部git通信を使用せず、接続済みGitHubツールで最新mainから作成する
  専用ブランチへ変更を保存し、draft PRを作成する。

