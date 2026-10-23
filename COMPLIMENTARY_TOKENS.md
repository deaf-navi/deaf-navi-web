# Deaf Navi 公開テキストの無料API運用

2026-10-24：ユーザー許可により宿泊案内の公式HTML抽出・比較と候補選別を追加。同じcuration_review用途・専用キー・既存予算と停止条件を使用する。運営者個人の障害・健康体験・連絡先は送らず、共有確認済みの短い宿泊条件だけを扱う。詳細はSERVER_CURATION.md。

2026-10-21：サーバー主導の比較・Worldの朝処理は `SERVER_CURATION.md` を参照。当日アカウント確認は自動更新しない。既存プロジェクトキーによるOrganization Usage APIは実測403であり、管理権限を追加していない。手動確認済みの同一文面は、再取得した公式本文hash・URL・題名・抜粋の全一致を条件に元の共有確認日時を保持して再利用する。新規文面の共有承認・当日の適格性や残量の推測・許可期限延長は行わない。

ユーザーが2026-10-18に shared-free-tier の利用とDeaf Navi専用キーの発行を許可。同日の追加許可で、国内ニュースの補助選別、イベント・カフェの事実抽出と既存情報の比較にも対応する。既存のデータ共有設定・請求設定・他アプリのキーは変更しない。RSS収集・情報源照合・復旧は非AIのまま。APIは証拠付き下書きを作り、差異・不足・画像/PDF等の例外をこのチャットで確認する。具体的手順は `API_CURATION.md`。

## 適格性と上限

- 公式条件: https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai
- 2026-10-18にアカウントの登録済み表示、Launch tier、shared-free-tierだけの入出力共有、正の残高を確認。このモデル群の無料枠は組織全体で入力・出力合計100万トークン/UTC日。将来も同じとは扱わない。
- 通常モデルは `gpt-6.1-sol`、`reasoning.effort=low`、Responses APIのStandard処理。高性能群100万tokens/日の無料残量で次の予約量を安全に収められない場合だけ、別の軽量群1,000万tokens/日の `gpt-5.6-terra` / lowへ切り替える。両群の当日適格性・組織全体の消費・実利用可否を確認した `groups` が必要。Astra・Fast・Ultrafast・有料検索ツールは使わない。HTTPエラーは切替条件にしない。
- モデル・推論設定の定義元は `scripts/complimentary-text-client.mjs` の `COMPLIMENTARY_MODEL` / `COMPLIMENTARY_REASONING_EFFORT`。日次記録とhealth表示も同じ定義を参照する。モデル変更前のallowanceは一致検査で拒否し、新モデルの対象可否・残量を実確認してから記録し直す。モデルを変えても当日の使用台帳・予約量は保持する。
- モデル仕様: https://developers.openai.com/api/docs/models/gpt-6.1-sol 。最新モデルという理由だけで無料対象・利用可能とは扱わず、上記の無料枠条件とアカウント表示、実APIを照合する。
- 2026-10-18に `gpt-6.1-sol` の無料対象を確認し、shared-free-tierのモデル許可リストへ同モデルのみ追加した（既存5.6系3モデル・支出上限は保持）。保存後も実APIが403 `model_not_found` / project does not have accessを返したため、本番移行は保留して5.6 Solへ明示的に戻した。APIキーの権限は変更していない。設定伝播以外の原因はUNKNOWN。6.1へ再移行する場合も実応答と無料枠区分を確認してから定義・日次記録を揃える。失敗したリクエストの予約量は払い戻さない。
- 同日08:49 UTC、ユーザー許可で要求回数を見直して同じキー・プロジェクトで再試験し、`gpt-6.1-sol` のHTTP 200・completed・日本語の構造化応答を確認した（入力210＋出力73＝283トークン）。追加のキー権限・共有設定変更は行っていない。以前の403が解消した内部原因はUNKNOWN。本番反映はこの要求の無料枠区分をUsage画面で照合してから行う。
- 日付の境界は00:00 UTC（09:00 JST）。毎日、当日の対象・残量・他の利用を確認した記録が必要。前日や過去7日間だけの確認では当日の許可を更新しない。
- Deaf Naviの上限は「確定実使用＋未精算の予約」で10万トークン/日、16リクエスト/日、確認済み残量の10%以下。要求回数は `COMPLIMENTARY_REQUEST_LIMIT` を実行・状態表示で共有する。2026-10-18に組織全体の当日実使用3,952トークン、対象枠100万、他プロジェクトの同日使用なしを確認し、ユーザー許可で12回から16回へ変更した。当日のトークン予算99,000、既存要求回数・保留予約は維持する。送信前に入力UTF-8バイト数＋出力上限＋余裕を確保し、APIが返した入力・出力tokensが妥当で予約内と確認できた場合だけ実使用へ精算する。推論tokensはoutput_tokensに含まれるため二重加算しない。元の予約量・履歴は削除せず、既存version 1台帳も同じ計算で読む。
- 拒否された要求の使用量が不明な場合は予約を保持し、通信断・5xx・使用量不明は再送を停止する。成功した要求の余剰分だけを解放し、失敗分をゼロと推測しない。通常処理の16回上限には失敗も含む。ユーザーの同日追加指定により、明示的な調査・再試験は `--research` で別集計し、回数上限を設けない。10万tokens以下の当日ローカル予算・確認済み無料枠・同じ台帳を共有し、回数以外の制限は外さない。HTTPサービスや定時処理は通常モード固定。
- 無料枠をまたぐリクエストは全体が通常課金になり得る。ローカル上限はOpenAI側の強制無料設定ではない。他クライアントの消費も調べ、不明なら使用しない。料金画面の反映待ちは0円確定と書かない。
- 残量・対象・キー所属・当日の確認が不明、期限切れ、上限超過、結果不明なら送信しない。自動で有料APIやCodexへ切り替えない。Google翻訳・キャッシュ・翻訳保留の仕組みは継続する。

