#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${1:-tg.vseti.top}"
TARGET_DIR="${2:-.}"

node "$SCRIPT_DIR/patch.js" "$DOMAIN" "$TARGET_DIR"
