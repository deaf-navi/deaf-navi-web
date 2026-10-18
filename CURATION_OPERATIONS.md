# 定時キュレーションの運用

## 保護対象と停止境界

`DEAF_NAVI_PROTECTED_SERVICE` は運用上の区分。以下は不要なCodexアプリの一括停止対象に含めない。

- `deaf-navi/deaf-navi-web` の `Curate & Build` / `Curate & Build World`
- 既存の `Deploy XServer` / GitHub Pages互換公開
- Deaf Naviの公開サービスと非AIの保守・バックアップ

専用 `deaf-navi-codex-app-server` と `deaf-navi-codex-healthcheck.timer` は不足翻訳・確認済み短文を処理する専用テキストサービス。2026-10-18から本番の実行先はshared-free-tierの無料API。Actionsとは独立し、停止していても基本更新を続ける。他アプリの停止状態を戻さない。古いPM2 dumpを丸ごと復元しない。

定時更新自体の停止は、Deaf Naviを名指ししたユーザー指示を受けた場合だけ、対象Workflowへ `gh workflow disable curate.yml --repo deaf-navi/deaf-navi-web` または `curate-world.yml` を明示的に実行する。停止理由・対象・再開条件を記録する。サーバー停止に連動してWorkflowを無効化する処理は設けない。

## 実行時刻・費用・翻訳

### 更新と復旧の時刻（2026-10-18整理）

| 処理 | 日本時間の予定 | 実行場所 |
| --- | --- | --- |
| 国内ニュース・World・登録済み国内イベントの照合 | 06:10 / 12:10 / 18:10 | GitHub Actions |
| カフェの登録済み情報源の巡回 | 06:40 | VPS |
| 国内イベント・カフェの追加復旧 | 08:40 / 14:40 / 20:40 | 国内イベントはActions、カフェはVPS |
| 新しいイベント・カフェの調査 | 09:00ごろ、1日1回 | このチャットのCodex heartbeat |
| 翻訳サービスの非生成ヘルスチェック | 60分ごと | VPS |

追加復旧は両対象とも48回/日から3回/日へ削減。URLごとの再試行期限が来ている通信失敗だけを処理し、対象なしなら取得・生成・公開をしない。内部の再試行間隔は最短の待機時間であり、実際の再取得は次の実行枠になる。通常照合、48時間失効、内容変更・アクセス拒否・目視確認を自動承認しない規則は維持する。

開始時刻は予定で、処理完了・公開時刻ではない。GitHubのscheduleは遅れることがある。実行履歴の開始/完了と公開データのgeneratedAtを区別する。サーバーの巡回・復旧は端末に依存せず、新規調査はCodex実行端末に依存する。

両WorkflowのcronはUTCの `10 3,9,21 * * *`、JST **06:10 / 12:10 / 18:10**。`timezone:` は使用しない。GitHubのscheduleは混雑時に遅延・欠落することがあり、開始時刻の保証はない。未起動と実行後の失敗はActions履歴で区別する。

国内はRSS/記事取得、分類、静的ビルド、app APIをGitHub Actions内で生成する。Codex・ChatGPT Work・有料AI APIは不要。

Worldは既存の `translate.googleapis.com/translate_a/single?client=gtx` による翻訳とDeaf Navi用語補正、翻訳キャッシュを先に使う。訳せない記事だけ、shared-free-tierの専用API（現在GPT-5.6 Sol・low）で補う。2026-09-27時点のCodex補完から移行済み。日本語になっているキャッシュ・Google翻訳済み記事は通常実行で再校正せず、Googleが成功した回は無料APIも呼ばない。

無料APIは当日の適格性・組織全体の残量・共有する実文面の確認を満たしたものだけ送る。上限判定は実使用と未精算予約を区別し、成功した要求の未使用分は解放する。結果不明なら止め、有料APIやCodexへ自動切替しない。未翻訳記事は `.state/world-translation.json` に保留し、前回の検証済み記事を維持して公開を続ける。詳しくは `COMPLIMENTARY_TOKENS.md`。

通常のschedule/push/手動実行は `WORLD_JP_CODEX_FALLBACK_ONLY=1`。変数名と `use_codex_post_edit` 入力は互換性のため残すが、実行先は専用サービスの設定で決まる。追加校正は手動の `use_codex_post_edit=true` のみで、無料APIに送れるのは当日確認済み文面だけ。旧キャッシュを無料API生成と書き換えず、新しい応答のengine/modelを記録する。

補完を完全に止める場合はユーザー指示でリポジトリ変数 `WORLD_JP_CODEX_FALLBACK=0` を設定する。Workflow自体や国内更新は止めない。未翻訳新着は保留になる可能性がある。

専用サーバーの `/health` は認証確認だけで生成しない。`/ready` とsmoke testは生成するため定期監視には使わない。本番タイマーは非生成の `/health` を使用する。GitHub Actionsと既存VPSは基盤として継続使用するため、基盤の契約・利用時間とAI課金は区別する。

