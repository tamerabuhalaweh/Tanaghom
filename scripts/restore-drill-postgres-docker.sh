#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tanaghum-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-tanaghum}"
POSTGRES_DB="${POSTGRES_DB:-tanaghum}"

if [[ -z "$backup_file" ]]; then
  echo "Usage: scripts/restore-drill-postgres-docker.sh <backup.dump>" >&2
  exit 2
fi

if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 2
fi

backup_dir="$(dirname "$backup_file")"
restore_db="tanaghum_restore_drill_$(date -u +%Y%m%dT%H%M%SZ)"
manifest="$backup_dir/restore-drill-latest.json"

docker exec "$POSTGRES_CONTAINER" createdb -U "$POSTGRES_USER" "$restore_db"
cleanup() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $restore_db;" >/dev/null
}
trap cleanup EXIT

cat "$backup_file" | docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$restore_db" --no-owner --no-privileges >/tmp/tanaghum-restore-drill.log 2>&1

table_count="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$restore_db" -tAc "select count(*) from information_schema.tables where table_schema='public';")"
if [[ "${table_count:-0}" -lt 1 ]]; then
  echo "Restore drill failed: restored database has no public tables" >&2
  exit 1
fi

cat > "$manifest" <<JSON
{
  "restoredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backupFile": "$backup_file",
  "sourceDatabase": "$POSTGRES_DB",
  "restoreDatabase": "$restore_db",
  "tableCount": $table_count,
  "status": "passed"
}
JSON

echo "Restore drill passed: $backup_file"
echo "Manifest written: $manifest"
