#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  İSTEĞE BAĞLI sunucu sertleştirmesi.
#
#  kurulum.sh sitenin kendi güvenliğini zaten sağlar (güvenlik duvarı,
#  fail2ban, otomatik yamalar, sertleştirilmiş servis). Bu betik bir adım
#  öteye gidip SSH'i ve çekirdek ağ ayarlarını sıkılaştırır.
#
#      bash /opt/okuryazar/deploy/sunucu-sertlestir.sh
#
#  DİKKAT: SSH şifreli girişi kapatma adımı yalnızca sunucuda kayıtlı bir
#  SSH anahtarı varsa önerilir. Betik bunu kontrol eder ve size sorar;
#  onaylamadan hiçbir şey değiştirmez. Ayarı değiştirdikten sonra mevcut
#  oturumunuzu KAPATMADAN yeni bir terminalden giriş yapıp deneyin.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

K='\033[0m'; MAVI='\033[1;34m'; YESIL='\033[1;32m'; SARI='\033[1;33m'; KIRMIZI='\033[1;31m'
adim()  { echo -e "\n${MAVI}▸ $*${K}"; }
tamam() { echo -e "  ${YESIL}✓${K} $*"; }
uyari() { echo -e "  ${SARI}!${K} $*"; }
hata()  { echo -e "\n${KIRMIZI}✗ $*${K}\n" >&2; exit 1; }
sor()   { read -r -p "  $1 (e/H) " C; [[ "$C" =~ ^[eE]$ ]]; }

[ "$(id -u)" -eq 0 ] || hata "root olarak çalıştırın."

# ── 1. çekirdek ağ ayarları ────────────────────────────────────────────────
adim "Çekirdek ağ ayarları (sysctl)"
cat > /etc/sysctl.d/99-okuryazar.conf <<'SYSCTL'
# Sahte kaynak IP'li paketleri reddet
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
# ICMP yönlendirmelerini kabul etme / gönderme
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
# Kaynak yönlendirmeli paketleri reddet
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
# SYN sel saldırısına karşı
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
# Şüpheli paketleri kaydet
net.ipv4.conf.all.log_martians = 1
# Ping yayınlarına yanıt verme
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
# Bellek adres rastgeleliği
kernel.randomize_va_space = 2
# Çekirdek işaretçilerini gizle
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
SYSCTL
sysctl --system >/dev/null 2>&1 || true
tamam "Uygulandı"

# ── 2. SSH ─────────────────────────────────────────────────────────────────
adim "SSH ayarları"
ANAHTAR_VAR=0
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -s "$f" ] && ANAHTAR_VAR=1
done

mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/60-okuryazar.conf <<'SSHD'
# okuryazar.blog — SSH sertleştirmesi
Protocol 2
PermitEmptyPasswords no
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitUserEnvironment no
SSHD

if [ "$ANAHTAR_VAR" = "1" ]; then
  echo
  uyari "Sunucuda kayıtlı bir SSH anahtarı bulundu."
  echo "  Şifreyle SSH girişini kapatmak güvenliği ciddi biçimde artırır."
  echo "  Kapattıktan sonra sunucuya YALNIZCA SSH anahtarıyla girebilirsiniz."
  if sor "Şifreyle SSH girişi kapatılsın mı?"; then
    {
      echo "PasswordAuthentication no"
      echo "KbdInteractiveAuthentication no"
      echo "PermitRootLogin prohibit-password"
    } >> /etc/ssh/sshd_config.d/60-okuryazar.conf
    tamam "Şifreli giriş kapatıldı (anahtarla giriş açık)"
  else
    echo "PermitRootLogin yes" >> /etc/ssh/sshd_config.d/60-okuryazar.conf
    uyari "Şifreli giriş açık bırakıldı — fail2ban sizi koruyor ama uzun bir şifre kullanın."
  fi
else
  echo "PermitRootLogin yes" >> /etc/ssh/sshd_config.d/60-okuryazar.conf
  uyari "Kayıtlı SSH anahtarı yok; şifreli giriş açık bırakıldı."
  echo "  Kendi bilgisayarınızdan anahtar yüklemek için:"
  echo "      ssh-keygen -t ed25519          (kendi bilgisayarınızda, bir kez)"
  echo "      ssh-copy-id root@SUNUCU_IP"
  echo "  Sonra bu betiği tekrar çalıştırıp şifreli girişi kapatabilirsiniz."
fi

if sshd -t 2>/dev/null; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  tamam "SSH yapılandırması geçerli ve yeniden yüklendi"
  uyari "ŞU ANKİ OTURUMU KAPATMADAN yeni bir terminalden giriş yapıp deneyin."
else
  rm -f /etc/ssh/sshd_config.d/60-okuryazar.conf
  hata "SSH yapılandırması geçersiz — değişiklik geri alındı."
fi

# ── 3. gereksiz servisler ──────────────────────────────────────────────────
adim "Kullanılmayan servisler"
for s in apache2 bind9 rpcbind avahi-daemon cups; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^$s.service"; then
    systemctl disable --now "$s" >/dev/null 2>&1 || true
    tamam "$s kapatıldı"
  fi
done

# ── 4. paylaşılan bellek ───────────────────────────────────────────────────
adim "/dev/shm sertleştirmesi"
if ! grep -q "^tmpfs /dev/shm" /etc/fstab; then
  echo "tmpfs /dev/shm tmpfs defaults,noexec,nosuid,nodev 0 0" >> /etc/fstab
  mount -o remount,noexec,nosuid,nodev /dev/shm 2>/dev/null || true
  tamam "noexec,nosuid,nodev eklendi"
else
  tamam "Zaten ayarlı"
fi

echo
echo -e "${YESIL}✓ Sertleştirme tamamlandı.${K}"
echo "  Durum kontrolü:  ufw status verbose · fail2ban-client status · systemctl status okuryazar"
echo
