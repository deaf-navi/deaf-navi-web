# サーバー主導のキュレーション（2026-10-21）

ユーザー指定により、毎日の比較処理の起動をCodexからサーバーへ移す。新しい公開情報の承認まで無条件に自動化する変更ではない。従来のAPI_CURATION.md、EVENT_CURATION.md、CAFE_EVENT_CURATION.md、COMPLIMENTARY_TOKENS.mdの安全条件は維持する。

## 実行分担

| 時刻（JST） | 担当・処理 |
| --- | --- |
| 06:10 / 12:10 / 18:10 | 既存Actionsの国内・World更新を維持。Google翻訳・保存済み訳を先に使う |
| 06:40 | 既存カフェ情報源照合を維持 |
| 08:40 / 14:40 / 20:40 | 既存イベント・カフェの限定的な通信復旧を維持 |
| 09:00ごろ | 既存deaf-navi-2で当日のアカウント確認、未承認の共有文面・新規情報源・例外を確認 |
| 09:10 | deafnavi-curation.timerからserver-curation.mjsを通常モードで実行 |
| 許可台帳・カタログ更新時 | deafnavi-curation.pathが同じ処理を起動。排他と保存済み結果を再利用 |
| 09:20 | Worldの既存workflowで承認済み未訳を非生成で確認し、対象がある場合のみ補完 |

タイマー時刻は実行完了時刻を保証しない。09:00の確認が遅れた場合は許可台帳更新で比較が再開する。Worldは実行中・完了記録を照合して必要な場合だけ通常workflowを1回起動し、重複起動しない。新しいチャットや有料検索サービスは使わない。

## サーバーで行うこと

- 既存公開イベントJSONとカフェのread-only review-exportから対象を作る。HTMLの全文hash、承認済み短い抜粋、現在の台帳と鮮度を比較する。
- 同じ文面・判定仕様は私有キャッシュを使う。必要な抽出だけ当日の無料APIで処理する。通常16回/UTC日・共通トークン予算・二群の無料枠制限は既存クライアントが再検証する。
- 過去に人が共有適性を確認した正確な文面は、再取得した公式HTML全文hash・URL・題名・抜粋が一致する場合だけ当日の文面hashへ再登録できる。元のsharingReviewedAtを保持する。新しい内容を機械的に共有承認しない。
- 登録された公式・専門団体ページの告知リンクを最大8ページ/日探索する。新しいURLは非公開候補へ残し、開催日時や掲載可否をリンク文言から認定しない。
- curation-exceptions.jsonへ新規・変化した例外と解消履歴を保存。同じ既知の例外を毎日新規扱いしない。server-curation.jsonとserver-curation-runsへ実行結果を保存する。

APIによる一致は掲載承認ではない。新規・変更・不足・SNS・画像・PDF・共有適性不明はCodexの例外確認へ回す。公開承認、reviewedAt、48時間期限、年次期限を機械的に更新しない。カフェDBにはこのサービスから書き込まない。通常の確認済み情報源の照合・復旧・公開は既存処理が担当する。

## 無料枠のアカウント確認

公式のOrganization Usage APIはモデル・service_tier等の使用量を取得できるが、既存のDeaf Naviプロジェクトキーでの実測はHTTP403だった。APIの成功やローカル台帳だけで、無料枠への登録、共有設定、適格モデル、正の残高、組織全体の当日残量を証明したことにはしない。管理キーの新規発行や権限拡大は行わない。

そのため当日のアカウント確認は現時点ではCodexのログイン済み画面での確認を残す。allowance.jsonが未確認・期限切れなら無料APIは停止し、既存キャッシュ・非AIの収集・候補探索は継続する。checkedAt・expiresAt・無料適格性・予算を自動延長しない。結果不明要求は再送しない。実使用の無料区分への計上確認も従来どおり行う。

## 新規候補と公式HTMLの拡張（2026-10-22）

公式入口は13ページ（カフェ向け6・その他7）に拡張。最大8ページ/JST日は維持し、カフェ向け・その他に各4枠を割り当て、余った枠を補充する。各群で最後の取得が古い入口から巡回し、同日の公開URL・設定変更でも既に取得したページを再取得せず8ページを超えない。確認済みの専門団体の指定パスに限り「例会」「交流企画」など一般的な題名も非公開候補へ残す。一般カフェ・一般施設にこの扱いを広げない。リンクの発見だけではAPIへ送らず、`curation-discovery.json`の`reviewQueue`で公式本文・共有適性の初回確認を待つ。

初回確認した候補は、私有`curation-review-catalog.json`の`discoveryTargets`へ固定ID・URL・題名・正確な短い抜粋・`approvedDocumentHash`・実際の`sharingReviewedAt`を登録する。既存掲載の`targets`とは分ける。サーバーは掲載済みの比較に続けて、1回最大8候補を4件ずつ、ドメインを分散して処理する。最近処理していない候補を先にし、残りはdeferredとして履歴を保持する。通常の16要求/UTC日・同じ無料枠/トークン予算内で、抽出キャッシュを再利用する。未承認文面、変更HTML、結果不明の送信は止める。

