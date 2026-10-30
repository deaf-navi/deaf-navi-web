# 管理集計の更新と確認

管理集計は、既存の国内・World収集が成功した後の `Deploy XServer` で生成する。追加のtimer、定期AI処理、有料APIは使わない。既存の収集・復旧の公開判定を維持する。

## 更新経路

1. 公開するcheckoutの `.state/events.json`、国内・Worldの公開判断台帳、`docs/articles-world.json` を読む。
2. `scripts/report-publication-quality.mjs` が集計を生成し、source commit・release ID・入力4ファイルのSHA-256を記録する。生成時とarchive作成直前に、4ファイルの実バイトをHEADのGit blobと照合する。欠落・壊れたJSON・不正な台帳・件数不整合はエラーとし、古い集計を上書きしない。
3. サイトの公開archiveとは別ファイルで既存のincomingへ送る。既存のdeploy lock内でchecksum・版・本文構造と、公開するWorldデータのSHA-256を検証する。台帳・eventsの原本はサーバーに送らず、CIでのGit blob照合を根拠にする。
4. `/srv/deafnavi/shared/publication-quality/<release-id>.json` へ配置した後、既存のcurrentリンクを切り替える。ディレクトリ0750・ファイル0640、既存のdeploy所有者/caddyグループを使用する。
5. 管理画面は実行中のrelease IDに対応するWeb root外の集計を読む。新しい版の集計が欠落・不一致なら、旧版の値へ代用せず「未取得・未確認」と表示する。

DBの保存先 `shared/directory` の0700、既存reportの0600、認証・役割・DB内容は変更しない。新しい集計には公開記事・イベント由来の情報だけを含み、投稿、アカウント、アクセスログは参照しない。

## 運用判断

- 既存の国内・World収集スケジュールに従う。手動の集計コピーは通常運用に不要。
- 生成日時と情報源の確認日時を区別する。24時間を超えた古い集計は既存表示で注意を示す。生成し直しても、イベントの根拠確認日時は延長しない。
- 公開保留は原文と判断理由を確認して処理する。地域未確認は保留とは別であり、ゼロ化を目標にしない。新しい根拠がなければ変更しない。
- 公開失敗時はWorkflowの失敗箇所を確認する。壊れた入力を空配列へ置き換えたり、checksum・版照合・公開ゲートを省略しない。
- 公開内容の判断基準は従来どおり。集計の生成・転送・照合に失敗した場合もデプロイを止め、現在の公開版と対応する集計を維持する。
- 復旧ではcurrentを対象の旧リリースへ戻す。同じ版の集計が自動的に選ばれる。旧リリースに対応する集計も保持し、DBを巻き戻さない。導入前のコードへ戻した場合は、保持している従来の非公開reportを読む。
- ローカルの `npm run quality:report` は従来の `.state/publication-quality-report.json` へ出力する。この生成物はGit追跡対象外とし、公開archiveへ入れない。

## 検証

`npm test` に生成・不正入力・公開先拒否・HEADとの実バイト照合・実データ契約のテストを含む。`node test/admin-dashboard.integration.mjs` は認証境界と、実PHPによる版の取り違え・欠落・本文・World hash・rollbackを検証する。Linux CIではcurrent symlinkの切替と復旧も検証する。本番ではWorkflowのdeploy成功、private reportの版・hash・runtimeからの読み取り、公開URLでの非露出を確認する。
