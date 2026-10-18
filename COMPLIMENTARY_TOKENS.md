# Deaf Navi 公開テキストの無料API運用

ユーザーが2026-10-18に shared-free-tier の利用とDeaf Navi専用キーの発行を許可。既存のデータ共有設定・請求設定・他アプリのキーは変更しない。国内ニュースのRSS収集、登録済み情報源の照合・復旧にAIは不要。APIはWorldの不足翻訳と、確認済みイベント・カフェの短い説明文の補助に限定する。ブラウザー調査・証拠確認・掲載判断は引き続きこのチャットで行う。

## 適格性と上限

- 公式条件: https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai
- 2026-10-18にアカウントの登録済み表示、Launch tier、shared-free-tierだけの入出力共有、正の残高を確認。このモデル群の無料枠は組織全体で入力・出力合計100万トークン/UTC日。将来も同じとは扱わない。
- 現行モデルは `gpt-6.1-sol`、`reasoning.effort=low`、Responses APIのStandard処理。Worldの不足翻訳と確認済みイベント・カフェの短文整理に使用する。旧 `gpt-5.6-sol` の暗黙の推論設定を置き換え、短い文章に過剰な推論を使わない。軽量Lunaも対象だが、現在の少量処理では翻訳の固有名詞・条件保持を優先してSolに統一する。Astra・Fast・Ultrafastや自動モデル振分けは使用しない。
- モデル・推論設定の定義元は `scripts/complimentary-text-client.mjs` の `COMPLIMENTARY_MODEL` / `COMPLIMENTARY_REASONING_EFFORT`。日次記録とhealth表示も同じ定義を参照する。モデル変更前のallowanceは一致検査で拒否し、新モデルの対象可否・残量を実確認してから記録し直す。モデルを変えても当日の使用台帳・予約量は保持する。
- モデル仕様: https://developers.openai.com/api/docs/models/gpt-6.1-sol 。最新モデルという理由だけで無料対象とは扱わず、上記の無料枠条件とアカウント表示を照合する。
- 日付の境界は00:00 UTC（09:00 JST）。毎日、当日の対象・残量・他の利用を確認した記録が必要。前日や過去7日間だけの確認では当日の許可を更新しない。
- 初期のDeaf Navi上限は保守的な予約量で10万トークン/日、12リクエスト/日、残量の10%以下。送信前に入力UTF-8バイト数＋出力上限＋余裕を確保する。実使用が少なくても予約を払い戻さない。
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

09:00以降の統合日次キュレーションで、OpenAI画面のプロジェクト・共有対象・適格表示・当日の利用・残高を確認する。確認不能なら期限を更新しない。端末が動かない日はAPIも期限で止まる。より早い時刻のWorldはGoogle・キャッシュを利用し、不足翻訳は保留する。

`scripts/record-complimentary-allowance.mjs` は標準入力の確認結果を記録する補助。アカウントの検証を自動で代行するものではない。秘密はファイルから読み、標準出力には日付・期限・上限・許可文数だけを出す。

- `mode=daily-account-check`: `model`（現行定義と一致し、無料対象を実確認したもの）、`checkedAt`（30分以内・当日）、`keyProjectVerified=true`、`otherUsageReviewed=true`、`enrolled=true`、`sharingEnabled=true`、`balancePositive=true`、`groupDailyLimit`、`observedGroupTokens`、`dailyBudget`、`publicDataReviewed=true`、`reviewedPublicItems` を実確認後に渡す。
- `mode=approve-text`: 同じ日の有効な許可に、`publicDataReviewed=true` と `reviewedPublicItems` のhashだけを追加する。期限・残量・利用記録は更新しない。
- `reviewedPublicItems` の各項目は `id/title/summary` または `id/original_title/original_summary`。共有する文面を変更したら再確認する。
- `scripts/review-public-text.mjs` は `publicDataReviewed=true`、`items`、`purpose=world_translation|public_event_summary|public_cafe_summary` を標準入力から受ける。返答は下書きであり、情報源確認・掲載承認・日時更新を実行しない。

APIに検索ツールやファイルは渡さない。公式本文・画像・PDFの閲覧は既存の調査方法を使う。画像や長文の転載、日程・会場の推測、48時間期限の見せかけの延長は禁止のまま。

## 使用記録・障害・復旧

`usage-YYYY-MM-DD.json` に日時、プロジェクト、モデル、目的、件数、予約量、実入力/出力tokens、推定費用、課金実測（未確認はnull）、結果を保存する。本文・キーは残さない。

`request.lock` は多重実行を防止する。`inflight.json` は送信前に作成し、処理結果・使用量が確認できた場合だけ除く。通信断・5xx・使用量不明は、翌日になっても自動再送しない。これらの記録が残る場合はOpenAIのリクエスト/使用状況と照合してから、専用バックアップを取り、対象記録だけを復旧する。確認なしに削除しない。

`/health` は認証付きの非生成確認。60分ごとの監視にはこれだけを使う。`/ready` は生成を伴い、当日の文面承認が必要。サービス到達成功を無料枠利用成功と混同しない。

初回は確認済みの短い公開文1件で実行し、プロジェクトと実使用tokens、Usage画面のdata sharing incentive tierを確認する。通常課金や対象外が判明したらAPIを止める。切替前のサービス・環境設定をバックアップし、必要なら当該サービスだけを戻す。PM2全体や他アプリの設定は復元しない。
