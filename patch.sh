#!/usr/bin/env sh
set -eu

# Переменная целевого домена (tg.vseti.top по умолчанию)
DOMAIN="${1:-tg.vseti.top}"
TARGET_DIR="${2:-.}"

if [ -d "$TARGET_DIR/telegram-tt" ]; then
  TARGET_DIR="$TARGET_DIR/telegram-tt"
fi

echo "==> [1/4] Удаление dist..."
rm -rf "$TARGET_DIR/dist" ./dist

echo "==> [2/4] Патчинг getWebSocketLink в PromisedWebSockets.ts..."
WS_FILE="$TARGET_DIR/src/lib/gramjs/extensions/PromisedWebSockets.ts"
if [ -f "$WS_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' 's/return `wss:\/\/${ip}:${port}\/apiws/if (ip.includes("?")) { const [h, q] = ip.split("?"); return `wss:\/\/${h}\/apiws${isTestServer ? "_test" : ""}${isPremium ? "_premium" : ""}?${q}`; } return `wss:\/\/${ip}:${port}\/apiws/g' "$WS_FILE"
  else
    sed -i 's/return `wss:\/\/${ip}:${port}\/apiws/if (ip.includes("?")) { const [h, q] = ip.split("?"); return `wss:\/\/${h}\/apiws${isTestServer ? "_test" : ""}${isPremium ? "_premium" : ""}?${q}`; } return `wss:\/\/${ip}:${port}\/apiws/g' "$WS_FILE"
  fi
  echo "    Файл $WS_FILE обновлен."
fi

echo "==> [3/4] Патчинг DC ipAddress в Utils.ts (перенос в query /wss?backend=zwsN)..."
UTILS_FILE="$TARGET_DIR/src/lib/gramjs/Utils.ts"
if [ -f "$UTILS_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s#ipAddress: \`zws\([1-5]\)\(\${downloadDC ? '-1' : ''}\)\.[^'\`]*\`#ipAddress: \`${DOMAIN}/wss?backend=zws\1\2\`#g" "$UTILS_FILE"
  else
    sed -i "s#ipAddress: \`zws\([1-5]\)\(\${downloadDC ? '-1' : ''}\)\.[^'\`]*\`#ipAddress: \`${DOMAIN}/wss?backend=zws\1\2\`#g" "$UTILS_FILE"
  fi
  echo "    Файл $UTILS_FILE обновлен."
fi

echo "==> [4/4] Замена web.telegram.org -> $DOMAIN..."
if [ "$(uname)" = "Darwin" ]; then
  find "$TARGET_DIR" -type f \
    ! -path '*/.git/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/.cache/*' \
    -exec sed -i '' "s#web\.telegram\.org#${DOMAIN}#g" {} +
else
  find "$TARGET_DIR" -type f \
    ! -path '*/.git/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/.cache/*' \
    -exec sed -i "s#web\.telegram\.org#${DOMAIN}#g" {} +
fi

echo "==> Патчинг успешно завершен для домена: $DOMAIN"
