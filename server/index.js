'use strict';
/**
 * Ali Arslan — okuryazar.blog
 * Express sunucusu. nginx'in arkasinda 127.0.0.1 uzerinde dinler; disari
 * yalnizca 80/443 acilir (bkz. deploy/ dizini).
 */
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const fs = require('node:fs');
const crypto = require('node:crypto');
const config = require('./config');
const dbmod = require('./db');
const auth = require('./auth');
const flash = require('./flash');

const app = express();

/* ── temel ayarlar ───────────────────────────────────────────────────────── */

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);       // nginx'in ilettigi gercek IP
app.set('view engine', 'ejs');
app.set('views', config.viewsDir);
app.set('etag', 'strong');
app.set('query parser', 'simple');

/* ── guvenlik basliklari ─────────────────────────────────────────────────── */

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      // Sayfada satir ici script/style YOKTUR; bu yuzden 'unsafe-inline'
      // gerekmez. XSS'e karsi en guclu ayar budur.
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
      manifestSrc: ["'self'"],
      ...(config.secureCookies ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  xFrameOptions: { action: 'deny' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: config.secureCookies
    ? { maxAge: 31536000, includeSubDomains: true, preload: false }
    : false,
}));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  next();
});

app.use(compression());

/* ── genel hiz siniri (yavaslatici degil, sel kesici) ────────────────────── */

app.use(rateLimit({
  windowMs: 60e3,
  limit: 300,                       // dakikada 300 istek / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' && /^\/(css|js|fonts|assets|uploads)\//.test(req.path),
}));

/* ── statik dosyalar ─────────────────────────────────────────────────────────
   Uretimde bunlari nginx dogrudan servis eder; buradaki tanimlar hem
   gelistirme icin hem de nginx'siz calistirmak isteyenler icin durur.
   Oturum/cerez katmanindan ONCE durur: statik dosyalar cerezsiz gider.       */

const statikAyar = { maxAge: '30d', etag: true, redirect: false, dotfiles: 'ignore' };
app.use('/css', express.static(path.join(config.publicDir, 'css'), statikAyar));
app.use('/js', express.static(path.join(config.publicDir, 'js'), statikAyar));
app.use('/fonts', express.static(path.join(config.publicDir, 'fonts'), { ...statikAyar, maxAge: '365d', immutable: true }));
app.use('/assets', express.static(path.join(config.publicDir, 'assets'), { ...statikAyar, maxAge: '365d' }));
app.use('/uploads', express.static(config.uploadDir, {
  ...statikAyar, maxAge: '365d', index: false,
  setHeaders: (res) => {
    // Yuklenen dosyalar hicbir kosulda calistirilabilir icerik olarak yorumlanmasin.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));
for (const ad of ['favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'favicon.ico']) {
  app.get('/' + ad, (req, res) => res.sendFile(path.join(config.publicDir, ad), (e) => { if (e) res.status(404).end(); }));
}

/* ── govde, cerezler, oturum ─────────────────────────────────────────────── */

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(flash.middleware);
app.use(auth.attachSession);

/* ── varlik surumu ────────────────────────────────────────────────────────────
   CSS/JS dosyalarinin icerigini ozetleyip adresin sonuna ?s=... olarak
   ekliyoruz. Boylece nginx bu dosyalari uzun sure onbellekte tutabilir ama
   siteyi guncellediginizde ziyaretcilerin tarayicisi yeni surumu hemen alir. */

const varlikSurumu = (() => {
  const ozet = crypto.createHash('sha256');
  for (const alt of ['css', 'js']) {
    const dizin = path.join(config.publicDir, alt);
    for (const ad of fs.readdirSync(dizin).sort()) {
      ozet.update(ad).update(fs.readFileSync(path.join(dizin, ad)));
    }
  }
  return ozet.digest('hex').slice(0, 10);
})();

/* ── her sayfada gecerli degiskenler ─────────────────────────────────────── */

app.use((req, res, next) => {
  res.locals.surum = varlikSurumu;
  res.locals.site = {
    url: config.siteUrl,
    name: config.siteName,
    title: config.siteTitle,
    desc: config.siteDesc,
    mode: config.varsayilanTema,
    sepya: config.kapaklarSepya,
  };
  res.locals.sayfa = { baslik: config.siteTitle, aciklama: config.siteDesc, yol: req.path };
  res.locals.sayfaScript = '';
  next();
});

// Gorsel yukleme kendi CSRF kontrolunu yapar (multipart govde multer'dan sonra okunur).
app.use((req, res, next) => (req.path === '/panel/gorsel' ? next() : auth.verifyCsrf(req, res, next)));

/* ── yollar ──────────────────────────────────────────────────────────────── */

app.use('/panel', require('./routes/admin'));
app.use('/', require('./routes/public'));

/* ── 404 ve hatalar ──────────────────────────────────────────────────────── */

app.use((req, res) => {
  res.status(404).render('hata', {
    kod: 404,
    baslik: 'Sayfa bulunamadı',
    mesaj: 'Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Ana sayfadan devam edebilirsiniz.',
    sayfa: { baslik: 'Sayfa bulunamadı — ' + config.siteName, aciklama: '', yol: req.path, indeksle: false },
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[okuryazar] hata:', err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  const json = req.get('accept')?.includes('application/json');
  if (json) return res.status(500).json({ ok: false, hata: 'Sunucu hatası' });
  res.status(500).render('hata', {
    kod: 500,
    baslik: 'Bir şeyler ters gitti',
    mesaj: 'Sunucuda beklenmedik bir hata oluştu. Birazdan tekrar deneyin.',
    sayfa: { baslik: 'Hata — ' + config.siteName, aciklama: '', yol: req.path, indeksle: false },
  });
});

/* ── ilk yonetici ────────────────────────────────────────────────────────── */

if (config.adminUser && config.adminPass && !dbmod.users.get(config.adminUser.toLowerCase())) {
  auth.ensureAdmin(config.adminUser.toLowerCase(), config.adminPass);
  console.log(`[okuryazar] yönetici oluşturuldu: ${config.adminUser}`);
}
if (dbmod.users.count() === 0) {
  console.warn('[okuryazar] UYARI: hiç yönetici yok. "npm run kullanici -- <kullanıcı> <şifre>" ile oluşturun.');
}

/* ── calistir ────────────────────────────────────────────────────────────── */

const server = app.listen(config.port, config.host, () => {
  console.log(`[okuryazar] ${config.env} · http://${config.host}:${config.port} · veri: ${config.dataDir}`);
});

const bakim = setInterval(() => dbmod.housekeeping(), 60 * 60e3);
bakim.unref();
dbmod.housekeeping();

function kapat(sinyal) {
  console.log(`[okuryazar] ${sinyal} alindi, kapaniyor…`);
  clearInterval(bakim);
  server.close(() => { dbmod.close(); process.exit(0); });
  setTimeout(() => { dbmod.close(); process.exit(0); }, 8000).unref();
}
process.on('SIGTERM', () => kapat('SIGTERM'));
process.on('SIGINT', () => kapat('SIGINT'));

module.exports = app;
