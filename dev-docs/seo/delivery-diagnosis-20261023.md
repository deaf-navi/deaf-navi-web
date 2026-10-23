# 2026-10-23 配信診断と限定承認候補

公開反映は未完。対象は全国手話カフェFAQの「手話カフェの一覧へ戻る」1リンク。PR121の完了済みFAQ回答や店舗タイトル/地域導線は再実装しない。

## 取得済み証拠

[PR141](https://github.com/deaf-navi/deaf-navi-web/pull/141)のhead `fe502e47859c98077d39d811e5792b334aa07490` /[CI39879857464](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39879857464)は全工程success。通常squash `b83508f168d98cfc8fd029c03e24246483f8d7b1` の[Deploy39880077869](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880077869)も09:47:16 JSTにsuccess。実parent092b36de、workflowと運用5文書だけで、対象PHPはPR139と同一。

09:47:10〜11 JSTの正規SSH activationで、切替前currentは `/srv/deafnavi/releases/092b36de1e7c2eeb8b00ccb2e0027298a2e4d770-39879138679-1`、切替後は `/srv/deafnavi/releases/b83508f168d98cfc8fd029c03e24246483f8d7b1-39880077869-1`。切替前PHP・staging・切替後currentの3つの実測SHA-256はすべて `868972728ac88ea7fea58d4e868da781d79a47bd907decdfac78a334309a812b` でGit原本と一致。これにより、この観測時点の配布ファイルとcurrent参照先の不一致は見つからなかった。09:18/09:28の実サーバーhashまで遡って測定したとはしない。

09:47:14 JSTの既存runnerによる識別付き公開GETはHTTP/1.1 200 OK、Content-Type text/html、Via Caddy、Cache-Controlはprivate/no-store/max-age=0とno-store/no-cache/must-revalidateを返したが、新リンクはHTML内にも不在。workflowがQA未完のwarningを記録した。これは配布元/ファイルの一致と、公開本文の不一致を同時に示す。公開実行PHPのパス・保持状態/有効設定はまだ未確定で、OPcache等の原因を確定しない。

親の09:21/09:22/後続Deploy後09:32 JSTの正式Chrome/CUAでもリンク不在。クリック/検索条件保持は本番未検証。稼働PHP/FastCGI設定は未取得で、キャッシュを確定原因にしない。

## 必要な読取と条件付き修正（未適用）

既存の承認済みVPS経路で、対象アプリの有効なCaddy root/rewrite/FastCGI socket/resolve_root_symlinkと、関連FPMの実行パス・OPcache timestamp/realpath条件を非秘密項目に限定して読む。設定全文、環境変数、鍵、Cookie、phpinfo、DBは取得しない。PR30のスクリプト全体を実行する承認とはしない。既存権限で読めなければそこで停止し、権限を広げない。

本番の有効な設定がGit管理の専用blockと一致し、symlink経由で旧PHP実行が続く条件が確定した場合だけ、/etc/caddy/deafnavi.caddyの対象専用blockへ以下の設定を加える候補。実際の有効ファイル/既存設定を読んでから差分を確定する。

```diff
-            php_fastcgi unix//run/php/deafnavi.sock
+            php_fastcgi unix//run/php/deafnavi.sock {
+                resolve_root_symlink
+            }
```

根拠：[Caddy php_fastcgi公式資料](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi)は、root symlinkを切り替える配布方式で実体パスへ解決する機能を説明する。[PHP公式資料](https://www.php.net/manual/en/opcache.configuration.php)はOPcacheのtimestamp検証条件を説明する。本番の原因とはまだ断定できない。

## 検証と復旧

- 元のDeaf Navi専用snippetを時刻/hash付きで退避し、読取時hashの一致と、対象socket blockが1件だけであることを確認する。対象block以外の差分があれば止める。
- 既存の全体Caddy設定を、現在のサービスと同じbinary/起動条件でvalidateしてからgraceful reloadする。共有PHP-FPM再起動、OPcache一括reset、DNS/権限/他アプリ設定の変更は行わない。必要な既存管理権限がなければ新しい権限を付与しない。
- 正規Deployのhash/実体検証と、識別付き公開URLのHTTP200/本文リンクを照合する。正式ブラウザーでFAQ末尾から#cafesへの移動とquery/絞込/表示状態の保持を確認する。トップ/アプリmanifest、カフェのmobile/keyboard、既存private pathの404を確認し、PWA/収集を保持する。
- 配信失敗・別アプリ影響・差分逸脱があれば専用snippetだけを保存版へ戻し、同じ全体validateとgraceful reloadで復旧する。current/DB/生成物/利用台帳を巻き戻さない。

ローカル候補は専用blockの1置換で元全文へ正確に戻ることと空白エラーなしを確認した。Caddy CLIは環境に存在せず、公式検証用binaryの取得はHTTP403で停止したため、CLIによるadapt/validateは未実施。別経路で取得を迂回せず、本番と同じbinaryでのvalidateを適用前の必須条件とする。外部サービスの追加やサーバー起動はしていない。

## 承認境界

本人の09:32 JSTの公開追跡指示で、既存Deploy内のcurrent/hash確認は実施済み。過去の委任でCaddy/PR30・失効/再起動は保留されているため、それを設定変更の包括承認へ読み替えない。求める追加承認は、上記の非秘密設定の限定読取と、原因確認時だけ行うDeaf Navi専用設定1項目・全体validate・graceful reload/同範囲rollback。新規認証・権限拡張は含まない。

GSC/GA4は未取得。店舗曜日の相違・Knotの対象区別は保留維持。30日検証は2026-11-10で終了し、無断延長しない。

後続の通常国内生成更新 `b50b3dae2a2975d3bfa9c3347911c4d929b7779d` の[XServer39880357771](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880357771)でも09:50:05〜06 JSTに切替前/staging/currentの同じSHA-256一致とcurrent参照先を実測。09:50:10 JSTの公開GETは再びHTTP200/no-storeでリンク不在。後続公開を待つだけでは解消を確認できていない。
