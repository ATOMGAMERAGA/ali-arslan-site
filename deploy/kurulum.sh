#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Ali Arslan — okuryazar.blog
#  Ubuntu 24.04 LTS icin tek komutluk kurulum.
#
#  Kullanim (sunucuya root olarak SSH ile baglandiktan sonra):
#      cd /root/ali-arslan-site
#      bash deploy/kurulum.sh
#
#  Ayarlari ortam degiskeniyle degistirebilirsiniz:
#      ALAN=okuryazar.blog EPOSTA=ornek@ornek.com bash deploy/kurulum.sh
#
#  Betik istege bagli her adimi ekrana yazar; iki kez calistirmak zararsizdir.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── ayarlar ────────────────────────────────────────────────────────────────
ALAN="${ALAN:-okuryazar.blog}"
EPOSTA="${EPOSTA:-}"
YONETICI_KULLANICI="${YONETICI_KULLANICI:-aliarslan}"
YONETICI_SIFRE="${YONETICI_SIFRE:-Arslan1324!}"
PORT="${PORT:-3000}"
MAX_UPLOAD_MB="${MAX_UPLOAD_MB:-12}"
SERVIS_KULLANICI="okuryazar"
UYGULAMA_DIZINI="/opt/okuryazar"
VERI_DIZINI="/var/lib/okuryazar"
LOG_DIZINI="/var/log/okuryazar"
AYAR_DIZINI="/etc/okuryazar"
NODE_SURUM="22"
SSL_ATLA="${SSL_ATLA:-0}"          # SSL_ATLA=1 -> sertifika adimini atla
ORNEK_YAZILAR="${ORNEK_YAZILAR:-1}" # ORNEK_YAZILAR=0 -> site bos baslasin

KAYNAK_DIZINI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── ekran ──────────────────────────────────────────────────────────────────
K='\033[0m'; MAVI='\033[1;34m'; YESIL='\033[1;32m'; SARI='\033[1;33m'; KIRMIZI='\033[1;31m'
adim()  { echo -e "\n${MAVI}▸ $*${K}"; }
tamam() { echo -e "  ${YESIL}✓${K} $*"; }
uyari() { echo -e "  ${SARI}!${K} $*"; }
hata()  { echo -e "\n${KIRMIZI}✗ $*${K}\n" >&2; exit 1; }

echo -e "${MAVI}"
cat <<'BANNER'
  ╔══════════════════════════════════════════════════════════╗
  ║   Ali Arslan — Edebiyat Blogu · Ubuntu 24.04 kurulumu     ║
  ╚══════════════════════════════════════════════════════════╝
BANNER
echo -e "${K}"

# ── 0. on kontroller ───────────────────────────────────────────────────────
adim "Ön kontroller"
[ "$(id -u)" -eq 0 ] || hata "Bu betiği root olarak çalıştırın:  sudo bash deploy/kurulum.sh"
[ -f "$KAYNAK_DIZINI/package.json" ] || hata "package.json bulunamadı. Depo dizininde misiniz? ($KAYNAK_DIZINI)"
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  uyari "Bu betik Ubuntu için yazıldı. Devam ediliyor…"
fi
SURUM="$(. /etc/os-release && echo "${VERSION_ID:-bilinmiyor}")"
tamam "Ubuntu $SURUM · $(uname -m)"
tamam "Kaynak dizini: $KAYNAK_DIZINI"
tamam "Alan adı: $ALAN"

if [ -z "$EPOSTA" ] && [ "$SSL_ATLA" != "1" ]; then
  echo
  echo "  Let's Encrypt sertifikası için bir e-posta adresi gerekiyor."
  echo "  (Sertifikanın süresi dolmak üzereyken uyarı buraya gelir.)"
  read -r -p "  E-posta adresiniz: " EPOSTA
  [ -n "$EPOSTA" ] || hata "E-posta boş bırakılamaz. SSL'i atlamak için: SSL_ATLA=1 bash deploy/kurulum.sh"
fi

# ── 1. sistem paketleri ────────────────────────────────────────────────────
adim "Sistem paketleri kuruluyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git rsync \
  nginx \
  certbot python3-certbot-nginx \
  ufw fail2ban \
  sqlite3 \
  unattended-upgrades apt-listchanges \
  build-essential python3 \
  logrotate >/dev/null
tamam "nginx, certbot, ufw, fail2ban, sqlite3 kuruldu"

