#!/usr/bin/env bash
set -euo pipefail

PUBLIC_APP_URL="${PUBLIC_APP_URL:-}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"
EVIDENCE_PATH="${UPTIME_CHECK_EVIDENCE_PATH:-./ops/uptime-latest.json}"
CONNECT_TIMEOUT_SECONDS="${UPTIME_CONNECT_TIMEOUT_SECONDS:-10}"
TOTAL_TIMEOUT_SECONDS="${UPTIME_TOTAL_TIMEOUT_SECONDS:-20}"

if [[ -z "$PUBLIC_HEALTH_URL" ]]; then
  echo "PUBLIC_HEALTH_URL is required" >&2
  exit 2
fi

mkdir -p "$(dirname "$EVIDENCE_PATH")"

probe() {
  local url="$1"
  local output="$2"
  curl -sS -o "$output" \
    --connect-timeout "$CONNECT_TIMEOUT_SECONDS" \
    --max-time "$TOTAL_TIMEOUT_SECONDS" \
    -w "%{http_code} %{time_total}" \
    "$url" || printf '000 0'
}

read -r health_status health_duration <<< "$(probe "$PUBLIC_HEALTH_URL" /tmp/tanaghum-uptime-health.json)"
app_status="not_configured"
app_duration="0"
if [[ -n "$PUBLIC_APP_URL" ]]; then
  read -r app_status app_duration <<< "$(probe "$PUBLIC_APP_URL" /tmp/tanaghum-uptime-app.html)"
fi

status="passed"
if [[ "$health_status" != "200" ]] || [[ -n "$PUBLIC_APP_URL" && "$app_status" != "200" ]]; then
  status="failed"
fi

cat > "$EVIDENCE_PATH" <<JSON
{
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicAppConfigured": $([[ -n "$PUBLIC_APP_URL" ]] && echo true || echo false),
  "publicAppStatus": "$app_status",
  "publicAppDurationSeconds": $app_duration,
  "publicHealthStatus": "$health_status",
  "publicHealthDurationSeconds": $health_duration,
  "status": "$status"
}
JSON

echo "Evidence written: $EVIDENCE_PATH"

if [[ "$status" != "passed" ]]; then
  echo "Uptime check failed: app=$app_status health=$health_status" >&2
  exit 1
fi

echo "Uptime check passed"
