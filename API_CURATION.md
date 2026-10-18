# 無料APIによる選別・抽出・比較

2026-10-18のユーザー許可範囲。Codexは共有適性の確認、新規情報源と例外の調査、公開差分の確認を担当する。全件を毎回LLMで読み直さず、同じ文面・同じ判定仕様の結果は私有キャッシュを再利用する。

## 国内ニュース

1. 既存の06:10/12:10/18:10 JST更新でRSSと検索を取得。難聴・聞き取り困難、情報アクセシビリティ、文字通報、鑑賞支援の検索を追加。みみサポみやぎ公式ブログと全国盲ろう者協会の公式お知らせも取得する。雑記を含むブログは本文の関連性条件を必須とし、本文を一覧へ転載しない。
2. 基礎選別は継続。漏れの候補を `.state/news-review-candidates.json` に最大40件のURL・hashとして残す。これは非掲載の調査入口であり、API送信済み・掲載承認済みを意味しない。画像一覧・広告等の明示除外、掲載済み記事の近似重複、候補間の重複は再調査へ回さない。関連性不足・本文未確認・点数不足は候補に残す。公式・専門の直接取得、その他の直接取得、検索で発見した公式・専門、その他の順に優先し、同じ優先度では配信元を交互に選ぶ。本文や個人名は追加保存せず、理由・配信元ドメイン・優先順位を記録する。
3. 日次調査で候補の公式本文を確認し、共有に適した短い抜粋を選ぶ。`prepare-curation-review.mjs` で本文中に抜粋が存在するか照合し、`curation-review.mjs` で関連性と開催案内/開催報告を抽出・比較する。APIが関連ありとしただけで公開せず、根拠との一致を確かめる。
4. 確認済みの差分だけ `content/news/assisted.json` へ記録する。ID・取得文面hash・元URL・短い根拠・モデル・確認日時・approvedを保存。必要な場合は確認者が書いた180文字以内の `publicSummary` で、関連する支援内容を簡潔に説明できる。原文の長文転載や未確認条件の補完はしない。本文変更や7日経過で無効となり、再確認まで元の選別に戻る。開催日を公開日に変えない。明示的な無関係判定・広告・工事中除外は補助結果でも解除しない。APIのno判定だけで既存記事を削除しない。

ニュースの保存済み一覧には補助判定の日時・期限・記事hashと公開文面hashを添え、再ビルドでも確認済みの分類を保持する。改変・7日失効は再ビルドでも除外し、承認取り下げは収集時の承認台帳との照合で再確認へ戻す。日時を延長しない。新しい記事を取得できたURLは旧スナップショットで補わず、変更後の本文が旧承認を引き継がないようにする。保存済み要約だけで関連性を再認定しない。

## イベント・カフェ

1. 既存の収集・照合が得た公式HTMLを対象に、`prepare-curation-review.mjs` へ `targets`（kind、title、sourceUrl、sourceMode=html、officialVerified、短いfragments、既存baseline、固定recordId）を渡す。1回最大8件。`approvedDocumentHash` がある場合はページ全体の変更も例外にする。結果は公開root・Gitの外へ0600で保存する。URLの取得失敗・抜粋の消失・画像/PDFは例外として返す。
2. 抜粋・題名を実際に読んで共有適性を確認し、当日allowanceに `prepareReviewItem` が作る正確な文面hashを登録する。個人の健康の話・名前・連絡先等を含む文面は送らない。自動fetchや正規表現だけでpublicDataReviewedをtrueにしない。
3. `curation-review.mjs` に `publicDataReviewed=true/tasks` を渡す。APIは日付・会場・申込・情報保障・状態を根拠の原文とともに返す。別工程が引用の存在、年を含む日付、必須項目、既存台帳との差異を検証する。締切日を開催日として返した場合も既存日付との比較で例外にする。未知の新規開催はbaseline不足として例外になる。
4. 既存情報と一致した抽出は `corroborated`、変更・不足は `exception`。結果の `reviewedAt=null` と `publicationApproved=false` は仕様。APIは目視や掲載承認を代行せず、48時間期限を延長しない。申込条件など新しく見つかった情報も差分として確認する。カフェDBと国内イベントの公開は従来の `CAFE_EVENT_CURATION.md` / `EVENT_CURATION.md` に従う。

## 実行場所と頻度

### 日次のイベント・カフェ比較

`/srv/deaf-navi-codex-app-server/curation-batch/scripts/daily-curation-review.mjs` を09:00 JSTの既存heartbeatから1回実行する。別cronは追加しない。現在の `events.json` と `curate-cafe-events.php --review-export` の読み取り専用出力から比較基準を作る。カフェの固定ID・掲載revision・根拠revisionも照合し、非公開レコードや管理メモは出力しない。

私有 `curation-review-catalog.json`（version 1、targets）は、kind/recordId/title/sourceUrl/sourceMode=html/officialVerified=true/fragments/approvedDocumentHash/sharingReviewedAtを持つ。公式本文と共有する短文を実際に読んで登録する。全文hashは `prepare-curation-review.mjs` が実取得した `sourceDocumentHash` を使う。カタログ登録だけでは当日のAPI送信を許可しない。初期対象は確認したHTML資料から増やし、未登録・変更された文面は例外に残す。