## 今すぐ再実行

1. `gh workflow list --repo deaf-navi/deaf-navi-web --all` で両Workflowがactiveか確認。進行中の同じ処理がないか確認。
2. `gh workflow run curate-world.yml --repo deaf-navi/deaf-navi-web --ref main`。完了ログで取得・翻訳・Codex使用有無・fallback・generate:world・build:app-api・commit/pushを確認。
3. `gh workflow run curate.yml --repo deaf-navi/deaf-navi-web --ref main`。generate・build:app-api・commit/pushを確認。
4. キュレーション成功の `workflow_run` から既存のDeploy XServerが自動起動する。手動deployを重ねず、起動した各runと最終releaseを確認する。
5. 国内/Worldの記事JSON、app API、feed、sitemap、実ブラウザーの更新時刻・表示を確認。検証アクセスには `dn_client=codex` または指定User-Agentを付ける。

同時刻の国内・Worldはそれぞれ独立したconcurrency groupで実行する。push競合時は既存の「取得済みデータを退避→最新mainで再ビルド」の処理を使い、再取得・再翻訳はしない。deployは共通groupで直列化する。

## 失敗通知

2026-10-18の無料APIへの移行手順・境界は `COMPLIMENTARY_TOKENS.md` を参照。専用サービスは同じHTTP契約を保ち、明示設定で `codex` / `complimentary` を選ぶ。設定・当日確認・使用記録で実行先を判別し、サービス名だけからCodex利用枠の消費を判断しない。

両Workflowの `notify-on-failure` は `issues: write` で `scripts/notify-curation.cjs` を実行する。同名の未解決Issueにはコメントを追記し、重複作成を防ぐ。Worldの翻訳保留通知も維持する。

`gh workflow run test-curation-notifications.yml --repo deaf-navi/deaf-navi-web --ref main` で同じ通知コードを実際のGITHUB_TOKEN権限でテストできる。国内・Worldの `[通知テスト]` Issueを確認後にcloseする。この専用Workflowは取得・生成・公開やデプロイを起動しない。

scheduled run自体が起動しない場合、失敗ジョブも起動しないためIssue通知の対象外。GitHubの未起動を失敗通知で検知できると解釈しない。

## 復旧とロールバック

ソース差分はGit履歴で保持。デプロイは `/srv/deafnavi/releases/` に新releaseを作成し、検証後に `current` を原子的に切り替える。直前のreleaseは保持する。障害時はその実在パスと現状を確認し、対象サイトだけを戻す。公開DB・アップロード・他サービスを変更しない。

2026-09-27調査時、両Workflowはactive、専用PM2はonline、healthcheckはactive/enabledかつsuccessだった。昨日20:23 JSTに専用サービスは復旧済みで、その後22時台のWorld・国内・XServer実行も成功。今朝06:00分は07:29時点でrunが未作成。GitHub側の遅延/未配信と整合するが、GitHub内部の具体的原因はUNKNOWN。

## 手話カフェイベント

手話カフェイベントの毎日確認・次回追跡・年次棚卸は CAFE_EVENT_CURATION.md を参照。既存の国内・World更新の定時、翻訳経路、サービス停止状態は維持する。

## 掲載対象との関係（2026-10-18更新）

単語の一致だけで関係ありと判断しない。聴覚・ろう／難聴・盲ろうの生活や権利、手話、字幕・筆談などの情報保障、当事者の文化・交流・就労との具体的な関係を確認する。一般向けの製品や催しでも、実際の支援機能・利用条件が確認できるものは対象。タイトルに「聴覚障害」がないことだけでは除外しない。

- スペイン語の audífonos は補聴器とイヤホンの両方を指す。一般向けオーディオ・スポーツ・音声による外国語翻訳の宣伝は、聴覚支援の文脈がなければ除外する。Bluetoothだけでは除外しない。
- subtitles は情報保障以外にも使われる。政治動画の偽字幕・観光宣伝用の撮影地表示を、字幕アクセシビリティのニュースと混同しない。字幕技術・字幕上映・利用者の課題は維持する。
- 協会名が掲示協力先として出るだけの一般企画の宣伝は対象外。本文に具体的な関連がある場合は区別する。
- 「視覚部門」の見出しだけでは除外しない。実際の総合だよりには盲ろう者向け案内もある。明示的に視覚のみのサービスを扱うものに限定して判定する。
- 新着の選別と保存済みニュースの再ビルドに同じ基準を適用する。過去記事は明示的な対象外だけを除き、キーワード不足だけで一括削除しない。除外理由・IDは publicationReview に記録し、履歴はGitで保持する。

確認記録: `operations/relevance-review-20261018.md`。取りこぼし・誤収集を完全に防ぐ保証ではなく、新しい誤収集は元記事を確認して判定と回帰テストを追加する。
