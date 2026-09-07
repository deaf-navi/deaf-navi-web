# 海外の手話カフェ・第一次データ投入

## 許可と範囲

2026-09-07、ユーザーが27件の登録、補足事項に応じた修正、本番反映を明示承認。
対象はdeaf-navi/deaf-navi-webとXServerの/srv/deafnaviのみ。海外ページと管理導線をリリースし、DBへ27件を保留追加する。
初期値はpublication=pending、status=open、last_verified_at=2026-09-07。公開承認とは分離する。

## 設計

- 国内一覧はJP、海外一覧はJP以外。海外にはカフェと正式Signing Storeを含める。
- 管理画面の海外一覧にも正式Signing Storeを含め、kind=storeで編集する。同一店舗をcafeとstoreの2レコードにしない。
- 日本のスターバックス一覧と地図に海外店舗を混ぜない。
- 調査資料の27件は23 cafe + 4 store、15か国。4 storeは常設・signing_store=true。
- 営業時間の矛盾・会場変動・別店舗の閉店・住所表記差は管理者メモに保存。時刻を確定できないものは空欄とする。
- 住所だけをもとに緯度経度を推測しない。今回の座標はnull、coordinate_accuracy=unknown。位置確認には住所・座標・確認元URLが必要。
- 保留データのJSONはGitHubやpublic rootへ置かない。ユーザー提供データの整形済みmanifestは作業領域から/srv/deafnavi/incomingの限定ディレクトリへ転送する。

## 一括投入

server/import-overseas.phpはCLI専用。レビュー済みmanifestのSHA-256を固定し、件数、種別、初期状態、ID・slug・国/都市/名称/住所の衝突を検査する。
`--dry-run`は書き込まない。`--apply`はBEGIN IMMEDIATE中に整合バックアップを取得してから一括追加し、既存レコード全体とusers/settings/submissions/outboxの不変、整合性、件数増分を検査してCOMMITする。再実行は衝突として拒否する。
seed・スキーマ・通知設定・ID/PW・DNS・Caddy/PHP-FPM設定は変更しない。

## 検証・復旧

既存のnpm test、directory HTTP、admin dashboard、公開項目テストに加え、overseas-cafes HTTPテストでSigning Storeの分離と正しい編集URLも検証する。
非公開manifestによる合成DBテストで27件増分、15か国、未公開、既存レコード不変、再実行拒否、改ざん拒否、バックアップの整合性を確認する。
実行日時、リリースID、バックアップ、ハッシュ、投入結果、公開確認はタスクのローカル実施記録へ保存する。
復旧は直前releaseへcurrentを原子的に戻す。追加27件は保留のため旧コードでも非公開。DB全体の巻き戻しは新規投稿を失うおそれがあるため行わず、必要時は追加IDとrevisionを再確認して対象レコードだけを処理する。
