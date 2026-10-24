// Забирает с игрового сервера зашифрованную выгрузку для админ-страницы (мод DvizhFriends, GET /dvz/admin/feed)
// и кладёт её в admin/feed.json. Файл уже зашифрован паролем админов, поэтому лежать на публичном сайте ему можно,
// а секретов в Actions не нужно. Сервер не ответил — оставляем то, что сейчас опубликовано (если оно есть).
// Запускается в GitHub Actions раз в ~10 минут вместе с fetch-status.mjs.
import http from 'node:http';
import https from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';

// Порт HTTP-интерфейса мода DvizhFriends: игровой 32331, если хостинг пропускает HTTP через него; иначе выделенный порт
// (http_port в dvizhfriends/config.json на сервере).
const HTTP_PORT = 22263;
const SERVER = { host: '45.157.232.7', port: HTTP_PORT, path: '/dvz/admin/feed' };
const LIVE = 'https://dvizhuha-mc.github.io/admin/feed.json';

function get(mod, opts, timeout) {
  return new Promise((resolve, reject) => {
    const req = mod.get(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function valid(text) {
  try {
    const j = JSON.parse(text);
    return j.v === 1 && typeof j.salt === 'string' && typeof j.iv === 'string' && typeof j.ct === 'string';
  } catch { return false; }
}

async function fromServer() {
  const r = await get(http, { ...SERVER, headers: { Accept: 'application/json' } }, 15000);
  if (r.status !== 200 || !valid(r.body)) throw new Error(`сервер ответил ${r.status}`);
  return r.body;
}

async function fromLive() {
  const r = await get(https, LIVE, 15000);
  if (r.status !== 200 || !valid(r.body)) throw new Error(`сайт ответил ${r.status}`);
  return r.body;
}

let body = null;
try {
  body = await fromServer();
  console.log('выгрузка с сервера получена,', body.length, 'байт');
} catch (e) {
  console.log('сервер не отдал выгрузку:', e.message);
  try {
    body = await fromLive();
    console.log('оставляю опубликованную раньше');
  } catch (e2) {
    console.log('опубликованной тоже нет:', e2.message);
  }
}
if (body) {
  mkdirSync('admin', { recursive: true });
  writeFileSync('admin/feed.json', body);
}
