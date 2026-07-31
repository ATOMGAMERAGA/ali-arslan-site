# ── okuryazar.blog · 2. ASAMA: HTTPS ────────────────────────────────────────
# Let's Encrypt sertifikasi alindiktan sonra kullanilan asil yapilandirma.
#   · 80 → 443 yonlendirmesi
#   · www.okuryazar.blog → okuryazar.blog yonlendirmesi (tek kanonik adres)
#   · Statik dosyalari (css/js/font/gorsel) nginx dogrudan servis eder;
#     Node.js yalnizca sayfalari uretir.

# 80: her sey HTTPS'e gider, ACME dogrulamasi haric.
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ www.__DOMAIN__;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
    location / {
        return 301 https://__DOMAIN__$request_uri;
    }
}

# www → koksuz adrese yonlendir (SEO icin tek kanonik adres).
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    __HTTP2__
    server_name www.__DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://__DOMAIN__$request_uri;
}

# Asil site.
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    __HTTP2__
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/__DOMAIN__/chain.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ssl_protocols / ssl_ciphers / ssl_session_* ayarlari certbot'un
    # options-ssl-nginx.conf dosyasindan gelir (yukarida include edildi);
    # burada tekrarlamak "duplicate directive" hatasi verir.
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # HSTS: tarayici bir daha bu siteye HTTP ile bagIanmayi denemez.
    # (preload listesine girmek isterseniz KURULUM.md'deki nota bakin)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size __MAXUPLOAD__M;
    server_tokens off;

    access_log /var/log/nginx/okuryazar.access.log;
    error_log  /var/log/nginx/okuryazar.error.log warn;

    # ── statik dosyalar (Node.js'e hic ugramaz) ────────────────────────────
    location ^~ /fonts/ {
        alias /opt/okuryazar/public/fonts/;
        expires 365d;
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }
    location ^~ /assets/ {
        alias /opt/okuryazar/public/assets/;
        expires 180d;
        add_header Cache-Control "public" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }
    location ^~ /css/ {
        alias /opt/okuryazar/public/css/;
        expires 7d;
        add_header Cache-Control "public" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }
    location ^~ /js/ {
        alias /opt/okuryazar/public/js/;
        expires 7d;
        add_header Cache-Control "public" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }

    # Yuklenen gorseller. Burada hicbir sey calistirilamaz: nginx yalnizca
    # dosya servis eder, betik motoru yoktur; yine de guvence altina aliyoruz.
    location ^~ /uploads/ {
        alias /var/lib/okuryazar/uploads/;
        expires 365d;
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Content-Security-Policy "default-src 'none'; sandbox" always;
        add_header Content-Disposition "inline" always;
        types { image/jpeg jpg jpeg; image/png png; image/webp webp; image/avif avif; image/gif gif; }
        default_type application/octet-stream;
        access_log off;
    }

    # ── giris sayfasi: ek hiz siniri ───────────────────────────────────────
    location = /giris {
        limit_req zone=okuryazar_giris burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";
    }

    # ── gizli/tehlikeli istekleri hemen kes ────────────────────────────────
    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; }
    location ~* \.(php|phtml|asp|aspx|jsp|cgi|pl|sh|bak|sql|env|git)$ { return 404; }

    # ── geri kalan her sey Node.js'e ───────────────────────────────────────
    location / {
        limit_req zone=okuryazar_genel burst=40 nodelay;
        limit_conn okuryazar_conn 24;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "";
        proxy_read_timeout 60s;
        proxy_buffering on;
    }

    # ACME yenileme dogrulamasi (certbot --webroot)
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
}
