# 日本の手話カフェDB v2 — 2026-09-07

本番コミット `301b3184b49efab0f475c16fe7b9a9857dbb92b0` と一致する隔離worktreeで実装。既存の作業中checkoutは変更していない。2026-09-07のユーザー承認によりXserver本番へ反映する。ほほえみの今回の更新は保留し、preserve_idsでスキーマ付加・revision更新も除外する。添付manifestは新規8件を確認待ちとして追加し、既存8件を更新する。新規3件は営業情報を確認できたが、公開状態はpendingのまま移行する。

## データ設計

既存SQLiteのrecordsテーブルとpayload JSONを維持し、schema_version=2を付加する。cafe/store共通で海外の拡張項目も保持する。既存のイベントレコードやstore_id関係は変更しない。

| 区分 | 保存内容 |
|---|---|
| 店舗形態 | shop_type: permanent / recurring_program / recurring_popup / public_recurring / facility_cafe / chain_signing_store / event / unknown |
| 営業状態 | status: open / active_recurring / temporarily_closed / permanently_closed / needs_review / unknown。旧closedは互換受付、移行時にpermanently_closedへ |
| 内容の確認状態 | confirmation_status: confirmed / needs_review / unknown。営業状態や公開状態とは独立 |
| 公開状態 | 既存publication: public / pending / private / deleted。今回の調査処理では変更しない |
| 運営・手話 | operator_type、sign_language_level、8個のtrue/false/null属性。未確認はnull。本人・店舗の公表URLがないオーナー・スタッフ属性は保存拒否 |
| 日程・会場 | recurrence、venue_name/address/url。活動レコードと開催先の通常店舗・施設を区別 |
| 移転 | addressが現在地、previous_addressが旧所在地、moved_atは年月。移転時は古い座標・地図URLを無効化 |
| 鮮度 | last_verified_at、first_found_at、last_researched_at、schedule_verified_at、latest_source_date、latest_sns_at。調査日だけで確認日を更新しない |
| 注記 | notesは公開用、review_notesは管理用。attribute_sourcesに属性公表元 |

旧typeは既存クライアント互換のため残す。旧limited/recurring/specialから具体的な営業形態は推測せずunknownとする。週次/月次は別形態を増やさずrecurrenceに保存する。

依頼された共通フィールド名はcafe_export()で公開allowlistへ対応する。name_kana/所在地/座標/SNS等の既存保存項目を再利用し、operator_name→operator、opening_days→event_schedule、opening_hours→business_hours、official_website→official_url、instagram/x/facebook→各*_url、google_maps_url→map_url、source_urls→verification_sources。regionは都道府県から導出し、沖縄を九州から分ける。新しい公開APIエンドポイントは追加していない。

## 移行と復旧

実行環境はPHP 8.1以上、PDO SQLite、SQLite3、mbstring。運用先はDeaf-NaviのXserver VPS。本番反映は2026-09-07に明示承認済み。

1. 現在の本番コミット・変更ファイルのハッシュ・DB revisionを再取得する。承認後に更新が進んでいたら対象差分を再確認する。旧ローカルcheckoutの内容を本番へ上書きしない。
2. 新しいreleaseに承認済みファイルのみ配置する。DNS・Caddy・PHP-FPM・証明書・認証・cron・投稿・通知設定は変更対象外。データとバックアップは公開rootの外に置く。
3. 新しいreleaseのCLIで以下のdry-runを実行し、新規8・更新8、公開状態維持を照合する。実行対象のDEAFNAVI_DATA_DIRは共有DBのディレクトリを明示する。

```sh
php server/cafe-migrate.php --dry-run research/domestic-cafes-20260907.json
```

4. 書き込みを伴う管理操作・投稿との同時処理を避けた作業時間を確保する。公開root外の存在するバックアップディレクトリを指定し、直前dry-runのplan_sha256を渡す。CLIが整合性のあるSQLiteバックアップを作成してから一括更新する。

```sh
php server/cafe-migrate.php --apply research/domestic-cafes-20260907.json BACKUP_DIRECTORY PLAN_SHA256
php server/cli.php check
```

