#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/tanaghum/postgres}"
RSYNC_TARGET="${BACKUP_RSYNC_TARGET:-}"
S3_URI="${BACKUP_S3_URI:-}"

latest_manifest="$BACKUP_DIR/latest.json"
offserver_manifest="$BACKUP_DIR/offserver-latest.json"

if [[ ! -f "$latest_manifest" ]]; then
  echo "Latest backup manifest not found: $latest_manifest" >&2
  exit 2
fi

backup_file="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('backupFile',''))" "$latest_manifest")"
checksum_file="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('checksumFile',''))" "$latest_manifest")"

if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Backup file referenced by manifest is missing" >&2
  exit 2
fi
if [[ -z "$checksum_file" || ! -f "$checksum_file" ]]; then
  echo "Checksum file referenced by manifest is missing" >&2
  exit 2
fi

provider=""
target_kind=""

if [[ -n "$RSYNC_TARGET" ]]; then
  command -v rsync >/dev/null || { echo "rsync is required for BACKUP_RSYNC_TARGET" >&2; exit 2; }
  rsync -a --checksum "$backup_file" "$checksum_file" "$latest_manifest" "$RSYNC_TARGET"
  provider="rsync"
  target_kind="rsync"
elif [[ -n "$S3_URI" ]]; then
  command -v aws >/dev/null || { echo "aws CLI is required for BACKUP_S3_URI" >&2; exit 2; }
  aws s3 cp "$backup_file" "$S3_URI/$(basename "$backup_file")"
  aws s3 cp "$checksum_file" "$S3_URI/$(basename "$checksum_file")"
  aws s3 cp "$latest_manifest" "$S3_URI/latest.json"
  provider="s3_compatible"
  target_kind="s3"
else
  echo "No off-server target configured. Set BACKUP_RSYNC_TARGET or BACKUP_S3_URI." >&2
  exit 2
fi

cat > "$offserver_manifest" <<JSON
{
  "syncedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "provider": "$provider",
  "targetKind": "$target_kind",
  "backupFile": "$(basename "$backup_file")",
  "checksumFile": "$(basename "$checksum_file")",
  "status": "synced",
  "rawTargetReturned": false
}
JSON

echo "Off-server backup sync completed with provider: $provider"
echo "Manifest written: $offserver_manifest"
