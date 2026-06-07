#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${DEAF_NAVI_CODEX_SERVICE_NAME:-deaf-navi-codex-app-server}"
ENV_PATH="${DEAF_NAVI_CODEX_ENV_PATH:-/etc/deaf-navi-codex-app-server.env}"
LOG_TAG="${DEAF_NAVI_CODEX_LOG_TAG:-deaf-navi-codex-healthcheck}"

log() {
  logger -t "$LOG_TAG" -- "$*"
}

if [[ ! -r "$ENV_PATH" ]]; then
  log "env file is not readable: $ENV_PATH"
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_PATH"
set +a

PORT="${CODEX_APP_SERVER_PORT:-8789}"
TOKEN="${CODEX_APP_SERVER_TOKEN:-}"
DEEP_CHECK="${DEAF_NAVI_CODEX_HEALTHCHECK_DEEP:-1}"
TIMEOUT_SECONDS="${DEAF_NAVI_CODEX_HEALTHCHECK_TIMEOUT_SECONDS:-90}"
HEALTH_PATH="/health"
if [[ "$DEEP_CHECK" != "0" ]]; then
  HEALTH_PATH="/ready"
fi
HEALTH_URL="http://127.0.0.1:${PORT}${HEALTH_PATH}"

if [[ -z "$TOKEN" ]]; then
  log "CODEX_APP_SERVER_TOKEN is empty"
  exit 1
fi

if curl -fsS -m "$TIMEOUT_SECONDS" -H "Authorization: Bearer ${TOKEN}" "$HEALTH_URL" >/dev/null; then
  exit 0
fi

log "health check failed at ${HEALTH_PATH}; restarting ${SERVICE_NAME}"
pm2 restart "$SERVICE_NAME" --update-env >/dev/null
sleep 5

if curl -fsS -m "$TIMEOUT_SECONDS" -H "Authorization: Bearer ${TOKEN}" "$HEALTH_URL" >/dev/null; then
  log "service recovered after restart"
  exit 0
fi

log "service is still unhealthy after restart"
exit 1
