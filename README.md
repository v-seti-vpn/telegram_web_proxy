# Telegram Web Proxy
На самом деле это не совсем прокси, а уже скорее зеркало.

### Схема работы:
```
User -> TLS (любой домен) -> Внешний Nginx -> Docker контейнер (Nginx) -> TLS (telegram domain) -> Telegram сервер
```

Таким образом наш сервер становится прозрачным посредником между клиентом и датацентрами Telegram

---

## 🚀 Быстрый старт

### 1. Запуск готового образа через Docker Compose
```yaml
services:
  telegramwebproxy:
    image: ghcr.io/v-seti-vpn/telegram_web_proxy:latest
    container_name: telegram-tt
    restart: unless-stopped
    ports:
      - "5002:80"
```
```bash
docker compose up -d
```

---

## 🌐 Конфигурация внешнего Nginx (на хост-машине)

Внешний Nginx принимает HTTPS и перенаправляет трафик в локальный Docker-контейнер:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name ДОМЕН; # или любой ваш домен

    ssl_certificate     .../fullchain.pem;
    ssl_certificate_key .../privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5002;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 1d;
        proxy_read_timeout 1d;
    }
}
```

По всем вопросам: https://t.me/v_seti_vpn?direct