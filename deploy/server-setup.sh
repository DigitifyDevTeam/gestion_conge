#!/usr/bin/env bash
# Run on the VPS after git pull and manual .env upload.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/gestion_conge/backend}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy backend/.env.example to backend/.env and fill values first."
  exit 1
fi

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

python manage.py migrate
python manage.py collectstatic --noinput

echo "Done. Test with:"
echo "  gunicorn --bind 127.0.0.1:8000 backend.wsgi:application"
