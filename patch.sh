#!/usr/bin/env sh
set -eu

# Переменная целевого домена (tg.vseti.top по умолчанию)
DOMAIN="${1:-tg.vseti.top}"
TARGET_DIR="${2:-.}"

if [ -d "$TARGET_DIR/telegram-tt" ]; then
  TARGET_DIR="$TARGET_DIR/telegram-tt"
fi

echo "==> [1/3] Удаление dist..."
rm -rf "$TARGET_DIR/dist" ./dist

echo "==> [2/3] Патчинг DC ipAddress в Utils.ts (перенос в query /wss?d=zwsN)..."
UTILS_FILE="$TARGET_DIR/src/lib/gramjs/Utils.ts"
if [ -f "$UTILS_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s#ipAddress: \`zws\([1-5]\)\(\${downloadDC ? '-1' : ''}\)\.[^'\`]*\`#ipAddress: \`${DOMAIN}/wss?d=zws\1\2\`#g" "$UTILS_FILE"
  else
    sed -i "s#ipAddress: \`zws\([1-5]\)\(\${downloadDC ? '-1' : ''}\)\.[^'\`]*\`#ipAddress: \`${DOMAIN}/wss?d=zws\1\2\`#g" "$UTILS_FILE"
  fi
fi

echo "==> [3/3] Замена web.telegram.org -> $DOMAIN..."
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
