export const GUIDE_LAST_REVIEWED = '2026-08-05';

export const GUIDE_SECTIONS = [
  {
    id: 'emergency',
    label: '災害・緊急時',
    summary: '110・118・119、避難支援、安否確認',
    items: [
      {
        title: '110番アプリシステム',
        summary: '文字・画像・位置情報で警察へ緊急通報。全国で利用でき、事前登録が必要です。',
        detail: '聴覚や発話に困難がある方が、スマートフォンから文字で警察へ通報できます。緊急時に備えて事前登録し、練習モードで操作を確認してください。',
        url: 'https://www.npa.go.jp/bureau/safetylife/110/app/',
        recommended: true,
      },
      {
        title: 'Net119 緊急通報',
        summary: 'スマートフォンから文字で救急・消防へ通報。利用地域での事前登録が必要です。',
        detail: '位置情報を添えて消防へ連絡できる緊急通報サービスです。登録方法はお住まいの地域を管轄する消防本部へ確認してください。',
        url: 'https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/net119.html',
        recommended: true,
      },
      {
        title: '電話リレーサービス 緊急通報（110・118・119）',
        summary: '手話・文字を通訳オペレータが音声につなぎ、24時間緊急通報できます。',
        detail: '電話リレーサービスの利用登録が必要です。平時のうちに登録と緊急通報の手順を確認してください。',
        url: 'https://www.nftrs.or.jp/about/',
        recommended: true,
      },
      {
        title: 'NET118 海の緊急通報',
        summary: '海での事件・事故を文字で海上保安庁へ通報。事前登録が必要です。',
        detail: '聴覚や発話に困難がある方のためのインターネット緊急通報サービスです。海へ出る前に登録を済ませてください。',
        url: 'https://www.kaiho.mlit.go.jp/doc/tel118.html',
        recommended: true,
      },
      {
        title: '避難行動要支援者の事前登録',
        summary: '災害時の避難支援に備える名簿登録。市区町村の福祉・防災窓口で相談できます。',
        detail: '警報や避難指示を受け取りにくい場合に備え、個別避難計画とあわせて平時から確認しておく制度です。',
        url: 'https://www.bousai.go.jp/taisaku/hisaisyagyousei/yoshiensha.html',
      },
    ],
  },
  {
    id: 'medical',
    label: '医療・補聴器',
    summary: '補聴器購入前に確認したい制度と手続き',
    items: [
      {
        title: '補聴器購入の医療費控除',
        summary: '補聴器相談医の診療と所定の手続きにより、医療費控除の対象になる場合があります。',
        detail: '購入前に補聴器相談医へ相談し、必要書類と購入手順を確認してください。',
        url: 'https://www.jibika.or.jp/modules/hearingloss/index.php?content_id=7',
        recommended: true,
      },
      {
        title: '補聴器・認定補聴器技能者の情報',
        summary: '補聴器の種類、選び方、認定補聴器技能者のいる販売店を確認できます。',
        detail: '購入後の調整も重要です。医療機関や認定補聴器技能者へ相談しながら選択してください。',
        url: 'https://www.techno-aids.or.jp/',
      },
    ],
  },
  {
    id: 'education',
    label: '教育・受験',
    summary: '学校での支援と入試の配慮',
    items: [
      {
        title: '通級による指導',
        summary: '通常の学級に在籍しながら、一部の時間に個別の指導を受ける仕組みです。',
        detail: '発音、聴覚活用、コミュニケーションなどの指導について、学校や教育委員会へ相談できます。',
        url: 'https://www.mext.go.jp/a_menu/shotou/tokubetu/005.htm',
      },
      {
        title: '大学入試の配慮・特例措置',
        summary: '大学入学共通テストでは、放送問題の文字化などの受験上の配慮を申請できます。',
        detail: '令和9年度は第1期が2026年7月1日から8月28日、第2期が8月31日から10月2日までです。必要書類を確認し、余裕を持って申請してください。',
        url: 'https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r9/r9_hairyo_qa.html',
        recommended: true,
      },
    ],
  },
  {
    id: 'employment',
    label: '就労・制度',
    summary: '働くときに利用できる制度と地域の相談先',
    items: [
      {
        title: '障害者雇用促進法と法定雇用率',
        summary: '民間企業の法定雇用率は2.7%（2026年7月から）。対象事業主は従業員37.5人以上です。',
        detail: '事業主には法定雇用率以上の障害者を雇用する義務があります。最新の制度資料は厚生労働省で確認できます。',
        url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/shougaishakoyou/index.html',
      },
      {
        title: '障害者就業・生活支援センター',
        summary: '仕事と日常生活の悩みを一体で相談できる地域の支援窓口です。',
        detail: '就職準備、職場定着、健康管理、生活習慣などを支援し、本人・家族・事業主から相談できます。',
        url: 'https://www.mhlw.go.jp/stf/newpage_18012.html',
        recommended: true,
      },
    ],
  },
  {
    id: 'phone',
    label: '電話・コミュニケーション',
    summary: '電話を手話・文字でつなぐ公共サービス',
    items: [
      {
        title: '電話リレーサービス',
        summary: '手話・文字と音声を通訳オペレータがつなぐ公共サービスです。',
        detail: '電話の発着信に加え、110・118・119への緊急通報にも対応しています。',
        url: 'https://www.nftrs.or.jp/about/',
        recommended: true,
      },
      {
        title: 'ヨメテル',
        summary: '電話の相手の声を文字で読める、聴覚障害者向けの電話サービスです。',
        detail: 'AIまたは文字入力オペレータによる文字化を選択できます。利用条件と対応端末は公式サイトで確認してください。',
        url: 'https://www.yometel.jp/',
        recommended: true,
      },
    ],
  },
  {
    id: 'life',
    label: '知る・暮らす',
    summary: 'デフスポーツの記録と暮らしのアクセシビリティ',
    items: [
      {
        title: '東京2025デフリンピック 公式記録',
        summary: '全21競技の対戦結果、順位、記録を公式結果ページで確認できます。',
        detail: '閉幕した第25回夏季デフリンピック競技大会 東京2025の公式記録です。',
        url: 'https://www.deaflympics.com/games/tokyo-2025/results',
        recommended: true,
      },
      {
        title: '全日本ろうあ連盟スポーツ委員会',
        summary: '国内大会、日本代表選考、各競技団体の情報を確認できます。',
        detail: '国内のデフスポーツ情報と各競技団体への入口です。',
        url: 'https://www.jfd.or.jp/sc/',
      },
      {
        title: 'ミライロID 対応施設・サービス',
        summary: 'デジタル障害者手帳に対応する交通機関、施設、サービスを探せます。',
        detail: '利用条件や割引内容は事業者ごとに異なるため、利用前に各施設の案内も確認してください。',
        url: 'https://mirairo-id.jp/place/',
      },
    ],
  },
];
