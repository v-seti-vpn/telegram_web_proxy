# Stage 1: Сборка фронтенда telegram-tt
FROM node:24-alpine AS builder

WORKDIR /app

# Устанавливаем git и findutils для работы patch.sh
RUN apk add --no-cache git findutils

# Аргументы сборки
ARG REPO_URL=https://github.com/Ajaxy/telegram-tt.git
ARG BRANCH=master
ARG DOMAIN=tg.vseti.top
ARG TELEGRAM_API_ID=1025907
ARG TELEGRAM_API_HASH=452b0359b988148995f22ff0f4229750
ARG APP_ENV=production
ARG BASE_URL=https://${DOMAIN}/a/

# 1. Клонируем исходный репозиторий telegram-tt
RUN git clone --depth 1 --branch ${BRANCH} ${REPO_URL} .

# 2. Копируем и запускаем скрипт патчинга (удаление dist, замена домена и query-параметров ipAddress)
COPY patch.sh /tmp/patch.sh
RUN chmod +x /tmp/patch.sh && /tmp/patch.sh "${DOMAIN}" /app

# 3. Установка зависимостей (и доустановка peer-зависимости @floating-ui/dom для @tiptap)
RUN --mount=type=cache,target=/root/.npm \
    (npm ci || npm install) && npm i @floating-ui/dom --no-save

# 4. Переменные окружения для сборщика Vite
ENV TELEGRAM_API_ID=${TELEGRAM_API_ID}
ENV TELEGRAM_API_HASH=${TELEGRAM_API_HASH}
ENV APP_ENV=${APP_ENV}
ENV BASE_URL=${BASE_URL}

# 5. Сборка проекта
RUN npm run build:production

# Stage 2: Раздача статики через Nginx
FROM nginx:alpine

# Конфигурация Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранную статику из builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
