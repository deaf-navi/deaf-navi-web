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
