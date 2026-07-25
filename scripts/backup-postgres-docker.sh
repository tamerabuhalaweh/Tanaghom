#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tanaghum-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-tanaghum}"
POSTGRES_DB="${POSTGRES_DB:-tanaghum}"
BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/tanaghum/postgres}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
output="$BACKUP_DIR/tanaghum-postgres-$timestamp.dump"
checksum="$output.sha256"
manifest="$BACKUP_DIR/latest.json"

docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-privileges > "$output"

sha256sum "$output" > "$checksum"
checksum_value="$(cut -d' ' -f1 "$checksum")"

cat > "$manifest" <<JSON
{
  "timestamp": "$timestamp",
  "backupFile": "$output",
  "checksumFile": "$checksum",
  "sha256": "$checksum_value",
  "format": "pg_dump_custom",
  "source": "docker:$POSTGRES_CONTAINER/$POSTGRES_DB",
  "restoreVerification": "Run scripts/verify-postgres-backup-docker.sh against this dump before production go-live."
}
JSON

echo "Backup written: $output"
echo "Checksum written: $checksum"
echo "Manifest written: $manifest"

if [[ "${BACKUP_PRUNE_AFTER_SUCCESS:-true}" == "true" ]]; then
  DATABASE_BACKUP_DIR="$BACKUP_DIR" \
  BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}" \
  BACKUP_MIN_KEEP="${BACKUP_MIN_KEEP:-7}" \
    /bin/bash "$(dirname "$0")/prune-postgres-backups.sh"
fi
