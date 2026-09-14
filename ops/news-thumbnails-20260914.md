# ニュースの任意サムネイル

状態: 実装・ローカル確認済み。2026-09-14にユーザーから「本番反映OK」の承認を受領。既存のGitHub Actions経由で本番反映する。
作業元: `63040341af4ce7265e2837353608811679a02e6b`（2026-09-14）。

反映前確認: mainと本番のリリースが作業元と一致。2026-09-14 14:03 UTCに `/srv/deafnavi/backups/news-thumbnails-20260914T140312Z/` へ公開リリース全体を退避し、アーカイブの読取とSHA-256を確認。
旧リリース: `/srv/deafnavi/releases/63040341af4ce7265e2837353608811679a02e6b-34823186743-1`。DB・ログ・アップロードは変更しない。最終の公開・表示確認結果は作業タスクの `outputs/news-thumbnails-report.md` に記録する。

## 変更

- 国内、World-JP、World-Originalの記事カードに任意の `thumbnail: { url, source, pageUrl }` を追加。
- RSS/Atomの画像指定を候補として保持し、元記事のOGP/Twitter画像で補完。公開データにはHTTP確認済みの候補だけを出す。
- Googleニュース経由の記事は、公開ページのナビゲーション情報から元記事を照合して取得。Google自身のOGP、明らかなロゴ・共通画像は除外する。
- 画像の再保存は行わず、HTTPSの配信元画像を `loading="lazy"` / `referrerpolicy="no-referrer"` で表示。PC 112×84、幅480px以下 80×60。読込失敗時は画像要素を除去し、記事本文とリンクを残す。
- 画像の下では本文を全幅で表示。見出し、要約、記事URL、順番、選定・翻訳処理は保持。
- 既存の国内・海外キュレーション処理に組み込み。上限は版ごとに60記事・90秒、Googleへの要求間隔は1.1秒。未確認の記事を先に処理する。
- `.state/thumbnails-domestic.json` / `.state/thumbnails-world.json` に状態を保持。成功30日、画像なし7日、通信失敗1日後に再試行。失敗時は最後に確認済みの画像を保持する。
- 401/403/429の配信元はその実行中の追加取得を停止。タイムアウト、本文サイズ上限、リダイレクト上限、接続に使うDNS回答の検証で内部アドレスへのアクセスを防ぐ。
- WorldのCSS/JSにも内容ハッシュを付け、更新後の旧スタイル混在を防ぐ。

Googleのナビゲーション取得は正式に保証されたAPIではない。応答仕様が変わった場合は画像なしとして扱い、記事更新は継続する。応答形式の参考: [google-news-url-decoder](https://github.com/SSujitX/google-news-url-decoder/blob/main/googlenewsdecoder/new_decoderv1.py)。新規パッケージ、認証情報、有料API、プロキシは使用しない。

## 検証結果

| 版 | 記事総数 | 取得を試した記事 | 画像採用 | 画像なし・除外 | 通信等の失敗 | 未試行 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 日本 | 472 | 27 | 21 | 5 | 1 | 445 |
| 海外 | 600 | 24 | 14 | 7 | 3 | 576 |

- 本文・記事ID・並び順を含む元データは、`thumbnail` を除いて作業元とJSON一致。
- `npm test`: 97/97成功。URL/DNS、RSS/OGP抽出、Google応答・停止、キャッシュ、画像404、描画失敗、iOS互換など。
- 最終のWorldのアセットハッシュ変更後、関連24テストを再実行して成功。
- 国内・World・アプリAPIビルド成功。`verify`: 国内472件、重複URLなし、ガイド17件、アーカイブ20ページ。`verify:world`: 海外600件。
- ブラウザー: 国内/World-JPの1280pxと375px、World-Originalの375pxと320pxで横はみ出しなし。画像読込成功、画像なし記事の通常表示、国内検索後の画像表示を確認。確認時にJavaScriptエラーなし。
- 画像失敗時の除去は模擬DOMテストで確認。全画像の全ブラウザーでの表示、本番サーバーからの取得、定期実行は未確認。

## 再開・確認

ローカルの追加取得（記事の再選定や翻訳を伴わない）:

```powershell
node scripts/enrich-thumbnails.mjs --edition=domestic --limit=60 --seconds=90 --write
node scripts/enrich-thumbnails.mjs --edition=world --limit=60 --seconds=90 --write
npm run build
npm run build:world
npm run build:app-api
```

`--write` を付けない場合は書き込まない。未取得が残っていても故障を意味しない。
本番反映前は最新mainを再確認し、この変更と定期更新された記事データを照合する。本タスクのサムネイル変更の公開・デプロイは承認済み。
