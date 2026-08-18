# Stage 1: Сборка фронтенда telegram-tt
FROM node:24-alpine AS builder

WORKDIR /app

# Устанавливаем git для клонирования исходного репозитория
RUN apk add --no-cache git

# Аргументы сборки
ARG REPO_URL=https://github.com/Ajaxy/telegram-tt.git
ARG BRANCH=master
ARG APP_ENV=production

# 1. Клонируем исходный репозиторий telegram-tt
RUN git clone --depth 1 --branch ${BRANCH} ${REPO_URL} .

# 2. Копируем и запускаем скрипты патчинга (динамический домен в runtime, инъекция credentials)
COPY patch.js patch.sh /tmp/
RUN chmod +x /tmp/patch.sh && /tmp/patch.sh /app

# 3. Установка зависимостей (и доустановка peer-зависимости @floating-ui/dom для @tiptap)
RUN --mount=type=cache,target=/root/.npm \
    (npm ci || npm install) && npm i @floating-ui/dom --no-save

# 4. Переменные окружения для сборщика Vite
ENV APP_ENV=${APP_ENV}

# 5. Сборка проекта
RUN npm run build:production

# Stage 2: Раздача статики и проксирование через Nginx
FROM nginx:alpine

# Конфигурация Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранную статику из builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
