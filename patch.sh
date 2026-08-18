#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-.}"

node "$SCRIPT_DIR/patch.js" "$TARGET_DIR"
