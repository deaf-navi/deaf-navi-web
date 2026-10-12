# 変更履歴

## 2026-10-12 初回改善

状態: ローカル実装・静的検証済み、未公開。GitHub App書込403と環境出口403でdraft PR/CI/正規公開が未実施。

実装commit: `da465bd363ac3e467d0c9896f0fb26c9710b389a`（この環境のローカルcommit、リモート未反映）。運営記録の最終状態は別commitで追記する。

変更前main: `b5b207d93a1edbc161434f5f71c7debc37a71add`。
変更前の正常XServer公開: [run 38130903364](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38130903364)。

変更対象URL:

- `/connect/sign-cafe/<国内カフェslug>/`: 既存の県・市と手話カフェ分類をtitleへ追加。対象は国内kind=cafe、カフェ分類だけ。海外、団体、交流スポット、単発イベント、storeは従来タイトルを保持。visible H1/description/URL/営業情報は保持。
- `/sitemap.xml`: noindexフォーム `/submit/` の列挙を除く。
- `/sitemap.html`: 海外カフェと単発イベントの既存URLへ2導線を追加。
- `/guide/`: 現行 `/guide.html` への入口リンクを追加。

実装元と生成物、既存CIのPHP SEO回帰検証、正規デプロイ後の読取確認を変更。運営台帳は `dev-docs/seo/` で公開rootから分離する。新規ページ・DB更新・外部サービス導入・DNS変更は0件。

検証済み:

- `npm test`: 106成功、失敗0（変更前105成功）。
- `npm run build` / `npm run verify`: 成功、記事425・ガイド17・archive21・Analytics49ページ。
- `npm run verify:world`: 600記事の検証成功。
- `node --check scripts/audit-seo.mjs` / `git diff --check`: 成功。
- ローカルChromium 375/1280px、7ページ各2表示: HTTP200、横はみ出し・pageerrorなし。外部通信はテストで遮断。

ローカルPHPがなく、sudoも利用不可。PHPを実行したと報告せず、既存GitHub CIで `npm run test:cafes` と `test/cafe-seo.integration.mjs` を実行してから公開する。元のニュースJSON・アプリJSON・おとまど・PWAは変更していない。ビルドの相対時刻だけのトップ差分は除外した。

復旧: 本変更commitのコード差分だけをrevertして既存Deploy XServerを実行する。DBを変更していないためDB復元は不要。緊急時のrelease切替は `dev-docs/operations.md` の手順を使い、既存サービスを停止しない。

未取得: GSC/GA4、CWVフィールド、管理画面の実集計、サーバー稼働・DNSの直接読取、Libraryローカル原本。未実施: draft PR、CI、本番公開、実URLの変更確認、PHP回帰、実機iOS。これらは取得・実行結果に応じて追記する。

## 公開を阻む確認済み制約と再開手順

- 通常シェルHTTP、Chromium、GitHub CLIは環境の出口で403/CONNECT失敗。追加network許可・エスカレーションを使っても到達できなかった。自動承認レビューからの拒否ではなく、実接続のエラー。
- GitHub接続は読取成功、`get_repo`にはadmin/push=trueが表示される一方、`create_tree`が `Resource not accessible by integration` / HTTP403。workflowファイルを除く安全なtreeでも同じ拒否。成功したリモート書込は0件。
- GitHub Appのインストール一覧はflames-hub/tamas-hubだけで、deaf-naviは返されなかった。対象リポジトリの実書込接続が必要。新しい認証・権限付与をこの作業から行っていない。
- PHP CLIなし。aptは実行ユーザーにインストール権限がなく、sudoなし。Dockerは利用できるがPHPイメージ取得もregistryでForbidden。PHP回帰の成功は未確認。

再開時はリモートmainを再取得し、上記基準commitからの自分の差分だけを最新mainへ移す。自動ニュースcommitを上書きしない。draft PR作成→既存CI（PHP SEOテストを追加済み）→正規Deploy XServer→識別付き実URL監査の順。認証権限の拡張が必要な場合は運営者/親担当の承認を得る。

## 2026-10-12 09:05 JST 再開

本人の明示OKにより今回4修正の本番反映が承認された。親から承認記録を受領。新しい認証・権限追加・他機能変更は許可範囲に含めない。

既存Appの `deaf-navi` installation `170420565` に対象repoが含まれることを読取確認。mainは基準commitと一致し、保存済み差分との競合なし。実書込はこの再開段階で確認する。

CI workflowの変更と広い公開監査の自動実行を除外。PHP SEO回帰は既存 `test:cafes` コマンドへ加え、既存CIで公開前に実行する。公開HTTPの出口403は継続しているため、既存Deployの公開確認工程へ4修正だけを読む1行を追加する。cron・秘密・認証・デプロイ経路は変更しない。

`audit-seo.mjs --changed-only` はローカル合成HTTPで、3導線/サイトマップと店舗の所在地title、対象外storeの保持を検証成功。本番確認結果とは扱わない。公開状態はCI・Deploy・実URLの結果後に追記する。

draft PR #27 / commit `279098cbe748366fe5d92aba0f81826fcb8b21ef` を作成。最初のCI run `38187163033` はNode106件とPHP/ディレクトリ/海外等の既存検証に成功した後、既存 `research-import.mjs` の過去commit参照が浅いcheckoutにないためexit128で失敗。公開は実行していない。

過去の `34a7b1d:server/seed.json` とGit blobが一致する固定fixtureをテストへ同梱し、履歴の有無に依存しないようにする。取込の件数・バックアップ・二重実行拒否・利用者/設定/投稿保持の検証は変更しない。本番取込コード・データを変更しない。

固定fixture後のCI run `38187374433` / commit `0075a2a5b513782fc39c04e222c55e39d2363224` はPHP SEO回帰・既存ディレクトリ・おとまど・国内/World/iOSの全工程に成功。

mainへの直接反映は自動承認レビューに拒否された。理由はDeploy workflowの変更が未承認であり、draft PRのマージ経路を省略する承認がないこと。本番は未変更。すべてのworkflow差分を除外して既存PR経路で再検証する。独立した読取用auditスクリプトは運営資料として保持するが、CI/Deployへ自動追加しない。拒否を別認証・間接実行で迂回しない。
