# 手話カフェ管理基盤（2026-09-05）

## 実装前の更新方針

最新版の指示により、常設・限定営業・定期開催・特殊の4分類を採用する。単発イベントは別扱い。nonowa国立のような正式なサイニングストアは一般一覧にも表示し、店舗は1レコードのみ保存する。

- `/connect/` は手話カフェとイベントのみ。場所・コミュニティのリンクとサイトマップ掲載を停止する。
- `/connect/sign-cafe/` は導入、2タブ、検索/地域/分類/営業状態、ソート可能な表、情報提供フォームの順。表は店舗名・所在地・営業形態・営業時間/営業日。確認日・情報源・住所・予約条件は詳細展開内に表示する。個別ページのURLも保持する。
- `/connect/sign-cafe/{slug}/` は店舗詳細、情報源、確認日、訂正の導線。
- `/connect/sign-cafe/starbucks/` は開催予定、定期・常設、地域/店舗検索、過去履歴、情報提供、このページについての順。
- `/connect/sign-cafe/starbucks/{slug}/` は開催回の詳細。店舗とは `store_id` で関連付ける。
- `/submit/` は共通フォーム。必ず保留保存。
- `/admin/` はログイン、初回PW変更、店舗と開催回CRUD、投稿審査、ID作成/停止、通知先設定。
- `/directory-sitemap.xml` は公開DBレコードのみ。既存ニュース・iOS APIは変更しない。

既存の一般一覧・スターバックス一覧は同一URLで静的プレースホルダーからPHP表示に切替。index.html形式は308で末尾/へ転送。旧GitHub PagesのHTML転送とJSON実配信は維持。旧JSONへの転送を追加しない。

## 保存

PHP 8.1 + PDO SQLite。`/srv/deafnavi/shared/directory/directory.sqlite` は公開root外。GitHub Actionsはプログラムのみをリリースし、DB・セッション・通知設定を上書きしない。専用PHP-FPMプールと実行ユーザーを使い、公開ソースへの書込権限を与えない。

`records` の種類は cafe / store / event。共通列は id / kind / slug / name / country_code / prefecture / city / publication / status / store_id / payload / revision / created_at / updated_at。国コード・国名・州/県・都市・タイムゾーン・緯度経度を保持できる。未確認座標はnull。

payloadの店舗項目：name_kana、country_name、address、map_url、latitude、longitude、timezone、type、subtypes、business_hours、event_schedule、holidays、reservation、description、sign_support、official_url、instagram_url、x_url、facebook_url、operator、verification_level、verification_sources、last_verified_at、internal_note。店舗種別storeには signing_store。

開催回項目：event_date / start_time / end_time / timezone / event_schedule / organizer / partners / description / conditions / application / official_url / verification_sources / published_at / last_verified_at / verification_level / confidence / internal_note。店舗所在地は店舗レコードから参照する。

publicationは public / private / pending / deleted。statusの営業/開催状態とは別。削除はソフト削除で復元可能。閉店は通常一覧から除外し、履歴表示で確認可能。unknown・未検証は公開不可。公開済みURL名の変更は禁止（別途転送が必要）。

submissionsは投稿原文と投稿者情報を分離した非公開テーブル。pending / approved / rejected。承認時は既存店舗への反映または新規作成を選び、検証情報を入力して保存する。画面の保存はrevision一致が必須。ユーザー投稿だけで公開データは変更しない。

## 認証と投稿保護

初期アカウントの認証情報は標準入力経由でハッシュのみを登録。Gitにはパスワードを保存しない。新規IDは初回PW変更必須。2026年9月5日の所有者依頼により既存 `tama` のみ `must_change=0` に変更する（パスワードハッシュ・権限・セッション世代は保持）。新しいPWは8文字以上・128バイト以内。UTF-8の文字数を検証し、ID作成とPW変更の両方で同じ条件を使用する。入力欄に制限と文字数/バイト数を表示する。ログイン後2時間の無操作・12時間の絶対期限。PW変更/ID停止で既存セッションを失効。Secure / HttpOnly / SameSite=Lax Cookie、CSRF、IPをHMAC化したレート制限、PDOパラメーター、HTMLエスケープ、URLと日付の検証、Honeypot、64KiB上限を使用。ID/設定操作は管理者のみ。

## 表示テーマと並べ替え

手話カフェ配下は `dn-cafe-theme` のベージュ/オータム系トークンを使用する。`src/assets/directory.css` の `--cafe-*` で変更でき、ニュース・管理画面の配色には影響しない。ゴシック系フォントを継承する。

所在地（日本は都道府県コード順、海外は国/州/市）・店舗名（読みがあれば優先）・営業形態で昇降順ソート。`sort/dir` と検索条件はURLに保持する。JSは行と詳細を組にして並べ替え、無効時も見出しリンクのGETでソートできる。確認日は表の列から除外し、詳細内と個別ページで保持する。狭幅では店舗名列を固定して表内を横スクロールできる。JS未実行時は個別ページで詳細を閲覧する。

管理・投稿・DBページに広告、解析スクリプトを載せず、CSP、no-store、noindex（管理/投稿）を適用。Service Workerも対象を保存しない。投稿者メール/名前/補足は管理画面から削除可能。任意の連絡先は確認目的のみ、確認後最長1年を目安に管理者が削除する。バックアップ内にも残るため管理者が保管期間を管理する。

## メール

BASP21はWindows向けCOM機能であり、Linux VPS上で直接動作しない。流用元のプログラム/設定場所はユーザーに確認中。既存送信方式が特定できるまではBASP21流用済みと報告しない。

無料・依存パッケージなしのSMTP通知アダプターを準備。通知先は管理画面で設定し、SMTP認証情報は公開root外 `shared/directory/mail.php` のみ。配列キー：host / port（465または587）/ encryption（tls または starttls）/ from / username / password。証明書検証は必須。投稿者のメールを送信先・Fromに使わない。通知本文は管理画面リンクのみ（連絡先情報は通知に含めない）。

通知キューは未送信・送信中・受付済・失敗・結果不明を区別。SMTPの最終応答が不明なら自動再送しない。SMTP未設定でも投稿は保存されるが、メール送信完了とは表示しない。メールサーバー受付済みでも受信箱への到達を保証しない。初期状態で送信設定/受信先がなければ実メール未検証。

## 公開・復旧

`server/` をリリースの `_backend/` に同梱し、直接HTTPアクセスは404。GitHub Pagesの成果物には含めない。Caddyで許可した動的URLだけを固定エントリPHPへ送る。DB、認証情報、投稿者データはGitHubへコピーしない。

初回setupはアプリsnippet・PHPプールをバックアップ後に導入し、PHP-FPMとCaddyを設定検証してreload。以後の通常Actionsリリースにサービスreloadは不要。

日次SQLite backupは整合性チェック付き。バックアップ自動削除はしないため容量と保存期限は運用確認が必要。障害時はcurrent symlinkを旧リリースに戻し、Caddy snippetをバックアップから復元・validate・reload。DBは残す。データ復元が必要なら書込停止後に整合性確認済みバックアップを別名で検証し、明示承認後に切替。

検証：`npm test`、`npm run verify`、`npm run test:directory`、PHP lint、狭幅/デスクトップ。HTTP統合テストはtemp内の合成DBだけに変更を加え、本番や実メールを使用しない。
