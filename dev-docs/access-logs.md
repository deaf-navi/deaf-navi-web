# アクセスログ

2026-09-08の「全コンテンツのアクセスログ取得と管理ページでの参照」依頼に対応。

## 対象と閲覧

ダッシュボードは管理者だけに「今日のアクセス」を簡易表示する。日本時間の当日リクエスト、推定UU、5xx件数、公開ページGETの直近5件と詳細分析へのリンクを表示する。編集者にはログの要約も公開しない。「アクセスログ」メニューは期間・URL・分類別の詳細分析を担当する。概要は8MiB・2.5万行・約0.5秒の読込範囲に抑え、上限や欠損は部分集計・未取得と明記する。

`deafnavi.com` と `www.deafnavi.com` のCaddyに到達したHTTPリクエストを、動的・静的ページ、API、画像等を含めて保存する。管理者ログイン後、メニュー「アクセスログ」（`/admin/?view=access`）から、期間（日本時間・直近180日）、URLパス、対象種別、HTTP応答、アクセス元分類で絞り込める。URL別上位50件・日別集計・ページ切替付き個別履歴・推定ユニーク数を確認できる。編集者は閲覧不可。

通常のダッシュボード・詳細分析は `client=human` を既定とし、Codex・AI・bot・自動操作・管理画面・分類不明を除外する。既存ログにも表示時に適用する。元ログは保持し、「すべての分類（調査用）」等で確認できる。一般ブラウザーでも画像等を含むHTTPリクエスト数で、利用者数や厳密なPVではない。公開ページの成功GETは公開ページ相当のパスへのGET・2xxを数える。オフライン表示、外部サイト、取得開始前の履歴は含まない。

詳細分析には日別リクエスト・日別推定UUの棒グラフを表示する。7日・30日・180日の切替、棒から当日の明細への遷移に対応。リクエストは全フィルタ、UUは期間・URL条件と一般ブラウザーが対象。計測開始前は未取得の灰色表示にし、0件と混同させない。数値表と併用でき、外部のグラフサービスやライブラリを使わない。

## 記録と保存

- 保存先：公開root外の `/srv/deafnavi/shared/access-logs/access-v2.log`。既存の `access.log` も180日の表示と圧縮の対象。
- 記録：日時、ホスト、クエリを除くURLパス、HTTPメソッド・プロトコル、HTTP応答、送信量、処理時間、アクセス元分類。
- 除外：IP、ポート、全リクエスト/レスポンスヘッダー（Cookie・認証・参照元・User-Agentを含む）、TLS情報、認証ID、エラー詳細。リクエスト本文は収集しない。クエリはCaddyの書込時点で除去する。
- Caddy標準のJSONフィルタとmapを使用。外部サービスへの追加送信・API課金はない。
- 10 MiBまたは24時間でローテーション。Caddy側の世代数・日数削除を無効にし、検証済みバックアップ処理のみが元ログを移す。新しいファイル名で出力設定を切り替える（同じ出力名の設定変更はreloadだけでは反映しない）。
- ディレクトリは `caddy:caddy 0750`、ログは `0640`。既存PHPプールのcaddyグループとopen_basedir内で読み取る。
- 閲覧はファイルを読み取るだけ。更新中の最終不完全行は次回に回す。欠損、権限不足、壊れた行、上限到達を0件や完全な集計と表示しない。
- 1回の表示は64 MiB・20万行・約4秒まで。到達時は一部集計と明示し、保存ログは削除しない。大量アクセス時の長期分析は管理者がサーバー上で処理する。
- 日次処理で閉じたファイルの最古・最新日時、サイズ、更新時刻を索引に保存する。期間外の一致するファイルは読み飛ばすため、直近の大量ログが過去の日付指定を妨げない。ファイルが変われば索引を使わず実データを読む。

## 分類とCookieなしの推定ユニーク数

UA等から `human / bot / ai / automation / internal / unknown` に分類。既存のUAを持たないログはunknown。`/admin/` の一般・不明アクセスは過去ログも管理画面扱いにする。Codexのブラウザー確認では最初と直接遷移するURLに `dn_client=codex` を付け、HTTPクライアントでは `X-DeafNavi-Client: codex` またはCodex入りUAを必須とする（AGENTS.mdにも記載）。同一サイト内のリンク・フォーム・管理画面のPOST後にも印を引き継ぐ。Caddyは同一サイトの印付きRefererから画像等も分類する。Referer自体は保存しない。webdriverも自動操作の印を送る。Cookie・端末ストレージへの識別子保存は使用しない。

