'use strict';
/**
 * Kimlik dogrulama.
 *
 *  · Sifre  : scrypt (Node'un kendi crypto modulu) + rastgele tuz. Duz sifre
 *             hicbir yerde saklanmaz, loglanmaz.
 *  · Oturum : cereze rastgele 32 bayt jeton konur; veritabaninda jetonun
 *             HMAC-SHA256 ozeti durur. Veritabani calinsa bile jeton uretilemez.
 *  · CSRF   : her oturuma ozel jeton, butun POST formlarinda dogrulanir.
 *  · Kaba kuvvet: IP basina deneme sayaci + fail2ban icin ayri log dosyasi.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { users, sessions, attempts } = require('./db');

const COOKIE = 'aa_sess';
const CSRF_COOKIE = 'aa_csrf';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* ── sifre ───────────────────────────────────────────────────────────────── */

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(plain), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 96 * 1024 * 1024 });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

function verifyPassword(plain, stored) {
  try {
    const [alg, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = crypto.scryptSync(String(plain), salt, expected.length,
      { N: Number(N), r: Number(r), p: Number(p), maxmem: 96 * 1024 * 1024 });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ── kayit (fail2ban bu dosyayi izler) ───────────────────────────────────── */

let logStream = null;
function authLog(line) {
  const msg = `${new Date().toISOString()} okuryazar ${line}\n`;
  try {
    if (!logStream) {
      fs.mkdirSync(path.dirname(config.authLog), { recursive: true });
      logStream = fs.createWriteStream(config.authLog, { flags: 'a' });
      logStream.on('error', () => { logStream = null; });
    }
    logStream.write(msg);
  } catch { /* log yazilamiyorsa site calismaya devam etsin */ }
  if (!config.isProd) process.stdout.write(msg);
}

/* ── oturum ──────────────────────────────────────────────────────────────── */

const sid = (token) => crypto.createHmac('sha256', config.sessionSecret || 'gelistirme').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,               // JavaScript cerezi okuyamaz (XSS'e karsi)
    secure: config.secureCookies, // yalnizca HTTPS uzerinden gonderilir
    sameSite: 'strict',           // baska siteden gelen isteklerde gonderilmez
    path: '/',
    maxAge: maxAgeMs,
  };
}

function startSession(res, username, ip, ua) {
  const token = newToken();
  const csrf = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86400e3;
  sessions.create(sid(token), username, csrf, Date.now() + maxAge, ip || '', String(ua || '').slice(0, 300));
  res.cookie(COOKIE, token, cookieOptions(maxAge));
  res.clearCookie(CSRF_COOKIE, { ...cookieOptions(0), maxAge: undefined });
  return csrf;
}

function endSession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) sessions.destroy(sid(token));
  res.clearCookie(COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

/** Her istekte calisir: gecerli oturum varsa req.user / req.csrf doldurulur. */
function attachSession(req, res, next) {
  req.user = null;
  req.csrf = '';
  const token = req.cookies?.[COOKIE];
  if (token) {
    const row = sessions.get(sid(token));
    if (row) {
      req.user = { username: row.username };
      req.csrf = row.csrf;
      req.sessionId = row.id;
      // Kayan sure: oturum kullanildikca uzar, atil kalirsa duser.
      const maxAge = config.sessionDays * 86400e3;
      const remaining = row.expires_at - Date.now();
      if (remaining < maxAge * 0.5) {
        sessions.touch(row.id, Date.now() + maxAge);
        res.cookie(COOKIE, token, cookieOptions(maxAge));
      }
    } else {
      res.clearCookie(COOKIE, { ...cookieOptions(0), maxAge: undefined });
    }
  }

  // Henuz giris yapmamis ziyaretcinin de bir CSRF jetonu olmali; giris formu
  // da korunuyor. Klasik "double submit cookie": jeton hem httpOnly cerezde
  // hem gizli form alaninda gelir, ikisi esitse istek kabul edilir. Cerez
  // SameSite=Strict oldugundan baska bir site bu istegi tetikleyemez.
  if (!req.user) {
    let anon = req.cookies?.[CSRF_COOKIE];
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(anon || ''))) {
      anon = crypto.randomBytes(32).toString('base64url');
      res.cookie(CSRF_COOKIE, anon, cookieOptions(12 * 3600e3));
    }
    req.csrf = anon;
  }

  res.locals.loggedIn = !!req.user;
  res.locals.csrf = req.csrf;
  next();
}

/** Panel ve editor icin kapi bekcisi. */
function requireLogin(req, res, next) {
  if (req.user) return next();
  const back = encodeURIComponent(req.originalUrl.startsWith('/panel') ? req.originalUrl : '/panel');
  return res.redirect(302, '/giris?devam=' + back);
}

/* ── CSRF ────────────────────────────────────────────────────────────────── */

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Butun degistirici (POST) isteklerde oturum jetonunu dogrular. */
function verifyCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const sent = req.body?._csrf || req.get('x-csrf-token') || '';
  if (req.csrf && safeEqual(sent, req.csrf)) return next();
  authLog(`CSRF-REJECT ${req.method} ${req.originalUrl} ip=${req.ip}`);
  if (req.get('accept')?.includes('application/json')) {
    return res.status(403).json({ ok: false, hata: 'Oturum doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.' });
  }
  return res.status(403).render('hata', {
    kod: 403,
    baslik: 'Oturum doğrulaması başarısız',
    mesaj: 'Güvenlik jetonu geçersiz ya da süresi dolmuş. Sayfayı yenileyip tekrar deneyin.',
    sayfa: { baslik: 'Güvenlik uyarısı — ' + config.siteName, aciklama: '', yol: req.path, indeksle: false },
  });
}

/* ── kaba kuvvet ─────────────────────────────────────────────────────────── */

const LOCK_WINDOW_MS = 15 * 60e3;
const LOCK_AFTER = 5;

function loginLock(ip) {
  const n = attempts.recent(ip, LOCK_WINDOW_MS);
  if (n < LOCK_AFTER) return null;
  return { tries: n, minutes: Math.ceil(LOCK_WINDOW_MS / 60e3) };
}

function noteFailure(ip, username) {
  attempts.add(ip);
  authLog(`FAILED-LOGIN user=${JSON.stringify(String(username).slice(0, 60))} ip=${ip}`);
}

function noteSuccess(ip, username) {
  attempts.clear(ip);
  authLog(`LOGIN-OK user=${JSON.stringify(username)} ip=${ip}`);
}

module.exports = {
  COOKIE, CSRF_COOKIE, hashPassword, verifyPassword, authLog,
  startSession, endSession, attachSession, requireLogin,
  verifyCsrf, safeEqual, loginLock, noteFailure, noteSuccess,
  ensureAdmin(username, plain) {
    users.upsert(username, hashPassword(plain));
  },
};
