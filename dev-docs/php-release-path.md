# PHPの公開フォルダ切替

Deaf Naviの公開rootは `/srv/deafnavi/current` で、デプロイ時に新しいreleaseへのシンボリックリンクへ切り替える。
Deaf Navi専用ソケット `/run/php/deafnavi.sock` を使う各 `php_fastcgi` には `resolve_root_symlink` を指定する。Caddyが実際のreleaseパスをPHPへ渡すため、PHPの古いパス・OPcacheの再利用による反映遅延を防ぐ。

2026-10-23、`current/_backend/index.php` 経由では旧フォーム、同じソケットへ実releaseパスを指定すると新フォームになったことを確認した。PHP全体の再起動やキャッシュの全消去ではなく、Deaf Naviの2つのPHPルートだけを変更した。

設定変更は既存 `/etc/caddy/deafnavi.caddy` をバックアップし、既存設定への最小差分で行う。他サイトを含むCaddyfile全体をリポジトリのサンプルで上書きしない。`caddy validate` 後にgraceful reloadし、`/about.html` のお問い合わせフォームが「サイトへのお問い合わせ」、hidden `contact_scope=site`、有効なCSRFを持つことと、カフェ・読みもの・管理画面入口を確認する。

PHP機能追加では本番の拡張モジュールも確認する。URL検査のUTF-8切詰めはmbstringを必須にせず、`php -n test/contact-url-check.php` でも検証する。

参考：[Caddy php_fastcgi](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi#syntax)
