#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"

if [[ -z "$backup_file" ]]; then
  echo "Usage: scripts/verify-postgres-backup.sh <backup.dump>" >&2
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
pg_restore --list "$backup_file" >/dev/null

echo "Backup checksum and pg_restore list verification passed: $backup_file"
