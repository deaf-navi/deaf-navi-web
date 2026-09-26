# 定時キュレーションの運用

## 保護対象と停止境界

`DEAF_NAVI_PROTECTED_SERVICE` は運用上の区分。以下は不要なCodexアプリの一括停止対象に含めない。

- `deaf-navi/deaf-navi-web` の `Curate & Build` / `Curate & Build World`
- 既存の `Deploy XServer` / GitHub Pages互換公開
- Deaf Naviの公開サービスと非AIの保守・バックアップ

専用 `deaf-navi-codex-app-server` と `deaf-navi-codex-healthcheck.timer` は任意の追加校正用。Actionsとは独立し、停止していても基本更新を続ける。他アプリの停止状態を戻さない。古いPM2 dumpを丸ごと復元しない。

定時更新自体の停止は、Deaf Naviを名指ししたユーザー指示を受けた場合だけ、対象Workflowへ `gh workflow disable curate.yml --repo deaf-navi/deaf-navi-web` または `curate-world.yml` を明示的に実行する。停止理由・対象・再開条件を記録する。サーバー停止に連動してWorkflowを無効化する処理は設けない。

## 実行時刻・費用・翻訳

両WorkflowのcronはUTCの `10 3,9,21 * * *`、JST **06:10 / 12:10 / 18:10**。`timezone:` は使用しない。GitHubのscheduleは混雑時に遅延・欠落することがあり、開始時刻の保証はない。未起動と実行後の失敗はActions履歴で区別する。

国内はRSS/記事取得、分類、静的ビルド、app APIをGitHub Actions内で生成する。Codex・ChatGPT Work・有料AI APIは不要。

Worldは既存の `translate.googleapis.com/translate_a/single?client=gtx` による翻訳とDeaf Navi用語補正、翻訳キャッシュを先に使う。2026-09-27の実ActionsではGoogleが429となり、新着33件が未翻訳のまま保留された。そのため、ユーザー指定の例外として、訳せない記事だけ専用Codexで補完する（既定は1回最大50件）。日本語になっているキャッシュ・Google翻訳済み記事は自動で再校正しない。Googleが成功した回はCodexを呼ばない。

有料翻訳APIのキー・契約・請求先は新設しない。429/5xx等は回数制限とcircuit breakerで打ち切る。Codexも利用不能なら、未翻訳記事を `.state/world-translation.json` に保留し、前回の検証済み記事を維持して公開を続け、次回再試行する。Codexなしで公開は継続できるが、Googleも使えない間のWorld新着翻訳は保証できない。

通常のschedule/push/手動実行は `WORLD_JP_CODEX_FALLBACK_ONLY=1`。全体への追加校正は手動の `use_codex_post_edit=true` だけ。Codex失敗・低カバレッジは公開の致命的エラーにしない。ローカルでCodexを使う場合も `WORLD_JP_CODEX_POST_EDIT=1` を明示する。

WorldでCodex補完が実行された場合は利用枠を消費する。完全に止める場合は、ユーザー指示を受けてリポジトリ変数 `WORLD_JP_CODEX_FALLBACK=0` を明示設定する。未翻訳新着が保留される可能性を記録する。Workflow自体や国内更新は止めない。

専用サーバーの `/health` は認証確認だけで生成しない。`/ready` とsmoke testは生成するため定期監視には使わない。本番タイマーは非生成の `/health` を使用する。GitHub Actionsと既存VPSは基盤として継続使用するため、基盤の契約・利用時間とAI課金は区別する。

## 今すぐ再実行

1. `gh workflow list --repo deaf-navi/deaf-navi-web --all` で両Workflowがactiveか確認。進行中の同じ処理がないか確認。
2. `gh workflow run curate-world.yml --repo deaf-navi/deaf-navi-web --ref main`。完了ログで取得・翻訳・Codex使用有無・fallback・generate:world・build:app-api・commit/pushを確認。
3. `gh workflow run curate.yml --repo deaf-navi/deaf-navi-web --ref main`。generate・build:app-api・commit/pushを確認。
4. キュレーション成功の `workflow_run` から既存のDeploy XServerが自動起動する。手動deployを重ねず、起動した各runと最終releaseを確認する。
5. 国内/Worldの記事JSON、app API、feed、sitemap、実ブラウザーの更新時刻・表示を確認。検証アクセスには `dn_client=codex` または指定User-Agentを付ける。

同時刻の国内・Worldはそれぞれ独立したconcurrency groupで実行する。push競合時は既存の「取得済みデータを退避→最新mainで再ビルド」の処理を使い、再取得・再翻訳はしない。deployは共通groupで直列化する。

## 失敗通知

両Workflowの `notify-on-failure` は `issues: write` で `scripts/notify-curation.cjs` を実行する。同名の未解決Issueにはコメントを追記し、重複作成を防ぐ。Worldの翻訳保留通知も維持する。

`gh workflow run test-curation-notifications.yml --repo deaf-navi/deaf-navi-web --ref main` で同じ通知コードを実際のGITHUB_TOKEN権限でテストできる。国内・Worldの `[通知テスト]` Issueを確認後にcloseする。この専用Workflowは取得・生成・公開やデプロイを起動しない。

scheduled run自体が起動しない場合、失敗ジョブも起動しないためIssue通知の対象外。GitHubの未起動を失敗通知で検知できると解釈しない。

## 復旧とロールバック

ソース差分はGit履歴で保持。デプロイは `/srv/deafnavi/releases/` に新releaseを作成し、検証後に `current` を原子的に切り替える。直前のreleaseは保持する。障害時はその実在パスと現状を確認し、対象サイトだけを戻す。公開DB・アップロード・他サービスを変更しない。

2026-09-27調査時、両Workflowはactive、専用PM2はonline、healthcheckはactive/enabledかつsuccessだった。昨日20:23 JSTに専用サービスは復旧済みで、その後22時台のWorld・国内・XServer実行も成功。今朝06:00分は07:29時点でrunが未作成。GitHub側の遅延/未配信と整合するが、GitHub内部の具体的原因はUNKNOWN。
