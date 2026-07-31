#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Let's Encrypt SSL sertifikasi alir ve nginx'i HTTPS'e gecirir.
#
#  Alan adiniz sunucuya yonlendikten SONRA calistirin:
#      bash /opt/okuryazar/deploy/ssl-al.sh
#
#  Farkli bir alan adi icin:
#      ALAN=baskaad.com EPOSTA=ben@ornek.com bash deploy/ssl-al.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ALAN="${ALAN:-okuryazar.blog}"
EPOSTA="${EPOSTA:-}"
PORT="${PORT:-3000}"
MAX_UPLOAD_MB="${MAX_UPLOAD_MB:-12}"
UYGULAMA_DIZINI="${UYGULAMA_DIZINI:-/opt/okuryazar}"
WWW_DAHIL="${WWW_DAHIL:-1}"

K='\033[0m'; MAVI='\033[1;34m'; YESIL='\033[1;32m'; SARI='\033[1;33m'; KIRMIZI='\033[1;31m'
adim()  { echo -e "\n${MAVI}▸ $*${K}"; }
tamam() { echo -e "  ${YESIL}✓${K} $*"; }
uyari() { echo -e "  ${SARI}!${K} $*"; }
hata()  { echo -e "\n${KIRMIZI}✗ $*${K}\n" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || hata "root olarak çalıştırın: sudo bash deploy/ssl-al.sh"

if [ -z "$EPOSTA" ]; then
  read -r -p "  Let's Encrypt için e-posta adresiniz: " EPOSTA
  [ -n "$EPOSTA" ] || hata "E-posta gerekli."
fi

# ── DNS kontrolu ───────────────────────────────────────────────────────────
adim "DNS kontrolü"
SUNUCU_IP="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
ALAN_IP="$(getent ahostsv4 "$ALAN" 2>/dev/null | awk 'NR==1{print $1}')"
WWW_IP="$(getent ahostsv4 "www.$ALAN" 2>/dev/null | awk 'NR==1{print $1}')"
echo "  Sunucu IP     : ${SUNUCU_IP:-bilinmiyor}"
echo "  $ALAN     → ${ALAN_IP:-çözümlenemedi}"
echo "  www.$ALAN → ${WWW_IP:-çözümlenemedi}"

[ -n "$ALAN_IP" ] || hata "$ALAN henüz çözümlenmiyor. Hostinger'daki A kaydını kontrol edin ve 5-30 dakika bekleyin."
if [ -n "$SUNUCU_IP" ] && [ "$ALAN_IP" != "$SUNUCU_IP" ]; then
  uyari "$ALAN başka bir IP'ye ($ALAN_IP) bakıyor. Sertifika alınamayabilir."
  read -r -p "  Yine de devam edilsin mi? (e/H) " C
  [[ "$C" =~ ^[eE]$ ]] || exit 1
fi

ALANLAR=(-d "$ALAN")
if [ "$WWW_DAHIL" = "1" ] && [ -n "$WWW_IP" ]; then
  ALANLAR+=(-d "www.$ALAN")
  tamam "Sertifikaya www.$ALAN da eklenecek"
else
  uyari "www.$ALAN çözümlenmiyor; sertifika yalnızca $ALAN için alınacak."
fi

# ── sertifika ──────────────────────────────────────────────────────────────
adim "Sertifika alınıyor (webroot doğrulaması)"
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot \
  "${ALANLAR[@]}" \
  --email "$EPOSTA" --agree-tos --no-eff-email \
  --non-interactive --keep-until-expiring \
  --deploy-hook "systemctl reload nginx"
tamam "Sertifika hazır: /etc/letsencrypt/live/$ALAN/"

# certbot'un onerdigi TLS ayarlari yoksa olustur
[ -f /etc/letsencrypt/options-ssl-nginx.conf ] || cat > /etc/letsencrypt/options-ssl-nginx.conf <<'TLS'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
TLS
[ -f /etc/letsencrypt/ssl-dhparams.pem ] || openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048

# ── nginx'i HTTPS'e gecir ──────────────────────────────────────────────────
adim "nginx HTTPS yapılandırmasına geçiriliyor"
HEDEF=/etc/nginx/sites-available/okuryazar
sed -e "s/__DOMAIN__/$ALAN/g" -e "s/__PORT__/$PORT/g" -e "s/__MAXUPLOAD__/$MAX_UPLOAD_MB/g" \
  "$UYGULAMA_DIZINI/deploy/nginx-ssl.conf.tpl" > "$HEDEF"

# HTTP/2 yazimi nginx surumune gore degisir:
#   nginx  < 1.25.1 (Ubuntu 24.04'te 1.24)  →  listen 443 ssl http2;
#   nginx >= 1.25.1                          →  listen 443 ssl;  +  http2 on;
NGINX_SURUM="$(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
if [ -n "$NGINX_SURUM" ] && dpkg --compare-versions "$NGINX_SURUM" ge 1.25.1; then
  sed -i 's/^\([[:space:]]*\)__HTTP2__$/\1http2 on;/' "$HEDEF"
  tamam "nginx $NGINX_SURUM · HTTP/2 (http2 on;)"
else
  sed -i '/^[[:space:]]*__HTTP2__$/d' "$HEDEF"
  sed -i 's/^\([[:space:]]*\)listen 443 ssl;$/\1listen 443 ssl http2;/' "$HEDEF"
  sed -i 's/^\([[:space:]]*\)listen \[::\]:443 ssl;$/\1listen [::]:443 ssl http2;/' "$HEDEF"
  tamam "nginx ${NGINX_SURUM:-<1.25} · HTTP/2 (listen … http2)"
fi

# IPv6 kapali sunucularda "listen [::]" satirlari nginx'i baslatmaz; kaldir.
if [ ! -f /proc/net/if_inet6 ]; then
  sed -i '/listen \[::\]/d' "$HEDEF"
  uyari "Sunucuda IPv6 kapali — IPv6 dinleme satirlari cikarildi."
fi

# www sertifikaya girmediyse www sunucu blogunu cikar (nginx aksi halde hata verir)
if [ "$WWW_DAHIL" != "1" ] || [ -z "$WWW_IP" ]; then
  sed -i "s/ www\.$ALAN;/;/" "$HEDEF"
fi

nginx -t >/dev/null 2>&1 || { nginx -t; hata "nginx yapılandırması hatalı."; }
systemctl reload nginx
tamam "HTTPS aktif"

# ── otomatik yenileme ──────────────────────────────────────────────────────
adim "Otomatik yenileme"
systemctl enable --now certbot.timer >/dev/null 2>&1 || true
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/nginx-yenile.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-yenile.sh
certbot renew --dry-run >/dev/null 2>&1 \
  && tamam "Yenileme provası başarılı — sertifika 90 günde bir kendiliğinden yenilenir" \
  || uyari "Yenileme provası başarısız. 'certbot renew --dry-run' ile inceleyin."

echo
echo -e "${YESIL}✓ Siteniz artık https://$ALAN adresinde yayında.${K}"
echo
