#!/usr/bin/env bash
# Gunluk yedek: veritabani + yuklenen gorseller.
# systemd zamanlayicisi (okuryazar-yedek.timer) her gece 03:30'da calistirir.
# Elle calistirmak icin:  sudo /opt/okuryazar/deploy/yedekle.sh
set -euo pipefail

VERI_DIZINI="${VERI_DIZINI:-/var/lib/okuryazar}"
YEDEK_DIZINI="${YEDEK_DIZINI:-/var/backups/okuryazar}"
GUN_SAYISI="${GUN_SAYISI:-14}"          # kac gunluk yedek saklansin

TARIH="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$YEDEK_DIZINI"
chmod 700 "$YEDEK_DIZINI"

# 1) Veritabani — site calisirken guvenli kopya almanin dogru yolu .backup'tir.
if [ -f "$VERI_DIZINI/blog.sqlite" ]; then
  sqlite3 "$VERI_DIZINI/blog.sqlite" ".backup '$YEDEK_DIZINI/blog-$TARIH.sqlite'"
  gzip -9 -f "$YEDEK_DIZINI/blog-$TARIH.sqlite"
  echo "veritabani yedeklendi: $YEDEK_DIZINI/blog-$TARIH.sqlite.gz"
fi

# 2) Yuklenen gorseller
if [ -d "$VERI_DIZINI/uploads" ]; then
  tar -czf "$YEDEK_DIZINI/uploads-$TARIH.tar.gz" -C "$VERI_DIZINI" uploads
  echo "gorseller yedeklendi: $YEDEK_DIZINI/uploads-$TARIH.tar.gz"
fi

# 3) Ayar dosyasi (oturum anahtari burada — yedegi gizli tutun)
if [ -f /etc/okuryazar/blog.env ]; then
  cp -a /etc/okuryazar/blog.env "$YEDEK_DIZINI/blog.env-$TARIH"
  chmod 600 "$YEDEK_DIZINI/blog.env-$TARIH"
fi

# 4) Eskileri temizle
find "$YEDEK_DIZINI" -type f -mtime "+$GUN_SAYISI" -delete
echo "$GUN_SAYISI günden eski yedekler silindi."

du -sh "$YEDEK_DIZINI"
