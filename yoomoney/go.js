// Код из адреса → скрипт на этом компьютере (он слушает 127.0.0.1:53682). Код одноразовый и живёт меньше минуты.
const q = new URLSearchParams(location.search);
const code = q.get('code');
const error = q.get('error');
const msg = document.getElementById('msg');
history.replaceState(null, '', location.pathname); // не оставлять код в истории браузера
if (error) {
  msg.textContent = error === 'access_denied'
    ? 'Доступ не выдан — нажата кнопка «Отказать». Запусти скрипт ещё раз.'
    : `ЮMoney вернул ошибку: ${error}. Запусти скрипт ещё раз.`;
} else if (code && /^[A-Za-z0-9._~-]{8,1024}$/.test(code)) {
  document.getElementById('code').textContent = code;
  setTimeout(() => { document.getElementById('manual').hidden = false; }, 4000);
  location.replace(`http://127.0.0.1:53682/?code=${encodeURIComponent(code)}`);
} else {
  msg.textContent = 'Эта страница нужна только при подключении ЮMoney к серверу.';
}
