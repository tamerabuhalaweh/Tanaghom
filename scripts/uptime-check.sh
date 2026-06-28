#!/usr/bin/env bash
set -euo pipefail

PUBLIC_APP_URL="${PUBLIC_APP_URL:-}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"
EVIDENCE_PATH="${UPTIME_CHECK_EVIDENCE_PATH:-./ops/uptime-latest.json}"

if [[ -z "$PUBLIC_HEALTH_URL" ]]; then
  echo "PUBLIC_HEALTH_URL is required" >&2
  exit 2
fi

mkdir -p "$(dirname "$EVIDENCE_PATH")"

health_status="$(curl -fsS -o /tmp/tanaghum-uptime-health.json -w "%{http_code}" -m 20 "$PUBLIC_HEALTH_URL")"
app_status="not_configured"
if [[ -n "$PUBLIC_APP_URL" ]]; then
  app_status="$(curl -fsS -o /tmp/tanaghum-uptime-app.html -w "%{http_code}" -m 20 "$PUBLIC_APP_URL")"
fi

if [[ "$health_status" != "200" ]]; then
  echo "Health URL returned $health_status" >&2
  exit 1
fi

cat > "$EVIDENCE_PATH" <<JSON
{
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicAppConfigured": $([[ -n "$PUBLIC_APP_URL" ]] && echo true || echo false),
  "publicAppStatus": "$app_status",
  "publicHealthStatus": "$health_status",
  "status": "passed"
}
JSON

echo "Uptime check passed"
echo "Evidence written: $EVIDENCE_PATH"
