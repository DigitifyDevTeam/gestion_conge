#!/usr/bin/env bash
# Run on the VPS after git pull and manual .env upload.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/gestion_conge/backend}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy backend/.env.example to backend/.env and fill values first."
  exit 1
fi

# Fix UTF-16 requirements.txt (Windows/OneDrive sometimes saves with BOM)
if grep -q $'\x00' requirements.txt 2>/dev/null; then
  echo "Converting requirements.txt from UTF-16 to UTF-8..."
  iconv -f UTF-16LE -t UTF-8 requirements.txt > requirements.txt.utf8
  mv requirements.txt.utf8 requirements.txt
fi

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

python manage.py migrate
python manage.py collectstatic --noinput

echo ""
echo "Done. Start Gunicorn (no sudo):"
echo "  cd backend && bash gunicorn-ctl.sh start"
echo "  python manage.py createsuperuser"
