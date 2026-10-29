# 変更履歴

最新状態（10/23 JST）：PR121の操作案内・所在地title/地域導線の完了を維持。FAQ読了後に同じ条件の一覧へ戻る1リンクを追加する。CI/正規公開/実URLは結果待ち。店舗出典の相違と検索値の未取得は保持。以下は経過履歴。

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

### FAQのCI・正規公開確定

PR97の最終head `9fe7a7d1ce447b2036376bab32277879cb181416` はCI39176242415全工程success（Node230/PHP SEO130/おとまど91、国内473/World600/iOS）。通常squash commit `54a81c6aad5435f85c1a75341d7088be3eec6a98` のXServer39176365311は10/19 08:25:01 JSTにsuccess。実commitは基準311fcc52をparentとする6ファイルで、PHP2行と運用5文書以外は変更なし。mainのPHP全文も候補と一致。

配布とサーバーstagingでPHP lint、隔離SEO回帰130項目、原子的切替とトップ/アプリmanifestの基本HTTP確認が成功。本番FAQ本文は08:25:26 JSTの子HTTPがCONNECT403、Webもnot accessibleのため未取得。公開workflow成功をFAQ反映完了に置き換えず、親の正式ブラウザーによる識別付き再読待ちとして保持する。詳細はdaily/2026-10-19.md。追加再デプロイやサーバー設定変更は行わない。

### 公開FAQの旧文言残存：未完へ更新

親の正式Chromeで08:30 JSTにFAQ2回答が旧文言、08:30:47 JSTの通常再読1回後も再現。現行の絞込項目/説明は表示済み。AXと実画面が一致、HTTPステータスは未計測。今回のFAQ反映は未完とし、CI/正規Deployのsuccessと分ける。

最新main/配布元PHP/checkout・staging lint/require経路を照合。6 PHPの隔離tarは単一収録・元bytes一致、static入口にFAQなし、DB条件による旧文言分岐なし。実サーバーのcurrent/hash・有効FastCGI/FPM設定は既存読取接続がなく未取得。原因をOPcacheと確定せず、再編集・追加Deploy・Caddy/PR30・失効/再起動・新規権限を行わない。期待hashと次に必要な非秘密情報はdaily/2026-10-19.mdへ保存する。

## 2026-10-20 PR110後の開閉順序をFAQへ反映

現行カフェUIは「会話の方法・詳しい条件」の内側に会話方法と「詳しい条件を追加」を置く。server/cafe-seo.phpの2回答を、その外側を開いてから探す手順へ更新する。営業日FAQでは続いて内側を開く順序も説明。既存の全条件一致、公式情報/最新案内確認、店舗条件・出典確認日を保持する。対象URLは `/connect/sign-cafe/#cafe-guide`。

現行CSSを使った合成FAQの375/1180/1280pxで表示とキーボード開閉を確認。変更はPHP2行と運用記録のみ。既存CI→通常PRマージ→Deploy XServer→親の識別付き公開QAで確定する。前回の旧表示だけを理由に同じ修正を再公開する作業ではない。

復旧は今回の2回答の差分だけを戻し、既存Deployへ渡す。DB/記事/画像/import/認証/サービス設定は変更しない。Caddy/PR30/再起動/cache purgeは行わない。PR/CI/配布commitと公開内容の結果は確定後に追記する。

## 2026-10-21 PR121の公開確認と記録統合

PR121/head5cba95e3のCI39344105058は全工程success、通常squash61aaa094のXServer39344289470は10/20 08:54:06 JSTにsuccess。10/21 08:13 JSTの親正式Chromeで、識別付きカフェURLのFAQ2回答・全条件一致の説明・外側→内側の実UIと「店舗タイプ」を照合し、今回の操作案内を完了とする。条件送信/サイト変更なし。旧表示の原因・解消時点は未特定。

10/20日次の未統合だったCI/公開/QA証跡、10/21日次、backlog/metrics/source-verificationを更新する。変更はdev-docs/seoの6文書のみで、プロダクトの重複修正・診断だけの再Deployは行わない。Agent Activity/オフライン表示等の別作業は対象外。既存CI後に通常PRで統合し、実差分とリモート内容を確認する。復旧は文書差分だけのrevertで行える。

## 2026-10-23 FAQから同じ検索結果へ戻るリンク

server/cafe-seo.phpの1行で、FAQ末尾に「手話カフェの一覧へ戻る」→既存#cafesを追加する。fragment-onlyのため検索条件・表示方法・識別を保つ。FAQ回答/フォーム/CSS/JS/URL構造/metadata/DBや収集・アプリは変更しない。

