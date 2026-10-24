// Пингует сервер Движухи и пишет status.json для сайта: онлайн, полный список игроков и статистику
// (поле "dvizhuha" добавляет серверный мод dvizhstats). Запускается в GitHub Actions раз в ~10 минут.
import net from 'node:net';
import { writeFileSync } from 'node:fs';

const HOST = '45.157.232.7';
const PORT = 32331;

function varint(n) {
  const out = [];
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
  return Buffer.from(out);
}
function readVarint(buf, off) {
  let v = 0, i = 0;
  for (;;) {
    if (off + i >= buf.length) return null;
    const b = buf[off + i];
    v |= (b & 0x7f) << (7 * i); i++;
    if (!(b & 0x80)) return { value: v, offset: off + i };
    if (i > 5) throw new Error('bad varint');
  }
}
function ping(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, HOST);
    const done = (e, v) => { sock.destroy(); clearTimeout(t); e ? reject(e) : resolve(v); };
    const t = setTimeout(() => done(new Error('timeout')), timeout);
    sock.on('connect', () => {
      const h = Buffer.from(HOST); const p = Buffer.alloc(2); p.writeUInt16BE(PORT);
      const hs = Buffer.concat([varint(0), varint(767), varint(h.length), h, p, varint(1)]);
      sock.write(Buffer.concat([varint(hs.length), hs, Buffer.from([1, 0])]));
    });
    let buf = Buffer.alloc(0);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const len = readVarint(buf, 0);
      if (!len || buf.length < len.offset + len.value) return;
      const id = readVarint(buf, len.offset);
      const sl = readVarint(buf, id.offset);
      try { done(null, JSON.parse(buf.subarray(sl.offset, sl.offset + sl.value).toString('utf8'))); } catch (e) { done(e); }
    });
    sock.on('error', done);
  });
}

const okName = (n) => typeof n === 'string' && n.length > 0 && n.length <= 16;
let out = { at: Math.floor(Date.now() / 1000), online: false };
for (let attempt = 0; attempt < 3 && !out.online; attempt++) {
  try {
    const j = await ping();
    const dz = j.dvizhuha && typeof j.dvizhuha === 'object' ? j.dvizhuha : null;
    const full = Array.isArray(dz?.players) ? dz.players.filter(okName) : null;
    const count = j.players?.online ?? 0;
    const sampleOf = (x) => (x.players?.sample || []).map((p) => p.name).filter((n) => okName(n) && !n.startsWith('§'));
    let players = full;
    if (!players) {
      // Без мода сервер называет 12 случайных ников за пинг — собираем всех за несколько пингов.
      const seen = new Set(sampleOf(j));
      // Выборка меняется не на каждом пинге (сервер и Krypton держат ответ в кэше), поэтому собираем около полутора минут.
      for (let k = 0; k < 30 && seen.size < count; k++) {
        await new Promise((r) => setTimeout(r, 3000));
        try { for (const n of sampleOf(await ping())) seen.add(n); } catch { /* следующий */ }
      }
      players = [...seen];
    }
    out = {
      at: Math.floor(Date.now() / 1000),
      online: true,
      count,
      max: j.players?.max ?? 0,
      exact: !!full || players.length >= count,
      players: players.sort((a, b) => a.localeCompare(b)),
      stats: Array.isArray(dz?.stats) ? dz.stats.filter((r) => Array.isArray(r) && okName(r[0]) && Number.isInteger(r[1]) && Number.isInteger(r[2])).slice(0, 500) : null,
      statsAt: Number.isInteger(dz?.statsAt) ? dz.statsAt : null,
    };
  } catch (e) {
    console.log('пинг не удался:', e.message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
writeFileSync('status.json', JSON.stringify(out));
console.log(out.online ? `онлайн ${out.count}/${out.max}, ников ${out.players.length}${out.exact ? ' (все)' : ''}, статистика: ${out.stats ? out.stats.length + ' строк' : 'нет'}` : 'сервер не ответил');
