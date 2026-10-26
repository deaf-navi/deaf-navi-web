// Editorial resource introductions. Dates describe each source, not a live emergency status.
export const HEARING_DISASTER = {
  path: '/guide/hearing-disaster/',
  title: '聞こえと防災',
  description: '聞こえない・聞こえにくい人の防災と、災害時の情報保障を知るために。行政・当事者団体の資料、支援の記録、関連ニュースをまとめました。',
  reviewedAt: '2026-10-26',
};

export const DISASTER_RESOURCES = [
  {
    id: 'mhlw-communication', group: 'communication',
    title: '避難所で情報を伝える方法・配慮の例',
    publisher: '厚生労働省', dateLabel: '2024年1月5日・PDF 2ページ',
    url: 'https://www.mhlw.go.jp/content/001186945.pdf',
    description: '聞こえの状態や本人が使う方法を確かめ、文字・手話などで情報を伝えるための資料。避難所運営や支援に関わる人が、配給の連絡や個別の説明を考える際の参考になります。',
    note: '能登半島地震の被災地域に向けた事務連絡です。掲載されたサービスは当時の案内としてお読みください。',
  },
  {
    id: 'nise-children', group: 'communication',
    title: '聴覚障害のある子どもへの配慮',
    publisher: '国立特別支援教育総合研究所', dateLabel: '2024年1月29日更新',
    url: 'https://www.nise.go.jp/tool/disaster/consideration/consideration05/',
    description: '子どもへの伝え方、補聴器・人工内耳を使う場合の留意点、年齢や理解に応じた情報の示し方を解説。保護者や教育・支援関係者に向けた資料です。',
    note: '機器を使っていることだけで、情報がすべて聞き取れているとは判断できません。',
  },
  {
    id: 'jasso-campus', group: 'communication',
    title: '大学での災害時の緊急対応と情報提供',
    publisher: '日本学生支援機構（JASSO）', dateLabel: '障害学生支援の実務資料',
    url: 'https://www.jasso.go.jp/gakusei/tokubetsu_shien/shogai_infomation/shien_guide/choukaku_bamen/emergency.html',
    description: '聴覚障害のある学生への連絡体制や、防災訓練・防災教育を考える資料。大学で情報を出す側と受け取る側のつながりを扱っています。',
    note: '東日本大震災当時の通信事情や機器の例も含みます。現在利用できる設備・サービスは各大学や提供元の案内をご確認ください。',
  },
  {
    id: 'cabinet-support', group: 'support',
    title: '避難行動要支援者名簿・個別避難計画の制度と資料',
    publisher: '内閣府', dateLabel: '制度解説・年度別資料',
    url: 'https://www.bousai.go.jp/taisaku/hisaisyagyousei/yoshiensha.html',
    description: '避難に支援が必要な人の名簿や、個別避難計画に関する制度・取組を掲載。制度の位置づけを知りたい本人・家族、自治体や支援関係者向けの入口です。',
    note: '対象や相談・手続きの方法は、お住まいの自治体の案内をご確認ください。',
  },
  {
    id: 'zennancho-disaster', group: 'support',
    title: '難聴者・中途失聴者の災害支援と対応マニュアル',
    publisher: '全日本難聴者・中途失聴者団体連合会', dateLabel: '2017年度のマニュアル・災害別の支援情報',
    url: 'https://www.zennancho.or.jp/info/disaster_support/',
    description: '難聴者・中途失聴者の立場から、地域の体制づくり、関係機関との連携、避難所巡回などを扱う資料を紹介しています。当事者団体の活動を知りたい人にも。',
    note: '複数の時期の情報が並び、受付を終了した案内もあります。各項目の対象災害と掲載時期をご覧ください。',
  },
  {
    id: 'jfd-noto', group: 'records',
    title: '能登半島地震・大雨での聴覚障害者支援の記録',
    publisher: '全日本ろうあ連盟', dateLabel: '2024年の災害に関する情報・活動報告',
    url: 'https://www.jfd.or.jp/noto-eq2024',
    description: '現地での支援、当事者団体の活動、その後の生活や支援拠点の再建をたどれるページ。発災直後から続く支援を知るための資料です。',
    note: '過去の時点の状況や呼びかけも残っています。個々の記事の日付と対象地域を区別してお読みください。',
  },
];
