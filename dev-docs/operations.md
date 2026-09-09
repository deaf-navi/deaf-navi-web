# 運用・障害対応（Deaf Navi Web）

## 定常運用（自動）

| ワークフロー | トリガ | 内容 |
|---|---|---|
| `curate.yml`（Curate & Build） | cron 1日3回（JST 6/12/18時ごろ）+ src変更のpush + 手動 | `generate`（国内: curate→build→verify）→ `build:app-api` → docs/ をcommit/push |
| `curate-world.yml` | cron 1日3回（JST 6/12/18時ごろ）+ World関連変更のpush + 手動 | Worldとアプリ同期JSONを再生成・commit |
| `app-sync.yml` | 手動のみ | アプリ同期JSONのみ再生成・commit |
| `ci.yml` | Pull Request | test / build / build:app-api / verify（読み取り権限のみ・ネットワーク不要） |
| `deploy-xserver.yml` | `docs/**` のmain push + 国内/World更新成功 + 手動 | 専用deployユーザーで `/srv/deafnavi/releases/` へ検証後に配置し、`current`を原子的に切替 |
| `deploy-github-pages-compat.yml` | `docs/**` 等のmain push + 国内/World更新成功 + 手動 | 旧PagesのHTMLを独自ドメインへ転送し、JSON/RSS等は実ファイルのまま公開 |

- 国内とWorldは別のconcurrency groupで実行し、Worldの翻訳障害が国内更新を止めない。
- push競合時は自分の取得データだけを退避し、最新main上で再ビルドして最大3回試す。相手のデータを古いスナップショットで上書きしない。

## 障害時の見分け方

1. **リポジトリのIssue** を見る。失敗は固定タイトルのIssueに集約される
   - `Curation workflow needs attention` — 国内更新の失敗
   - `App sync build needs attention` — アプリJSON生成の失敗
   - World系はラベル `curation-failure` 付き
2. Issue内のRunリンク → ログの `Source health` / `verify` 出力を確認

## よくある障害と対応

| 症状 | 原因の当たり | 対応 |
|---|---|---|
| 特定ソースだけ0件が続く | フィード停止・URL変更 | `config/sources.domestic.mjs` を修正 or 削除。当面は他ソース＋45日フォールバックで自動継続 |
| verify失敗で公開停止 | データ品質の悪化（重複・日付・スキーマ） | ログの ✗ 行を確認。ルール側が過剰なら `scripts/verify-site.mjs` を調整 |
| World-JPの日本語が機械翻訳のまま | VPSの Codex App Server 停止 | 日本語検証済み記事は公開する。保留Issueと `/ready` を確認し、CLI・モデル・認証・利用上限の原因を切り分ける |
| World更新が失敗 | Google News側の一時失敗 | 48時間以内なら前回スナップショットが維持される。手動で `curate-world.yml` を再実行 |
| 独自ドメインへ反映されない | `Deploy XServer` のSSH・検証・切替失敗 | 失敗Runを確認。`current`は前リリースのままなので、原因修正後に再実行 |
| 旧Pages転送に反映されない | `Deploy GitHub Pages compatibility site` の失敗 | JSONの旧URL配信を確認し、Actionsタブから再実行 |
| 全フィード取得失敗 | ネットワーク/Google News障害 | 前回の公開物は残る。時間を置いて `curate.yml` を手動実行 |

## World翻訳の再試行

- 新規・未後編集記事は既存ChatGPT認証のCodexで日本語化する。失敗したフィールドのみGoogle翻訳へ回す。
- 429・認証・サービス障害ではGoogleへの追加呼び出しを止め、成功済みの訳を再利用する。Codexも1回の実行予算と連続失敗上限を持つ。
- 未訳記事は `.state/world-translation.json` に部分訳・試行回数と共に保存する。このファイルはWeb公開されない。次回のWorld更新で再試行し、選定対象から外れた保留記事は14日で期限切れ、最大600件とする。
- 公開候補は全記事の日本語を検証する。欠けた分は前回の翻訳済み記事で補う。原題・原文はWorld-Original用に保持する。
- 保留があるとActionsに警告と `World translations are pending` Issueを出す。保留数の変化で更新し、解消時に自動クローズする。ジョブ自体の失敗は既存の障害Issueで扱う。
- `/health` は認証付きの生存確認、`/ready` は実際にCodexを呼ぶ確認。モデル変更時は `/ready` とWorldの実更新を検証する。モデル非対応や利用上限は再起動だけでは直らない。
- 2026-09-09の復旧構成はDeaf Navi専用CLI 0.153.4と `gpt-5.6-sol`。アカウント側のモデル提供状況は変わるため、利用可能なモデルを確認して明示指定する。APIキーへの自動切替は行わない。

## 緊急で更新を止めたい場合

- Actionsタブ → 対象ワークフロー → `…` → **Disable workflow**（サイトは最終状態のまま残る）

## デプロイ後の確認（リリース時）

1. https://deafnavi.com/ — 最終更新時刻が新しいこと
2. 検索・カテゴリ・期間・地域フィルタの動作
3. DevTools → Application → Service Workers — `sw.js` が activated（PWA。HTTPSでのみ動作）
4. https://deafnavi.com/app/v1/manifest.json — `generatedAt` 更新
5. https://deaf-navi.github.io/deaf-navi-web/ — パス・クエリ・ハッシュを保って独自ドメインへ転送されること
6. https://deaf-navi.github.io/deaf-navi-web/app/v1/manifest.json — 旧URLでJSONを取得できること
7. https://tamas-hub.github.io/deaf-navi-web/app/v1/manifest.json — さらに旧いURLでもJSONを取得できること
8. iOSアプリでニュースが表示されること（互換確認の最終防衛線）

## XServerロールバック

- 公開先は `/srv/deafnavi/current` のシンボリックリンクで、実体は `/srv/deafnavi/releases/<release-id>`
- 直前の正常リリースを確認し、同一ファイルシステム内で `current` をその絶対パスへ原子的に差し替える
- Caddy設定は `/etc/caddy/deafnavi.caddy`。変更前バックアップを戻し、`caddy validate` 成功後にCaddyをreloadする
- 旧GitHub Pagesは最低2027年9月5日まで維持し、iOSの旧URL利用がなくなったことを確認するまでJSONを削除・転送しない

## 秘密情報

- リポジトリ Secrets: `CODEX_APP_SERVER_URL` / `CODEX_APP_SERVER_TOKEN`（World-JP後編集用・任意）、`DEAFNAVI_DEPLOY_KEY` / `DEAFNAVI_DEPLOY_KNOWN_HOSTS`（XServerデプロイ用）
- リポジトリ Variables: `DEAFNAVI_DEPLOY_HOST` / `DEAFNAVI_DEPLOY_USER`
- リポジトリに秘密情報はコミットしない。Cloudflare Web AnalyticsのBeacon Tokenは公開HTMLに含まれるサイト識別子で、`config/site.mjs` の `ANALYTICS` で一元管理する（詳細はREADMEの「Analytics」）

## 定期メンテナンス（月1目安）

- Issueの棚卸し（集約Issueのクローズ）
- `Source health` で失敗が続くソースの見直し（`config/sources.domestic.mjs`）
- 追加したいキーワード・地域・カテゴリの検討（rin エージェントの知見を活用）
