# iOS 2.3 共通コンテンツAPI

Webで公開判断した情報をiOSが読み取る。端末側では再キュレーションや独自RSS収集を行わない。定時ジョブの時刻・回数・審査条件・48時間の確認期限は変更しない。

| URL | 正本・更新経路 |
|---|---|
| `/app/v1/domestic.json` | `docs/articles.json`。Webと同じ話題グループ・先頭記事の順位、確認済み画像、ニュース文脈を追加。既存8キーフラット配列は変更なし |
| `/app/v1/events.json` | `docs/events.json`。`appEventSnapshot` が公開フィールドだけを出力。通常更新と情報源復旧の両方で再生成 |
| `/connect/sign-cafe/app-v1.json` | Webと同じSQLiteの公開レコードをGETごとに投影。店舗・定期開催と単発イベントを分離。非公開レコード、審査メモ、連絡先、根拠hashを除外 |
| `/app/v1/info.json` | `content/app/info.json`。現在は空配列。古い別ホストのお知らせを引き継がない |

カフェAPIはGET/HEADのみ。ETagは公開内容で算出し、毎回再検証する。`generatedAt` は応答時刻であり、情報源の確認日時ではない。営業日・時間・開催周期はWebと同様に未確認状態では空にする。対応有無はtrue/false/nullを区別する。

イベントの`verifiedAt`/`validUntil`は情報源の確認時刻と48時間期限。一般イベントの`generatedAt`は元スナップショットの`checkedAt`。キャッシュや再生成によって確認期限を延長しない。未確定日程はnullとし、クライアントは開催予定に含めない。

配列が空でも有効なスナップショットとして送信する。全件取り下げと取得失敗を区別するため、失敗時は正常な空配列を返さない。イベント・カフェの情報源ごとにキャッシュを維持し、片方の障害で他方の更新を捨てない。公開取り下げは次回の正常取得で反映する。

検証: `npm test`、`node test/app-directory.integration.mjs`、既存のdirectory/cafe-events統合テスト。iOS側では生成済みJSONをSwiftで読むクロスリポジトリテストも行う。先にWeb APIを配備して公開GETを確認し、その後iOS 2.3を配信する。
