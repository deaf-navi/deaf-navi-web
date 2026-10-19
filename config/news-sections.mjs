// Two useful editorial collections, not one generated page per query.
export const NEWS_SECTIONS = [
  {
    slug: 'support', label: '制度・支援',
    title: '聴覚障害の制度・支援ニュース', categories: ['policy', 'education'],
    description: '聴覚障害・難聴に関する制度、助成、雇用、教育の新着をまとめています。対象地域や利用条件は、各記事の出典から確認できます。',
    heading: '制度のニュースを、自分の暮らしにつなげる',
    text: '新しい支援の発表と、すでに申請できる制度は同じではありません。記事の公開日だけでなく、開始日・対象地域・申請先を確認しましょう。',
    checks: ['住んでいる地域、年齢などの対象条件', '申請の受付期間と、購入・利用前の手続きの有無', '問い合わせ先と、文字や手話で相談できる方法'],
    guide: '/guide/systems/', guideLabel: '仕事・学びの場で相談するとき',
    related: '/guide/life/', relatedLabel: '病院・窓口での伝え方',
  },
  {
    slug: 'accessibility', label: '字幕・手話通訳',
    title: '字幕・手話通訳・情報保障のニュース', categories: ['accessibility', 'relay', 'technology'],
    description: '聴覚障害・難聴のある人の情報の受け取り方に関わる新着。字幕、手話通訳、要約筆記、電話リレー、音声文字変換などの情報を出典付きで紹介します。',
    heading: '自分に合う方法が、使いたい場面にあるか',
    text: '「字幕あり」「手話通訳あり」でも、対応する場面や申込方法は異なります。製品・サービスの発表と、今すぐ使える提供情報も分けて確認しましょう。',
    checks: ['手話・字幕・要約筆記・筆談のうち、対応する方法', '本編だけでなく、受付・質疑応答などで使える範囲', '事前申込、対応端末、料金などの利用条件'],
    guide: '/guide/accessibility/', guideLabel: '通訳・字幕・筆談の確認ポイント',
    related: '/events.html', relatedLabel: '情報の受け取り方からイベントを探す',
  },
];
