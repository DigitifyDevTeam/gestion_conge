#!/usr/bin/env bash
# Start/stop Gunicorn without sudo (fallback if user systemd is unavailable).
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/gestion_conge/backend}"
PID_FILE="$APP_DIR/gunicorn.pid"
LOG_FILE="$APP_DIR/gunicorn.log"
VENV_GUNICORN="$APP_DIR/venv/bin/gunicorn"

cmd="${1:-start}"

cd "$APP_DIR"

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "$cmd" in
  start)
    if is_running; then
      echo "Gunicorn already running (pid $(cat "$PID_FILE"))"
      exit 0
    fi
    source venv/bin/activate
    nohup "$VENV_GUNICORN" \
      --workers 3 \
      --bind 127.0.0.1:8000 \
      --timeout 120 \
      --pid "$PID_FILE" \
      --log-file "$LOG_FILE" \
      backend.wsgi:application >> "$LOG_FILE" 2>&1 &
    sleep 1
    if is_running; then
      echo "Gunicorn started (pid $(cat "$PID_FILE"))"
    else
      echo "Failed to start. Check $LOG_FILE"
      exit 1
    fi
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PID_FILE")"
      rm -f "$PID_FILE"
      echo "Gunicorn stopped"
    else
      echo "Gunicorn not running"
    fi
    ;;
  restart)
    "$0" stop || true
    "$0" start
    ;;
  status)
    if is_running; then
      echo "Gunicorn running (pid $(cat "$PID_FILE"))"
    else
      echo "Gunicorn not running"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
