#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${DATABASE_BACKUP_DIR:-./backups/postgres}"
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
output="$BACKUP_DIR/tanaghum-postgres-$timestamp.dump"
checksum="$output.sha256"
manifest="$BACKUP_DIR/latest.json"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$output"
sha256sum "$output" > "$checksum"
checksum_value="$(cut -d' ' -f1 "$checksum")"
cat > "$manifest" <<JSON
{
  "timestamp": "$timestamp",
  "backupFile": "$output",
  "checksumFile": "$checksum",
  "sha256": "$checksum_value",
  "format": "pg_dump_custom",
  "restoreVerification": "Run scripts/verify-postgres-backup.sh against this dump before go-live."
}
JSON

echo "Backup written: $output"
echo "Checksum written: $checksum"
echo "Manifest written: $manifest"
