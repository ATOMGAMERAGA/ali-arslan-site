#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Siteyi GitHub'daki son sürüme günceller.
#
#      cd /root/ali-arslan-site && git pull
#      bash deploy/guncelle.sh
#
#  Veritabanı ve yüklenen görseller /var/lib/okuryazar içinde durur; bu
#  betik onlara dokunmaz, güncellemeden önce yedek alır.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SERVIS_KULLANICI="okuryazar"
UYGULAMA_DIZINI="/opt/okuryazar"
KAYNAK_DIZINI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

K='\033[0m'; MAVI='\033[1;34m'; YESIL='\033[1;32m'; KIRMIZI='\033[1;31m'
adim()  { echo -e "\n${MAVI}▸ $*${K}"; }
tamam() { echo -e "  ${YESIL}✓${K} $*"; }
hata()  { echo -e "\n${KIRMIZI}✗ $*${K}\n" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || hata "root olarak çalıştırın: sudo bash deploy/guncelle.sh"
[ -f "$KAYNAK_DIZINI/package.json" ] || hata "Depo dizininde değilsiniz."

adim "Güncellemeden önce yedek alınıyor"
bash "$UYGULAMA_DIZINI/deploy/yedekle.sh" >/dev/null && tamam "Yedek alındı (/var/backups/okuryazar)"

adim "Dosyalar kopyalanıyor"
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'data' --exclude '.env' \
  "$KAYNAK_DIZINI"/ "$UYGULAMA_DIZINI"/
chown -R "$SERVIS_KULLANICI:$SERVIS_KULLANICI" "$UYGULAMA_DIZINI"
chmod -R a+rX "$UYGULAMA_DIZINI"
chmod +x "$UYGULAMA_DIZINI"/deploy/*.sh
tamam "Kopyalandı"

adim "Bağımlılıklar"
cd "$UYGULAMA_DIZINI"
sudo -u "$SERVIS_KULLANICI" HOME=/var/lib/okuryazar npm ci --omit=dev --no-audit --no-fund
tamam "Güncel"

adim "Servis yeniden başlatılıyor"
systemctl restart okuryazar
sleep 2
systemctl is-active --quiet okuryazar || { journalctl -u okuryazar -n 30 --no-pager; hata "Servis açılmadı."; }
tamam "Çalışıyor"

# nginx sablonlari degistiyse yeniden uygula
if [ -f /etc/nginx/sites-available/okuryazar ]; then
  install -m 644 "$UYGULAMA_DIZINI/deploy/nginx-global.conf" /etc/nginx/conf.d/okuryazar-global.conf
  nginx -t >/dev/null 2>&1 && systemctl reload nginx && tamam "nginx yeniden yüklendi"
fi

echo
echo -e "${YESIL}✓ Güncelleme tamamlandı.${K}"