## 私有ファイルと公開データの境界

専用サービスは `/srv/deaf-navi-codex-app-server/`、環境設定は既存の `/etc/deaf-navi-codex-app-server.env`。秘密・利用記録は公開root外の `/srv/deafnavi/shared/ai/`（0700）、ファイルは0600。Git・静的公開物・プロンプト・画面キャプチャにキーを含めない。

```text
DEAFNAVI_TEXT_BACKEND=complimentary
DEAFNAVI_OPENAI_KEY_FILE=/srv/deafnavi/shared/ai/shared-free-tier.key
DEAFNAVI_OPENAI_PROJECT_ID=<確認済みプロジェクトID>
DEAFNAVI_AI_STATE_DIR=/srv/deafnavi/shared/ai
```

既定値は従来の `codex`。APIを有効にするには上記の明示設定と当日の `allowance.json` の両方が必要。`provider=codex_app_server` は既存HTTP契約の識別子で、実際の実行先は `engine=openai_complimentary` と私有使用記録で区別する。

一般公開されたニュースにも個人情報・第三者の健康情報は含まれる。公開済みだから共有可能とは扱わない。送るタイトルと短い要約を実際に確認し、個人・患者・連絡先・秘密・契約上の制限を含まないものだけ `approvedTextHashes` に記録する。正確な文面のhashが当日の許可と一致しなければ送信しない。医療・健康分類や明らかな秘密等は追加の拒否条件であり、正規表現だけで安全判定を完了したとは扱わない。

## 毎日の確認と使用

09:00以降の統合日次キュレーションで、OpenAI画面のプロジェクト・共有対象・適格表示・当日の利用・残高を確認する。確認不能なら期限を更新しない。端末が動かない日はAPIも期限で止まる。より早い時刻のWorldで保留された未訳は、朝の共有確認後に同じ日次作業内で処理・公開・無料計上の照合まで進め、12:10の定期実行待ちにしない。Google翻訳を制限する指定はなく、利用可能なGoogle翻訳・保存済み訳を使い、不足する承認済み文面を無料APIで補完する。外部のHTTP 429等と利用者の制限指定は区別する。

`scripts/record-complimentary-allowance.mjs` は標準入力の確認結果を記録する補助。アカウントの検証を自動で代行するものではない。秘密はファイルから読み、標準出力には日付・期限・上限・許可文数だけを出す。