# ── 2. Node.js ─────────────────────────────────────────────────────────────
adim "Node.js $NODE_SURUM kuruluyor"
if command -v node >/dev/null && node -v | grep -qE "^v(2[0-9]|[3-9][0-9])\."; then
  tamam "Node.js zaten kurulu: $(node -v)"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_SURUM}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
  tamam "Node.js $(node -v) kuruldu"
fi

# ── 3. kullanici ve dizinler ───────────────────────────────────────────────
adim "Servis kullanıcısı ve dizinler"
if ! id "$SERVIS_KULLANICI" >/dev/null 2>&1; then
  useradd --system --home-dir "$VERI_DIZINI" --shell /usr/sbin/nologin "$SERVIS_KULLANICI"
  tamam "Kullanıcı oluşturuldu: $SERVIS_KULLANICI (kabuk yok, giriş yapamaz)"
else
  tamam "Kullanıcı zaten var: $SERVIS_KULLANICI"
fi

mkdir -p "$UYGULAMA_DIZINI" "$VERI_DIZINI/uploads" "$LOG_DIZINI" "$AYAR_DIZINI" /var/www/certbot
chown -R "$SERVIS_KULLANICI:$SERVIS_KULLANICI" "$VERI_DIZINI" "$LOG_DIZINI"
chmod 751 "$VERI_DIZINI"           # www-data icinden gecebilsin, listeleyemesin
chmod 750 "$LOG_DIZINI"
# Yuklenen gorselleri nginx dogrudan okuyabilsin (setgid ile yeni dosyalar da).
chown "$SERVIS_KULLANICI:www-data" "$VERI_DIZINI/uploads"
chmod 2750 "$VERI_DIZINI/uploads"
chmod 750 "$AYAR_DIZINI"
tamam "Dizinler hazır: $UYGULAMA_DIZINI · $VERI_DIZINI · $LOG_DIZINI"

# ── 4. uygulama dosyalari ──────────────────────────────────────────────────
adim "Uygulama $UYGULAMA_DIZINI dizinine kopyalanıyor"
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'data' --exclude '.env' \
  "$KAYNAK_DIZINI"/ "$UYGULAMA_DIZINI"/
