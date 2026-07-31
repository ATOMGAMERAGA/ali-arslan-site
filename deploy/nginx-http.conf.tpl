# ── okuryazar.blog · 1. ASAMA: yalnizca HTTP ────────────────────────────────
# Bu dosya, Let's Encrypt sertifikasi alinana kadar gecerlidir. Sertifika
# alindiktan sonra kurulum betigi bunun yerine nginx-ssl.conf.tpl'i koyar.

server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ www.__DOMAIN__;

    # Let's Encrypt dogrulama dosyalari
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location / {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "";
        proxy_read_timeout 60s;
    }

    client_max_body_size __MAXUPLOAD__M;
}