通常6週間・公演6か月の範囲で、登録済み情報をイベントとカフェ交互に最大40件選び、4件ずつ順番に比較する。同じURLのHTMLは実行内で一度だけ取得し、全文hashと抜粋の存在を再照合する（取得失敗も実行内で再送しない）。新規情報源の詳査は従来どおり1回最大8件。APIの1回・当日トークン予算、通常16回の回数上限は拡大しない。API/キャッシュ異常時は後続バッチも止め、UNKNOWNと例外を残す。

API結果・既存キャッシュと最新台帳を比較し、一致は `corroborated`、差異・不足・未登録・目視対象は `exception`。対象上限超過は `deferred` として保持する。48時間の期限切れやカフェのrevision不一致を、この処理で復旧・承認しない。常設店舗の年次棚卸は別途維持する。

表記の違い等を公式本文と掲載内容で実際に照合済みの場合だけ、私有カタログの `comparisonReview` に `baselineHash/documentHash/decisionHash/checkedAt/note` を保存できる。根拠本文、最新掲載内容・カフェrevision、抽出結果が全て同一で、理由が `differs-from-current` のみの場合は `reviewed-unchanged` に分ける。差分と確認日時を結果に残し、毎日の同じ確認を避ける。日付不足、関連性不明、別の出力、48時間切れ、本文や掲載内容の変更には使えない。掲載承認や鮮度延長を意味せず、`reviewedAt=null/publicationApproved=false` を維持する。

同日・同じ台帳/カタログ/当日共有許可の再実行は保存済み結果を返す。強制再調査は `--research --force` の明示実行のみで、無料枠や結果不明の停止条件は共通。新規API送信は当日許可に正確な文面hashがあるものだけ。未承認の1件で他のキャッシュ照合を止めない。API/キャッシュ異常時の送信件数はUNKNOWN(null)とし、自動再送しない。

`daily-curation-review.json` は公開root外に0600で保存する。Codexは主に `exceptionRecords` と未探索の情報源を確認し、一致した抽出を毎回手で作り直さない。新規発見、画像/PDF/SNS、共有適性・当日無料枠の確認、掲載差分の承認は残る。公開DB、承認台帳、reviewedAt、年次期限をこのCLIから更新しない。

本体はGitHubのCI・PR・既定公開後、同じcommitのscripts（daily/prepare/curation-review/contract/complimentary-text-client）と参照するsrc/lib（thumbnail-fetch/thumbnail-metadata/text）を専用サービス内の版別フォルダへ設置し、`curation-batch` のリンクを原子的に切り替える。既存HTTPサービスやキー設定の再起動・変更は不要。モデル定義更新時も同じ版のbundleへ揃える。切替前のフォルダと私有カタログ・結果を保持し、旧リンクへ戻せるよう記録する。

比較CLIは `/srv/deaf-navi-codex-app-server/curation-review.mjs`、私有キャッシュは `/srv/deafnavi/shared/ai/curation-review-cache.json`。当日の承認済み文面だけ処理する。ロックにより二重実行を防ぐ。同じ結果は再取得せず、再利用時に既存台帳・取得時刻との比較をやり直す。結果不明の送信を自動再試行しない。

日次の `deaf-navi-2` に統合し、新しいcron・定時API連打は追加しない。登録済み情報源の復旧は引き続き非AI。毎日の共有適性・無料枠確認は必要なため、Codexが完全に不要になるわけではない。新規発見・画像・PDF・SNSの実確認も残る。

調査・再試験に限りCLIへ `--research` を付け、回数を通常の16回と分ける。トークン予算、当日残量、秘密保護、結果不明時の停止は共通。モデル比較時の `modelOverride` も調査CLIのみ。定時HTTPの入力から上限を回避する経路はない。

API応答の件数・固定ID・重複はバッチ全体で厳密に検証する。その上で、引用や日付が根拠と合わない項目だけを `api-evidence-invalid` として私有キャッシュへ保存し、正常な項目の照合は継続する。無効な原文や出力は保存せず、同じ文面の無効結果を自動再送しない。別IDや結果不明の応答をこの仕組みで正常扱いしない。

## 比較と公開

日次で候補台帳の `counts` / `comparison` と、APIの `submitted/cached/corroborated/exceptions`、実使用量・無料枠区分を比較する。候補数の増加だけを改善と見なさず、明示除外・重複を再確認せずに済んだ件数と、根拠を確認して掲載できた取りこぼしを分けて記録する。`feedChange=unchanged` は取得済みフィードの同一性だけであり、公式本文の再確認や48時間期限の更新を代行しない。上限で後回しになった件数も `deferred` に残す。既存の私有キャッシュを使う場合も鮮度と台帳との差分を毎回検証する。

実測: みみサポみやぎの開催報告、ふれあいランド岩手の交流会、豊中市の手話カフェの3資料を両モデルで比較。関連性、記事種別、開催日と会場は一致。6.1 Solは比較データに未収録の「予約制」を抽出し、例外確認になった。少数の試験で全情報源の精度を保証せず、未確認の新規情報を自動公開しない。

新しい情報源の構造変更、根拠のない出力、日付不足、通信失敗、無料枠不明は既存処理を維持して例外に残す。私有原文やAPIキーはPRに含めない。
