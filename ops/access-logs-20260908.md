# 全コンテンツアクセスログと管理画面

- 依頼：Deaf Naviの全コンテンツのアクセスログ取得と管理ページでの参照を確認し、未導入なら対応する。
- 対象：deaf-navi/deaf-navi-web、XServer `/srv/deafnavi`、専用 `/etc/caddy/deafnavi.caddy` のログ設定。
- 事前確認：本番 `d3ebec6428930eee163876796fccb45f6839f498-34163852206-1` と対象ソースが一致。Caddy専用アクセスログ・管理画面の閲覧機能は未導入。旧ローカル作業ツリーの既存変更は保持し、本番と同じ最新版を別チェックアウトして実装。
- 実装：CaddyでURLクエリ/ヘッダー/IPを除外して全リクエストを記録。管理者限定の期間・パス・種別・応答絞り込み、URL別/日別/個別履歴。ログの欠損・読取上限は一部集計として明示。
- 検証：アクセスログ統合42項目、既存管理画面58項目、変更PHP lint、git diff --check。Caddy 2.11.4隔離実行で6リクエスト・2分割ファイル・機密の合成マーカー非保存・動的URL保持を確認。375/1280 CSS pxで表示確認、全体の横はみ出しなし、コンソール警告/エラーなし。
- バックアップ：`/srv/deafnavi/shared/backups/access-logs-20260907T215602Z`。専用Caddy snippet、SQLite整合バックアップ、変更前リリース・設定ハッシュ・集計件数を記録。DB integrity ok、users 1 / records 89 / settings 3 / submissions 0 / outbox 0。
- 反映方法：通常のDeploy XServerでプログラムを原子的に公開し、専用ログ設定だけをvalidate後にCaddy reload。設定全体のハッシュで他サイトの変更がないことを確認する。
- 変更しないもの：既存ID/PW・権限、業務DBのスキーマ/レコード、通知先、メール、DNS、他サイト、PHP-FPM設定。取得開始前のアクセスは復元できない。
- 復旧：旧リリースへcurrentを戻し、専用snippetをバックアップから復元・validate・reload。保存ログ・業務DBは維持。
- 実施後の状態は本番manifestと今回の成果物レポートへ追記する。