5. コード切替とDB移行を同じ作業枠で完了する。サイト・管理画面・新規pendingの非公開・既存URL・海外・Starbucks・地図・投稿フォームを再確認する。メール送信テストは別の明示許可がない限り行わない。

移行は自動実行されない。BEGIN IMMEDIATE、revisionと全レコードの計画ハッシュ、重複照合、整合性検証により、途中変更・競合・同一batchの改ざんでは停止する。ID/slug/公開状態/作成日時を保持し、users/settings/submissions/outboxの前後ハッシュも比較する。cafe_migration_runsと検索索引2個を追加する。同じbatchとmanifestの再実行はALREADY_APPLIEDとなる。

重複はID・slug・同県の正規化名称/別名・公式URL・Instagramで照合する。URLの追跡queryを除き、Instagramのドットを保持する。住所は移転履歴と候補の比較に利用するが、同じ会場で別の活動も開催されるため住所一致だけでは自動統合しない。複数の強い一致がある場合は停止し、管理者が判断する。

失敗時はトランザクションがロールバックする。適用成功後の復旧は、まずDB・コードの現状を再退避し、適用後の投稿/管理更新の有無を調べる。新規書き込みがあるDBへ適用前バックアップをそのまま戻さない。後続更新がなければ承認の上で書き込み停止中にSQLiteの整合性ある復元と旧releaseへの切替を一組で行い、整合性とHTTPを再検証する。バックアップや共有DBをrelease内へ置かない。

## 管理運用と全国再調査

管理画面で総数・営業中・定期開催・営業未確認・休業・閉店を抽出する。6/12か月以上未確認と確認日なしを独立表示する。暦月差で判定し、月末・閏年も扱う。公開pending件数と営業needs_review件数は異なる。

調査は都道府県×「手話カフェ / 手話 cafe / 手話 coffee / デフカフェ / deaf cafe / ろう者 カフェ / ろう者 喫茶 / 聴覚障害 カフェ / ろうスタッフ カフェ / 手話スタッフ カフェ / 手話で注文 / 手話 接客 カフェ / 筆談カフェ / silent cafe / sign language cafe」を組み合わせる。Instagram限定検索だけで完結せず、店舗SNS、Facebook、地域ろう協、手話サークル、自治体、福祉法人、NPO、地域メディア、Google Mapsを照合する。SNS本文を取得できない場合はURLを候補として残し、投稿日や営業状態を推測しない。

候補発見→既存照合→根拠URL/公開日/確認項目を記録→未確認項目をreview_notesへ→管理者確認→公開の順で運用する。施設提供者と活動主催者を混同しない。一般店舗の通常営業時間を手話プログラムの時間に転用しない。属性は店舗や本人の公表だけを使う。

## 今後の追加候補（今回未実装）

- 項目単位の根拠履歴・変更差分と再調査キューの担当者管理。
- 定期開催の休止・会場変更を扱う個別開催日カレンダー。
- 大規模件数でのSQL検索/索引利用への移行。現状は既存visible_recordsを読み込み、全体ソート後24件ずつ表示する。
- SNSの手動確認記録、重複候補の比較・統合専用画面。
- 地図座標の再確認と共通スキーマのAPI提供。通知自動化は運用合意後に別途実装。

## 検証

`npm run test:cafes`：モデル42、移行17、HTTP87、海外モデル549、管理58、海外HTTP50の803項目とプロフィールテストが成功。`npm test`63件成功。`npm run build`・`npm run verify`成功（474記事、ガイド17項目、20月分アーカイブ、Analytics49ページ）。移行試験は合成DBと公開項目だけを含むローカルDBで実施。本番DB全体や認証情報を複製していない。

375pxでカード・検索ゼロ・近隣リンク・修正フォーム引継ぎを操作確認。1440pxのカード表示も目視確認。比較表はカードとは別の意図的な横スクロール領域。プレビュー画像の新規3件はUI検証用DBだけで公開を模擬している。実際の移行では新規8件すべてpending。本番の反映後検証とGitHub CIの実行は未実施。
