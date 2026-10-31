# iOSアプリへの案内と計測

設定の正本は `server/ios-app-promotion.json`。App Store ConnectでDeaf Naviを選んで生成したURLのprovider tokenを使用する。これは公開キャンペーンURLの識別子で、APIキーではない。アプリIDやprovider tokenを推測しない。

| 掲載場所 | サイト側の固定パス | Appleのキャンペーン |
| --- | --- | --- |
| トップの目的別ナビ | `/go/ios/top` | `web_top` |
| 暮らしのガイド・緊急時の補足 | `/go/ios/guide` | `web_guide` |
| トップ下部 | `/go/ios/footer` | `web_footer` |
| サイト紹介 | `/go/ios/about` | `web_about` |
| Safari標準バナー | サイト内転送なし | `web_banner` |

4パスはGET/HEADだけを302転送する。転送先・pt/ct/mtは固定し、入力クエリや任意URLを引き継がない。未知のパスは404、他のメソッドは405。Cookie、DB、セッション、外部計測スクリプトは追加しない。キャッシュはno-store、Service Workerも対象外。

Safari標準バナーは共通の公開HTML headに設定する。PHPのカフェ・読みものにも適用し、おとまど、投稿、管理、非公開・noindexページには表示しない。アプリが対応していると未確認のdeep link（app-argument）は指定しない。ブラウザでのmeta確認と実機Safariでの表示確認を区別する。既インストール・閲覧履歴等による表示はSafariに従う。

## 集計の使い分け

- 302だけではCloudflare Web AnalyticsのJavaScriptは実行されない。転送数をCloudflareのページ閲覧数として扱わない。
- サイト側は既存アクセス管理の「リクエスト」、利用者分類「一般」、状態「3xx」、パス前方一致 `/go/ios/` で4パス別のリクエストを確認する。ページ閲覧の定義（成功した200/304）を変更しない。HEAD・直接アクセス・再試行を含み得るので、この表示はインストール数や厳密なクリック数ではない。
- クリックの参考値を精査するときはGET・302・4つの正確なパスに限定し、既存のクライアント再分類を使って既知bot/AI/検証/先読みを除外する。IP・UA・生ログを報告やGitへ出さない。部分読取・保持期間・欠測を明記し、未取得を0にしない。配置元の閲覧数を分母にしてもユーザー単位CTRとは呼ばない。
- App Store Connectはキャンペーン別のプロダクトページ閲覧・初回ダウンロード等を確認する。サイトの転送数からインストール数を推測しない。初回ダウンロードと再ダウンロードは、同意ユーザーに限る「使用状況」のインストール・セッション数とは別の指標。
- Appleのキャンペーンは最低件数・表示遅延がある。非表示をダウンロード0件と扱わない。初回ダウンロードはリンク経由から24時間以内、複数キャンペーンなら直近のリンクへの帰属が基本。Appleの集計日はUTC、サイトの管理画面はJSTなので期間を揃える。バナー経由はサイトの4パス集計に入らない。
- 導入後1〜2か月を目安に効果を評価する。母数不足なら結論を保留する。この変更で新しい自動化は作らない。

## 公開と確認

通常のPR/CI/Curate & Build/Deploy XServerを使う。初回だけ、現行 `/etc/caddy/deafnavi.caddy` のDeaf Navi用routeへ、private-file保護の後に `import /srv/deafnavi/current/_backend/ios-app-routes.caddy` を追加する。既存ログ・権限・他サイトの設定を置換しない。変更前の設定を保管し、`caddy validate` 後にreloadする。公開後は4パスの302とpt/ct/mt、未知パス404、POST405、管理/投稿/おとまどの除外、PC/スマホ・ダーク・文字拡大を確認する。検証HTTPには `Codex-DeafNavi-Verification`、画面には `dn_client=codex` を使用する。

初回導入のロールバックは保存したCaddy設定と直前のサイトリリースを対にして戻す。次回以降、provider token/文言は通常のソース変更・再ビルドで更新できる。Caddy routeの変更時だけ再validate/reloadする。

## 公式資料（2026-11-01確認）

- [Deaf Navi App Store](https://apps.apple.com/jp/app/deaf-navi/id6761352199)
- [Apple: Metrics definitions](https://developer.apple.com/help/app-store-connect-analytics/reference/metrics-definitions/)
- [Apple: Campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/)
- [Apple: Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)