現行CSS・JSを使う合成HTTPの9ケースで移動・Tab継続・条件保持を確認、1置換で元PHP全文へ戻り、空白エラーなし。既存CI→通常マージ→Deploy XServer→識別付き実URLを別々に確認する。確定ID/結果は当該PRと公開QA後に追記。復旧はこの1リンクだけのrevertと既存Deployで行える。

西尾茶屋の曜日相違とKnot奈良/芦屋の対象区別は出典記録へ保存し、営業情報・確認日を変更しない。Caddy/PR30/再起動/cache purge・新権限/サービス・SNS収集・本番importは行わない。

### PR139の公開QA未完と通常Deploy内の整合確認

[PR139](https://github.com/deaf-navi/deaf-navi-web/pull/139)のhead `2818f7507b3154e59d58c0d335f786c44829f0a2` は[CI39877067946](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39877067946)全工程success（Node271、stories JS11＋隔離128、PHP SEO130、おとまど91、国内468/World600/iOS）。通常squash `0e30ab54b385b2f0647285f9cdc006038152376e` の[XServer39877282606](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39877282606)は09:18:55 JSTにsuccess。実parentはd04e78c0、差分はPHP1行＋運用5文書。

親の正式クラウドChrome/CUAでは09:21 JSTの識別付きURL、09:22 JSTの通常URLで新リンクがAX/スクリーンショットに不在。FAQ4項目の直後は掲載方針。後続main `7e2ed8bb521ff8b075e17ec51a7a893f39eca95e` の[XServer39878229270](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39878229270)も09:28:45 JSTに実deploy successだが、09:32 JSTの新規タブでも不在だった。検索条件保持/リンク移動は本番未検証、HTTPstatus未計測。タブ閉鎖済み、設定変更/キャッシュ削除なし。Deploy成功だけでは公開QAを完了としない。

09:32 JSTの本人「本番公開まで進めるようチェックしといて」と親の追跡指示に基づき、既存Deploy XServerの通常処理へ整合確認を追加する。接続先/Secrets/権限/トリガー/原子的切替は既存のまま、checkoutのGit原本hashとstaging/currentの対象PHP hash、切替前後のcurrent参照先を照合する。hash/参照先不一致では失敗させる。公開確認は識別付きカフェURLのHTMLでリンク有無と許可した公開cache headerだけを出力し、不在はwarningかつ公開QA未完とする。新規workflow/endpoint/認証や鍵の抽出、Caddy/PR30/失効/サービス再起動は行わない。

ローカルでYAMLの変更範囲（既存Activate/Verifyのrunだけ）、全Deploy shellのbash構文、正常/改変/欠落PHP、正常/不正hash入力、currentの一致/不一致、公開リンク有/無、Cookie/認証headerの非出力を検証して成功。外部通信/本番操作のないfixture検証であり、実サーバー/公開の成功ではない。既存PR CI→通常マージ→正規Deployで稼働実体と公開本文を分けて確認する。復旧は今回の検証差分だけを戻せる。

### 09:47 JST 正規配布の実体照合、公開QAは未完

[PR141](https://github.com/deaf-navi/deaf-navi-web/pull/141)のhead `fe502e47859c98077d39d811e5792b334aa07490` /[CI39879857464](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39879857464)は全工程success。通常squash `b83508f168d98cfc8fd029c03e24246483f8d7b1` の[Deploy39880077869](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880077869)も09:47:16 JSTにsuccess。実parent092b36de、workflowと運用5文書だけで、対象PHPはPR139と同一。

09:47:10〜11 JSTの正規SSH activationで、切替前currentは `/srv/deafnavi/releases/092b36de1e7c2eeb8b00ccb2e0027298a2e4d770-39879138679-1`、切替後は `/srv/deafnavi/releases/b83508f168d98cfc8fd029c03e24246483f8d7b1-39880077869-1`。切替前PHP・staging・切替後currentの3つの実測SHA-256はすべて `868972728ac88ea7fea58d4e868da781d79a47bd907decdfac78a334309a812b` でGit原本と一致。これにより、この観測時点の配布ファイルとcurrent参照先の不一致は見つからなかった。09:18/09:28の実サーバーhashまで遡って測定したとはしない。

09:47:14 JSTの既存runnerによる識別付き公開GETはHTTP/1.1 200 OK、Content-Type text/html、Via Caddy、Cache-Controlはprivate/no-store/max-age=0とno-store/no-cache/must-revalidateを返したが、新リンクはHTML内にも不在。workflowがQA未完のwarningを記録した。これは配布元/ファイルの一致と、公開本文の不一致を同時に示す。公開実行PHPのパス・保持状態/有効設定はまだ未確定で、OPcache等の原因を確定しない。

次は有効なDeaf Navi専用FastCGI root/socketとPHP-FPMの関連設定を非秘密部分だけで照合する必要がある。過去のCaddy/PR30実行・cache操作の承認待ちを維持し、PR30全体の実行、設定適用、サービスreload/restart、失効は未実施。条件付きの専用resolve_root_symlink案・限定QA・復旧手順は[配信診断と承認候補](delivery-diagnosis-20261023.md)へ保存し、実設定読取と必要性の確定前に適用しない。新しい認証/権限/サービス・DNS変更は行わない。

後続の通常国内生成更新 `b50b3dae2a2975d3bfa9c3347911c4d929b7779d` の[XServer39880357771](https://github.com/deaf-navi/deaf-navi-web/actions/runs/39880357771)でも09:50:05〜06 JSTに切替前/staging/currentの同じSHA-256一致とcurrent参照先を実測。09:50:10 JSTの公開GETは再びHTTP200/no-storeでリンク不在。後続公開を待つだけでは解消を確認できていない。

### Windows側の限定読取結果を台帳へ反映

2026-10-23 10:14 JSTの本人「読み取りいいよ」と親の限定委任により、既存の正規接続でDeaf Naviの配信先/current実体と有効Caddy/FastCGI/PHP-FPM設定の非秘密項目を読むことは承認済み。設定変更・権限拡張・キャッシュ消去・再起動・graceful reloadは未承認のまま。PR30全体の実行やDB読取の包括承認へ広げない。

親から受領したWindows担当作業 `01a16656-a59b-7156-b02f-cb79a1f90009` の報告では、本日成功したDeployのDEPLOY_HOSTと既存SSH宛先が一致した。ただし、Windows実行環境でそのホストとdeafnavi.comの通常DNS照会が双方「アクセス拒否」error 5となり、DNS回答は未取得。照会の実施時刻はこの子に未提供で、10:14 JSTの承認時刻を照会時刻へ転用しない。

NXDOMAINやサーバー停止を確認した結果ではない。SSH認証・遠隔実行へ到達しておらず、SSH認証失敗とも扱わない。VPS内の有効Caddy/FastCGI/PHP-FPM設定・公開リクエストの実行ファイルは未取得。09:47/09:50の正規Deployで得たcurrent/hashの一致と、その時点の公開HTMLのリンク不在は従来の証拠として保持する。

状態は公開QA未完・実行環境待ち。本人への具体的な阻害要因の通知済みは親の報告として記録する。権限拒否を迂回せず、追加の再公開・設定/キャッシュ/reload・権限変更は行わない。次は既存接続で限定読取を実行できる環境が利用可能になったときに再開し、承認済みの読取を再承認待ちへ戻さない。新規接続や資格情報を追加しない。

今回の差分はdev-docs/seoの6文書だけ。プロダクト・生成物・workflowを変更せず、通常の文書PRと既存CIで保存する。追加Deployは起動しない。

## 2026-10-27 公開証跡と未完QAの記録を更新

10/27 07:56:25 JSTの[既存Deploy40416072301](https://github.com/deaf-navi/deaf-navi-web/actions/runs/40416072301)は、main `20c1f7ed1e2058d72bd01bf948cbb599f1f03f76` の識別付きカフェ公開GETでHTTP200/no-storeと「手話カフェの一覧へ戻る」のHTML内存在を記録した。current参照先と対象PHPのstaging/current SHA-256 `3400dbe91cabbb9c5de67d92151959715adbafe18bc5315175169596fc05fc13` の一致もログで確認した。

これは既存Actionsの観測をこの作業で読んだ証拠であり、新しい直接GET・ブラウザー実表示/クリックの証拠ではない。#cafesへの実クリック、検索query・絞込条件・表示状態の保持と、初回4修正の当日公開再読は未完。CONNECT403は新たな関連証拠がないため再試行せず、別経路で迂回しない。

同じmainのsitemap.xml/sitemap-world.xmlは合計85エントリ・83固有URL。PHP配信の全国一覧/地図2URLを別扱いとし、残る静的81ページのhead全体をGitHubのソースから照合した。すべて掲載URLとcanonicalが一致し、meta noindex/refreshは検出しなかった。これは2つの静的XMLとソースheadに限る検査で、公開HTTP・Googleの選択canonical・GSC対象URL・動的directory/stories sitemapの検証ではない。

公開コード/生成物・guesthouses・DB・収集/PWA/絞込/アプリ・workflowは変更しない。今回は公開対象外の運営記録だけを通常PR/既存CIで更新する。追加Deploy・新規接続/認証・設定/cache/reload・監視は起動しない。30日範囲は10/12〜11/10を維持する。

10/23のリンク不在の観測は履歴として保存し、最新状態を「公開HTML内存在確認済み・操作QA未完」へ更新する。GSC通知との対応は未確定のまま。復旧は今回の運営文書/検査記録差分だけをrevertできる。

## 2026-10-28 差分メタデータ検証と配布jobの区別

前回PR185以降の14コミット/96ファイルの差分を読み、比較APIのファイル上限に達していないことを確認した。カフェのSEO・検索UI/戻りリンクのソース変更はなく、既存情報の更新と無料枠確認運用等が主な差分。今回それらのコード・内容・運用設定は編集しない。

2つの静的XMLは91エントリ・89固有URL。全国カフェ一覧/地図のPHP配信2URLを除く静的87ページについて、追加・変更53ページのheadを再読し、ソース未変更の34ページは前日の検査結果を継承した。全87件で掲載URLとcanonicalが一致し、meta noindex/refreshは検出しなかった。sitemapは6URL増・削除0で、増加は既存mainの更新であり、このSEO作業による新規公開ではない。

main `1339751b23174734bc9529ad9388672bc36ca0f9` の[既存Deploy40530201910](https://github.com/deaf-navi/deaf-navi-web/actions/runs/40530201910)は実deploy job success。10/28 00:23:39 JSTの識別付き公開GETでHTTP200/no-storeとFAQの戻りリンクのHTML内存在を記録した。current/stagingの対象PHP SHA-256は `3400dbe91cabbb9c5de67d92151959715adbafe18bc5315175169596fc05fc13` で一致。

より新しい[40545029312](https://github.com/deaf-navi/deaf-navi-web/actions/runs/40545029312)はrecovery-publication job successだがdeploy jobはskippedであり、新しい実配布とは数えない。run全体のsuccessと配布jobの実行を区別する。

詳細は[daily/2026-10-28.md](daily/2026-10-28.md)と同日のJSONへ保存する。変更は運営文書/検査データ4ファイルのみで、公開URL・コード・workflow・DBは変更しない。公開QA未完を維持し、追加Deployは実施しない。復旧はこの運営記録差分だけをrevertできる。

## 2026-10-29 SEO-13の限定実操作QA完了と現行導線の確認

親の正式cloud Chromeで08:57 JSTにSELF＋東京都・該当1件・カード表示を保ってFAQ→#cafesへ実移動。08:58 JSTには初回4修正も限定再読した。詳細なquery・URL・観測範囲・既存Deploy40789874694の証跡は[daily/2026-10-29.md](daily/2026-10-29.md)へ保存する。SEO-13と配信診断冒頭の現在状態を更新し、10/23の履歴は残す。全条件/モバイル・guideのHTTP301・GSC/GA4の未取得は完了へ置換しない。

公開URL/コードの変更は0件。既存mainのPR199/200等を保持し、今回の差分は運営記録5ファイルのみ。draft PR→既存最終head CI→通常ポリシーでの保存とし、approveレビュー・追加Deployは実行しない。復旧は今回の記録差分だけをrevertできる。次の優先は既存GSCアクセスでの対象URL/クロール情報の照合と、適用日付き一次情報待ちのSEO-05。

## 2026-10-30 既存告知画像をEventメタデータへ反映

本文の既存画像をJSON-LDにも使う小さな変更をPR208で通常統合（48e3cf8）。関連22テストと最終head CI40973955747が成功し、既存Curate & Build40974266654→生成2d4d90b→Deploy XServer40974749780も成功。画像付き21詳細の生成物でEvent.image/本文画像の一致を確認した。10/30 08:46:58〜08:47:27 JSTの親正式Chromeで代表1URLの画像一致/実表示を確認。変更URL・証拠・未完は[daily/2026-10-30.md](daily/2026-10-30.md)と同日の検証JSONを参照する。

新規ページ0件。offers/performer/organizer.urlは補作せず、4種類のGSC非重大警告を4URLと数えない。対象URL/件数/クロール日とGA4/GSC実測は未取得。PR201の完了済み限定QAは保持する。approveレビュー・新規認証・設定/収集/アプリ/PWAの変更なし。復旧はPR208の差分と今回の運営記録差分を個別にrevertできる。
