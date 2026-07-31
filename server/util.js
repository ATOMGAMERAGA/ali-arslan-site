'use strict';
/**
 * Kucuk yardimcilar: Turkce tarih bicimi, okuma suresi, slug uretimi.
 * Tarih adlari elle yazildi ki sunucuda ICU/yerel ayar eksik olsa bile
 * cikti her zaman Turkce olsun. Saat dilimi systemd biriminde
 * TZ=Europe/Istanbul olarak sabitlenir.
 */
const crypto = require('node:crypto');

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const iki = (n) => String(n).padStart(2, '0');

/** 12 Temmuz 2026 */
function dateTR(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

/** 18:30 */
function timeTR(t) {
  const d = new Date(t);
  return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** 18:30:07 */
function timeSecTR(t) {
  const d = new Date(t);
  return `${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`;
}

/** 31 Temmuz 2026 · 19:04 */
function nowTR(t = Date.now()) {
  return `${dateTR(t)} · ${timeTR(t)}`;
}

/** RSS ve sitemap icin RFC/ISO tarihleri */
const iso = (t) => new Date(t).toISOString();

/** Dakika cinsinden okuma suresi — dakikada 180 kelime. */
function readMin(body) {
  const w = String(body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(w / 180));
}

/** "Taş Sokaklarda Cümle Aramak" → "tas-sokaklarda-cumle-aramak" */
function slugify(s) {
  const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', 'Â': 'a', 'Î': 'i', 'Û': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
  return s.split('').map((ch) => map[ch] || ch).join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/, '') || 'yazi';
}

/** XML (sitemap, RSS) icin kacis. */
function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Okunma sayaci icin ziyaretci parmak izi: IP + tarayici + gun, tuzlanip
 * ozetlenir. Ham IP hicbir yerde saklanmaz (KVKK dostu).
 */
function viewerKey(ip, ua, secret) {
  const gun = new Date().toISOString().slice(0, 10);
  return crypto.createHmac('sha256', secret || 'okuryazar')
    .update(`${ip}|${String(ua || '').slice(0, 200)}|${gun}`)
    .digest('base64url').slice(0, 22);
}

const yeniId = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

module.exports = { AYLAR, dateTR, timeTR, timeSecTR, nowTR, iso, readMin, slugify, xmlEscape, viewerKey, yeniId };
