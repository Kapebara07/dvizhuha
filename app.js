// Сайт не должен открываться внутри чужой страницы (кликджекинг): GitHub Pages не даёт поставить заголовок, поэтому так.
if (window.top !== window.self) {
  document.body.textContent = 'Официальный сайт: https://dvizhuha-mc.github.io';
  try { window.top.location.replace(window.location.href); } catch { /* песочница не пустила — страница уже пустая */ }
  throw new Error('framed');
}

const HOST = '185.137.233.193:25661';
// Браузер не умеет пинговать Minecraft-сервер, поэтому онлайн берём у публичных сервисов.
// Оба за Cloudflare: в РФ могут не открыться — тогда табло так и скажет, скачиванию это не мешает.
const SOURCES = [
  { url: `https://api.mcstatus.io/v2/status/java/${HOST}`, read: (j) => ({ online: j.online, count: j.players?.online, max: j.players?.max, names: (j.players?.list || []).map((p) => p.name_clean) }) },
  { url: `https://api.mcsrvstat.us/3/${HOST}`, read: (j) => ({ online: j.online, count: j.players?.online, max: j.players?.max, names: (j.players?.list || []).map((p) => p.name) }) },
];

const $ = (s) => document.querySelector(s);

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(HOST);
    toast('Адрес скопирован');
  } catch {
    getSelection().selectAllChildren($('#addr'));
    toast('Выделил адрес, нажми Ctrl+C');
  }
});


// Выбор системы по кнопке «Скачать лаунчер». Без JS ссылка просто качает версию для Windows.
function detectOs() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
  if (p.includes('mac')) return 'mac';
  if (p.includes('linux') && !/android/.test(navigator.userAgent.toLowerCase())) return 'linux';
  if (p.includes('win')) return 'windows';
  return null;
}
const osDialog = $('#osDialog');
const myOs = detectOs();
if (myOs) {
  const sec = osDialog.querySelector(`[data-os="${myOs}"]`);
  sec.classList.add('mine');
  sec.querySelector('.os-btn').classList.add('pick');
}
// Chrome на Mac умеет сказать, какой процессор: на Intel подсвечиваем вторую кнопку.
navigator.userAgentData?.getHighEntropyValues?.(['architecture']).then((v) => {
  if (myOs !== 'mac' || !v.architecture) return;
  const arm = v.architecture.startsWith('arm');
  osDialog.querySelector('[data-arch="arm"]').classList.toggle('pick', arm);
  osDialog.querySelector('[data-arch="intel"]').classList.toggle('pick', !arm);
}).catch(() => {});
$('#download').addEventListener('click', (e) => {
  if (typeof osDialog.showModal !== 'function') return; // совсем старый браузер — пусть качает по ссылке
  e.preventDefault();
  osDialog.showModal();
});
osDialog.addEventListener('click', (e) => { if (e.target === osDialog) osDialog.close(); });
osDialog.querySelectorAll('.os-btn').forEach((a) => a.addEventListener('click', () => setTimeout(() => osDialog.close(), 300)));