chown -R "$SERVIS_KULLANICI:$SERVIS_KULLANICI" "$UYGULAMA_DIZINI"
chmod -R a+rX "$UYGULAMA_DIZINI"
chmod +x "$UYGULAMA_DIZINI"/deploy/*.sh
tamam "Dosyalar kopyalandı"

adim "Node.js bağımlılıkları kuruluyor (birkaç dakika sürebilir)"
cd "$UYGULAMA_DIZINI"
if [ -f package-lock.json ]; then
  sudo -u "$SERVIS_KULLANICI" HOME="$VERI_DIZINI" npm ci --omit=dev --no-audit --no-fund
else
  sudo -u "$SERVIS_KULLANICI" HOME="$VERI_DIZINI" npm install --omit=dev --no-audit --no-fund
fi
tamam "Bağımlılıklar kuruldu"

# ── 5. ayar dosyasi ────────────────────────────────────────────────────────
adim "Ayar dosyası: $AYAR_DIZINI/blog.env"
if [ -f "$AYAR_DIZINI/blog.env" ]; then
  OTURUM_ANAHTARI="$(grep -E '^SESSION_SECRET=' "$AYAR_DIZINI/blog.env" | cut -d= -f2- || true)"
  uyari "Dosya zaten var; oturum anahtarı korunuyor."
fi
[ -n "${OTURUM_ANAHTARI:-}" ] || OTURUM_ANAHTARI="$(openssl rand -base64 48 | tr -d '\n')"

cat > "$AYAR_DIZINI/blog.env" <<ENV
# okuryazar.blog — sunucu ayarları.  Bu dosyayı GİT'E KOYMAYIN.
# Değiştirdikten sonra:  systemctl restart okuryazar
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT

SITE_URL=https://$ALAN
SITE_NAME=Ali Arslan
SITE_TITLE=Ali Arslan — Edebiyat
SITE_DESC=Tarih ve edebiyat okumalarında notlar.

SESSION_SECRET=$OTURUM_ANAHTARI
SECURE_COOKIES=1
TRUST_PROXY=1

DATA_DIR=$VERI_DIZINI
AUTH_LOG=$LOG_DIZINI/auth.log

MAX_UPLOAD_MB=$MAX_UPLOAD_MB

# Görünüm ayarları:  sistem | acik | koyu
VARSAYILAN_TEMA=sistem
OKUMA_SURESI_GOSTER=1
KAPAKLAR_SEPYA=1
ENV
chown root:"$SERVIS_KULLANICI" "$AYAR_DIZINI/blog.env"
chmod 640 "$AYAR_DIZINI/blog.env"
tamam "Oturum anahtarı üretildi, dosya izinleri 640 (yalnızca root + servis)"

# ── 6. yonetici ve ornek yazilar ───────────────────────────────────────────
adim "Yönetici hesabı"
sudo -u "$SERVIS_KULLANICI" env \
  DATA_DIR="$VERI_DIZINI" NODE_ENV=production SESSION_SECRET="$OTURUM_ANAHTARI" \
  node "$UYGULAMA_DIZINI/scripts/kullanici.js" "$YONETICI_KULLANICI" "$YONETICI_SIFRE"

if [ "$ORNEK_YAZILAR" = "1" ]; then
  sudo -u "$SERVIS_KULLANICI" env \
    DATA_DIR="$VERI_DIZINI" NODE_ENV=production SESSION_SECRET="$OTURUM_ANAHTARI" \
    node "$UYGULAMA_DIZINI/scripts/tohum.js"
fi
chown -R "$SERVIS_KULLANICI:$SERVIS_KULLANICI" "$VERI_DIZINI"
chown "$SERVIS_KULLANICI:www-data" "$VERI_DIZINI/uploads"
chmod 2750 "$VERI_DIZINI/uploads"
chmod 751 "$VERI_DIZINI"

# ── 7. systemd servisi ─────────────────────────────────────────────────────
adim "systemd servisi (7/24 çalışma)"
install -m 644 "$UYGULAMA_DIZINI/deploy/okuryazar.service" /etc/systemd/system/okuryazar.service
install -m 644 "$UYGULAMA_DIZINI/deploy/okuryazar-yedek.service" /etc/systemd/system/okuryazar-yedek.service
install -m 644 "$UYGULAMA_DIZINI/deploy/okuryazar-yedek.timer" /etc/systemd/system/okuryazar-yedek.timer
systemctl daemon-reload
systemctl enable --now okuryazar.service >/dev/null
systemctl enable --now okuryazar-yedek.timer >/dev/null
sleep 2
if systemctl is-active --quiet okuryazar; then
  tamam "Servis çalışıyor · sunucu yeniden başlasa da kendi kendine açılır"
else
  journalctl -u okuryazar -n 30 --no-pager || true
  hata "Servis başlatılamadı. Yukarıdaki kayıtlara bakın."
fi

# ── 8. log donusumu ────────────────────────────────────────────────────────
adim "Log dosyaları döngüsü (logrotate)"
cat > /etc/logrotate.d/okuryazar <<'LOGROTATE'
/var/log/okuryazar/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 okuryazar okuryazar
    copytruncate
}
LOGROTATE
tamam "Haftalık, 8 hafta saklanır"

# ── 9. nginx (once HTTP) ───────────────────────────────────────────────────
adim "nginx yapılandırması"
install -m 644 "$UYGULAMA_DIZINI/deploy/nginx-global.conf" /etc/nginx/conf.d/okuryazar-global.conf
HEDEF=/etc/nginx/sites-available/okuryazar
sed -e "s/__DOMAIN__/$ALAN/g" -e "s/__PORT__/$PORT/g" -e "s/__MAXUPLOAD__/$MAX_UPLOAD_MB/g" \
  "$UYGULAMA_DIZINI/deploy/nginx-http.conf.tpl" > "$HEDEF"
# IPv6 kapali sunucularda "listen [::]" satirlari nginx'i baslatmaz; kaldir.
if [ ! -f /proc/net/if_inet6 ]; then
  sed -i '/listen \[::\]/d' "$HEDEF"
  uyari "Sunucuda IPv6 kapali — IPv6 dinleme satirlari cikarildi."
fi
ln -sf /etc/nginx/sites-available/okuryazar /etc/nginx/sites-enabled/okuryazar
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || { nginx -t; hata "nginx yapılandırması hatalı."; }
systemctl reload nginx
tamam "nginx HTTP üzerinden yayında (sertifika alınana kadar)"

# ── 10. guvenlik duvari ────────────────────────────────────────────────────
adim "Güvenlik duvarı (UFW)"
ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
tamam "Yalnızca 22 (SSH), 80 ve 443 açık; diğer her şey kapalı"

# ── 11. fail2ban ───────────────────────────────────────────────────────────
adim "fail2ban (kaba kuvvet koruması)"
install -m 644 "$UYGULAMA_DIZINI/deploy/fail2ban/filter.d/okuryazar-auth.conf"   /etc/fail2ban/filter.d/okuryazar-auth.conf
install -m 644 "$UYGULAMA_DIZINI/deploy/fail2ban/filter.d/okuryazar-tarama.conf" /etc/fail2ban/filter.d/okuryazar-tarama.conf
install -m 644 "$UYGULAMA_DIZINI/deploy/fail2ban/jail.local" /etc/fail2ban/jail.local
touch "$LOG_DIZINI/auth.log"; chown "$SERVIS_KULLANICI:$SERVIS_KULLANICI" "$LOG_DIZINI/auth.log"; chmod 640 "$LOG_DIZINI/auth.log"
touch /var/log/nginx/okuryazar.access.log /var/log/nginx/okuryazar.error.log
systemctl enable fail2ban >/dev/null
systemctl restart fail2ban
sleep 2
if fail2ban-client status >/dev/null 2>&1; then
  tamam "Aktif hapishaneler: $(fail2ban-client status | sed -n 's/.*Jail list:\s*//p')"
