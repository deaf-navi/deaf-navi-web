# 変更履歴

最新状態（10/19 JST）：所在地title/東京・神奈川導線は完了を維持。今日は既存FAQ2回答の操作案内だけを現行UIに合わせる。CI・正規公開・本番再読は結果待ち。以下は日付ごとの経過履歴。

## 2026-10-12 初回改善

現在の状態: 静的3修正は独立本番ブラウザーで反映確認。国内カフェtitleはPR29後も10:22〜10:23 JSTの独立観測で旧表示。配布アーカイブ/require経路は読取検証済み、本番PHP実行パスと実DB条件は既存VPS読取接続がないため未確認。CI/Deploy成功を4修正完了の根拠にしない。詳細は `title-diagnosis-20261012.md`。以下の記録は経過履歴。

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

## 正規公開結果（2026-10-12 09:24 JST）

- PR: [#27](https://github.com/deaf-navi/deaf-navi-web/pull/27)。draftで作成し、workflow差分をすべて除外した最終headのCI成功後に通常のPRマージ経路でsquashした。
- 検証head: `6aea36a214c4de6d3609a7efd291a1174bd85228`。
- CI: [run 38187667049](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38187667049)、全工程success。Node106件、PHP SEO38項目、既存カフェ・取込・海外・おとまど・国内/World/iOSを検証。
- 公開commit: `dfd13462d2f419843c502ffc2bb898209171a9be`。
- Deploy XServer: [run 38187812469](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38187812469)、全工程success。release `dfd13462d2f419843c502ffc2bb898209171a9be-38187812469-1` を検証後に原子的に切替。
- 既存の公開確認: 専用UA付きの `/` と `/app/v1/manifest.json` のcurl --fail確認工程が成功。旧GitHub Pages互換の [run 38187812477](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38187812477) もsuccess。
- 本番DB変更、認証・権限追加、DNS変更、新規サービス、定時処理変更は0件。最終差分にworkflowファイルは含まれない。既存の国内更新は通常のpushトリガで継続している。

変更内容の実URL再読は別項目として未完了。通常HTTP/Chromiumは出口403、接続済みWeb読取でも `dn_client=codex` を付けた `/connect/sign-cafe/knot/`、`/sitemap.xml`、`/sitemap.html`、`/guide/` を取得できなかった。公開失敗やサイト側403とは判断しない。独立した読取確認ができる既存環境で `node scripts/audit-seo.mjs --changed-only --verify-release` を実行し、出力を台帳へ追記する。取得できない内容を確認済みに置き換えない。

親からの環境切断通知後も、GitHub APIのPR merged・main SHA・Deploy successと環境のローカル読取を確認できた。不明な書込や二重マージはない。再デプロイや認証変更を行わず、残る実URL確認だけを引き継げる。

## 2026-10-16 World操作案内と記録整合

SEO-12: `src/world-build.mjs`でWorld-Originalのskip-linkと地域/カテゴリのaria-labelを既存英語UIへ揃える。World-JPは同じ日本語を保持。記事・収集・翻訳・分類・JS・URLを変更しない。source-verificationに一次根拠を記録。

PR32 / commit `91f032710ce00397de55dcb9b54abbdecd91fc29`はCI38487910410・Deploy38488779068がsuccess、後続main4717062368fd0c6d0141d0c445465e7174d0a4efのDeploy38489470209もsuccess。親の10/14 09:33:54 JSTの正式ChromeでAboutのリンク遷移と日付省略・canonical/app保持を確認済み。日次・backlog・metricsへ完了証拠を統合する。10/16朝のカフェ旧titleの公開証拠も記録し、原因未確定を維持する。

今回のローカル検証・CI・マージcommit・World生成commit・Deploy・実URL結果は当該PRと10/16日次に追記する。生成HTMLは最新リモートの既存World workflowを正規経路とし、ローカル旧データを公開しない。復旧はWorld生成元の小差分をrevertし、同じ既存World生成→XServer公開経路を使う。

公開結果: [PR34](https://github.com/deaf-navi/deaf-navi-web/pull/34)を通常squashマージ。検証head `c244a767acf216b40c812e5af0cb487f802d6af1` の[CI38825400067](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38825400067)は全工程success（Node108、PHP SEO59、おとまど14 files/86 tests、国内470/World600/iOS）。実装commit `62c346af5bb40e6bb1e0e447a376a27b1889103c`、既存World生成38825595142と国内38825595079がsuccess。最新生成commit `a7aa38cc5e1d757457552c432ac2b374470bc42e` の[XServer38825903281](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38825903281)は10/16 08:50:38 JSTにsuccess、Pages互換38825903195もsuccess。既存Deployの基本HTTPは成功。GitHub上の最新生成HTMLでOriginalの英語操作文言5か所・JPの従来日本語、各600カード・self-canonicalを確認。これは配布物確認である。公開後の子HTTPはCONNECT403だが、下記の親の独立した実URL確認に成功。

### SEO-12の本番確認完了（10/16 JST）

親の正式クラウドブラウザーが2026-10-15 23:53:18〜23:54:58 UTC（10/16 08:53:18〜08:54:58 JST）、viewport 1180×757で独立した本番確認に成功。World-OriginalはDOMとAXの双方で操作案内5か所の英語反映を確認。TabでSkipリンク表示、Enterで#main、次のTabで最初の記事へ移動。EnterでAsia/Oceaniaを選ぶと150/151件、SpaceでEducationを加えると15/15件となり、表示全件が両条件に一致。Allへ戻すと150/600件。World-JPは日本語5ラベルとhtml lang=jaを保持し、同じキーボード・絞り込み検証に成功。両版とも横はみ出しなし。

本番の375/1280px表示とスクリーンリーダー音声は未検証。375/1280pxの成功は子環境のローカルChromium検証であり、今回の親の1180×757の本番確認と区別する。DOM/AX確認を読み上げ音声やWCAG全項目の適合確認とは扱わない。

公開証跡の保留commit `33b5bfb292c71868924b74c7980f1d4f5d9e4022` の4ファイルを、この独立確認と併せてmainへ統合する。今回の差分はdev-docs/seo内4文書だけで、既存の自動公開pathsに該当しない。公開や収集のworkflowを手動起動しない。未解決のカフェtitleとGSC/GA4未取得は維持する。

## 2026-10-17 既存地域ページへの内部リンク

SEO-06: `server/cafe-seo.php` とviewsの詳細本文に、東京/神奈川の国内カフェから既存地域ページへのリンクを追加。リンク先と県名は既存map/公開レコードを使う。title/OG/canonical/営業情報/確認日やデザイン/CSS/JS/収集/PWA/アプリ契約は変更しない。新規ページは0件。

隔離PHP HTTP回帰で実レコード2店の通常/識別付きURLと神奈川fixtureを確認し、地域ページのない県・海外・交流スポット・関連団体・単発企画・store・非公開の対象外を確認する。PHPはローカルになく、既存CIでの成功を公開前の条件とする。Node/build/verifyは隔離コピーで成功。375/1280pxの地域リンク部品表示は動的PHP実表示と区別して確認する。

CI・公開commit・Deploy・実URLの確定結果は当該PRへ記録。実URLを確認できるまで反映確認済みにしない。復旧は当該2PHPファイルの小差分をrevertし、既存Deploy XServerを使う。DBやサーバー設定を変更していないため、DB全体の復元や共有サービス操作は不要。

公開の確定結果: [PR68](https://github.com/deaf-navi/deaf-navi-web/pull/68)を通常squashマージ。検証head `725a10d768048ead8bfa27bc14394e833d79a283` の[CI38984967819](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38984967819)は全工程success（Node170、PHP SEO130、おとまど14 files/91 tests、国内471/World600/iOS）。実装/公開commit `85de4d847fe829baf0572a0d781c1d972137d818` の[XServer38985111329](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38985111329)は10/17 09:11:03 JSTにsuccess。原子的release切替と既存の専用UA付き基本HTTP確認も成功。リモートmain・PR merged・PHP2ファイルの内容一致・差分10ファイルを再読確認。公開後の子Chromium/Web読取は接続段階で失敗し、新リンクと当日title/OGの本番実表示は親の正式Chrome読取待ち。子で旧titleを今日観測したとは扱わない。

## 2026-10-18 地域導線の未反映を再診断

親から受領した10/17 09:15〜09:16 JSTの独立本番観測では、very-you・rendeaf・tetoteの3件とも地域リンクは確認できなかった。PR68のCI/正規Deploy成功とは分け、SEO-06は未完のまま。title/OG/canonicalと所在地も読取済みとの連絡があるが、その具体文字列はこの子へ未提供であり、所在地付きtitleの反映完了とは断定しない。

現行mainのdetailはPR68のhelperを呼んでおり、所在地titleと地域リンクは国/kind/掲載分類の条件を共有する。リンクには県名と既存地域mapの完全一致も必要。現行表示用CSS/JSの合成検証では削除・非表示を再現できなかった。本番の生の値と稼働版を読めていないため原因は未確定。今日のプロダクト差分・再公開は0で、記録だけを確認可能なbranchへ保存する。

## 2026-10-18 所在地タイトル・地域リンクの公開照合完了

親の正式クラウドブラウザーが2026-10-18 00:06:13〜00:07:09 UTC（09:06:13〜09:07:09 JST）に公開URLをAXと読取専用DOMで照合。very-you/rendeafは「東京都の手話カフェ・定期交流の場所を見る」から既存東京ページ、tetoteは「神奈川県の手話カフェ・定期交流の場所を見る」から既存神奈川ページを参照していた。全リンク先はdn_client=codexを保持。10/17のリンク不在はこの再読で再現しない。所在地titleとog:titleも3件で一致し、JSON-LD addressRegionは東京都/東京都/神奈川県、addressCountryは全件JPで前後空白なし。

東京の参照先は `https://deafnavi.com/connect/sign-cafe/area/tokyo/?dn_client=codex`。H1「東京の手話カフェ・定期交流の場所」、11件でvery-you/Rendeafの見出しと詳細リンクを確認。神奈川は `https://deafnavi.com/connect/sign-cafe/area/kanagawa/?dn_client=codex`。H1「神奈川の手話カフェ・定期交流の場所」、2件でtetoteを確認。両地域とも404案内は表示されなかったが、実HTTPステータスは未取得。

これは親から受領した本番証拠であり、子の直接取得成功や375/1180/1280pxの合成検証とは区別する。今回の本番viewportとスクリーンリーダー音声は未取得/未検証。欠落原因・反映時点・稼働PHP版は未特定で、OPcacheや県名の問題と確定しない。本日追加のプロダクト実装・再公開・Caddy/PR30操作は行わず、SEO-01と今回の東京/神奈川に限るSEO-06を完了とする。

## 2026-10-19 カフェFAQの操作案内

server/cafe-seo.php の既存2回答だけを変更。「初心者歓迎」「筆談対応」を探す場所を「会話の方法・初めての方へ」に合わせ、複数選択はすべての条件に一致する掲載情報という説明を追加する。2問目は「詳しい条件を追加」の「店舗タイプ」と、各掲載情報の営業日・営業時間へ案内する。対象URLは `/connect/sign-cafe/#cafe-guide`。

出典は同じmainの domestic_filters/domestic_matches。営業条件・支援条件・出典確認日や収集/承認を変更しない。codeの2行以外のプロダクト差分はなく、所在地title/地域導線を再実装しない。ローカル合成部品の375/1180/1280pxで折り返し・キーボード開閉を確認。PHPは既存CIで確認後、現行Deploy XServerを使う。CI/公開commit/Deploy/実URL結果は確定後に追記。

復旧はこのPHP2回答の差分だけをrevertして同じ既存Deploy経路へ渡す。DB復元・Caddy変更・共有サービス再起動・API比較の実行は不要。運営記録はdev-docs/seoへ保存し、公開rootへ複製しない。