// ---------- Поддержать сервер: своё окно, сама оплата — на Boosty ----------
const donateDialog = $('#donateDialog');
const boostyRaw = (donateDialog.dataset.boosty || '').trim().replace(/\/+$/, '');
// Пока ссылки на Boosty нет, окно работает, но вместо оплаты пишет, что она ещё не подключена.
const boosty = /^https:\/\/boosty\.to\/[A-Za-z0-9_.-]+$/.test(boostyRaw) ? boostyRaw : '';
{
  const perk = (donateDialog.dataset.perk || '').trim();
  if (perk) { $('#dnPerk').textContent = perk; $('#dnPerk').hidden = false; }
  let amount = 300;
  const NICK = /^[A-Za-z0-9_]{3,16}$/;
  const setAmount = (a) => {
    amount = a;
    $('#dnAmounts').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.a) === a));
  };
  $('#dnAmounts').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $('#dnOwn').value = '';
    setAmount(Number(b.dataset.a));
  });
  $('#dnOwn').addEventListener('input', () => {
    const v = Math.round(Number($('#dnOwn').value));
    if (v >= 10) setAmount(v);
  });
  $('#dnNick').addEventListener('input', () => {
    const v = $('#dnNick').value.trim();
    const bad = v && !NICK.test(v);
    $('#dnNick').classList.toggle('bad', !!bad);
    $('#dnNickHint').classList.toggle('bad', !!bad);
    $('#dnNickHint').textContent = bad ? 'Латиница, цифры и _, от 3 до 16 знаков — как в игре.' : 'Можно не писать, если бонус не нужен.';
  });
  $('#dnGo').addEventListener('click', () => {
    const nick = $('#dnNick').value.trim();
    if (nick && !NICK.test(nick)) { $('#dnNick').focus(); return; }
    if (!boosty) {
      $('#dnError').hidden = false;
      return;
    }
    const msg = nick ? `Ник: ${nick}` : '';
    const url = `${boosty}/donate`;
    // Копируем, пока вкладка в фокусе (потом фокус уйдёт на Boosty и браузер не даст), ждать не нужно.
    if (msg) navigator.clipboard?.writeText(msg).catch(() => { /* текст всё равно показан ниже */ });
    window.open(url, '_blank', 'noopener');
    $('#dnSum').textContent = `${amount} ₽`;
    $('#dnMsg').textContent = msg;
    $('#dnMsgStep').hidden = !msg;
    $('#dnLink').href = url;
    $('#dnForm').hidden = true;
    $('#dnAfter').hidden = false;
  });
  $('#dnBack').addEventListener('click', () => { $('#dnAfter').hidden = true; $('#dnForm').hidden = false; });
  $('#donateOpen').hidden = false;
  $('#donateOpen').addEventListener('click', () => {
    $('#dnAfter').hidden = true;
    $('#dnForm').hidden = false;
    $('#dnError').hidden = true;
    if (typeof donateDialog.showModal === 'function') donateDialog.showModal();
    else if (boosty) window.open(`${boosty}/donate`, '_blank', 'noopener');
  });
  donateDialog.addEventListener('click', (e) => { if (e.target === donateDialog) donateDialog.close(); });
}

const mirror = $('#mirror');
if (mirror.dataset.href) {
  $('#mirrorLink').href = mirror.dataset.href;
  mirror.hidden = false;
}

function renderFlaps(text) {
  const box = $('#count');
  const padded = text.padStart(2, ' ');
  const old = [...box.children].map((c) => c.textContent).join('');
  if (old === padded) return;
  box.innerHTML = '';
  [...padded].forEach((ch, i) => {
    const f = document.createElement('span');
    f.className = 'flap' + (old[i] !== ch ? ' turn' : '');
    f.textContent = ch;
    box.append(f);
  });
}

function render(s) {
  const lamp = $('#lamp');
  const list = $('#players');
  const note = $('#note');
  list.innerHTML = '';
  note.textContent = '';
  if (!s) {
    lamp.className = 'lamp';
    $('#statusText').textContent = 'онлайн не загрузился';
    renderFlaps('--');
    $('#max').textContent = '';
    note.textContent = 'Сервис, который считает игроков, сейчас недоступен. Кто на сервере, видно в самом лаунчере.';
    return;
  }
  if (!s.online) {
    lamp.className = 'lamp off';
    $('#statusText').textContent = 'сервер не отвечает';
    renderFlaps('--');
    $('#max').textContent = '';
    note.textContent = 'Скорее всего, перезапуск. Обычно это ненадолго.';
    return;
  }
  lamp.className = 'lamp on';
  $('#statusText').textContent = 'сервер работает';
  renderFlaps(String(s.count ?? 0));
  $('#max').textContent = s.max ? `из ${s.max}` : '';
  if (!s.count) {
    note.textContent = 'Сейчас никого. Зайдёшь первым?';
    return;
  }
  for (const name of [...s.names].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }))) {
    const row = document.createElement('div');
    row.className = 'row';
    row.textContent = name;
    row.title = name;
    list.append(row);
  }
  const hidden = s.count - s.names.length;
  if (hidden > 0) note.textContent = `И ещё ${hidden}: сервер называет не больше 12 ников за раз.`;
  else if (s.at) note.textContent = `Обновлено ${ago(s.at)}.`;
}

