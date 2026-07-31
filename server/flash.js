'use strict';
/**
 * Tek seferlik bildirimler. Yonlendirmeden sonra gosterilecek mesaj cereze
 * KOD olarak yazilir, metin sunucuda bu tablodan secilir. Boylece cerezin
 * icerigi sayfaya hicbir zaman serbest metin olarak dusmez.
 */
const MESAJLAR = {
  hosgeldiniz: 'Hoş geldiniz, Ali Bey',
  cikildi: 'Çıkış yapıldı',
  yayinlandi: 'Yazı yayımlandı',
  guncellendi: 'Yazı güncellendi',
  taslak: 'Taslak kaydedildi',
  silindi: 'Yazı silindi',
  bosYazi: 'Yayımlamak için önce bir şeyler yazın',
  bulunamadi: 'Yazı bulunamadı',
};

const COOKIE = 'aa_flash';

function set(res, kod) {
  if (!MESAJLAR[kod]) return;
  res.cookie(COOKIE, kod, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 20000 });
}

/** Her istekte calisir: cerezdeki kodu okur, temizler ve res.locals.toast'a yazar. */
function middleware(req, res, next) {
  const kod = req.cookies?.[COOKIE];
  res.locals.toast = (kod && MESAJLAR[kod]) || '';
  if (kod) res.clearCookie(COOKIE, { path: '/' });
  next();
}

module.exports = { set, middleware, MESAJLAR };