`discovery-review.json`は新規候補の抽出結果・根拠・不足・変更だけを記録する。`publication-review-required`は掲載前の確認待ちであり、公開承認ではない。`not-relevant-proposed`も非掲載の提案に留める。開催年や会場が不明ならneeds-review、期間外ならoutside-horizonとして残す。掲載済みURLとの重複は保留し、同じURLに次回告知がある場合はCodexが開催回を区別して確認する。申込期限切れ、画像/PDF、情報不足や本文の不一致をCodexへ回し、既存ID・公開状態・確認日時・DBは変更しない。

`server-curation.json`の`candidateReview`と`discovery-review.json`の`newOrChanged`を例外対応時に確認する。`selected/cached/submittedThisRun`は対象項目数であり、API要求回数は使用台帳のroutineRequestsで確認する。候補結果の自動取得日時を人による確認日時として扱わない。

## 宿泊案内の比較と候補選別（2026-10-24）

既存09:10の同じ処理に宿泊案内を加える。新しいcron・APIキー・予算枠は作らない。公開`guesthouses.json`は施設ID・出典URL・掲載内容hashだけを持つ。`src/guesthouses-data.mjs`をビルドした実公開版と、手で確認した比較基準をhashで結び付ける。

私有カタログの`lodgingTargets`（掲載済み）と`lodgingCandidates`（候補）へ、`kind=lodging`、固定recordId、公式URL、共有確認した短文・approvedDocumentHash・元のsharingReviewedAtを保存する。掲載済みはfacilityId/publicationHash/baseline.requiredFields/baseline.factsも必要。fieldはbooking、rates、payment、cancellation、stay、reception、lodgingCommunication。税・単位・人数・季節・経路を含む短い原文を比較し、別予約経路の条件を混ぜない。運営者の障害・健康体験・個人の連絡先は送信しない。

`lodging-review.json`へ1回最大8件、4件ずつ最大2バッチを保存。通常16回/UTC日・既存の共通無料予算内で、前回確認が古い対象を優先し残りはdeferredへ。文面・判定仕様が同じなら抽出キャッシュ、同日同条件なら保存結果を再利用する。料金・予約の差異、本文hash変更、掲載版変更、取得不能、未登録、画像/PDF/SNSを例外にする。machineCheckedAtは機械取得時刻であり公開確認日時を更新しない。常設宿にイベントの48時間掲載失効を適用しない。

候補のoperatorVerified/receptionVerifiedは公式情報を実確認した時だけ設定し、APIへは送らない。APIは短期宿泊案内かと条件を整理し、現在の受付・運営属性・空室を推定しない。publication-review-requiredも公開承認ではない。APIのnoで掲載削除せず、条件不足や受付不明はneeds-reviewで保持。屋久島デフファームの過去の案内だけで現在の受付を承認しない。

`config/lodging-discovery.json`の専門媒体から土曜を起点に週1回、最大8ページ・各24リンクを探索し、`lodging-discovery.json`へ非公開候補を保存する。未実施なら次の同じ処理で補う。取材本文はAPIへ自動送信せず、新規公式HTML・短文の共有適性を初回確認してからカタログへ加える。登録入口外の全国検索は既存の週次Codex作業を維持し、APIに検索機能があるとは扱わない。

Codexはserver-curation.jsonのlodging/lodgingDiscoveryと私有レポートのnewOrChanged・不足理由を優先し、一致結果や既知の保留を毎日作り直さない。確認できた重要差分だけ既定PR/CI/Deploy XServerで反映し、guesthouses.jsonも同時生成する。取得失敗・容量上限は例外に残し、無制限取得や閉業判断をしない。API生成・公開日時の更新・DB変更を伴わない比較モードで従来結果も照合する。

### 大きい公式ページと確定した抽出不備の扱い

たらこ湯のようにテーマのCSSがHTML本文より前に容量上限へ達する場合、公式WordPressの公開ページAPIを初回に実確認して私有対象の`wordpressPage: {id, apiUrl}`へ指定できる。宿泊対象だけ・元ページと同じorigin・固定page ID・`_fields=id,link,status,content`に限定し、応答のid/link/publish/protected=falseを照合する。取得先の自動探索・ログイン・context=edit・外部転送はしない。80万bytes・15秒・DNS/SSRF保護は維持し、rendered本文全体と取得先を含むhashをapprovedDocumentHashへ実確認時に登録する。ページ外のテーマやナビは本文hashの対象外であることをdocumentScope/sourceEvidenceUrlに明示する。公開ページ、ID、URL、本文が変われば例外へ戻す。

確定済みキャッシュの`api-evidence-invalid`だけは、一度原文を再読し、私有対象へ`evidenceReview`（reason、inputId、documentHash、publicationHash、checkedAt、原文に一致するdecision）を記録できる。再取得した本文・正確な入力ID・現在の掲載版・有効な根拠引用・全必須条件との一致を毎回検証し、合格時だけ`reviewed-evidence`/`evidenceReviewed`として再利用する。APIのcorroboratedとは区別し、元の拒否キャッシュ・実確認時刻を保持する。未知の送信、候補の運営確認、変更条件、期限切れ、取得不能は解除しない。checkedAtを自動更新せず、公開reviewedAtや掲載承認も更新しない。

