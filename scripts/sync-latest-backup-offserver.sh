#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/tanaghum/postgres}"
RSYNC_TARGET="${BACKUP_RSYNC_TARGET:-}"
S3_URI="${BACKUP_S3_URI:-}"
PASSPHRASE_FILE="${BACKUP_ENCRYPTION_PASSPHRASE_FILE:-}"

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

sha256sum --check "$checksum_file" >/dev/null

if [[ -z "$PASSPHRASE_FILE" || ! -f "$PASSPHRASE_FILE" ]]; then
  echo "BACKUP_ENCRYPTION_PASSPHRASE_FILE must reference a server-only passphrase file" >&2
  exit 2
fi

permissions="$(stat -c '%a' "$PASSPHRASE_FILE")"
if [[ "$permissions" != "400" && "$permissions" != "600" ]]; then
  echo "Backup encryption passphrase file must have mode 400 or 600" >&2
  exit 2
fi

command -v openssl >/dev/null || { echo "openssl is required for encrypted off-server backups" >&2; exit 2; }

encrypted_file="$backup_file.enc"
encrypted_checksum_file="$encrypted_file.sha256"
upload_manifest="$BACKUP_DIR/offserver-upload.json"
encrypted_tmp="$encrypted_file.tmp"

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 \
  -pass "file:$PASSPHRASE_FILE" \
  -in "$backup_file" \
  -out "$encrypted_tmp"
mv "$encrypted_tmp" "$encrypted_file"
chmod 600 "$encrypted_file"
(
  cd "$(dirname "$encrypted_file")"
  sha256sum "$(basename "$encrypted_file")" > "$(basename "$encrypted_checksum_file")"
)

source_sha256="$(sha256sum "$backup_file" | cut -d' ' -f1)"
encrypted_sha256="$(cut -d' ' -f1 "$encrypted_checksum_file")"

cat > "$upload_manifest" <<JSON
{
  "preparedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backupFile": "$(basename "$encrypted_file")",
  "checksumFile": "$(basename "$encrypted_checksum_file")",
  "sourceSha256": "$source_sha256",
  "encryptedSha256": "$encrypted_sha256",
  "encryption": "aes-256-cbc-pbkdf2-sha256",
  "kdfIterations": 200000,
  "rawTargetReturned": false
}
JSON

provider=""
target_kind=""

if [[ -n "$RSYNC_TARGET" ]]; then
  command -v rsync >/dev/null || { echo "rsync is required for BACKUP_RSYNC_TARGET" >&2; exit 2; }
  rsync -a --checksum "$encrypted_file" "$encrypted_checksum_file" "$upload_manifest" "$RSYNC_TARGET"
  provider="rsync"
  target_kind="rsync"
elif [[ -n "$S3_URI" ]]; then
  command -v aws >/dev/null || { echo "aws CLI is required for BACKUP_S3_URI" >&2; exit 2; }
  aws s3 cp "$encrypted_file" "$S3_URI/$(basename "$encrypted_file")"
  aws s3 cp "$encrypted_checksum_file" "$S3_URI/$(basename "$encrypted_checksum_file")"
  aws s3 cp "$upload_manifest" "$S3_URI/offserver-upload.json"
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
  "backupFile": "$(basename "$encrypted_file")",
  "checksumFile": "$(basename "$encrypted_checksum_file")",
  "encrypted": true,
  "encryption": "aes-256-cbc-pbkdf2-sha256",
  "encryptedSha256": "$encrypted_sha256",
  "status": "synced",
  "rawTargetReturned": false
}
JSON

echo "Off-server backup sync completed with provider: $provider"
echo "Manifest written: $offserver_manifest"
