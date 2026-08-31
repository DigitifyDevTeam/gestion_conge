#!/usr/bin/env bash
# Start/stop Gunicorn without sudo. Run from backend/: bash gunicorn-ctl.sh start
set -eo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/gunicorn.pid"
LOG_FILE="$APP_DIR/gunicorn.log"
VENV_GUNICORN="$APP_DIR/venv/bin/gunicorn"

cmd="${1:-start}"
cmd="${cmd//$'\r'/}"

cd "$APP_DIR"

_resolve_env_file() {
  local active_file="$APP_DIR/.env.active"
  local app_env="local"
  if [[ -f "$active_file" ]]; then
    app_env=$(tr -d '\r\n' < "$active_file")
  fi
  if [[ -f "$APP_DIR/.env.$app_env" ]]; then
    echo "$APP_DIR/.env.$app_env"
  elif [[ -f "$APP_DIR/.env" ]]; then
    echo "$APP_DIR/.env"
  fi
}

ENV_FILE="$(_resolve_env_file)"
if [[ -n "${ENV_FILE:-}" && -f "$ENV_FILE" ]]; then
  _gb=$(grep -E '^GUNICORN_BIND=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)
  if [[ -n "${_gb:-}" ]]; then
    export GUNICORN_BIND="$_gb"
  fi
fi
BIND="${GUNICORN_BIND:-127.0.0.1:8001}"

port_from_bind() {
  echo "${BIND##*:}"
}

port_in_use() {
  local port="$1"
  ss -tln 2>/dev/null | grep -q ":${port} "
}

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

responds() {
  local code
  code=$(curl -s -o /dev/null -m 3 -w "%{http_code}" "http://$BIND/api/" 2>/dev/null || echo "000")
  [[ "$code" =~ ^[0-9]+$ && "$code" != "000" ]]
}

show_log_tail() {
  if [[ -f "$LOG_FILE" ]]; then
    echo "--- Last lines of $LOG_FILE ---"
    tail -n 20 "$LOG_FILE"
  else
    echo "No log file at $LOG_FILE"
  fi
}

case "$cmd" in
  check)
    port="$(port_from_bind)"
    echo "Configured bind: $BIND"
    if port_in_use "$port"; then
      echo "Port $port is IN USE."
      curl -s "http://$BIND/api/" || true
      echo ""
    else
      echo "Port $port is free."
    fi
    if is_running; then
      echo "Gunicorn pid: $(cat "$PID_FILE")"
    else
      echo "No gunicorn pid file."
    fi
    ;;
  start)
    port="$(port_from_bind)"
    if is_running; then
      echo "Gunicorn already running (pid $(cat "$PID_FILE"))"
      exit 0
    fi
    if port_in_use "$port"; then
      echo "ERROR: Port $port already in use by another process."
      ss -tln | grep ":${port} " || true
      exit 1
    fi
    rm -f "$PID_FILE"
    if [[ ! -x "$VENV_GUNICORN" ]]; then
      echo "Missing $VENV_GUNICORN"
      exit 1
    fi
    if [[ -f "$APP_DIR/.env.production" ]]; then
      if [[ ! -f "$APP_DIR/.env.active" ]] || [[ "$(tr -d '\r\n' < "$APP_DIR/.env.active")" != "production" ]]; then
        echo "production" > "$APP_DIR/.env.active"
        echo "Set .env.active to production"
      fi
    fi
    if [[ -z "${ENV_FILE:-}" || ! -f "$ENV_FILE" ]]; then
      echo "Missing env file. Create backend/.env.production or backend/.env.active"
      exit 1
    fi
    echo "Using env file: $ENV_FILE"
    echo "Starting gunicorn on $BIND ..."
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
    if is_running && port_in_use "$port"; then
      echo "Gunicorn started (pid $(cat "$PID_FILE"), bind $BIND)"
      echo "Test: curl http://$BIND/api/"
    else
      echo "Gunicorn failed to start."
      show_log_tail
      rm -f "$PID_FILE"
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
    bash "$0" stop || true
    sleep 1
    bash "$0" start
    ;;
  status)
    port="$(port_from_bind)"
    if is_running && port_in_use "$port"; then
      echo "Gunicorn running (pid $(cat "$PID_FILE"), bind $BIND)"
      responds && echo "API responding on http://$BIND/api/"
    else
      echo "Gunicorn not running on $BIND"
      show_log_tail
      exit 1
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  config)
    if [[ -z "${ENV_FILE:-}" || ! -f "$ENV_FILE" ]]; then
      echo "Missing env file."
      exit 1
    fi
    echo "Env file: $ENV_FILE"
    if [[ -f "$APP_DIR/.env.active" ]]; then
      echo "Active: $(tr -d '\r\n' < "$APP_DIR/.env.active")"
    fi
    "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" shell -c "
from django.conf import settings
print('DEBUG', settings.DEBUG)
print('FRONTEND_URL', settings.FRONTEND_URL)
print('EMAIL_BACKEND', settings.EMAIL_BACKEND)
print('EMAIL_HOST_USER', settings.EMAIL_HOST_USER)
"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|check|config}"
    exit 1
    ;;
esac
