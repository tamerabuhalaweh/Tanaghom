#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tanaghum-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-tanaghum}"
POSTGRES_DB="${POSTGRES_DB:-tanaghum}"
APP_CONTAINER="${RESTORE_DRILL_APP_CONTAINER:-tanaghum-hybrid-app}"
LOGIN_EMAIL="${RESTORE_DRILL_LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${RESTORE_DRILL_LOGIN_PASSWORD:-}"
LOGIN_PASSWORD_FILE="${RESTORE_DRILL_LOGIN_PASSWORD_FILE:-}"

if [[ -z "$LOGIN_PASSWORD" && -n "$LOGIN_PASSWORD_FILE" && -f "$LOGIN_PASSWORD_FILE" ]]; then
  LOGIN_PASSWORD="$(cat "$LOGIN_PASSWORD_FILE")"
fi

if [[ -z "$backup_file" ]]; then
  echo "Usage: RESTORE_DRILL_LOGIN_EMAIL=<email> RESTORE_DRILL_LOGIN_PASSWORD=<password> $0 <backup.dump>" >&2
  exit 2
fi
if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 2
fi
if [[ -z "$LOGIN_EMAIL" || -z "$LOGIN_PASSWORD" ]]; then
  echo "RESTORE_DRILL_LOGIN_EMAIL and RESTORE_DRILL_LOGIN_PASSWORD or RESTORE_DRILL_LOGIN_PASSWORD_FILE are required" >&2
  exit 2
fi
if [[ -f "$backup_file.sha256" ]]; then
  sha256sum --check "$backup_file.sha256" >/dev/null
fi

backup_dir="$(dirname "$backup_file")"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
restore_db="tanaghum_restore_drill_$timestamp"
drill_container="tanaghum-restore-drill-app-$timestamp"
manifest="$backup_dir/restore-drill-latest.json"
env_file="$(mktemp)"
inspect_file="$(mktemp)"
counts_file="$(mktemp)"

cleanup() {
  docker rm -f "$drill_container" >/dev/null 2>&1 || true
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $restore_db;" >/dev/null 2>&1 || true
  rm -f "$env_file" "$inspect_file" "$counts_file"
}
trap cleanup EXIT

docker exec "$POSTGRES_CONTAINER" createdb -U "$POSTGRES_USER" "$restore_db"
cat "$backup_file" | docker exec -i "$POSTGRES_CONTAINER" pg_restore \
  -U "$POSTGRES_USER" -d "$restore_db" --no-owner --no-privileges \
  >/tmp/tanaghum-restore-drill.log 2>&1

table_count="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$restore_db" -tAc \
  "select count(*) from information_schema.tables where table_schema='public';")"
if [[ "${table_count:-0}" -lt 1 ]]; then
  echo "Restore drill failed: restored database has no public tables" >&2
  exit 1
fi

for table in tenants users tenant_memberships commercial_events commercial_plans lead_capture_records; do
  exists="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$restore_db" -tAc \
    "select to_regclass('public.$table') is not null;")"
  if [[ "$exists" == "t" ]]; then
    count="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$restore_db" -tAc \
      "select count(*) from \"$table\";")"
    printf '%s\t%s\n' "$table" "$count" >> "$counts_file"
  fi
done

docker inspect "$APP_CONTAINER" "$POSTGRES_CONTAINER" > "$inspect_file"
common_network="$(INSPECT_FILE="$inspect_file" APP_CONTAINER="$APP_CONTAINER" POSTGRES_CONTAINER="$POSTGRES_CONTAINER" python3 - <<'PY'
import json, os
items = json.load(open(os.environ['INSPECT_FILE']))
by_name = {item['Name'].lstrip('/'): item for item in items}
app = set(by_name[os.environ['APP_CONTAINER']]['NetworkSettings']['Networks'])
postgres = set(by_name[os.environ['POSTGRES_CONTAINER']]['NetworkSettings']['Networks'])
common = sorted(app & postgres)
if not common:
    raise SystemExit('No common Docker network between application and PostgreSQL containers')
print(common[0])
PY
)"

source_database_url="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$APP_CONTAINER" | sed -n 's/^DATABASE_URL=//p' | head -1)"
if [[ -z "$source_database_url" ]]; then
  echo "Could not resolve DATABASE_URL from $APP_CONTAINER" >&2
  exit 1
fi
restore_database_url="$(SOURCE_DATABASE_URL="$source_database_url" RESTORE_DB="$restore_db" python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit
source = urlsplit(os.environ['SOURCE_DATABASE_URL'])
print(urlunsplit((source.scheme, source.netloc, '/' + os.environ['RESTORE_DB'], source.query, source.fragment)))
PY
)"

docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$APP_CONTAINER" \
  | grep -v '^DATABASE_URL=' > "$env_file"
printf 'DATABASE_URL=%s\n' "$restore_database_url" >> "$env_file"
chmod 600 "$env_file"

app_image="$(docker inspect -f '{{.Config.Image}}' "$APP_CONTAINER")"
docker run -d --name "$drill_container" --network "$common_network" \
  --env-file "$env_file" -e PORT=4000 "$app_image" >/dev/null

health_status="000"
for _ in $(seq 1 30); do
  health_status="$(docker exec "$drill_container" node -e \
    "fetch('http://127.0.0.1:4000/health').then(r=>console.log(r.status)).catch(()=>console.log('000'))" 2>/dev/null || true)"
  [[ "$health_status" == "200" ]] && break
  sleep 1
done
if [[ "$health_status" != "200" ]]; then
  docker logs "$drill_container" >&2
  echo "Restore drill failed: isolated application health check returned $health_status" >&2
  exit 1
fi

login_status="$(docker exec \
  -e DRILL_EMAIL="$LOGIN_EMAIL" \
  -e DRILL_PASSWORD="$LOGIN_PASSWORD" \
  "$drill_container" node -e \
  "fetch('http://127.0.0.1:4000/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.DRILL_EMAIL,password:process.env.DRILL_PASSWORD})}).then(r=>console.log(r.status)).catch(()=>console.log('000'))")"
if [[ "$login_status" != "200" ]]; then
  echo "Restore drill failed: isolated application login returned $login_status" >&2
  exit 1
fi

RESTORED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
BACKUP_FILE="$(basename "$backup_file")" \
SOURCE_DATABASE="$POSTGRES_DB" \
TABLE_COUNT="$table_count" \
COUNTS_FILE="$counts_file" \
MANIFEST="$manifest" \
python3 - <<'PY'
import json, os
counts = {}
with open(os.environ['COUNTS_FILE']) as handle:
    for line in handle:
        table, value = line.rstrip('\n').split('\t', 1)
        counts[table] = int(value)
manifest = {
    'restoredAt': os.environ['RESTORED_AT'],
    'backupFile': os.environ['BACKUP_FILE'],
    'sourceDatabase': os.environ['SOURCE_DATABASE'],
    'isolatedRestore': True,
    'tableCount': int(os.environ['TABLE_COUNT']),
    'criticalTableRecordCounts': counts,
    'applicationHealthValidation': 'passed',
    'applicationLoginValidation': 'passed',
    'rawCredentialsReturned': False,
    'status': 'passed',
}
with open(os.environ['MANIFEST'], 'w') as handle:
    json.dump(manifest, handle, indent=2)
    handle.write('\n')
PY

echo "Restore drill passed: $backup_file"
echo "Isolated application health and login validation passed."
echo "Manifest written: $manifest"