新しい抽出不備には本文を保存せずvalidationCodeを記録する。旧キャッシュはunknown-historicalのままにし、不正応答が残っていない過去の原因を推測で埋めない。同じ短文を原因調査のためだけに再送しない。

## World

専用サービスの認証付きPOST /filter-approvedは、当日の有効な許可と正確な文面hashに一致するIDだけを返す。生成は行わない。WorldはこのID群を選んでから50件の上限を適用し、未承認の先頭記事が後続の承認済み記事を押し出さないようにする。補完時には予算・共有・結果不明等をもう一度検証する。未承認・未訳は保留を維持する。

## 比較と運用確認

2026-10-22、同一の本番入力53件で隔離比較した。既存49件のstatus/reasons/differencesは一致し、新規登録4件だけが未登録から共有承認待ちへ進んだ。API送信0・カフェDB全テーブルと本番allowance/使用台帳は不変。新しい3候補も掲載承認せず保持した。公式入口9件中8ページを取得し、非公開候補20件を抽出した。抽出対象の私有カタログは既存掲載25→29件、掲載前候補3件であり、日々の鮮度・取得状態によって実際の選択数は変わる。

2026-10-21、本番の同一入力52件について旧日次CLIと新サーバー処理のstatus/reasons/differencesが一致した。選択24件は全てキャッシュ、新規API送信0。公式等6ページから非公開候補8件を発見した。カフェDB全テーブルの論理hash、実運用のallowanceと使用台帳は比較前後で不変だった。件数はその時点の実測であり固定値ではない。

本番リリースは専用サービス・curation-batchの旧ファイル/リンク先を非公開領域に保存し、版管理された新リリースへ切り替える。PM2はdeaf-navi-codex-app-serverだけを再起動する。systemdのservice/timer/pathはoperations/の定義を使用する。公開サイトは既存PR・CI・Deploy XServer経路を維持する。

復旧時は新timer/pathだけを停止し、curation-batchのリンクと専用サービスを保存版へ戻す。実利用台帳・予約・許可を古いバックアップで上書きしない。従来のニュース更新・カフェ巡回・通信復旧や他サービスを停止しない。再起動後はhealth（非生成）、当日許可、例外結果、API回数、公開データを照合する。

## カフェ・イベントの確認期限と取りこぼし防止（2026-10-25）

画像・PDF・SNSの比較理由が毎日同じでも、48時間の確認期限は進む。`curation-exceptions.json`の`newOrChanged`だけを作業一覧にしない。`curation-attention.json`はその時点の公開スナップショットから、期限切れ、次の24時間以内に期限を迎える目視対象、掲載版と確認版の不一致を計算する。APIの同日キャッシュや無料枠の未確認にかかわらず、既存サーバー処理の冒頭で更新する。

朝09:00の例外確認は09:10のサーバー処理より前なので、まず以下の非生成モードで期限一覧だけを更新する。既存lockを共有し、競合時はbusyとして稼働中の結果を待つ。キー・allowanceを読まず、外部HTTP・抽出・API・公開DB更新を実行しない。通常CLIの二重実行に置き換えない。

```sh
DEAFNAVI_AI_STATE_DIR=/srv/deafnavi/shared/ai node /srv/deaf-navi-codex-app-server/curation-batch/scripts/server-curation.mjs --attention-only
```

`due`は未解消の作業一覧で、理由に変化がなくても保持する。`newOrChanged`は差分だけ。2週間以内を優先し、通常は6週間、演劇は6か月以内で開催日順に確認する。同一根拠URLは`sourceGroups`でまとめて一度読み、開催回ごとの日付・条件は別々に照合する。日付不足・期間外は別枠に残し、次回日程を推定しない。HTMLの期限切れは既存巡回の変更・復旧状況と照合し、目視対象は実際の本文・画像・PDFを確認する。確認できた差分のみ従来の掲載手順へ進め、ここから公開承認や確認日時を延長しない。新規例外がなくても`due`を読み、未対応なら根拠と次回確認を既存調査台帳へ残す。

新しい巡回入口は世田谷総合プラザ、YA読書会主催者、LamuneDou、愛媛県視聴覚福祉センター。2026-10-25に公式HTMLから候補リンクを実取得できることを確認した。「手話べり」「おしゃべり」「読書会」の告知名も候補にする。「みみカフェ」は実読済みの当該シリーズ名と同一originの指定パスに限り候補化する。一般読書会・一般教室をカフェと認定しない。めめ菓子工房のHTMLはブラウザの表示と異なり告知リンクが取れなかったため、機能するHTML入口としては追加していない。

候補探索は非公開リンクの収集であり、無料APIの送信承認ではない。初回の公式本文・共有適性・正確なhash確認は従来どおり必要。転載制限のある愛媛の本文は共有APIカタログに追加しない。定期企画はカフェ一覧で扱い、単発開催への二重登録や一般教室の自動掲載はしない。期限一覧は公開root外・0600に保存し、ユーザーには新規掲載・重要変更・実障害だけを通知する。
