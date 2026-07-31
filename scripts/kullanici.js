#!/usr/bin/env node
'use strict';
/**
 * Yonetici olusturur ya da sifresini degistirir.
 *
 *   node scripts/kullanici.js aliarslan 'YeniSifre!'
 *   ADMIN_USER=aliarslan ADMIN_PASS='YeniSifre!' node scripts/kullanici.js
 *
 * Sifre komut satirinda gorunmesin isterseniz ikinci bicimi kullanin.
 * Sifre veritabaninda yalnizca scrypt ozeti olarak saklanir.
 */
const { users, sessions, close } = require('../server/db');
const { hashPassword } = require('../server/auth');

const kullanici = (process.argv[2] || process.env.ADMIN_USER || '').trim().toLowerCase();
const sifre = process.argv[3] || process.env.ADMIN_PASS || '';

if (!kullanici || !sifre) {
  console.error('Kullanım: node scripts/kullanici.js <kullanıcı-adı> <şifre>');
  process.exit(1);
}
if (sifre.length < 8) {
  console.error('Şifre en az 8 karakter olmalı.');
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,64}$/.test(kullanici)) {
  console.error('Kullanıcı adı 3-64 karakter olmalı; yalnızca küçük harf, rakam ve . _ - içerebilir.');
  process.exit(1);
}

const vardi = !!users.get(kullanici);
users.upsert(kullanici, hashPassword(sifre));
// Sifre degistiyse acik olan butun oturumlar dusurulur.
if (vardi) sessions.destroyAllFor(kullanici);
close();

console.log(vardi
  ? `Şifre güncellendi: ${kullanici} (açık oturumlar kapatıldı)`
  : `Yönetici oluşturuldu: ${kullanici}`);
