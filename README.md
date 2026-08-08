<div align="center">

# Ali Arslan — Edebiyat Blogu

**okuryazar.blog** · Tarih okumaları, araştırmalar ve geçmişin bugüne bıraktığı izler.

Claude Design'da hazırlanan *Classical* tasarımın, Ubuntu 24.04 üzerinde
7/24 çalışacak biçimde gerçek bir siteye dönüştürülmüş hâli.

</div>

---

## Kurulum

Sunucuya root olarak bağlanıp üç komut:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/ATOMGAMERAGA/ali-arslan-site.git /root/ali-arslan-site
cd /root/ali-arslan-site && bash deploy/kurulum.sh
```

Alan adı bağlama, SSL, güvenlik ve bakım için adım adım anlatım:
**[KURULUM.md](KURULUM.md)**

---

## Ne var içinde

| | |
|---|---|
| **Ana sayfa** | Kapak görseli, giriş metni ve tarihe göre sıralı yazı listesi |
| **Yazı sayfası** | Kapak, okuma süresi, okunma sayacı, paylaş düğmesi |
| **Hakkımda** | Portre ve yazarın kendi anlatımı |
| **Yönetici paneli** | Toplam okuma / yayında / taslak sayaçları, yazı listesi |
| **Editör** | Kod bilmeden yazmak için düğmeli biçimlendirme, görsel yükleme, canlı önizleme, sunucuya otomatik kayıt |
| **Tema** | Sistem / Açık / Koyu — tercih tarayıcıda saklanır, açılışta parlama yok |
| **Ekstra** | RSS beslemesi, site haritası, OpenGraph paylaşım kartları, JSON-LD |

Sayfalar sunucuda üretilir (SSR): arama motorları ve paylaşım önizlemeleri
yazıları olduğu gibi görür, JavaScript kapalı bir tarayıcıda bile site okunur.

---

## Teknik özet

```
Ziyaretçi → nginx (TLS 1.2/1.3, HTTP/2, statik dosyalar, hız sınırı)
             └→ Node.js 22 + Express  (127.0.0.1:3000, dışarıya kapalı)
                  └→ SQLite (WAL)  +  /var/lib/okuryazar/uploads
```

- **Sunucu:** Node.js 22 · Express 4 · EJS · better-sqlite3 · sharp
- **İstemci:** Derleme adımı yok. Düz CSS + üç küçük JavaScript dosyası
  (tema, sayfa davranışları, editör). Tek bir satır içi `<script>` veya
  `style=""` yok — site `default-src 'none'; script-src 'self'; style-src 'self'`
  gibi katı bir CSP altında çalışır.
- **Fontlar:** Cormorant Garamond + Lora, kendi sunucumuzdan (üçüncü taraf
  CDN'e istek gitmez).
- **Veri:** Uygulama dizininden ayrı (`/var/lib/okuryazar`), güncelleme
  yazılara dokunmaz, her gece otomatik yedeklenir.

### Güvenlik

scrypt şifre özeti · `HttpOnly`+`Secure`+`SameSite=Strict` oturum çerezi ·
CSRF jetonları · IP başına giriş kilidi · fail2ban · UFW · sertleştirilmiş
systemd birimi · HTML enjeksiyonuna kapalı yazı motoru · yüklenen görsellerin
yeniden kodlanması (EXIF/konum temizliği) · hazır ifadeli SQL · HSTS ve
güvenlik başlıkları.

Ayrıntılar: [KURULUM.md § Güvenlik](KURULUM.md#8-güvenlik--sitede-neler-yapıldı)

---

## Geliştirme (kendi bilgisayarınızda)

```bash
npm install
cp .env.example .env          # SESSION_SECRET'ı doldurun
npm run tohum                 # örnek yazıları ekle
npm run kullanici -- aliarslan 'Arslan1324!'
npm run dev                   # http://localhost:3000
npm test                      # testler
```

---

## Dizin yapısı

```
server/           Express sunucusu
  index.js          uygulama kurulumu, güvenlik başlıkları, statik dosyalar
  config.js         bütün ayarlar (ortam değişkenlerinden)
  db.js             SQLite şeması ve sorgular
  auth.js           şifre, oturum, CSRF, kaba kuvvet koruması
  util.js           Türkçe tarih, slug, okuma süresi
  flash.js          tek seferlik bildirimler
  routes/           public.js (site) · admin.js (panel + editör)
  views/            EJS şablonları
public/
  css/              ds.css (Classical tasarım sistemi) · site.css · fonts.css
  js/               theme.js · site.js · editor.js · md.js
  fonts/            Cormorant Garamond + Lora (woff2)
  assets/           hero.jpg · uskup.jpg · sea.jpg
scripts/          kullanici.js (yönetici) · tohum.js (örnek yazılar)
deploy/           kurulum.sh · ssl-al.sh · guncelle.sh · yedekle.sh
                  sunucu-sertlestir.sh · nginx/systemd/fail2ban dosyaları
test/             node --test ile çalışan testler
```

`public/js/md.js` hem tarayıcıda hem sunucuda çalışır: editördeki önizleme ile
yayımlanan yazı birebir aynı motoru kullanır.

---

<div align="center">

Made by **Atom** for Ali Arslan

</div>
