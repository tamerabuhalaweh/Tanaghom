#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
POSTGRES_VERIFY_IMAGE="${POSTGRES_VERIFY_IMAGE:-postgres:16-alpine}"

if [[ -z "$backup_file" ]]; then
  echo "Usage: scripts/verify-postgres-backup-docker.sh <backup.dump>" >&2
  exit 1
fi

if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 1
fi

checksum_file="$backup_file.sha256"
if [[ ! -f "$checksum_file" ]]; then
  echo "Checksum file not found: $checksum_file" >&2
  exit 1
fi

sha256sum --check "$checksum_file"

backup_dir="$(dirname "$backup_file")"
backup_name="$(basename "$backup_file")"
docker run --rm -v "$backup_dir:/backups:ro" "$POSTGRES_VERIFY_IMAGE" pg_restore --list "/backups/$backup_name" >/dev/null

echo "Backup checksum and docker pg_restore list verification passed: $backup_file"
