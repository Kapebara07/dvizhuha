// Админ-страница «Штаб». Данные сервера лежат рядом зашифрованными (feed.json), расшифровываются тут паролем.
// Всё, что пришло из данных (ники, сообщения донатеров), выводится только через textContent — никакого innerHTML.
'use strict';

// Не показываться в чужом iframe.
if (window.top !== window.self) document.documentElement.textContent = '';

const REPO = 'dvizhuha-mc/dvizhuha-mc.github.io';
const PAGE = 200;
const $ = (s) => document.querySelector(s);

const SOURCE = { da: 'DonationAlerts', donatex: 'DonateX', yoomoney: 'ЮMoney', discord: 'Discord', system: 'Система' };
const TYPE = {
  donation: ['Донат', 'ok'],
  role_granted: ['Роль выдана', 'ok'],
  role_problem: ['Проблема с ролью', 'warn'],
  error: ['Ошибка', 'bad'],
  info: ['Событие', ''],
};

const dtf = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
/** Мс от эпохи или ISO-строка → «23.10.2026, 19:14:05» по Москве. */
const msk = (v) => {
  if (v == null || v === '') return '—';
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) && t > 0 ? dtf.format(t) : '—';
};
const ts = (v) => (typeof v === 'number' ? v : Date.parse(v) || 0);
const num = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
const money = (a, cur) => (!cur || cur === 'RUB' ? `${num(a)} ₽` : `${num(a)} ${cur}`);
const ago = (ms) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  if (m < 48 * 60) return `${Math.round(m / 60)} ч назад`;
  return `${Math.round(m / 1440)} дн назад`;
};

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function row(tbody, cells) {
  const tr = document.createElement('tr');
  for (const c of cells) {
    const td = document.createElement('td');
    if (c instanceof Node) td.appendChild(c);
    else if (c && typeof c === 'object') { td.textContent = c.t; if (c.cls) td.className = c.cls; if (c.title) td.title = c.title; }
    else td.textContent = c == null ? '' : String(c);
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
}
const badge = (text, cls) => el('span', text, `badge ${cls || ''}`);

// ---------- вход ----------

let feed = null;
let password = '';
let timer = null;

const store = {
  get() { try { return sessionStorage.getItem('dvz-admin-pw') || ''; } catch { return ''; } },
  set(v) { try { v ? sessionStorage.setItem('dvz-admin-pw', v) : sessionStorage.removeItem('dvz-admin-pw'); } catch { /* приватное окно */ } },
};

async function loadFeed(pw) {
  let res;
  try {
    res = await fetch(`feed.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
  } catch {
    throw Object.assign(new Error('Не получилось загрузить данные — нет связи с сайтом.'), { fatal: true });
  }
  if (res.status === 404) throw Object.assign(new Error('Данных пока нет: выгрузка ещё не настроена на сервере или сервер не отвечал при последней сборке сайта.'), { fatal: true });
  if (!res.ok) throw Object.assign(new Error(`Сайт ответил ${res.status}.`), { fatal: true });
  let blob;
  try { blob = await res.json(); } catch { throw Object.assign(new Error('Файл данных повреждён.'), { fatal: true }); }
  try {
    return await window.DvzDecrypt(blob, pw);
  } catch {
    throw new Error('Неверный пароль.');
  }
}

async function enter(pw, silent) {
  const err = $('#loginErr');
  err.hidden = true;
  $('#loginGo').disabled = true;
  try {
    feed = await loadFeed(pw);
  } catch (e) {
    $('#loginGo').disabled = false;
    if (silent && !e.fatal) { store.set(''); return; }
    err.textContent = e.message;
    err.hidden = false;
    return;
  }
  password = pw;
  store.set(pw);
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#pw').value = '';
  render();
  loadDownloads();
  clearInterval(timer);
  timer = setInterval(refresh, 5 * 60000);
}

async function refresh() {
  const btn = $('#refresh');
  btn.disabled = true;
  try {
    feed = await loadFeed(password);
    render();
    loadDownloads();
  } catch (e) {
    showWarn(`Не удалось обновить: ${e.message}`);
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  store.set('');
  password = '';
  feed = null;
  clearInterval(timer);
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginGo').disabled = false;
  $('#pw').focus();
}

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pw = $('#pw').value.trim();
  if (pw) enter(pw, false);
});
$('#refresh').addEventListener('click', refresh);
$('#logout').addEventListener('click', logout);

// ---------- вкладки ----------

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  for (const t of document.querySelectorAll('#tabs button')) t.classList.toggle('on', t === b);
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `tab-${b.dataset.tab}`;
});

// ---------- показ ----------

function showWarn(text) {
  const w = $('#warn');
  w.textContent = text || '';
  w.hidden = !text;
}

let filter = 'all';
let query = '';
let shown = PAGE;

function render() {
  const d = feed.donate || {};
  const l = feed.launcher || { total: 0, online: 0, day: 0, week: 0, users: [] };
  const events = (d.events || []).slice().sort((a, b) => ts(b.t) - ts(a.t));
  const donors = d.donors || [];

  $('#updated').textContent = `Данные сервера собраны ${msk(feed.generated)} МСК (${ago(feed.generated)}). Сайт получает их примерно раз в 10 минут.`;

  const warns = [];
  if (!feed.donate) warns.push('Мод донатов (DvizhDonate) ещё не отдал данных — донаты не видны.');
  if (Date.now() - feed.generated > 60 * 60000) warns.push('Данные старше часа — сервер не отвечал при последних сборках сайта.');
  const src = d.sources || {};
  for (const k of ['da', 'donatex', 'yoomoney']) {
    if (src[k] && src[k].configured && src[k].error) warns.push(`${SOURCE[k]}: ${src[k].error}`);
  }
  showWarn(warns.join(' · '));

  // карточки
  const donations = events.filter((e) => e.type === 'donation');
  const sum = (arr) => arr.reduce((s, e) => s + (e.rub || 0), 0);
  const monthAgo = Date.now() - 30 * 86400000;
  const sponsors = donors.filter((x) => x.role_given).length;
  const waiting = donors.filter((x) => !x.role_given && x.discord && x.total >= (d.sponsor_min_rub || 0)).length;
  const cards = $('#cards');
  cards.textContent = '';
  const card = (title, big, sub) => {
    const c = el('div', null, 'card');
    c.append(el('span', title, 'card-k'), el('b', big, 'card-v'), el('span', sub || '', 'card-s'));
    cards.appendChild(c);
  };
  card('Донаты за всё время', `${num(sum(donations))} ₽`, `${donations.length} шт.`);
  card('За 30 дней', `${num(sum(donations.filter((e) => ts(e.t) > monthAgo)))} ₽`, `${donations.filter((e) => ts(e.t) > monthAgo).length} шт.`);
  card('Спонсоры', String(sponsors), waiting ? `ждут роль: ${waiting}` : 'роль выдана');
  card('Игроков с лаунчером', String(l.total), `сейчас открыт у ${l.online}`);
  card('Заходили за сутки', String(l.day), `за неделю: ${l.week}`);

  renderLog(events);
  renderDonors(donors);
  renderLauncher(l);
  renderState(d, l);
}

function matches(e) {
  if (filter === 'donation' && e.type !== 'donation') return false;
  if (filter === 'role' && !e.type.startsWith('role_')) return false;
  if (filter === 'error' && e.type !== 'error') return false;
  if (!query) return true;
  const hay = `${e.who || ''} ${e.text || ''} ${SOURCE[e.source] || e.source || ''}`.toLowerCase();
  return hay.includes(query);
}

function renderLog(events) {
  const body = $('#logBody');
  body.textContent = '';
  const list = events.filter(matches);
  for (const e of list.slice(0, shown)) {
    const [label, cls] = TYPE[e.type] || [e.type, ''];
    let amount = '';
    if (e.type === 'donation') {
      amount = money(e.amount, e.currency);
      if (e.currency && e.currency !== 'RUB') amount += ` (≈${num(e.rub)} ₽)`;
    }
    row(body, [
      { t: msk(e.t), cls: 'nowrap mono' },
      badge(label, cls),
      e.who || '',
      { t: amount, cls: 'num mono nowrap' },
      SOURCE[e.source] || e.source || '',
      { t: e.text || '', cls: 'wide' },
    ]);
  }
  $('#logEmpty').hidden = list.length > 0;
  $('#logMore').hidden = list.length <= shown;
}

function renderDonors(donors) {
  const body = $('#donorBody');
  body.textContent = '';
  const list = donors.slice().sort((a, b) => b.total - a.total);
  for (const x of list) {
    let role;
    if (x.role_given) role = badge('выдана', 'ok');
    else if (!x.discord) role = badge('нет Discord в донате', 'warn');
    else if (x.problem) role = badge(x.problem, 'warn');
    else role = badge('ещё нет', '');
    row(body, [x.who, { t: num(x.total), cls: 'num mono' }, { t: String(x.count), cls: 'num mono' },
      { t: msk(x.first), cls: 'nowrap mono' }, { t: msk(x.last), cls: 'nowrap mono' }, role]);
  }
  $('#donorEmpty').hidden = list.length > 0;
}

function renderLauncher(l) {
  $('#launcherNote').textContent = 'Считаются игроки, чей лаунчер версии 1.4 и новее хотя бы раз связался с сервером (друзья). '
    + 'Старые версии и лаунчеры, ни разу не открытые после обновления, здесь не видны. Один человек с двумя никами — две строки.';
  const body = $('#userBody');
  body.textContent = '';
  const now = Date.now();
  for (const u of l.users) {
    let st;
    if (u.seen && now - u.seen < 2 * 60000) st = badge('открыт сейчас', 'ok');
    else if (u.seen) st = el('span', ago(u.seen));
    else st = el('span', 'нет данных', 'muted');
    row(body, [u.nick, { t: msk(u.created), cls: 'nowrap mono' }, { t: msk(u.seen), cls: 'nowrap mono' }, st]);
  }
  $('#userEmpty').hidden = l.users.length > 0;
}

function renderState(d, l) {
  const body = $('#stateBody');
  body.textContent = '';
  const src = d.sources || {};
  for (const k of ['da', 'donatex', 'yoomoney', 'discord']) {
    const s = src[k];
    if (!s) { row(body, [SOURCE[k], '—', '—', '']); continue; }
    row(body, [SOURCE[k], s.configured ? badge('да', 'ok') : badge('нет', 'warn'), { t: msk(s.last_poll), cls: 'nowrap mono' },
      { t: s.error || '', cls: s.error ? 'bad-text wide' : 'wide' }]);
  }
  $('#stateNote').textContent = `Минимальная сумма для роли «Спонсор»: ${num(d.sponsor_min_rub || 0)} ₽ (валюта пересчитывается по курсу из config.json мода). `
    + `Лаунчеров в базе: ${l.total}.`;
}

$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !feed) return;
  filter = b.dataset.f;
  shown = PAGE;
  for (const x of $('#chips').children) x.classList.toggle('on', x === b);
  render();
});
$('#q').addEventListener('input', () => { query = $('#q').value.trim().toLowerCase(); shown = PAGE; if (feed) render(); });
$('#logMore').addEventListener('click', () => { shown += PAGE; render(); });

// ---------- скачивания (публичное API GitHub, без пароля) ----------

async function loadDownloads() {
  const note = $('#dlNote');
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(String(res.status));
    const rels = (await res.json()).filter((r) => !r.draft);
    const body = $('#dlBody');
    body.textContent = '';
    let total = 0;
    for (const r of rels) {
      const n = (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0);
      total += n;
      const files = (r.assets || []).filter((a) => a.download_count).map((a) => `${a.name.replace(/^Dvizhuha-Launcher-?/, '')}: ${a.download_count}`).join(' · ');
      row(body, [r.tag_name, { t: msk(r.published_at), cls: 'nowrap mono' }, { t: String(n), cls: 'num mono' }, { t: files, cls: 'wide' }]);
    }
    note.textContent = `Всего скачиваний со всех релизов: ${total}. В счёт входят и автообновления лаунчера, так что это не число людей.`;
    $('#dlWrap').hidden = rels.length === 0;
  } catch {
    note.textContent = 'Счётчик скачиваний с GitHub не загрузился (нет связи или лимит запросов) — попробуй позже.';
  }
}

// ---------- старт ----------

{
  const saved = store.get();
  if (saved) enter(saved, true);
}