分類は自己申告を含む統計用であり、認証・アクセス制御には使用しない。無印の通常ブラウザーと同じUAによる自動操作は識別できない。過去にhumanで保存したHTTPログにはIPやUAがないため、全件の再判定はできない。根拠なく過去の一般アクセスを削除しない。

公開HTMLから `/_access/visit` にパスだけをPOSTする。Cookie送信なし・referrerなし、本文/音声/検索語/端末ストレージの収集なし。エンドポイントはセッションを開始せず、業務DBを開かない。Origin・型・サイズ・公開パスを検証。bot/AI/自動操作とwebdriverをUUから除外する。JavaScript停止、通知失敗、APIだけの利用はUUに含まれない。

`/srv/deafnavi/shared/access-visitors/` は `deafnavi-runtime:caddy 0750`。`secret.key` は0600、`visitors.sqlite` は0640。秘密鍵はサーバー内で生成し表示・出力・Git保存しない。`day + IPのバイナリ + UA` を秘密鍵でHMAC-SHA256化して、`(day,visitor,path)` の主キーでINSERT OR IGNORE。再表示と並行再送も重複しない。別ページの同じHMACは日別でCOUNT DISTINCT。期間合計は人日。同じ回線・同じUAの過少推計やIP変更による過大推計があり、個人特定や日をまたぐ追跡には使用しない。

## 月次保存と日次の上限確認

同じ日の一般ブラウザー接続が後からCodex・自動操作と分かった場合、`excluded_visitors(day,visitor,reason)` に日別HMACだけを記録する。元の訪問行は保持し、全ページの推定UUから除外する。以降その接続の当日の再通知も追加しない。別日・別接続は巻き込まない。除外表も180日超を `excluded-visitors-YYYY-MM-DD.jsonl.gz` へ検証付きで移す。復元時は通常の訪問行と除外行の両方を戻す。

`deafnavi-access-maintenance.timer` が毎日03:30 JSTに起動。監視HEADで休眠中のCaddyログにもローテーションを促し、月初は180日超の閉じたファイルと古いUU日別行をgzipに移す。他の日は208日を境界に補助処理し、24時間の分割幅と次の日次実行を考慮して内部保持が通常210日を超えないようにする。停止・保存失敗時には、期間を超えても検証できない原本を保持する。

バックアップは各保存先の `archive/YYYY-MM/`。圧縮後に全量を展開してSHA-256と元サイズを照合し、manifestとディレクトリをfsyncしてから元ファイルを移す。SQLiteは日別JSONLの検証後にトランザクション内で古い行だけを削除する。再実行時は既存アーカイブ一致が必須。不一致、壊れた記録、更新中の記録は保持してエラーにする。圧縮ファイルの自動削除は行わない。容量は累積する。SQLite空きページは再利用されるため、DBファイル自体の縮小を保証しない。

管理画面には容量と `maintenance.json` の直近処理・最終月次・異常を表示する。運用確認は `systemctl status deafnavi-access-maintenance.timer` と `journalctl -u deafnavi-access-maintenance.service`。手動月次実行は `python3 /srv/deafnavi/current/_backend/access-maintenance.py --monthly`。実データで日付偽装はしない。

## 導入と復旧

通常のGitHub ActionsはHTMLとserverのプログラムを反映する。Caddy snippetとsystemdの2ファイルは個別にバックアップ・差分確認・validateして反映する。UU保存先を作成後、runtimeユーザーで `php /srv/deafnavi/current/_backend/access-visitors.php init` を実行する。systemd timerを有効にする。初回の保存処理を確認する。OPcacheはDeaf NaviのPHPだけを失効させ、全体のPHP-FPMは再起動しない。

復旧はtimerを停止し、前のリリースとバックアップしたDeaf Navi snippetを復元・validate・reloadする。ログ、UU、秘密鍵、圧縮バックアップは保持する。圧縮ログはmanifestに従って展開し照合してから別の作業場所で読む。UU復元はSQLiteのコピーにJSONLをINSERT OR IGNOREし整合性を確認する。業務DBは復旧のために書き換えない。

追加導入時はUU DBの整合バックアップを取得し、新しい `access-visitors.php init` をruntimeユーザーで実行して除外表を追加する。既存の秘密鍵・訪問行・計測開始日時は変更しない。

検証：アクセスログ・簡易表示・グラフ72項目、CookieなしUU37項目、保存処理8ケース、Caddy分類16ケース、既存管理画面58項目、375px/1280px表示。テストで使うIP・UAは合成値。実利用者の値を出力しない。

公式仕様：[Caddy access logging](https://caddyserver.com/docs/caddyfile/directives/log)、[map](https://caddyserver.com/docs/caddyfile/directives/map)、[log_append](https://caddyserver.com/docs/caddyfile/directives/log_append)。
