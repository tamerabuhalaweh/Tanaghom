#!/usr/bin/env bash
set -euo pipefail

OFFSERVER_BACKUP_DIR="${OFFSERVER_BACKUP_DIR:-/srv/tanaghum-primary}"
UPLOAD_MANIFEST="${OFFSERVER_UPLOAD_MANIFEST:-$OFFSERVER_BACKUP_DIR/offserver-upload.json}"
PASSPHRASE_FILE="${BACKUP_ENCRYPTION_PASSPHRASE_FILE:-}"
EVIDENCE_PATH="${RESTORE_DRILL_EVIDENCE_PATH:-/var/lib/tanaghum-primary-dr/restore-drill-latest.json}"

if [[ ! -f "$UPLOAD_MANIFEST" ]]; then
  echo "Off-server upload manifest not found: $UPLOAD_MANIFEST" >&2
  exit 2
fi
if [[ -z "$PASSPHRASE_FILE" || ! -f "$PASSPHRASE_FILE" ]]; then
  echo "BACKUP_ENCRYPTION_PASSPHRASE_FILE must reference the decryption passphrase" >&2
  exit 2
fi

encrypted_name="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('backupFile',''))" "$UPLOAD_MANIFEST")"
expected_source_sha256="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('sourceSha256',''))" "$UPLOAD_MANIFEST")"
encryption="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('encryption',''))" "$UPLOAD_MANIFEST")"
if [[ -z "$encrypted_name" || "$encrypted_name" != "$(basename "$encrypted_name")" ]]; then
  echo "Off-server manifest contains an invalid backup filename" >&2
  exit 2
fi
if [[ ! "$expected_source_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Off-server manifest contains an invalid source checksum" >&2
  exit 2
fi
if [[ "$encryption" != "aes-256-cbc-pbkdf2-sha256" ]]; then
  echo "Off-server manifest uses an unsupported encryption profile" >&2
  exit 2
fi

encrypted_file="$OFFSERVER_BACKUP_DIR/$encrypted_name"
encrypted_checksum="$encrypted_file.sha256"
if [[ ! -f "$encrypted_file" || ! -f "$encrypted_checksum" ]]; then
  echo "Encrypted backup or checksum is missing" >&2
  exit 2
fi

(
  cd "$OFFSERVER_BACKUP_DIR"
  sha256sum --check "$(basename "$encrypted_checksum")"
)

tmp_dump="$(mktemp --suffix=.dump)"
cleanup() {
  rm -f "$tmp_dump"
}
trap cleanup EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass "file:$PASSPHRASE_FILE" \
  -in "$encrypted_file" \
  -out "$tmp_dump"

actual_source_sha256="$(sha256sum "$tmp_dump" | cut -d' ' -f1)"
if [[ "$actual_source_sha256" != "$expected_source_sha256" ]]; then
  echo "Decrypted source checksum does not match the upload manifest" >&2
  exit 1
fi

RESTORE_DRILL_EVIDENCE_PATH="$EVIDENCE_PATH" \
RESTORE_DRILL_SOURCE_ARTIFACT="$encrypted_name" \
RESTORE_DRILL_SOURCE_ENCRYPTED=true \
RESTORE_DRILL_SOURCE_CHECKSUM_VERIFIED=true \
  /bin/bash "$(dirname "$0")/restore-drill-postgres-docker.sh" "$tmp_dump"

echo "Independent-host restore drill passed for: $encrypted_name"
