(() => {
  const text = document.querySelector('#inquiry-text');
  const room = document.querySelector('#inquiry-room');
  const communication = document.querySelector('#inquiry-communication');
  const children = document.querySelector('#inquiry-children');
  const button = document.querySelector('[data-copy-inquiry]');
  const status = document.querySelector('[data-inquiry-status]');
  const controls = document.querySelector('[data-inquiry-controls]');
  if (!text || !room || !communication || !children || !button || !status || !controls) return;
  const template = text.value;
  const update = () => {
    const valid = children.validity.valid;
    children.setAttribute('aria-invalid', String(!valid));
    let draft = template;
    if (valid && children.value !== '') {
      const count = Number(children.value);
      draft = draft.replace('・子ども○名', count === 0 ? '' : `・子ども${count}名`)
        .replace('子どもがいる場合の年齢：○歳。', count === 0 ? '' : '子どもの年齢：○歳。');
    }
    draft = room.value === '指定なし'
      ? draft.replace('部屋は［個室／相部屋／指定なし］を希望します。', '部屋の種類に指定はありません。')
      : draft.replace('［個室／相部屋／指定なし］', room.value || '［個室／相部屋／指定なし］');
    text.value = communication.value === 'どれでも可'
      ? draft.replace('当日のやりとりは［手話／筆談／口話／音声認識アプリ／どれでも可］を希望します。', '会話の方法に指定はありません。')
      : draft.replace('［手話／筆談／口話／音声認識アプリ／どれでも可］', communication.value || '［手話／筆談／口話／音声認識アプリ／どれでも可］');
    status.textContent = valid ? '選んだ内容を問い合わせ文に反映しました。' : '子どもの人数は0〜99の整数で入力してください。文面の人数は「○名」のままです。';
  };
  controls.hidden = false;
  button.hidden = false;
  room.addEventListener('change', update);
  communication.addEventListener('change', update);
  children.addEventListener('input', update);
  button.addEventListener('click', async () => {
    if (!children.reportValidity()) { update(); return; }
    button.disabled = true;
    status.textContent = 'コピーしています…';
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'コピーしました。日付・泊数・大人の人数、必要なら子どもの年齢も記入してお使いください。';
    } catch {
      text.focus();
      text.select();
      text.setSelectionRange(0, text.value.length);
      status.textContent = '自動でコピーできませんでした。選択された文章を、端末のコピー操作でコピーしてください。';
    } finally {
      button.disabled = false;
    }
  });
})();
