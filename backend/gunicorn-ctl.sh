#!/usr/bin/env bash
# Start/stop Gunicorn without sudo. Run from anywhere: bash gunicorn-ctl.sh start
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/gunicorn.pid"
LOG_FILE="$APP_DIR/gunicorn.log"
VENV_GUNICORN="$APP_DIR/venv/bin/gunicorn"
BIND="${GUNICORN_BIND:-127.0.0.1:8000}"

cmd="${1:-start}"

cd "$APP_DIR"

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

show_log_tail() {
  if [[ -f "$LOG_FILE" ]]; then
    echo "--- Last lines of $LOG_FILE ---"
    tail -n 20 "$LOG_FILE"
  fi
}

case "$cmd" in
  start)
    if is_running; then
      echo "Gunicorn already running (pid $(cat "$PID_FILE"))"
      exit 0
    fi
    rm -f "$PID_FILE"
    if [[ ! -x "$VENV_GUNICORN" ]]; then
      echo "Missing $VENV_GUNICORN — run: python3 -m venv venv && pip install -r requirements.txt"
      exit 1
    fi
    if [[ ! -f .env ]]; then
      echo "Missing $APP_DIR/.env"
      exit 1
    fi
    "$VENV_GUNICORN" \
      --daemon \
      --workers 3 \
      --bind "$BIND" \
      --timeout 120 \
      --pid "$PID_FILE" \
      --access-logfile "$LOG_FILE" \
      --error-logfile "$LOG_FILE" \
      --capture-output \
      backend.wsgi:application
    sleep 2
    if is_running; then
      echo "Gunicorn started (pid $(cat "$PID_FILE"), bind $BIND)"
    else
      echo "Gunicorn failed to start."
      show_log_tail
      exit 1
    fi
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PID_FILE")"
      rm -f "$PID_FILE"
      echo "Gunicorn stopped"
    else
      rm -f "$PID_FILE"
      echo "Gunicorn not running"
    fi
    ;;
  restart)
    "$0" stop || true
    sleep 1
    "$0" start
    ;;
  status)
    if is_running; then
      echo "Gunicorn running (pid $(cat "$PID_FILE"), bind $BIND)"
    else
      echo "Gunicorn not running"
      show_log_tail
      exit 1
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
