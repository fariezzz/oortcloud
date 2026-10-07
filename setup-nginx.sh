#!/usr/bin/env bash
# ==============================================================================
# Script Otomatisasi Setup Nginx untuk OortCloud di Server Proxmox
# Jalankan di terminal server: sudo bash setup-nginx.sh
# ==============================================================================

set -e

echo "=== [1/5] Memeriksa instalasi Nginx ==="
if ! command -v nginx &> /dev/null; then
    echo "Nginx belum terpasang. Memasang Nginx..."
    apt update && apt install -y nginx
else
    echo "Nginx sudah terpasang."
fi

CONF_SOURCE="/var/www/oortcloud/nginx/oortcloud.conf"
CONF_TARGET="/etc/nginx/sites-available/oortcloud"

if [ ! -f "$CONF_SOURCE" ]; then
    echo "Error: File $CONF_SOURCE tidak ditemukan!"
    echo "Pastikan script ini dijalankan dari direktori /var/www/oortcloud"
    exit 1
fi

echo "=== [2/5] Menyalin konfigurasi Nginx ke /etc/nginx/sites-available ==="
cp "$CONF_SOURCE" "$CONF_TARGET"

echo "=== [3/5] Mengaktifkan konfigurasi OortCloud & menghapus default lama ==="
# Hapus default virtual host lama agar tidak bentrok dengan IP server
rm -f /etc/nginx/sites-enabled/default

# Aktifkan virtual host oortcloud via symlink
ln -sf "$CONF_TARGET" /etc/nginx/sites-enabled/oortcloud

echo "=== [4/5] Menguji sintaks konfigurasi Nginx (nginx -t) ==="
nginx -t

echo "=== [5/5] Memuat ulang (reload) Nginx ==="
systemctl reload nginx || systemctl restart nginx

echo ""
echo "=========================================================================="
echo " Setup Nginx Berhasil!"
echo " Web Cloud Drive kini aktif melayani port 80 melalui IP Address server."
echo " Akses di browser: http://$(hostname -I | awk '{print $1}')/"
echo "=========================================================================="