function ago(sec) {
  const m = Math.max(0, Math.round((Date.now() / 1000 - sec) / 60));
  return m < 1 ? 'только что' : `${m} мин назад`;
}

// status.json кладёт рядом с сайтом GitHub раз в ~10 минут: там все игроки и статистика.
// Он лежит на этом же адресе, поэтому открывается и там, где режут сторонние сервисы.
async function fetchOwnStatus() {
  try {
    const r = await fetch(`status.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.at || Date.now() / 1000 - j.at > 40 * 60) return null; // старше 40 минут — не доверяем
    return j;
  } catch { return null; }
}

let statsData = null;
async function fetchStatus() {
  const own = await fetchOwnStatus();
  if (own) {
    statsData = own;
    renderStats();
    return own.online ? { online: true, count: own.count, max: own.max, names: own.players || [], at: own.at } : { online: false };
  }
  renderStats();
  for (const src of SOURCES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(src.url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!r.ok) continue;
      return src.read(await r.json());
    } catch { /* следующий источник */ }
  }
  return null;
}

// ---------- Статистика: убийства игроков и смерти (из мода dvizhstats через status.json) ----------
let statsSort = 'kills';
let statsAll = false;
const STATS_SHORT = 15;

function renderStats() {
  const body = $('#statsBody');
  const more = $('#statsMore');
  body.innerHTML = '';
  more.hidden = true;
  const empty = (t) => { const p = document.createElement('p'); p.className = 'st-empty'; p.textContent = t; body.append(p); };
  const s = statsData;
  if (!s) { empty('Статистика не загрузилась. Она видна и в самом лаунчере — кнопка «Статистика».'); return; }
  if (!s.stats) { empty('Статистика появится после ближайшего обновления сервера.'); return; }
  if (s.statsAt) $('#statsUpd').textContent = `Обновлено ${ago(s.statsAt)}. Обновляется раз в 10 минут.`;
  const key = statsSort === 'kills' ? 1 : 2;
  const other = key === 1 ? 2 : 1;
  const ranked = [...s.stats].sort((a, b) => b[key] - a[key] || b[other] - a[other] || a[0].localeCompare(b[0]))
    .map((r, i) => ({ place: i + 1, name: r[0], kills: r[1], deaths: r[2] }));
  const q = $('#statsFind').value.trim().toLowerCase();
  let rows = q ? ranked.filter((r) => r.name.toLowerCase().includes(q)) : ranked;
  if (!rows.length) { empty(q ? 'Такого ника в статистике нет.' : 'Пока никто никого не убил и никто не умер.'); return; }
  if (!q && !statsAll && rows.length > STATS_SHORT) {
    more.hidden = false;
    more.textContent = `Показать всех (${rows.length})`;
    rows = rows.slice(0, STATS_SHORT);
  }
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'st-row' + (r.place <= 3 && (key === 1 ? r.kills : r.deaths) > 0 ? ' top' : '');
    row.setAttribute('role', 'row');
    const cell = (t, cls) => { const c = document.createElement('span'); c.textContent = t; if (cls) c.className = cls; row.append(c); };
    cell(String(r.place), 'n');
    cell(r.name, 'who');
    cell(String(r.kills), r.kills ? '' : 'zero');
    cell(String(r.deaths), r.deaths ? '' : 'zero');
    body.append(row);
  }
}

$('#statsSort').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  statsSort = b.dataset.v;
  $('#statsSort').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  renderStats();
});
$('#statsFind').addEventListener('input', renderStats);
$('#statsMore').addEventListener('click', () => { statsAll = true; renderStats(); });

async function tick() {
  render(await fetchStatus());
}
tick();
setInterval(() => { if (!document.hidden) tick(); }, 60000);
