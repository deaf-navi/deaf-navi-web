# 運用・障害対応（Deaf Navi Web）

## 定常運用（自動）

| ワークフロー | トリガ | 内容 |
|---|---|---|
| `curate.yml`（Curate & Build） | cron 1日3回（JST 6/12/18時ごろ）+ src変更のpush + 手動 | `generate`（国内: curate→build→verify）→ `generate:world` → `build:app-api` → docs/ をcommit/push |
| `curate-world.yml` | 手動のみ | World版のみ再生成・commit |
| `app-sync.yml` | 手動のみ | アプリ同期JSONのみ再生成・commit |
| `ci.yml` | Pull Request | test / build / build:app-api / verify（読み取り権限のみ・ネットワーク不要） |

- push系3ワークフローは concurrency group `deaf-navi-publisher` を共有し、mainへのpushを直列化
- push失敗時は rebase して最大3回リトライ

## 障害時の見分け方

1. **リポジトリのIssue** を見る。失敗は固定タイトルのIssueに集約される
   - `Curation workflow needs attention` — 国内/一括更新の失敗
   - `App sync build needs attention` — アプリJSON生成の失敗
   - World系はラベル `curation-failure` 付き
2. Issue内のRunリンク → ログの `Source health` / `verify` 出力を確認

## よくある障害と対応

| 症状 | 原因の当たり | 対応 |
|---|---|---|
| 特定ソースだけ0件が続く | フィード停止・URL変更 | `config/sources.domestic.mjs` を修正 or 削除。当面は他ソース＋45日フォールバックで自動継続 |
| verify失敗で公開停止 | データ品質の悪化（重複・日付・スキーマ） | ログの ✗ 行を確認。ルール側が過剰なら `scripts/verify-site.mjs` を調整 |
| World-JPの日本語が機械翻訳のまま | VPSの Codex App Server 停止 | カバレッジ85%以上あれば公開は継続する。VPS側で `deaf-navi-codex-healthcheck.sh` を確認し pm2 再起動 |
| World更新が失敗 | Google News側の一時失敗 | 48時間以内なら前回スナップショットが維持される。手動で `curate-world.yml` を再実行 |
| Pagesに反映されない | pages-build-deployment の一時失敗 | 多くは自己回復。Actionsタブから再実行 |
| 全フィード取得失敗 | ネットワーク/Google News障害 | 前回の公開物は残る。時間を置いて `curate.yml` を手動実行 |

## 緊急で更新を止めたい場合

- Actionsタブ → 対象ワークフロー → `…` → **Disable workflow**（サイトは最終状態のまま残る）

## デプロイ後の確認（リリース時）

1. https://tamas-hub.github.io/deaf-navi-web/ — 最終更新時刻が新しいこと
2. 検索・カテゴリ・期間・地域フィルタの動作
3. DevTools → Application → Service Workers — `sw.js` が activated（PWA。HTTPSでのみ動作）
4. https://tamas-hub.github.io/deaf-navi-web/app/v1/manifest.json — `generatedAt` 更新
5. iOSアプリでニュースが表示されること（互換確認の最終防衛線）

## 秘密情報

- リポジトリ Secrets: `CODEX_APP_SERVER_URL` / `CODEX_APP_SERVER_TOKEN`（World-JP後編集用・任意）
- リポジトリに秘密情報はコミットしない。Cloudflare Analytics トークンは公開前提の値（cookieless beacon）

## 定期メンテナンス（月1目安）

- Issueの棚卸し（集約Issueのクローズ）
- `Source health` で失敗が続くソースの見直し（`config/sources.domestic.mjs`）
- 追加したいキーワード・地域・カテゴリの検討（rin エージェントの知見を活用）