- `mode=daily-account-check`: `model`（現行定義と一致し、無料対象を実確認したもの）、`checkedAt`（30分以内・当日）、`keyProjectVerified=true`、`otherUsageReviewed=true`、`enrolled=true`、`sharingEnabled=true`、`balancePositive=true`、`groupDailyLimit`、`observedGroupTokens`、`dailyBudget`、`publicDataReviewed=true`、`reviewedPublicItems` を実確認後に渡す。
- `mode=approve-text`: 同じ日の有効な許可に、`publicDataReviewed=true` と `reviewedPublicItems` のhashだけを追加する。期限・残量・利用記録は更新しない。
- 二群対応の `daily-account-check` は `groups.high/light` に `model/eligible/modelAccessVerified/groupDailyLimit/observedGroupTokens` を実測で渡す。highはトップレベルの枠・使用量と一致させる。初回の軽量モデル試験だけ `modelAccessVerified=false` のまま `--research` と `modelOverride=gpt-5.6-terra` を指定できる。本番自動切替は実応答と無料区分確認後のtrueのみ。群の残量は確認値の10%から確認後の自アプリ利用・保留予約を引いて評価し、総予算・回数・結果不明ロックはモデル変更でも共通。
- `reviewedPublicItems` の各項目は `id/title/summary` または `id/original_title/original_summary`。共有する文面を変更したら再確認する。
- `scripts/review-public-text.mjs` は `publicDataReviewed=true`、`items`、`purpose=world_translation|public_event_summary|public_cafe_summary|curation_review` を標準入力から受ける。比較には `scripts/curation-review.mjs` を使う。返答は下書きであり、掲載承認・確認期限更新を実行しない。

APIに検索ツールやファイルは渡さない。公式本文・画像・PDFの閲覧は既存の調査方法を使う。画像や長文の転載、日程・会場の推測、48時間期限の見せかけの延長は禁止のまま。

## 使用記録・障害・復旧

`usage-YYYY-MM-DD.json` に日時、プロジェクト、モデル、目的、件数、予約量、実入力/出力tokens、推定費用、課金実測（未確認はnull）、結果を保存する。本文・キーは残さない。

API拒否時も安全な形式のrequest ID・error code/typeだけを保存し、問い合わせ時に照合できるようにする。応答本文・エラーメッセージは入力やアカウント情報を含み得るため保存しない。通常の利用量計算や結果不明時の停止条件は変えない。

`scripts/complimentary-usage.mjs` は非生成・読取専用の状態確認。`actualTokens`（確定実使用）、`heldTokens`（未精算予約）、`accountedTokens`（上限判定に使用）、`historicalReservedTokens`（履歴上の仮予約合計）を分けて返す。`remainingLocalBudget` はDeaf Navi独自上限の残りであり、OpenAI組織全体の無料枠残量ではない。秘密やプロンプトは出力しない。端末からは既存の非公開環境設定を読み込んだ上で実行する。

Worldの既存 `WORLD_JP_CODEX_*` 変数・`codex_app_server` provider・キャッシュ識別子は互換性のため残す。実生成時は応答の `engine=openai_complimentary` と `model` をログへ記録し、新しい翻訳記事には `japanesePostEditEngine` / `japanesePostEditModel` として保持する。旧キャッシュの実行先は推測せずunknownのまま。Google/キャッシュで解決した回は無料APIも呼ばない。

`request.lock` は多重実行を防止する。`inflight.json` は送信前に作成し、処理結果・使用量が確認できた場合だけ除く。通信断・5xx・使用量不明は、翌日になっても自動再送しない。これらの記録が残る場合はOpenAIのリクエスト/使用状況と照合してから、専用バックアップを取り、対象記録だけを復旧する。確認なしに削除しない。

`/health` は認証付きの非生成確認。60分ごとの監視にはこれだけを使う。`/ready` は生成を伴い、当日の文面承認が必要。サービス到達成功を無料枠利用成功と混同しない。

初回は確認済みの短い公開文1件で実行し、プロジェクトと実使用tokens、Usage画面のdata sharing incentive tierを確認する。通常課金や対象外が判明したらAPIを止める。切替前のサービス・環境設定をバックアップし、必要なら当該サービスだけを戻す。PM2全体や他アプリの設定は復元しない。
