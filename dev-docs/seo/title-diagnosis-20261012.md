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

## 2026-10-14 最新観測と読取診断

親の正式dotクラウドChromeから受領した本番証拠:

- 00:33:54 UTC（09:33:54 JST）: Aboutは最新main HTMLと一致。新本文リンクからカフェ一覧へ遷移でき、JSON-LDの日付2項目省略、canonical・iOS/app情報保持を確認。
- 00:34:32 UTC: very-youのtitle/OGは `サインカフェ ベリーユー | Deaf Navi`、所在地東京都/小平市。rendeafも `Rendeaf Coffee | Deaf Navi`、所在地東京都/文京区。静的修正の成功とPHP詳細タイトルの未完を分ける。

確認対象mainは4717062368fd0c6d0141d0c445465e7174d0a4ef。PR29公開a7e54cfからPHP・deploy設定・workflowに差分はない。最新リポジトリで次を再読した:

- `detail()`は新しい`cafe_record_seo()`を呼んでpageの第7引数へ渡す。HTMLとOGは同じdocumentTitleを使う。適用条件はcountry_code=JP / kind=cafe / listing_group=cafes。公開seedと実DBは同じとは限らず、expanded()ではSQL列がpayloadを上書きする。通常DeployはDBを更新しない。
- 正規tarはserverを_backendへ変換し、同じ__DIR__からindex→views→cafe-ui→cafe-seoを読む。正規Deployはstagingの全PHPをlintし、専用socket存在を確認してcurrentを原子的に切り替える。今回のAbout実読は静的配信成功の証拠だが、FastCGIの実行ファイルを証明しない。
- リポジトリCaddyはcurrentをroot、カフェURLを_backend/index.phpへrewriteし、専用socketへ渡す。resolve_root_symlinkは記載なし。DeployにはOPcache失効処理がない。PHPプールの追跡ファイルにもOPcache値はなく、有効な全体設定・稼働値は未取得。symlink/OPcacheで旧PHPを実行する仮説、実際の別root/handler、実DB条件の不一致をまだ区別できていない。
- 実際のSSH送信先・ユーザーは既存ActionsのDEAFNAVI_DEPLOY_HOST/USER、鍵は同Actionsの既存Secretから設定される。値・鍵をこの子環境へ取り出していない。子環境にはSSH config、対象alias、agent socket、標準identity/known_hosts、対象host/user変数がない。remote-exec/SSH読取ツールも現在露出していない。この環境からのVPS実体・有効設定・実DBの読取接続がないことと、既存DeployのSSH成功を混同しない。

安全に確定したコード不具合はまだないため、タイトルの重複修正・新たな診断だけのデプロイは行わない。PR30スクリプト実行とCaddy変更は未承認で未実施（拒否・結果不明ではなく保留）。新しい認証・権限・外部サービスを追加しない。

次に必要な情報は、親の既存Chromeで読める `.dn-location` 全文、H2一覧、店舗タイプ/関連団体のnotice、twitter:title、可能なら公開JSON-LDのaddressCountry/type。kind=storeの国内詳細なら「この店舗の開催履歴」が出るため、所在地文字列だけより適用条件を絞れる。これでも実行版を確定できなければ、既存の承認済みVPS読取接続でcurrent実体・PHP hash・有効FastCGI root/socket・FPMキャッシュ値・公開2レコードの条件を確認する必要がある。実行方法がPR30のscriptになる場合は、その実行について別の明示承認が必要。Caddy変更は実読と原因確定の後の承認対象のまま。

## 2026-10-16の独立本番観測（親から受領）

- very-you: 2026-10-15 23:35:32 UTC / 10/16 08:35:32 JST。title/OGは `サインカフェ ベリーユー | Deaf Navi`。twitter:title/cardなし。self-canonical、H1店舗名。H2は営業時間・ご利用案内、アクセス、掲載情報について。現住所は東京都小平市鈴木町2-187 吉田ビル1F、確認日は2026-09-05。LDはCafeOrCoffeeShopとBreadcrumbList、addressLocality小平市、addressRegion東京都、addressCountry JP。
- rendeaf: 23:35:55 UTC。title/OGは `Rendeaf Coffee | Deaf Navi`。twitter:title/cardなし、self-canonical。H2は営業時間・ご利用案内、手話でのコミュニケーション、アクセス、掲載情報について。現住所は東京都文京区本郷4-3-11 ヴィサーレ本郷1階で旧住所は現会場としていない。確認日は2026-09-07。LDはCafeOrCoffeeShopとBreadcrumbList、文京区/東京都/JP。
- 両店に「この店舗の開催履歴」H2はない。現行ソースのcountry/kind/groupガード、storeのH2、構造化データ分岐との照合ではSEO適用条件と整合する。ただし、このDOMから実DBのkind・掲載区分や実際に稼働するPHP版は確定できない。条件を緩めたり同じtitle修正を再公開したりする根拠にはしない。
- 今日の子HTTPもCONNECT403。SSH設定・鍵・agent・deploy host/userは未提供。PR30スクリプトは実行せず、サーバー設定・診断用workflowの追加も行っていない。次の必要証拠は既存正規の読取手段による識別header、実行PHPファイルのパス/ハッシュ、実際のFastCGI設定、該当2件の公開分類条件。読取接続の有無と、本番障害の有無を混同しない。

## 2026-10-17の最新main照合

最新main257a3cffa2ec00152c0d91d89ceb77bf7f5a906eでは、他作業でviews/cafe-seo等に地域ページや共通表示の更新が入っている。detail→cafe_record_seo→page第7引数→documentTitle/OGという呼出と、国/kind/掲載区分の適用条件は残っている。以前の「PHP変更なし」という日付付き履歴を現在まで延長しない。

今日の識別付きHTTPはCONNECT403、Webも取得不可。SSH設定・鍵・agent・host/userなし。今日の本番title/OG/headerは未取得であり、10/16の旧表示を今日観測したとは扱わない。実行PHP/DB条件を確定できないため、同じtitle修正を重ねず、PR30スクリプト/Caddy変更も実施しない。独立したSEO-06の地域リンクを正規公開後に確認するとき、既存2店舗のtitle/OGも親の正式Chromeで再読する。
