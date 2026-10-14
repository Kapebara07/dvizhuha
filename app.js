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
}

async function fetchStatus() {
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

async function tick() {
  render(await fetchStatus());
}
tick();
setInterval(() => { if (!document.hidden) tick(); }, 60000);
