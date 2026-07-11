#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/tanaghum/postgres}"
manifest="$BACKUP_DIR/latest.json"

if [[ ! -f "$manifest" ]]; then
  echo "Latest backup manifest not found: $manifest" >&2
  exit 2
fi

backup_file="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('backupFile',''))" "$manifest")"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Latest backup file referenced by manifest is missing" >&2
  exit 2
fi

exec /bin/bash "$(dirname "$0")/restore-drill-postgres-docker.sh" "$backup_file"
