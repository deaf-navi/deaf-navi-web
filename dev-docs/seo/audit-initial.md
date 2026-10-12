# 初回診断

2026-10-12 JST。初回main `b5b207d93a1edbc161434f5f71c7debc37a71add`。
指示書の全512行、リポジトリ指示・関連運用資料を実読。保存環境に関連 `.agents/skills/SKILL.md` はなかった。

## 重要事項（確認根拠を保持）

| 優先 | 観測・問題 | 根拠 | 対応 |
|---|---|---|---|
| P0 | 国内カフェ個別titleが店舗名だけで所在地・分類が伝わりにくい | `server/views.php`の`detail()`と公開レコード | 既存の県・市をメタデータへ追加。見出し・本文・URL・営業情報を保持 |
| P0 | `/submit/` がnoindexにもかかわらずXML sitemapへ列挙 | PHP `page(...,true)` / `src/templates/feeds.mjs` | XMLからフォームURLだけを除外。フォームは保持 |
| P0 | HTMLサイトマップに海外カフェと単発イベントの分類リンクがない | `src/templates/feeds.mjs`のカフェ欄 | 既存URLへ2リンク追加 |
| P0 | ナビゲーション先 `/guide/` の静的本文が準備案内だけで現行ガイドを直接開けない | `src/templates/connect.mjs`と生成HTML | `/guide.html`へのリンク追加。制度・医療・通報の説明は変更しない |
| P1 | 定常ページのlastmodがニュース更新のgeneratedAtに連動 | `renderSitemapXml()`でAbout/おとまど/入口等にも同じ時刻 | 正しい実質更新日の保持方式をbacklogへ。今回変更しない |
| P1 | カフェの出典相違・最新日程不明が残る | 西尾茶屋: seed月曜、今回の公式トップ火曜。全国一覧にも確認中・営業未確認の表示 | 最新の一次告知・適用日を確認するまで曜日・状態を断定修正しない |
| P2 | 短いカテゴリ入口と実コンテンツが別のself-canonical URLで共存 | `/news/world/`とWorld-JP、`/about/`とabout.html、ガイドの入口/本文 | 薄い入口の検索対象はGSCを見て個別に判断。大規模変更をしない |
| P2 | イベントのページ2以降もCollectionPage.urlがroot、canonicalはpage番号 | `server/cafe-events.php` | メタデータ整合の小修正候補。初回はイベント挙動を維持 |

GSC/GA4/CWV/インデックス数/ユーザー遷移は未取得で、SEO不具合や数値0とは扱わない。問題数のために既存の正しい実装を問題扱いしない。

## 既存の良好な実装と保持対象

- 国内カフェはSSR一覧、ページ別canonical、絞り込み/並べ替えのnoindex、CollectionPage/ItemList、BreadcrumbList、出典・確認日・未確認表示、初心者案内を既に持つ。
- 公開DBはallowlist表示。private recordはsitemapから除外し、private詳細へ情報を出さない。閉店・未確認・定期開催と常設を区別する。
- robotsは静的・World・動的directoryの3 sitemapを案内する。404ページはnoindex。実HTTP404とDNSは識別付きCI監査で確認する。
- viewport、skip link、focus、aria属性、文字サイズ、テーマ、折り返し/モバイル表表示、PWA世代切替、private/no-storeのDBページのキャッシュ除外がある。全文WCAG適合を今回再認定していない。
- iOS `app/v1/` のURL・キー・日付形式・カテゴリ契約を保持。過去GitHub Pagesの転送とJSON互換配信は最低2027-09-05まで保持する。
- ニュース・Worldの収集、翻訳、分類、既存cron、情報提供/管理、地図、外部サービスを変更しない。

## 実読対象・取得の限界

トップ、国内JSON/アーカイブ、World-JP/Original、ガイド、About内の掲載方針とiOS案内、おとまどはコミット済み公開物と生成元を読取。国内・海外・イベントの動的本文はPHP生成元を読取。全国の当日公開表示も検索ツールで読取。実行環境のHTTP/Chromiumは出口で403/接続失敗のため、これだけを「本番ブラウザー確認済み」としない。

`scripts/audit-seo.mjs`は接続可能な既存GitHub CIで上記主要実URL、個別ページ、月別アーカイブ、robots/3 sitemap/manifest/sw/iOS JSON、不存在URL、DNSをGETする。専用UA・header・URL印を付ける。構造化された結果をActionsログに記録し、公開後の確認にも使う。実機操作、CWVのフィールド値、全外部リンクの生存、管理画面・DBの現況は別検証。

終了時点でGitHub Appの書込APIも403となり、draft PR/CIを開始できなかった。このスクリプトを本番で実行したと報告しない。ローカル実装と検証済みの成果を保存し、書込接続の復旧後にこの段階から再開する。

## 定時処理の重複点検

- 国内とWorld: 既存各1日3回（cron `10 3,9,21 * * *` UTC、JST06:10/12:10/18:10）。実Run successを確認。
- カフェ一次情報のサーバー確認: `operations/cafe-event-sources.cron` と台帳運用資料に06:40 JST。チャット側09:00運用は資料で存在を確認し、実タスク一覧は未取得。
- 既存のバックアップ・メール通知・アクセス保守timerがある。設定を変更せず、稼働状態はサーバー未接続のため未確認。
- 既存SEO専用定時jobはリポジトリ内では発見されなかった。親のスケジュール操作と重複する新規automationはこの作業から作成0件。
