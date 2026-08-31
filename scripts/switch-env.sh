#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-}"
if [[ "$ENV_NAME" != "local" && "$ENV_NAME" != "production" ]]; then
  echo "Usage: $0 {local|production}"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
ACTIVE="$BACKEND/.env.active"
SOURCE="$BACKEND/.env.$ENV_NAME"

if [[ ! -f "$SOURCE" ]]; then
  EXAMPLE="$BACKEND/.env.$ENV_NAME.example"
  if [[ -f "$EXAMPLE" ]]; then
    cp "$EXAMPLE" "$SOURCE"
    echo "Created $SOURCE from example — edit it with your values."
  else
    echo "Missing $SOURCE"
    exit 1
  fi
fi

printf '%s' "$ENV_NAME" > "$ACTIVE"
echo "Active environment: $ENV_NAME"
echo "Loaded from: backend/.env.$ENV_NAME"
echo "Restart Gunicorn/runserver if already running."
