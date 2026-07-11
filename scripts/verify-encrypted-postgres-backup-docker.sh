#!/usr/bin/env bash
set -euo pipefail

encrypted_file="${1:-}"
PASSPHRASE_FILE="${BACKUP_ENCRYPTION_PASSPHRASE_FILE:-}"
POSTGRES_VERIFY_IMAGE="${POSTGRES_VERIFY_IMAGE:-postgres:16-alpine}"

if [[ -z "$encrypted_file" || ! -f "$encrypted_file" ]]; then
  echo "Usage: BACKUP_ENCRYPTION_PASSPHRASE_FILE=<file> $0 <backup.dump.enc>" >&2
  exit 2
fi
if [[ -z "$PASSPHRASE_FILE" || ! -f "$PASSPHRASE_FILE" ]]; then
  echo "BACKUP_ENCRYPTION_PASSPHRASE_FILE must reference the decryption passphrase file" >&2
  exit 2
fi
if [[ ! -f "$encrypted_file.sha256" ]]; then
  echo "Encrypted checksum file not found: $encrypted_file.sha256" >&2
  exit 2
fi

(
  cd "$(dirname "$encrypted_file")"
  sha256sum --check "$(basename "$encrypted_file.sha256")"
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

docker run --rm -v "$(dirname "$tmp_dump"):/backups:ro" "$POSTGRES_VERIFY_IMAGE" \
  pg_restore --list "/backups/$(basename "$tmp_dump")" >/dev/null

echo "Encrypted backup checksum, decryption, and pg_restore verification passed."
