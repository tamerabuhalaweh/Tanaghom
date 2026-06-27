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

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$output"
sha256sum "$output" > "$output.sha256"

echo "Backup written: $output"
echo "Checksum written: $output.sha256"
