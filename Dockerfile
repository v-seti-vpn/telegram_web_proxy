# syntax=docker/dockerfile:1

# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:24-alpine AS deps

WORKDIR /app

# Берём только package manifests из upstream.
# Пока они не меняются, npm ci будет брать готовый слой из BuildKit cache.
COPY --from=upstream /package.json /package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci \
        --prefer-offline \
        --no-audit \
        --no-fund \
    && npm install @floating-ui/dom \
        --no-save \
        --prefer-offline \
        --no-audit \
        --no-fund


# ==========================================
# Stage 2: Build telegram-tt
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /app

ARG APP_ENV=production

# Полный upstream source.
COPY --from=upstream / ./

# Готовые зависимости из отдельного кешируемого stage.
COPY --from=deps /app/node_modules ./node_modules

# Наши патчи идут ПОСЛЕ dependencies,
# поэтому изменение patch.js / patch.sh не инвалидирует npm ci.
COPY patch.js patch.sh /tmp/

RUN chmod +x /tmp/patch.sh \
    && /tmp/patch.sh /app

ENV APP_ENV=${APP_ENV}

RUN npm run build:production


# ==========================================
# Stage 3: Runtime
# ==========================================
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]