else
  uyari "fail2ban başlatılamadı; 'journalctl -u fail2ban -n 30' ile bakın."
fi

# ── 12. otomatik guvenlik guncellemeleri ───────────────────────────────────
adim "Otomatik güvenlik güncellemeleri"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTOUP'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUP
cat > /etc/apt/apt.conf.d/52okuryazar-unattended <<'UNATT'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UNATT
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
tamam "Güvenlik yamaları her gün kendiliğinden kurulur"

# ── 13. SSL ────────────────────────────────────────────────────────────────
if [ "$SSL_ATLA" = "1" ]; then
  adim "SSL adımı atlandı (SSL_ATLA=1)"
  uyari "Alan adı sunucuya yönlendikten sonra:  bash $UYGULAMA_DIZINI/deploy/ssl-al.sh"
else
  adim "Let's Encrypt SSL sertifikası"
  SUNUCU_IP="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  ALAN_IP="$(getent ahostsv4 "$ALAN" 2>/dev/null | awk 'NR==1{print $1}')"
  echo "  Sunucu IP  : ${SUNUCU_IP:-bilinmiyor}"
  echo "  $ALAN → ${ALAN_IP:-çözümlenemedi}"

  if [ -z "$ALAN_IP" ] || { [ -n "$SUNUCU_IP" ] && [ "$ALAN_IP" != "$SUNUCU_IP" ]; }; then
    uyari "Alan adı henüz bu sunucuya bakmıyor. Sertifika şimdilik alınmadı."
    uyari "Hostinger'da DNS kaydını yaptıktan sonra (KURULUM.md'ye bakın) şunu çalıştırın:"
    echo  "      bash $UYGULAMA_DIZINI/deploy/ssl-al.sh"
  else
    ALAN="$ALAN" EPOSTA="$EPOSTA" PORT="$PORT" MAX_UPLOAD_MB="$MAX_UPLOAD_MB" \
      bash "$UYGULAMA_DIZINI/deploy/ssl-al.sh" || uyari "Sertifika alınamadı; sonra tekrar deneyin: bash $UYGULAMA_DIZINI/deploy/ssl-al.sh"
  fi
fi

# ── ozet ───────────────────────────────────────────────────────────────────
echo
echo -e "${YESIL}╔══════════════════════════════════════════════════════════╗${K}"
echo -e "${YESIL}║                   KURULUM TAMAMLANDI                     ║${K}"
echo -e "${YESIL}╚══════════════════════════════════════════════════════════╝${K}"
echo
echo "  Site           : https://$ALAN"
echo "  Yönetici girişi: https://$ALAN/giris"
echo "  Kullanıcı adı  : $YONETICI_KULLANICI"
echo "  Şifre          : (kurulumda verdiğiniz şifre)"
echo
echo "  Sık kullanılan komutlar:"
echo "    systemctl status okuryazar          → çalışıyor mu?"
echo "    systemctl restart okuryazar         → yeniden başlat"
echo "    journalctl -u okuryazar -f          → canlı kayıtlar"
echo "    fail2ban-client status okuryazar-auth → engellenen IP'ler"
echo "    bash $UYGULAMA_DIZINI/deploy/guncelle.sh → siteyi güncelle"
echo "    bash $UYGULAMA_DIZINI/deploy/yedekle.sh  → elle yedek al"
echo
