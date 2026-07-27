#!/usr/bin/env bash
set -euo pipefail

POSTIZ_DIR="${POSTIZ_DIR:-/opt/postiz}"
POSTIZ_HOST="${POSTIZ_HOST:-postiz.155-117-45-45.sslip.io}"
POSTIZ_VERSION="${POSTIZ_VERSION:-v2.22.1}"
CADDYFILE="${CADDYFILE:-/opt/tanaghum-backup/Caddyfile.backup}"
CADDY_CONTAINER="${CADDY_CONTAINER:-tanaghum-backup-caddy}"
SHARED_NETWORK="${SHARED_NETWORK:-tanaghum-backup_internal}"

COMPOSE_FILE="${POSTIZ_DIR}/docker-compose.yaml"
ENV_FILE="${POSTIZ_DIR}/.env"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Postiz compose file not found at ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${CADDYFILE}" ]]; then
  echo "Caddyfile not found at ${CADDYFILE}" >&2
  exit 1
fi

if ! docker network inspect "${SHARED_NETWORK}" >/dev/null 2>&1; then
  echo "Shared Docker network ${SHARED_NETWORK} is missing" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  umask 077
  {
    printf 'POSTIZ_JWT_SECRET=%s\n' "$(openssl rand -hex 48)"
    printf 'POSTIZ_DB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'TEMPORAL_DB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  } > "${ENV_FILE}"
fi
chmod 600 "${ENV_FILE}"

sed -i \
  -e "s#ghcr.io/gitroomhq/postiz-app:latest#ghcr.io/gitroomhq/postiz-app:${POSTIZ_VERSION}#" \
  -e "s#MAIN_URL: 'http://localhost:4007'#MAIN_URL: 'https://${POSTIZ_HOST}'#" \
  -e "s#FRONTEND_URL: 'http://localhost:4007'#FRONTEND_URL: 'https://${POSTIZ_HOST}'#" \
  -e "s#NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4007/api'#NEXT_PUBLIC_BACKEND_URL: 'https://${POSTIZ_HOST}/api'#" \
  -e "s#JWT_SECRET: 'random string that is unique to every install - just type random characters here!'#JWT_SECRET: '\${POSTIZ_JWT_SECRET}'#" \
  -e "s#postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local#postgresql://postiz-user:\${POSTIZ_DB_PASSWORD}@postiz-postgres:5432/postiz-db-local#" \
  -e "s#POSTGRES_PASSWORD: postiz-password#POSTGRES_PASSWORD: '\${POSTIZ_DB_PASSWORD}'#" \
  -e "s#POSTGRES_PASSWORD: temporal#POSTGRES_PASSWORD: '\${TEMPORAL_DB_PASSWORD}'#" \
  -e "s#POSTGRES_PWD=temporal#POSTGRES_PWD=\${TEMPORAL_DB_PASSWORD}#" \
  -e 's#"4007:5000"#"127.0.0.1:4007:5000"#' \
  -e "s#'127.0.0.1:8080:8080'#'127.0.0.1:8081:8080'#" \
  "${COMPOSE_FILE}"

if ! grep -q -- "- ${SHARED_NETWORK}" "${COMPOSE_FILE}"; then
  sed -i "/^      - temporal-network$/a\\      - ${SHARED_NETWORK}" "${COMPOSE_FILE}"
fi

if ! grep -q "^  ${SHARED_NETWORK}:$" "${COMPOSE_FILE}"; then
  {
    printf '\n'
    printf '  %s:\n' "${SHARED_NETWORK}"
    printf '    external: true\n'
  } >> "${COMPOSE_FILE}"
fi

if ! grep -q "^${POSTIZ_HOST} {" "${CADDYFILE}"; then
  {
    printf '\n%s {\n' "${POSTIZ_HOST}"
    printf '  encode zstd gzip\n'
    printf '  reverse_proxy postiz:5000\n'
    printf '  header {\n'
    printf '    Strict-Transport-Security "max-age=31536000; includeSubDomains"\n'
    printf '    X-Content-Type-Options "nosniff"\n'
    printf '    X-Frame-Options "SAMEORIGIN"\n'
    printf '    Referrer-Policy "strict-origin-when-cross-origin"\n'
    printf '  }\n'
    printf '  log {\n'
    printf '    output stdout\n'
    printf '    format console\n'
    printf '  }\n'
    printf '}\n'
  } >> "${CADDYFILE}"
fi

cd "${POSTIZ_DIR}"
docker compose config --quiet
docker compose pull
docker compose up -d
docker exec "${CADDY_CONTAINER}" caddy validate --config /etc/caddy/Caddyfile
docker exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile

deadline=$((SECONDS + 600))
while (( SECONDS < deadline )); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' postiz 2>/dev/null || true)"
  if [[ "${status}" == "healthy" ]]; then
    printf 'Postiz is healthy at https://%s\n' "${POSTIZ_HOST}"
    exit 0
  fi
  if [[ "${status}" == "unhealthy" ]]; then
    docker logs --tail 100 postiz >&2
    exit 1
  fi
  sleep 10
done

echo "Postiz did not become healthy within 10 minutes" >&2
docker compose ps >&2
docker logs --tail 100 postiz >&2
exit 1
