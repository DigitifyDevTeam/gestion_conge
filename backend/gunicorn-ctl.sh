#!/usr/bin/env bash
# Start/stop Gunicorn without sudo. Run from backend/: bash gunicorn-ctl.sh start
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/gunicorn.pid"
LOG_FILE="$APP_DIR/gunicorn.log"
VENV_GUNICORN="$APP_DIR/venv/bin/gunicorn"

cmd="${1:-start}"

cd "$APP_DIR"

if [[ -f .env ]]; then
  _gb=$(grep -E '^GUNICORN_BIND=' .env | tail -1 | cut -d= -f2- | tr -d '\r')
  if [[ -n "$_gb" ]]; then
    export GUNICORN_BIND="$_gb"
  fi
fi
BIND="${GUNICORN_BIND:-127.0.0.1:8001}"

port_from_bind() {
  echo "${BIND##*:}"
}

host_from_bind() {
  echo "${BIND%%:*}"
}

port_in_use() {
  local port="$1"
  ss -tln 2>/dev/null | awk -v p=":${port}" '$4 ~ p { found=1 } END { exit !found }'
}

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

responds() {
  # Django returns 404 on /api/ — any HTTP response means gunicorn is up
  local code
  code=$(curl -s -o /dev/null -m 3 -w "%{http_code}" "http://$BIND/api/" 2>/dev/null || echo "000")
  [[ "$code" != "000" && "$code" != "000000" ]]
}

show_log_tail() {
  if [[ -f "$LOG_FILE" ]]; then
    echo "--- Last lines of $LOG_FILE ---"
    tail -n 20 "$LOG_FILE"
  fi
}

case "$cmd" in
  check)
    port="$(port_from_bind)"
    echo "Configured bind: $BIND"
    if port_in_use "$port"; then
      echo "Port $port is IN USE."
      echo "Test API: curl http://$BIND/api/"
      curl -s "http://$BIND/api/" || true
      echo ""
    else
      echo "Port $port is free."
    fi
    if is_running; then
      echo "Our gunicorn pid: $(cat "$PID_FILE")"
    else
      echo "Our gunicorn is not running (no valid pid file)."
    fi
    ;;
  start)
    port="$(port_from_bind)"
    if port_in_use "$port"; then
      echo "ERROR: Port $port is already in use."
      echo "Another process owns it (maybe an old gunicorn)."
      echo ""
      echo "Try:"
      echo "  ss -tln | grep 8001"
      echo "  GUNICORN_BIND=127.0.0.1:8002 bash gunicorn-ctl.sh start"
      exit 1
    fi
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
    if is_running && responds; then
      echo "Gunicorn started (pid $(cat "$PID_FILE"), bind $BIND)"
      echo "Nginx must proxy to: http://$BIND"
    else
      echo "Gunicorn failed to start or is not responding."
      rm -f "$PID_FILE"
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
    if is_running && responds; then
      echo "Gunicorn running (pid $(cat "$PID_FILE"), bind $BIND)"
    else
      echo "Gunicorn not running or not responding on $BIND"
      show_log_tail
      exit 1
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|check}"
    exit 1
    ;;
esac
