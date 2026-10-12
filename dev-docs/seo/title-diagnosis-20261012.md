# 国内カフェの実タイトル未反映

親の独立本番ブラウザー観測（2026-10-12 09:44〜09:45 JST）:

- `/connect/sign-cafe/very-you/`: document.title / og:title はともに `サインカフェ ベリーユー | Deaf Navi`。本文の所在地は東京都 / 小平市。queryの有無でも同じ。
- Rendeaf Coffeeも旧タイトル。公開seedは両店ともkind=cafe/country_code=JP。
- sitemap.xml、sitemap.html、guideの静的3修正は反映済み。CI/Deploy成功だけでカフェtitleを完了扱いにしない。

## 読取から確認したこと

現在main `5b56af63a2df34f01ad96765fbd20ac62a49f087` の `views.php` は `cafe_record_seo()` を呼び、同じtitleをHTMLとOGへ出力する。JSによるdocument.title/og:titleの書換はない。公開seedの両店は適用条件に一致する。国・kind・掲載区分の実DB値はまだ直接読んでいない。

PHP配信のリポジトリ設定は `/srv/deafnavi/current` を固定rootとしてFastCGIへ渡す。Deployはこのsymlinkをreleaseへ原子的に切り替えるが、OPcache失効は実行していない。既存運用資料（public-profile、map2d等）にはアプリ限定のOPcache失効が必要との記録がある。本番で有効なCaddy/PHP設定は未読なので、旧PHPコードの継続配信は有力仮説として扱い、確定したと報告しない。

## 承認範囲の切り分け

実店舗2件について、通常URL/`dn_client=codex`、HTML title、OG title、H1、canonicalを隔離PHP HTTPで検証する。公開詳細に固定の `X-DeafNavi-Cafe-SEO: locality-20261012-2; mode=applied|default` を追加して、実行されたコードとSEO適用の有無を識別する。内部レコードのkind、国コード、管理メモ、パス、認証情報をheaderへ出さない。private/404にはこのheaderを出さない。

公開後の識別付きGETで、このheaderとtitle/OGを実読する。

- headerがありmode=appliedかつ新タイトル: 現行コードと適用を確認できる。
- headerがありmode=default: 現行コードは実行されている。実DBの分類等の条件を確認する。
- headerがなく旧タイトル: 新しい公開詳細コードが確認できない。実際のFastCGIパス・PHPキャッシュ・上流キャッシュを読取確認する。コード成功テストを本番反映証拠に置き換えない。

## サーバー設定が必要な場合の承認用候補（未適用）

対象アプリの既存PHP socketブロックに1設定だけ追加する候補:

```caddy
php_fastcgi unix//run/php/deafnavi.sock {
    resolve_root_symlink
}
```

[Caddy一次資料](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi) は、symlinkを別releaseへ切り替える構成で `resolve_root_symlink` により実体rootへ解決でき、既定では無効と説明する。[PHP OPcache一次資料](https://www.php.net/manual/en/opcache.configuration.php) も併せて設定を確認する。

この候補を本番へ適用していない。適用が必要と判明した場合は、現行Deaf Navi snippetのバックアップ・差分確認・Caddy validate・限定reload・PHPタイトル再読・復旧手順を具体化して承認を待つ。全体PHP-FPM再起動、他アプリのOPcache一括reset、DNS・権限変更を行わない。

## PR29公開後の再観測と配布経路の監査

- PR29の検証head `4ffbe375136635544ed4c1fbfff27497a50e0014`、CI [38190566024](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38190566024) は全工程success。実seedの2店を通常URLと識別付きURLで検証し、PHP SEOは59項目成功。
- 通常PRマージ後のmainは `a7e54cf60b6b14cee94ef026b123daa5a5cff55d`。[Deploy XServer 38191032136](https://github.com/deaf-navi/deaf-navi-web/actions/runs/38191032136) は10:13:58 JSTにsuccess。stagingのviews.php/cafe-seo.phpを含む全PHPの本番CLI lintも成功している。
- 親の10:22〜10:23 JSTの本番DOM再読では、very-youとrendeafのtitle/OGは依然旧表示、canonicalは正常。親ブラウザーにHTTP response header取得機能がないため、新しい識別headerは**未確認**である。headerなしと観測したものではない。
- 正規tarコマンドをローカルで再現し、index.php、views.php、cafe-ui.php、cafe-seo.php、core.php、public-profile.phpがそれぞれ1回、正しい `_backend/` 配下に収録され、元ファイルとbyte一致することを確認。対象2店の静的HTML詳細は収録されない。`index.php → views.php → cafe-ui.php → cafe-seo.php` は同じ `__DIR__` からのrequireであり、同名detail/page関数の別定義はない。
- `src/assets/sw.js` は全カフェURLをfetch介入の対象から除外し、private/no-storeレスポンスを保存しない。`directory-safety.js` に旧キャッシュ排除もある。ただし本番の稼働worker自体を読んだ証拠とは区別する。

ローカル再現アーカイブの主要SHA-256:

| ファイル | SHA-256 |
|---|---|
| `_backend/views.php` | `fd50437a5f66240e389f0030c0dc861daf21ea307fe0e19e44710525b96558ad` |
| `_backend/cafe-seo.php` | `5dd849222e31d29f2099bc1abf3d52e388b260f3e907fc5c196e2020e47a3529` |

ここまでで、リポジトリと正規配布処理の配置漏れ・静的詳細との重複は確認されていない。一方、公開DBはSQL列がpayloadを上書きするのでseedだけでは実DBのkind等を断定できない。本番Caddyの有効root/FastCGI設定、実体release、稼働PHPキャッシュは未確認。キャッシュ原因と確定していない。

## 次に必要な既存権限での読取

`read-only-php-serving-audit.sh` を**既存の承認済みVPS接続**で手動実行する。GitHub Actionsの鍵を取り出したり、workflowを追加・変更したり、新しい認証・権限を作ったりしない。スクリプトはcurrentの実体・該当6ファイルのhash・対象アプリの非秘密directive・公開2店のtitle入力だけを読む。DBはmode=ro/query_only、対象はpublication=publicの2slugだけ。識別付き公開GETでtitle/OG/canonicalと新しいheaderを読む。設定・データ・サービス・キャッシュを変更しない。

この保存環境にはVPSのパス/socket/既存読取接続がなく、手動スクリプトの本番実行は未実施。ブラウザーDOMのh2/type表示はkind=storeや関連団体の条件を絞る補助になるが、HTTP headerやPHP実行パスの代用にはしない。診断だけの追加公開を繰り返さない。

設定変更が必要と判明した場合の承認対象は、既存運用資料の `/etc/caddy/deafnavi.caddy` 内、Deaf Navi専用socket `/run/php/deafnavi.sock` の `php_fastcgi` ブロックに上記1設定を追加する差分（実際の有効ファイルを読取後に確定）。目的はrelease symlinkの実体パスをFastCGIへ渡すこと。リスクはPHP動的ページの配信失敗。承認後も元snippetをhash付きバックアップし、有効な全体Caddy設定をvalidateしてからgraceful reloadし、2店のtitle/OGとprivate経路を確認する。失敗時は当該snippetだけを戻して再validate/reloadする。current・DB・DNS・FPMの共有サービスは変更しない。Caddyバイナリがこの環境にないため、この候補の構文検証も未実施。
