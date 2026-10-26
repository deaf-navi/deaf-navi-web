(() => {
  const text = document.querySelector('#inquiry-text');
  const room = document.querySelector('#inquiry-room');
  const communication = document.querySelector('#inquiry-communication');
  const button = document.querySelector('[data-copy-inquiry]');
  const status = document.querySelector('[data-inquiry-status]');
  const controls = document.querySelector('[data-inquiry-controls]');
  if (!text || !room || !communication || !button || !status || !controls) return;
  const template = text.value;
  const update = () => {
    text.value = template.replace('［個室／相部屋］', room.value || '［個室／相部屋］')
      .replace('［手話／筆談］', communication.value || '［手話／筆談］');
    status.textContent = '選んだ内容を問い合わせ文に反映しました。';
  };
  controls.hidden = false;
  button.hidden = false;
  room.addEventListener('change', update);
  communication.addEventListener('change', update);
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'コピーしています…';
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'コピーしました。日付・泊数・人数を記入してお使いください。';
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
