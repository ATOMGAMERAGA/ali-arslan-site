# Kurulum Rehberi — okuryazar.blog

Bu rehber, **sıfırdan aldığınız bir Ubuntu 24.04 LTS sunucusunda** Ali Arslan'ın
edebiyat blogunu 7/24 çalışır hâle getirir, **okuryazar.blog** alan adını
Hostinger üzerinden bağlar ve **Let's Encrypt** ile ücretsiz SSL sertifikası alır.

Sunucu yönetimi bilmenize gerek yok: komutları sırayla kopyalayıp yapıştırmanız
yeterli. Her komutun ne yaptığını da anlatıyorum.

---

## İçindekiler

1. [Neye ihtiyacınız var](#1-neye-ihtiyacınız-var)
2. [Sunucuya bağlanma](#2-sunucuya-bağlanma)
3. [Projeyi sunucuya indirme (git clone)](#3-projeyi-sunucuya-indirme-git-clone)
4. [Tek komutla kurulum](#4-tek-komutla-kurulum)
5. [Hostinger'da alan adını bağlama](#5-hostingerda-alan-adını-bağlama)
6. [SSL sertifikası (Let's Encrypt)](#6-ssl-sertifikası-lets-encrypt)
7. [Siteyi kullanma](#7-siteyi-kullanma)
8. [Güvenlik — sitede neler yapıldı](#8-güvenlik--sitede-neler-yapıldı)
9. [İsteğe bağlı: sunucuyu daha da sıkılaştırma](#9-isteğe-bağlı-sunucuyu-daha-da-sıkılaştırma)
10. [Bakım: güncelleme, yedek, şifre değiştirme](#10-bakım-güncelleme-yedek-şifre-değiştirme)
11. [Sorun giderme](#11-sorun-giderme)
12. [Ek: betik kullanmadan elle kurulum](#12-ek-betik-kullanmadan-elle-kurulum)

---

## 1. Neye ihtiyacınız var

| Gerekli | Açıklama |
|---|---|
| **Ubuntu 24.04 LTS sunucu** | En az 1 GB RAM, 10 GB disk yeter. (Site çok hafif; 1 GB rahat eder.) |
| **Sunucunun IP adresi** | Sunucuyu aldığınız yerden verilir, örn. `93.184.216.34` |
| **root şifresi veya SSH anahtarı** | Sunucuya bağlanmak için |
| **okuryazar.blog alan adı** | Hostinger hesabınızda |
| **Bir e-posta adresi** | Let's Encrypt sertifika uyarıları için |

Sunucuda `apt update && apt upgrade` yaptığınızı söylemiştiniz — güzel, o adımı
atlayabilirsiniz. Kurulum betiği kalan her şeyi kendisi kurar.

> **Küçük not:** Alan adını *önce* sunucuya yönlendirirseniz (Adım 5), kurulum
> betiği SSL sertifikasını da aynı anda alır ve tek seferde bitirirsiniz.
> Yönlendirmeyi sonra yapacaksanız da sorun yok; SSL için ayrı bir komut var.

---

## 2. Sunucuya bağlanma

Kendi bilgisayarınızda bir terminal açın (Windows'ta **PowerShell** veya
**Windows Terminal**, Mac/Linux'ta **Terminal**) ve şunu yazın — `SUNUCU_IP`
yerine kendi sunucunuzun IP adresini koyun:

```bash
ssh root@SUNUCU_IP
```

İlk bağlantıda "Are you sure you want to continue connecting?" diye sorar,
`yes` yazıp Enter'a basın. Sonra root şifrenizi girin (yazarken ekranda
görünmez, normaldir).

Bağlandığınızda komut satırı şuna benzer:

```
root@sunucu:~#
```

Bundan sonraki bütün komutlar **bu ekranda** çalıştırılacak.

---

## 3. Projeyi sunucuya indirme (git clone)

`git`'i kurup depoyu root'un ev dizinine (`/root`) klonluyoruz:

```bash
apt-get update && apt-get install -y git
cd /root
git clone https://github.com/ATOMGAMERAGA/ali-arslan-site.git
cd /root/ali-arslan-site
```

Bu üç satırın sonunda `/root/ali-arslan-site` dizinindesiniz — kurulum
komutunu buradan çalıştıracağız.

<details>
<summary><b>Depo henüz ana dala (main) birleşmediyse</b></summary>

Değişiklikler önce bir geliştirme dalında duruyor. O dalı çekmek için:

```bash
cd /root
git clone -b claude/ali-arslan-blog-ubuntu-setup-w8tc5t \
  https://github.com/ATOMGAMERAGA/ali-arslan-site.git
cd /root/ali-arslan-site
```
</details>

<details>
<summary><b>Depo gizliyse (private) — kullanıcı adı/şifre soruyorsa</b></summary>

GitHub artık şifre kabul etmiyor; **kişisel erişim jetonu** (personal access
token) gerekir:

1. GitHub → sağ üstteki profil → **Settings** → en altta **Developer settings**
2. **Personal access tokens** → **Tokens (classic)** → **Generate new token**
3. Yetki olarak yalnızca **`repo`** kutusunu işaretleyin, oluşturun ve
   `ghp_...` ile başlayan jetonu kopyalayın.
4. Klonlarken kullanıcı adı olarak GitHub kullanıcı adınızı, şifre olarak
   **jetonu** yapıştırın. Ya da tek satırda:

```bash
git clone https://ATOMGAMERAGA:ghp_JETONUNUZ@github.com/ATOMGAMERAGA/ali-arslan-site.git
```

> Jetonu komut geçmişinde bırakmamak için sonrasında `history -c` çalıştırın.
</details>

---

## 4. Tek komutla kurulum

Depo dizinindeyken:

```bash
cd /root/ali-arslan-site
bash deploy/kurulum.sh
```

Betik size **Let's Encrypt için e-posta adresinizi** soracak; yazıp Enter'a
basın. Sonrasında her şey kendiliğinden ilerler (2-5 dakika sürer).

**Betik ne yapıyor?**

| # | Adım | Ne işe yarıyor |
|---|---|---|
| 1 | Sistem paketleri | nginx, certbot, ufw, fail2ban, sqlite3 kurulur |
| 2 | Node.js 22 | Sitenin çalıştığı ortam |
| 3 | `okuryazar` kullanıcısı | Site root olarak değil, yetkisiz bir kullanıcıyla çalışır |
| 4 | Dosyalar `/opt/okuryazar` | Uygulama buraya kopyalanır, bağımlılıklar kurulur |
| 5 | `/etc/okuryazar/blog.env` | Ayarlar + rastgele üretilen oturum anahtarı (izin 640) |
| 6 | Yönetici hesabı | `aliarslan` kullanıcısı oluşturulur, şifre özetlenerek saklanır |
| 7 | systemd servisi | Site 7/24 çalışır; çökerse 3 saniyede kalkar, sunucu yeniden başlarsa otomatik açılır |
| 8 | logrotate | Kayıt dosyaları şişmez |
| 9 | nginx | Sitenin önündeki web sunucusu |
| 10 | UFW güvenlik duvarı | Yalnızca 22, 80, 443 açık; gerisi kapalı |
| 11 | fail2ban | Kaba kuvvet deneyenlerin IP'sini otomatik engeller |
| 12 | Otomatik güvenlik yamaları | Ubuntu güvenlik güncellemeleri her gün kendiliğinden kurulur |
| 13 | Let's Encrypt SSL | Alan adı sunucuya bakıyorsa sertifika alınır |

### Ayarları değiştirmek isterseniz

Betik varsayılan olarak alan adını `okuryazar.blog`, yöneticiyi `aliarslan`
kabul eder. Değiştirmek isterseniz:

```bash
ALAN=okuryazar.blog \
EPOSTA=sizin@epostaniz.com \
YONETICI_KULLANICI=aliarslan \
YONETICI_SIFRE='Arslan1324!' \
bash deploy/kurulum.sh
```

Diğer seçenekler:

| Değişken | Varsayılan | Ne yapar |
|---|---|---|
| `SSL_ATLA=1` | `0` | Sertifika adımını atlar (alan adı hazır değilse) |
| `ORNEK_YAZILAR=0` | `1` | Örnek 3 yazıyı eklemez, site boş başlar |
| `PORT=3000` | `3000` | Node.js'in dinlediği yerel port |
| `MAX_UPLOAD_MB=12` | `12` | Yüklenebilecek en büyük görsel |

### Kurulum bittiğinde

Ekranda şunu görürsünüz:

```
╔══════════════════════════════════════════════════════════╗
║                   KURULUM TAMAMLANDI                     ║
╚══════════════════════════════════════════════════════════╝

  Site           : https://okuryazar.blog
  Yönetici girişi: https://okuryazar.blog/giris
  Kullanıcı adı  : aliarslan
```

Alan adı henüz bağlı değilse siteyi **sunucunun IP'siyle** deneyebilirsiniz:
tarayıcıda `http://SUNUCU_IP` yazın; blog karşınıza çıkmalı.

---

## 5. Hostinger'da alan adını bağlama

Şimdi `okuryazar.blog` adresinin sunucunuzu göstermesini sağlayacağız.

### 5.1 Sunucunuzun IP adresini öğrenin

Sunucudaki terminale şunu yazın:

```bash
curl -4 https://api.ipify.org; echo
```

Çıkan sayı (örn. `93.184.216.34`) sizin **sunucu IP adresiniz**. Bir kenara not edin.

### 5.2 Hostinger'da DNS kayıtlarını girin

1. [hpanel.hostinger.com](https://hpanel.hostinger.com) adresinden hesabınıza girin.
2. Üst menüden **Alan Adları** (Domains) → listeden **okuryazar.blog** → **Yönet**.
3. Sol menüden **DNS / Ad Sunucuları** (DNS / Nameservers) → **DNS kayıtları** sekmesi.

> **Önemli:** Bu sayfada "Ad sunucuları" (nameservers) **Hostinger'ın kendi ad
> sunucuları** olmalı (`ns1.dns-parking.com` gibi). Öyleyse DNS kayıtlarını
> buradan yönetebilirsiniz. Eğer başka bir sağlayıcının ad sunucuları
> yazıyorsa, kayıtları orada girmeniz gerekir.

4. Listede hazır gelen **A** ve **CNAME** kayıtlarından `@` ve `www` olanları
   **silin** (Hostinger genelde kendi park sayfasını gösteren kayıtlar koyar).

5. Şu **iki kaydı** ekleyin — `SUNUCU_IP` yerine 5.1'de bulduğunuz IP:

| Tür (Type) | Ad (Name) | İçerik (Points to) | TTL |
|---|---|---|---|
| **A** | `@` | `SUNUCU_IP` | 14400 (veya "Auto") |
| **A** | `www` | `SUNUCU_IP` | 14400 (veya "Auto") |

   - `@` kaydı → `okuryazar.blog` adresini karşılar
   - `www` kaydı → `www.okuryazar.blog` adresini karşılar
     (site bunu otomatik olarak `okuryazar.blog`'a yönlendirir)

6. **Kaydet**e basın.

> **CNAME yerine neden A kaydı?** `@` (kök alan adı) için CNAME kullanılamaz;
> kök alan adı her zaman A kaydıyla bir IP'ye bağlanır. `www` için CNAME de
> olur ama iki A kaydı en basit ve en az hata veren yoldur.

### 5.3 DNS'in yayılmasını bekleyin

DNS değişikliği dünya çapında yayılırken **5 dakika ile 30 dakika** arası sürer
(nadiren 2-4 saat). Beklerken sunucudan kontrol edebilirsiniz:

```bash
getent ahostsv4 okuryazar.blog | head -1
```

Çıktıda **sunucunuzun IP'si** görünüyorsa hazırsınız. Hâlâ eski/başka bir IP
görünüyorsa biraz daha bekleyin.

Dilerseniz [dnschecker.org](https://dnschecker.org) üzerinden dünya genelinde
yayılımı da izleyebilirsiniz.

---

## 6. SSL sertifikası (Let's Encrypt)

DNS yayıldıktan **sonra** sunucuda şunu çalıştırın:

```bash
bash /opt/okuryazar/deploy/ssl-al.sh
```

> Kurulum sırasında alan adı zaten sunucuya bakıyorsa bu adım otomatik
> yapılmıştır; o zaman bu komut "sertifika zaten var" deyip geçer, zararı olmaz.

Betik sırayla:

1. DNS'in gerçekten sunucuya baktığını doğrular
2. `okuryazar.blog` **ve** `www.okuryazar.blog` için ücretsiz sertifika alır
3. nginx'i HTTPS yapılandırmasına geçirir:
   - `http://` → `https://` yönlendirmesi
   - `www.okuryazar.blog` → `okuryazar.blog` yönlendirmesi
   - HSTS başlığı (tarayıcı bir daha HTTP denemesin diye)
   - TLS 1.2 + TLS 1.3, modern şifreleme takımları, OCSP stapling
4. **Otomatik yenilemeyi** kurar ve prova eder

**Sertifika 90 günde bir kendiliğinden yenilenir.** Elle bir şey yapmanız
gerekmez; `certbot.timer` günde iki kez kontrol eder ve süresi yaklaşınca yeniler.

Kontrol etmek isterseniz:

```bash
certbot certificates          # sertifikalar ve bitiş tarihleri
systemctl list-timers certbot.timer
certbot renew --dry-run       # yenileme provası
```

Artık **https://okuryazar.blog** açıldığında tarayıcıda kilit simgesini
görmelisiniz. 🎉

---

## 7. Siteyi kullanma

### Giriş

`https://okuryazar.blog/giris` adresine gidin (sayfanın en altındaki
"Yönetici Girişi" bağlantısı da aynı yere götürür).

| | |
|---|---|
| **Kullanıcı adı** | `aliarslan` |
| **Şifre** | `Arslan1324!` |

Giriş yaptıktan sonra üst menüde **Panel** bağlantısı çıkar.

> **Şifre nerede duruyor?** Veritabanında düz şifre **yok**; yalnızca scrypt ile
> üretilmiş özeti var. Sunucudaki dosyaları okuyan biri bile şifreyi geri
> döndüremez. Şifreyi değiştirmek için [Bölüm 10](#şifre-değiştirme)'a bakın.

### Yazı yazma

**Panel → + Yeni Yazı**

- **Başlık** kutusuna yazının adını yazın.
- **+ Kapak görseli ekle** ile bilgisayarınızdan bir fotoğraf seçin
  (otomatik küçültülür, konum/EXIF bilgisi silinir).
- Metin alanına yazın. Kod bilmenize gerek yok — metni **seçip** üstteki
  düğmelere basın:

| Düğme | Ne yapar |
|---|---|
| **Kalın** / *Eğik* | Seçili metni vurgular |
| **Başlık** / **Alt Başlık** | Bulunduğunuz satırı başlık yapar |
| **Alıntı** | Satırı kenar çizgili alıntıya çevirir |
| **• Liste** / **1. Liste** | Madde veya numaralı liste |
| **Bağlantı** | Görünecek metin + adres girip eklersiniz |
| **Görsel** | Bilgisayarınızdan yazı içine fotoğraf ekler |
| **Çizgi** | Bölüm ayıran ince çizgi |
| **Önizle** | Yazının okuyucuya nasıl görüneceğini gösterir |

- **Yayımla** → yazı sitede görünür.
- **Taslak Olarak Kaydet** → yalnızca siz görürsünüz.
- Yazdıklarınız **her 0,6 saniyede bir sunucuya otomatik kaydedilir**;
  sekmeyi kapatsanız, telefondan devam etseniz bile kaybolmaz.
  (`Ctrl`+`S` ile de elle kaydedebilirsiniz.)

### Tema

Sağ üstteki düğme temayı **Sistem → Açık → Koyu** sırasıyla değiştirir.
Tercih tarayıcıda saklanır. "Sistem" seçiliyken telefonunuzun/bilgisayarınızın
karanlık mod ayarını takip eder.

### Diğer adresler

| Adres | Ne var |
|---|---|
| `/` | Ana sayfa, son yazılar |
| `/hakkimda` | Hakkımda sayfası |
| `/yazi/<adres>` | Tek yazı |
| `/rss.xml` | RSS beslemesi (okuyucular takip edebilsin) |
| `/sitemap.xml` | Google için site haritası |
| `/robots.txt` | Arama motoru yönergeleri (panel indekslenmez) |

---

## 8. Güvenlik — sitede neler yapıldı

"Site güvenli olsun, insanlar hackleyemesin" dediniz. Yapılanlar:

### Sunucu katmanı

| Önlem | Ne sağlıyor |
|---|---|
| **UFW güvenlik duvarı** | Yalnızca SSH (22), HTTP (80), HTTPS (443) açık. Veritabanı ve Node.js dışarıdan **hiç erişilemez** (yalnızca `127.0.0.1` dinler). |
| **fail2ban** | Şifre deneyen IP'ler otomatik engellenir: SSH'ta 4 hatada 2 saat, blog girişinde 5 hatada 2 saat, `wp-login.php` gibi tarama yapanlara 12 saat. |
| **Otomatik güvenlik yamaları** | Ubuntu güvenlik güncellemeleri her gün kendiliğinden kurulur. |
| **Sertleştirilmiş systemd servisi** | Site root değil, kabuk hakkı bile olmayan `okuryazar` kullanıcısıyla çalışır. Dosya sisteminin tamamını salt-okunur görür; yalnızca kendi veri dizinine yazabilir. Yeni yetki alamaz (`NoNewPrivileges`), çekirdek ayarlarına dokunamaz, sistem çağrıları kısıtlıdır. |
| **Ayrılmış izinler** | Ayar dosyası `640` (yalnızca root + servis okur). Veritabanı nginx'in bile erişemeyeceği izinlerde. |

### Uygulama katmanı

| Önlem | Ne sağlıyor |
|---|---|
| **scrypt şifre özeti** | Şifre düz metin olarak hiçbir yerde yok. Rastgele tuz + yavaş özet fonksiyonu → sözlük saldırısı pratikte imkânsız. |
| **Güvenli oturum çerezi** | `HttpOnly` (JavaScript okuyamaz), `Secure` (yalnızca HTTPS), `SameSite=Strict` (başka siteden gönderilmez). Veritabanında çerezin kendisi değil, HMAC özeti durur. |
| **CSRF koruması** | Her formda oturuma özel jeton. Başka bir sitenin sizin adınıza yazı silmesi/eklemesi mümkün değil. |
| **Kaba kuvvet kilidi** | Aynı IP'den 5 hatalı girişte 15 dakika kilit — fail2ban devreye girmeden önce bile. |
| **Hız sınırı** | nginx'te giriş sayfasına dakikada 10, siteye saniyede 20 istek; uygulamada da ayrıca sınır var. |
| **Katı Content-Security-Policy** | `default-src 'none'; script-src 'self'; style-src 'self'` — sayfada tek bir satır içi `<script>` veya `style=""` bile yok. Bir XSS açığı bulunsa dahi tarayıcı kodu çalıştırmaz. |
| **HTML enjeksiyonuna kapalı yazı motoru** | Yazı metni önce tamamen kaçışlanır; `<script>` yazsanız ekranda metin olarak görünür. `javascript:` bağlantıları, dizin geçişi (`../`) ve site dışı `http://` görseller reddedilir. |
| **Görsel yeniden kodlama** | Yüklenen her fotoğraf `sharp` ile yeniden JPEG'e çevrilir. İçine gizlenmiş kod, EXIF verisi (**konum bilgisi dâhil**) tamamen silinir. |
| **SQL enjeksiyonuna kapalı** | Bütün sorgular hazır ifade (prepared statement); kullanıcı girdisi asla SQL metnine yapıştırılmaz. |
| **Güvenlik başlıkları** | HSTS, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` (siteniz iframe'e gömülemez), `Referrer-Policy`, `Permissions-Policy`. |
| **Gizlilik** | Google Fonts dâhil hiçbir üçüncü taraf CDN'e istek gitmez; fontlar kendi sunucunuzdan. Okunma sayacı ham IP saklamaz, tuzlanmış özet kullanır. |

### Kendiniz doğrulamak isterseniz

Site yayına girdikten sonra bu ücretsiz araçlardan **A / A+** almalısınız:

- SSL: [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/)
- Başlıklar: [securityheaders.com](https://securityheaders.com)
- Mozilla: [observatory.mozilla.org](https://observatory.mozilla.org)

### Size düşen tek şey

1. **Şifreyi zamanla değiştirin.** `Arslan1324!` iyi bir şifre ama bu rehberde
   ve GitHub deposunda yazılı olduğu için siteyi yayına aldıktan sonra
   [Bölüm 10](#şifre-değiştirme)'daki komutla yenilemenizi öneririm.
2. **SSH anahtarı kullanın.** Sunucuya şifreyle değil anahtarla girmek en büyük
   güvenlik kazancıdır — [Bölüm 9](#9-isteğe-bağlı-sunucuyu-daha-da-sıkılaştırma).

---

## 9. İsteğe bağlı: sunucuyu daha da sıkılaştırma

Kurulum betiği zaten güvenli bir sunucu bırakıyor. Bir adım öteye gitmek
isterseniz:

```bash
bash /opt/okuryazar/deploy/sunucu-sertlestir.sh
```

Betik şunları yapar:

- Çekirdek ağ ayarlarını sıkılaştırır (SYN sel koruması, sahte IP filtresi,
  ICMP yönlendirme kapalı, ASLR)
- SSH'ta: en fazla 3 deneme, 30 saniye giriş süresi, X11/port yönlendirme kapalı
- Kullanılmayan servisleri kapatır
- `/dev/shm`'i `noexec,nosuid,nodev` yapar
- **Sunucuda SSH anahtarı varsa** şifreyle SSH girişini kapatmayı önerir
  (sorar, siz onaylamadan yapmaz)

### SSH anahtarı nasıl kurulur

Kendi bilgisayarınızda (sunucuda değil!) bir kez:

```bash
ssh-keygen -t ed25519          # Enter, Enter, Enter (parola isteğe bağlı)
ssh-copy-id root@SUNUCU_IP     # sunucu şifrenizi sorar, son kez
```

Windows'ta `ssh-copy-id` yoksa:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@SUNUCU_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Sonra `ssh root@SUNUCU_IP` **şifre sormadan** girmeli. Girdikten sonra
sertleştirme betiğini çalıştırıp şifreli girişi kapatabilirsiniz.

> ⚠️ Şifreli girişi kapattıktan sonra **açık olan terminali kapatmayın**;
> yeni bir terminalden girebildiğinizi doğrulayın. Bir sorun olursa açık
> oturumdan geri alabilirsiniz.

---

## 10. Bakım: güncelleme, yedek, şifre değiştirme

### Siteyi güncelleme

Kodda bir değişiklik yapıldığında:

```bash
cd /root/ali-arslan-site
git pull
bash deploy/guncelle.sh
```

Betik önce yedek alır, dosyaları kopyalar, bağımlılıkları günceller ve servisi
yeniden başlatır. **Yazılarınıza ve görsellerinize dokunmaz** — onlar
`/var/lib/okuryazar` içinde durur, uygulama dizininden ayrıdır.

### Yedekler

Her gece **03:30**'da otomatik yedek alınır: veritabanı + görseller + ayar
dosyası, `/var/backups/okuryazar` altında, **14 gün** saklanır.

```bash
ls -lh /var/backups/okuryazar          # yedekleri gör
bash /opt/okuryazar/deploy/yedekle.sh  # hemen yedek al
systemctl list-timers okuryazar-yedek.timer
```

**Yedeği kendi bilgisayarınıza indirmek** (kendi bilgisayarınızda çalıştırın):

```bash
scp root@SUNUCU_IP:/var/backups/okuryazar/blog-*.sqlite.gz .
scp root@SUNUCU_IP:/var/backups/okuryazar/uploads-*.tar.gz .
```

**Yedekten geri dönmek:**

```bash
systemctl stop okuryazar
gunzip -c /var/backups/okuryazar/blog-2026-07-31_0330.sqlite.gz > /var/lib/okuryazar/blog.sqlite
tar -xzf /var/backups/okuryazar/uploads-2026-07-31_0330.tar.gz -C /var/lib/okuryazar
chown -R okuryazar:okuryazar /var/lib/okuryazar
chown okuryazar:www-data /var/lib/okuryazar/uploads
chmod 2750 /var/lib/okuryazar/uploads
systemctl start okuryazar
```

### Şifre değiştirme

```bash
cd /opt/okuryazar
sudo -u okuryazar env DATA_DIR=/var/lib/okuryazar \
  node scripts/kullanici.js aliarslan 'YeniGüçlüŞifreniz2026!'
```

Şifre değişince açık olan bütün oturumlar kapanır. Şifre komut geçmişinde
kalmasın isterseniz sonrasında `history -c` çalıştırın.

Yeni bir yönetici eklemek için aynı komutu farklı bir kullanıcı adıyla çalıştırın.

### Site ayarlarını değiştirme

```bash
nano /etc/okuryazar/blog.env
systemctl restart okuryazar
```

Değiştirebileceğiniz ilginç ayarlar:

| Ayar | Anlamı |
|---|---|
| `VARSAYILAN_TEMA` | `sistem`, `acik` veya `koyu` — ilk gelen ziyaretçinin göreceği tema |
| `OKUMA_SURESI_GOSTER` | `0` yaparsanız "3 dk okuma" yazısı kalkar |
| `KAPAKLAR_SEPYA` | `0` yaparsanız fotoğraflardaki sıcak arşiv tonu kalkar |
| `SITE_TITLE`, `SITE_DESC` | Tarayıcı sekmesi ve Google'da görünen metin |
| `MAX_UPLOAD_MB` | En büyük görsel boyutu (nginx tarafını da güncelleyin) |

### Günlük kontrol komutları

```bash
systemctl status okuryazar             # site çalışıyor mu
journalctl -u okuryazar -f             # canlı kayıt akışı
journalctl -u okuryazar --since today  # bugünkü kayıtlar
tail -f /var/log/okuryazar/auth.log    # giriş denemeleri
fail2ban-client status                 # aktif korumalar
fail2ban-client status okuryazar-auth  # engellenen IP'ler
ufw status verbose                     # güvenlik duvarı
df -h /                                # disk doluluk
```

Yanlışlıkla kendi IP'nizi engellettiyseniz:

```bash
fail2ban-client set okuryazar-auth unbanip SIZIN_IP
```

---

## 11. Sorun giderme

### Site açılmıyor (502 Bad Gateway)

Node.js servisi durmuş demektir:

```bash
systemctl status okuryazar
journalctl -u okuryazar -n 50 --no-pager   # hata mesajını okuyun
systemctl restart okuryazar
```

### Site açılmıyor (bağlantı zaman aşımı)

Güvenlik duvarı veya nginx:

```bash
ufw status                 # 80 ve 443 açık mı
systemctl status nginx
nginx -t                   # yapılandırma hatası var mı
systemctl restart nginx
```

### Alan adı çalışmıyor

```bash
getent ahostsv4 okuryazar.blog     # sunucu IP'sini mi gösteriyor
curl -I http://SUNUCU_IP           # IP ile site açılıyor mu
```

IP ile açılıyor ama alan adıyla açılmıyorsa sorun DNS'te — Hostinger'daki
A kayıtlarını kontrol edin, biraz daha bekleyin.

### Sertifika alınamıyor

```bash
certbot certificates
journalctl -u nginx -n 30 --no-pager
```

En sık üç sebep:
1. DNS henüz yayılmamış → bekleyin, tekrar deneyin
2. 80 portu kapalı → `ufw allow 'Nginx Full'`
3. Aynı alan için haftalık deneme sınırı aşılmış (Let's Encrypt: haftada 5
   başarısız deneme) → bir saat bekleyip tekrar deneyin

### Görsel yüklenmiyor

```bash
ls -la /var/lib/okuryazar/uploads
df -h /                     # disk dolmuş olabilir
journalctl -u okuryazar -n 30
```

Görsel 12 MB'tan büyükse reddedilir; `MAX_UPLOAD_MB` ayarını ve nginx'teki
`client_max_body_size` değerini birlikte artırın.

### Panele giremiyorum ("Çok fazla başarısız deneme")

15 dakika bekleyin ya da kilidi elle kaldırın:

```bash
sqlite3 /var/lib/okuryazar/blog.sqlite "DELETE FROM login_attempts;"
fail2ban-client set okuryazar-auth unbanip SIZIN_IP
```

### Her şeyi baştan kurmak

```bash
systemctl stop okuryazar
rm -rf /opt/okuryazar
# Veriyi de silmek isterseniz (DİKKAT: yazılarınız gider):
# rm -rf /var/lib/okuryazar
cd /root/ali-arslan-site && git pull && bash deploy/kurulum.sh
```

---

## 12. Ek: betik kullanmadan elle kurulum

`deploy/kurulum.sh`'in yaptığı her şeyi elle yapmak isterseniz, sırasıyla:

```bash
# ── 1. paketler ────────────────────────────────────────────────────────────
apt-get update && apt-get install -y \
  curl ca-certificates gnupg git rsync nginx certbot python3-certbot-nginx \
  ufw fail2ban sqlite3 unattended-upgrades build-essential python3 logrotate

# ── 2. Node.js 22 ──────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v          # v22.x görmelisiniz

# ── 3. kullanıcı ve dizinler ───────────────────────────────────────────────
useradd --system --home-dir /var/lib/okuryazar --shell /usr/sbin/nologin okuryazar
mkdir -p /opt/okuryazar /var/lib/okuryazar/uploads /var/log/okuryazar /etc/okuryazar /var/www/certbot
chown -R okuryazar:okuryazar /var/lib/okuryazar /var/log/okuryazar
chmod 751 /var/lib/okuryazar
chmod 750 /var/log/okuryazar /etc/okuryazar
chown okuryazar:www-data /var/lib/okuryazar/uploads
chmod 2750 /var/lib/okuryazar/uploads

# ── 4. uygulama ────────────────────────────────────────────────────────────
rsync -a --exclude .git --exclude node_modules --exclude data \
  /root/ali-arslan-site/ /opt/okuryazar/
chown -R okuryazar:okuryazar /opt/okuryazar
chmod -R a+rX /opt/okuryazar
cd /opt/okuryazar
sudo -u okuryazar HOME=/var/lib/okuryazar npm ci --omit=dev

# ── 5. ayarlar ─────────────────────────────────────────────────────────────
ANAHTAR=$(openssl rand -base64 48 | tr -d '\n')
cat > /etc/okuryazar/blog.env <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
SITE_URL=https://okuryazar.blog
SITE_NAME=Ali Arslan
SITE_TITLE=Ali Arslan — Edebiyat
SITE_DESC=Tarih ve edebiyat okumalarından notlar...
SESSION_SECRET=$ANAHTAR
SECURE_COOKIES=1
TRUST_PROXY=1
DATA_DIR=/var/lib/okuryazar
AUTH_LOG=/var/log/okuryazar/auth.log
MAX_UPLOAD_MB=12
VARSAYILAN_TEMA=sistem
OKUMA_SURESI_GOSTER=1
KAPAKLAR_SEPYA=1
ENV
chown root:okuryazar /etc/okuryazar/blog.env
chmod 640 /etc/okuryazar/blog.env

# ── 6. yönetici + örnek yazılar ────────────────────────────────────────────
sudo -u okuryazar env DATA_DIR=/var/lib/okuryazar SESSION_SECRET="$ANAHTAR" \
  node /opt/okuryazar/scripts/kullanici.js aliarslan 'Arslan1324!'
sudo -u okuryazar env DATA_DIR=/var/lib/okuryazar SESSION_SECRET="$ANAHTAR" \
  node /opt/okuryazar/scripts/tohum.js

# ── 7. servis ──────────────────────────────────────────────────────────────
cp /opt/okuryazar/deploy/okuryazar.service        /etc/systemd/system/
cp /opt/okuryazar/deploy/okuryazar-yedek.service  /etc/systemd/system/
cp /opt/okuryazar/deploy/okuryazar-yedek.timer    /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now okuryazar okuryazar-yedek.timer
systemctl status okuryazar

# ── 8. nginx ───────────────────────────────────────────────────────────────
cp /opt/okuryazar/deploy/nginx-global.conf /etc/nginx/conf.d/okuryazar-global.conf
sed -e 's/__DOMAIN__/okuryazar.blog/g' -e 's/__PORT__/3000/g' -e 's/__MAXUPLOAD__/12/g' \
  /opt/okuryazar/deploy/nginx-http.conf.tpl > /etc/nginx/sites-available/okuryazar
ln -sf /etc/nginx/sites-available/okuryazar /etc/nginx/sites-enabled/okuryazar
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 9. güvenlik duvarı ─────────────────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 10. fail2ban ───────────────────────────────────────────────────────────
cp /opt/okuryazar/deploy/fail2ban/filter.d/*.conf /etc/fail2ban/filter.d/
cp /opt/okuryazar/deploy/fail2ban/jail.local      /etc/fail2ban/jail.local
touch /var/log/okuryazar/auth.log
chown okuryazar:okuryazar /var/log/okuryazar/auth.log
systemctl enable --now fail2ban && systemctl restart fail2ban

# ── 11. SSL ────────────────────────────────────────────────────────────────
ALAN=okuryazar.blog EPOSTA=sizin@epostaniz.com bash /opt/okuryazar/deploy/ssl-al.sh
```

---

## Dosya ve dizin haritası

| Yol | İçinde ne var |
|---|---|
| `/root/ali-arslan-site` | GitHub deposunun kopyası (buradan güncellersiniz) |
| `/opt/okuryazar` | Çalışan uygulama (güncellemede baştan yazılır) |
| `/var/lib/okuryazar/blog.sqlite` | **Yazılarınız** — veritabanı |
| `/var/lib/okuryazar/uploads/` | **Yüklediğiniz görseller** |
| `/etc/okuryazar/blog.env` | Ayarlar ve oturum anahtarı (gizli) |
| `/var/log/okuryazar/auth.log` | Giriş denemeleri |
| `/var/log/nginx/okuryazar.*.log` | Web sunucusu kayıtları |
| `/var/backups/okuryazar/` | Günlük yedekler |
| `/etc/systemd/system/okuryazar.service` | Servis tanımı |
| `/etc/nginx/sites-available/okuryazar` | nginx yapılandırması |
| `/etc/letsencrypt/live/okuryazar.blog/` | SSL sertifikası |

---

*Made by Atom for Ali Arslan.*
