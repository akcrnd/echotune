#!/bin/sh
set -eu

DATA_FILE_PATH="${DATA_FILE_PATH:-/data/data.json}"
SEED_FILE="/app/data.seed.json"

mkdir -p "$(dirname "$DATA_FILE_PATH")"

if [ ! -f "$DATA_FILE_PATH" ] && [ -f "$SEED_FILE" ]; then
  cp "$SEED_FILE" "$DATA_FILE_PATH"
fi

exec "$@"
