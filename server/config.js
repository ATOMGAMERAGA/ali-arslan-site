'use strict';
/**
 * Tek yapilandirma noktasi. Butun ayarlar ortam degiskeninden gelir;
 * kodun icinde sifre, anahtar veya sunucuya ozel yol yazmayiz.
 */
const path = require('node:path');
const fs = require('node:fs');

// Gelistirme makinesinde kok dizindeki .env dosyasini yukle. Sunucuda bu dosya
// yoktur; degiskenleri systemd EnvironmentFile= ile veririz.
const localEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnv) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(localEnv); } catch { /* yok sayilir */ }
}

const bool = (v, def) => (v === undefined || v === '' ? def : /^(1|true|evet|yes|on)$/i.test(String(v)));
const num = (v, def) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : def);

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

const config = {
  root: ROOT,
  env: process.env.NODE_ENV || 'development',
  get isProd() { return this.env === 'production'; },

  host: process.env.HOST || '127.0.0.1',
  port: num(process.env.PORT, 3000),
  trustProxy: num(process.env.TRUST_PROXY, 0),

  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  siteName: process.env.SITE_NAME || 'Ali Arslan',
  siteTitle: process.env.SITE_TITLE || 'Ali Arslan — Edebiyat',
  siteDesc: process.env.SITE_DESC
    || 'Denemeler, şiirler ve roman okumalarından notlar.',

  dataDir: DATA_DIR,
  dbFile: path.join(DATA_DIR, 'blog.sqlite'),
  uploadDir: path.join(DATA_DIR, 'uploads'),
  publicDir: path.join(ROOT, 'public'),
  viewsDir: path.join(__dirname, 'views'),

  authLog: process.env.AUTH_LOG || path.join(DATA_DIR, 'auth.log'),

  sessionSecret: process.env.SESSION_SECRET || '',
  secureCookies: bool(process.env.SECURE_COOKIES, process.env.NODE_ENV === 'production'),
  sessionDays: num(process.env.SESSION_DAYS, 7),

  adminUser: process.env.ADMIN_USER || '',
  adminPass: process.env.ADMIN_PASS || '',

  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 12),

  // Claude Design'daki "props" karsiliklari — sitenin gorunumunu belirler.
  varsayilanTema: ['sistem', 'acik', 'koyu'].includes(process.env.VARSAYILAN_TEMA)
    ? process.env.VARSAYILAN_TEMA : 'sistem',
  okumaSuresiGoster: bool(process.env.OKUMA_SURESI_GOSTER, true),
  kapaklarSepya: bool(process.env.KAPAKLAR_SEPYA, true),
};

// Uretimde imzasiz oturum anahtariyla acilmayiz: sessiz bir guvenlik acigi olur.
if (config.isProd && config.sessionSecret.length < 32) {
  console.error(
    '[okuryazar] SESSION_SECRET tanimli degil ya da 32 karakterden kisa.\n' +
    '            /etc/okuryazar/blog.env icine "openssl rand -base64 48" ciktisini yazin.'
  );
  process.exit(1);
}

module.exports = config;
