# 掲載関連性の確認 2026-10-18

## 範囲と結果

本番の国内ニュース469件、World 600件、国内過去記事5000件のメタデータを対象に、キーワード衝突と既存除外条件を照合。疑義のある候補は発信元の記事を確認した。全過去記事の全文を再読した監査ではない。

国内イベント34件と、公開状態のカフェ159・関連店舗11・開催回3の名称／説明／注記も点検した。この範囲で明らかな対象外は見つからなかった。これら173件すべての公式情報を今回再取得したという意味ではない。カフェDBとイベント台帳の掲載内容・確認日時は変更しない。

除外は現在の国内1件・World 9件・国内過去記事2件。ニュース更新日時・残した記事のIDや日付は維持し、除外理由を公開スナップショットのpublicationReviewへ記録する。既存Git履歴から復元可能。

## 元記事で確認した対象外

| 掲載先 | 内容と判断 | 確認先 |
| --- | --- | --- |
| 国内 | 一般のフラ公演のポスター掲示のお礼。協会名は掲示協力先としての言及 | https://camp-fire.jp/projects/972709/view/activities/895428 |
| World | HONORの一般向けタブレット・時計・イヤホン発表。聴覚支援の記事ではない | https://diariocorreo.pe/tecnologia/honor-lanza-en-peru-nueva-tablet-smartwatch-y-audifonos-caracteristicas-noticia/ （本文は同社公開配信先 https://elcomercio-diariocorreo-prod.cdn.arcpublishing.com/tecnologia/honor-lanza-en-peru-nueva-tablet-smartwatch-y-audifonos-caracteristicas-noticia/ でも確認） |
| World | Soundcoreの通話音質を宣伝する一般向けイヤホン | https://www.theclinic.cl/2026/09/25/soundcore-liberty-5-pro-max-chile-precio-caracteristicas/ |
| World | Soundcoreの一般向け音楽用イヤホン紹介 | https://laverdadnoticias.com/futuro-ahora/gadgets-que-importan/soundcore |
| World | Soundcoreの運動用イヤホン販売紹介 | https://www.eluniversal.com.mx/descubre-y-compra/soundcore-sport-x20-los-audifonos-deportivos-que-no-se-caen-resistencia-extrema-e-increible-bateria-a-precio-de-oferta/ |
| World | D1の外国語音声翻訳イヤホン販売。字幕による聴覚支援とは異なる | https://www.cronista.com/colombia/finanzas-y-economia/tiendas-d1-suma-a-su-catalogo-unos-audifonos-que-traducen-idiomas-en-tiempo-real-por-49900/ |
| World | Ankerイヤホンの値引き紹介 | https://www.xataka.com.mx/seleccion/amazon-esta-rematando-version-mejorada-audifonos-soundcore-ideales-para-transporte-publico-anker-p31i |
| World | 映画への撮影地表記を求める観光宣伝の話題 | https://timesofindia.indiatimes.com/city/vijayawada/ap-minister-calls-for-mention-of-shooting-locations-in-movie-subtitles/articleshow/131045219.cms |
| World | 偽字幕を使った政治的な誤情報。字幕による情報保障とは別の話題 | https://www.straitstimes.com/asia/east-asia/plagiarised-videos-reposted-with-false-subtitles-aimed-at-stoking-anti-japan-sentiment-in-china/ |
| World | 偽字幕の政治動画を検証する記事。聴覚障害の話題ではない | https://www.news24.com/southafrica/debunking/viral-clip-with-fake-subtitles-falsely-claims-chinas-xi-pledged-23-million-jobs-to-sa-amid-us-row-20250624-1099 （公開範囲を確認。購読制限を回避していない） |
| 国内過去 | 視覚部門の図書館メンテナンス案内 | https://shichocenter.kagoshima.kagoshima.jp/archives/548 |
| 国内過去 | 視覚部門の音訳奉仕員講習案内 | https://shichocenter.kagoshima.kagoshima.jp/archives/412 |

## 過剰な除外を防ぐ確認

視覚部門の総合だより10月号には「盲ろう者通訳・介助員養成講習会」の案内がある。部門名だけの一律除外をやめ、上記の視覚のみのサービス案内に条件を限定した。総合だよりはアーカイブに残す。

- https://shichocenter.kagoshima.kagoshima.jp/shikaku_sub/shikaku-tayori_2026_10.html
- 字幕付き講演番組や字幕技術の記事は、「字幕」という語だけで対象外にしない。Wang Gungwu Lectureは登壇者の聴覚医療との関係も確認できるため、明らかな無関係とは判定しない: https://www.australiachinafoundation.org.au/news/wang-gungwu-lecture-2026

国内・Worldの収集時と保存済み記事のビルド時に判定を適用。過去記事の再結合でも明示的な対象外が復活しないようにする。イベント・カフェの毎日09:00の統合タスクには、公式情報に基づく関連性の根拠、単発会場と常設対応の区別、曖昧な候補の保留を追加する。実行頻度、復旧処理、既存保留は維持する。
