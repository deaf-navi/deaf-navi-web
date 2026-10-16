# 検索入口・イベント詳細・生活ガイド

## 公開経路

`config/entry-redirects.json` を入口URLの正とする。ビルドは静的転送ページと `server/entry-redirects.caddy` / `.json` を生成する。正規URLだけをサイトマップへ掲載する。

本番Caddyは `/etc/caddy/deafnavi.caddy` の route 内、file_server より前で `/etc/caddy/deafnavi-entry-redirects.caddy` を import する。生成済みルールをこの専用ファイルへ配置し、設定全体を validate してから reload する。定時ビルドによるアプリ切替とは独立。ルール変更時は専用ファイルの更新・バックアップ・301/Locationの実測も必要。別ホストやアクセス集計設定は変更しない。

対象は旧入口7種の末尾スラッシュ有無と index.html。クエリを保持し、ガイド配下の実記事やイベント詳細は転送しない。静的配信時も canonical と転送リンクを残す。

## イベント

`events.html` の見出しは `/events/<event.id>/` へ、公式案内ボタンは主催者へ直接進む。元データは従来どおり `.state/events.json`。定時の `events:update` → `build` で一覧と詳細を同時更新する。

開催予定・再確認中・過去の告知・中止を区別する。48時間失効、取得不能、本文変更の判定は既存の `eventPeriod` に従う。再確認中は noindex。開催予定だけに Event 構造化データを付け、時刻・費用・主催者などを推測しない。開きっぱなしでも日時・確認期限を再評価する。構造化データの追加は検索結果の特別表示を保証しない。

`docs/events/page-ids.json` は公開済みURLの台帳。削除しない。スナップショットから外れたIDは、終了・中止と決めつけず noindex の案内ページを残す。

## 地域・困りごと

東京・神奈川の地域ページは既存の公開カフェDBから動的表示する。別データの登録や複製はしない。非公開・営業終了などの除外条件は全国一覧と共通。未掲載があるため網羅と表現しない。

生活ガイド3本は `src/guide-topics.mjs` が原本。病院・窓口、仕事・学び、手話通訳・字幕・要約筆記・筆談を扱う。公式情報、確認日、編集主体、相談に使える文例を示す。確認日は実際に情報源を読んだときだけ更新し、ニュースのビルド日時で上書きしない。制度の適用条件・料金・地域差は公式窓口へつなぐ。

## 検証と復旧

`npm test`、`node test/cafe-seo.integration.mjs`、`npm run build`、`npm run verify` を実施。個別URL・正規URL・サイトマップ、古い情報の扱い、非公開情報の除外を検証する。ブラウザで320/390/1440px、ヘッダー位置、ダーク表示・文字拡大、リンク・JavaScript無効を確認する。

公開前のリリースパスとCaddy専用ファイルを記録・保存する。アプリは直前リリースへの原子的切替で戻せる。転送を戻す場合は専用設定をバックアップから戻し、設定全体の validate 後 reload。DB変更はない。PHPの出力が古い場合は対象Deaf Naviファイルのみキャッシュを照合・無効化し、他サービスや共有OPcache全体をリセットしない。

公開確認は `Codex-DeafNavi-Verification` / `dn_client=codex` で識別する。Search Consoleの登録状況、順位、クリック数の改善は別途実測し、本番公開だけで改善したと判断しない。
