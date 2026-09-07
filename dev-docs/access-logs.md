# アクセスログ

2026-09-08の「全コンテンツのアクセスログ取得と管理ページでの参照」依頼に対応。

## 対象と閲覧

`deafnavi.com` と `www.deafnavi.com` のCaddyに到達したHTTPリクエストを、動的・静的ページ、API、画像等を含めて保存する。管理者ログイン後、メニュー「アクセスログ」（`/admin/?view=access`）から、期間（日本時間・直近180日）、URLパス、対象種別、HTTP応答、アクセス元分類で絞り込める。URL別上位50件・日別集計・ページ切替付き個別履歴・推定ユニーク数を確認できる。編集者は閲覧不可。

ロボット・監視・管理者の確認も含むリクエスト数。利用者数や厳密なPVではない。公開ページの成功GETは公開ページ相当のパスへのGET・2xxを数える。オフライン表示、ブラウザ内だけの操作、外部記事そのものの閲覧、旧GitHub Pagesへの直接アクセス、取得開始前の履歴は含まない。Cloudflare側の既存集計の取り込みや過去ログの復元は行わない。

## 記録と保存

- 保存先：公開root外の `/srv/deafnavi/shared/access-logs/access-v2.log`。既存の `access.log` も180日の表示と圧縮の対象。
- 記録：日時、ホスト、クエリを除くURLパス、HTTPメソッド・プロトコル、HTTP応答、送信量、処理時間、アクセス元分類。
- 除外：IP、ポート、全リクエスト/レスポンスヘッダー（Cookie・認証・参照元・User-Agentを含む）、TLS情報、認証ID、エラー詳細。リクエスト本文は収集しない。クエリはCaddyの書込時点で除去する。
- Caddy標準のJSONフィルタとmapを使用。外部サービスへの追加送信・API課金はない。
- 10 MiBまたは24時間でローテーション。Caddy側の世代数・日数削除を無効にし、検証済みバックアップ処理のみが元ログを移す。新しいファイル名で出力設定を切り替える（同じ出力名の設定変更はreloadだけでは反映しない）。
- ディレクトリは `caddy:caddy 0750`、ログは `0640`。既存PHPプールのcaddyグループとopen_basedir内で読み取る。
- 閲覧はファイルを読み取るだけ。更新中の最終不完全行は次回に回す。欠損、権限不足、壊れた行、上限到達を0件や完全な集計と表示しない。
- 1回の表示は64 MiB・20万行・約4秒まで。到達時は一部集計と明示し、保存ログは削除しない。大量アクセス時の長期分析は管理者がサーバー上で処理する。

## 分類とCookieなしの推定ユニーク数

UA等から `human / bot / ai / automation / unknown` に分類。既存のUAを持たないログはunknown。Codexが通常ブラウザーを使う場合はURLの `dn_client=codex` または `X-DeafNavi-Client: codex` で明示可能。識別表示は自己申告を含む統計用であり、認証・アクセス制御には使用しない。無印の通常ブラウザーと同じUAによる自動操作は識別できない。

公開HTMLから `/_access/visit` にパスだけをPOSTする。Cookie送信なし・referrerなし、本文/音声/検索語/端末ストレージの収集なし。エンドポイントはセッションを開始せず、業務DBを開かない。Origin・型・サイズ・公開パスを検証。bot/AI/自動操作とwebdriverをUUから除外する。JavaScript停止、通知失敗、APIだけの利用はUUに含まれない。

`/srv/deafnavi/shared/access-visitors/` は `deafnavi-runtime:caddy 0750`。`secret.key` は0600、`visitors.sqlite` は0640。秘密鍵はサーバー内で生成し表示・出力・Git保存しない。`day + IPのバイナリ + UA` を秘密鍵でHMAC-SHA256化して、`(day,visitor,path)` の主キーでINSERT OR IGNORE。再表示と並行再送も重複しない。別ページの同じHMACは日別でCOUNT DISTINCT。期間合計は人日。同じ回線・同じUAの過少推計やIP変更による過大推計があり、個人特定や日をまたぐ追跡には使用しない。

## 月次保存と日次の上限確認

`deafnavi-access-maintenance.timer` が毎日03:30 JSTに起動。監視HEADで休眠中のCaddyログにもローテーションを促し、月初は180日超の閉じたファイルと古いUU日別行をgzipに移す。他の日は208日を境界に補助処理し、24時間の分割幅と次の日次実行を考慮して内部保持が通常210日を超えないようにする。停止・保存失敗時には、期間を超えても検証できない原本を保持する。

バックアップは各保存先の `archive/YYYY-MM/`。圧縮後に全量を展開してSHA-256と元サイズを照合し、manifestとディレクトリをfsyncしてから元ファイルを移す。SQLiteは日別JSONLの検証後にトランザクション内で古い行だけを削除する。再実行時は既存アーカイブ一致が必須。不一致、壊れた記録、更新中の記録は保持してエラーにする。圧縮ファイルの自動削除は行わない。容量は累積する。SQLite空きページは再利用されるため、DBファイル自体の縮小を保証しない。

管理画面には容量と `maintenance.json` の直近処理・最終月次・異常を表示する。運用確認は `systemctl status deafnavi-access-maintenance.timer` と `journalctl -u deafnavi-access-maintenance.service`。手動月次実行は `python3 /srv/deafnavi/current/_backend/access-maintenance.py --monthly`。実データで日付偽装はしない。

## 導入と復旧

通常のGitHub ActionsはHTMLとserverのプログラムを反映する。Caddy snippetとsystemdの2ファイルは個別にバックアップ・差分確認・validateして反映する。UU保存先を作成後、runtimeユーザーで `php /srv/deafnavi/current/_backend/access-visitors.php init` を実行する。systemd timerを有効にする。初回の保存処理を確認する。OPcacheはDeaf NaviのPHPだけを失効させ、全体のPHP-FPMは再起動しない。

復旧はtimerを停止し、前のリリースとバックアップしたDeaf Navi snippetを復元・validate・reloadする。ログ、UU、秘密鍵、圧縮バックアップは保持する。圧縮ログはmanifestに従って展開し照合してから別の作業場所で読む。UU復元はSQLiteのコピーにJSONLをINSERT OR IGNOREし整合性を確認する。業務DBは復旧のために書き換えない。

検証：アクセスログ51項目、CookieなしUU28項目、保存処理6ケース、Caddy分類8ケース、既存管理画面と公開ページ、375px/1280px表示。テストで使うIP・UAは合成値。実利用者の値を出力しない。

公式仕様：[Caddy access logging](https://caddyserver.com/docs/caddyfile/directives/log)。
