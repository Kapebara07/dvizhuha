// Расшифровка выгрузки сервера: PBKDF2-SHA256 (пароль → ключ) и AES-256-GCM, всё средствами браузера (WebCrypto).
// Формат файла feed.json: {v:1, salt, iter, iv, ct} (base64); ct = шифртекст + тег. Ключ делает tools/make-admin-key.mjs
// тем же PBKDF2, поэтому из пароля в браузере получается тот же ключ, что лежит на сервере.
(function (g) {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function decryptFeed(blob, password) {
    if (!blob || blob.v !== 1 || !blob.salt || !blob.iv || !blob.ct) throw new Error('format');
    const iter = Number(blob.iter);
    if (!(iter >= 100000 && iter <= 2000000)) throw new Error('format');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(blob.salt), iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    // Неверный пароль → тег не сойдётся → decrypt бросит OperationError.
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  g.DvzDecrypt = decryptFeed;
})(typeof window !== 'undefined' ? window : globalThis);
