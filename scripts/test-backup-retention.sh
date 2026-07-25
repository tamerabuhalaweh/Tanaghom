#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

for day in 01 02 03 04 05 06 07 08; do
  artifact="$tmp_dir/tanaghum-postgres-202601${day}T000000Z.dump"
  printf 'backup-%s' "$day" > "$artifact"
  printf 'checksum-%s' "$day" > "$artifact.sha256"
  touch -d "2026-01-$day 00:00:00 UTC" "$artifact" "$artifact.sha256"
done

touch -d "now" \
  "$tmp_dir/tanaghum-postgres-20260108T000000Z.dump" \
  "$tmp_dir/tanaghum-postgres-20260108T000000Z.dump.sha256"
touch -d "1 day ago" \
  "$tmp_dir/tanaghum-postgres-20260107T000000Z.dump" \
  "$tmp_dir/tanaghum-postgres-20260107T000000Z.dump.sha256"

DATABASE_BACKUP_DIR="$tmp_dir" \
BACKUP_RETENTION_DAYS=30 \
BACKUP_MIN_KEEP=3 \
  /bin/bash "$repo_root/scripts/prune-postgres-backups.sh"

remaining="$(find "$tmp_dir" -maxdepth 1 -type f -name '*.dump' | wc -l)"
if [[ "$remaining" -ne 3 ]]; then
  echo "Expected exactly 3 retained dumps, found $remaining" >&2
  exit 1
fi
if [[ -f "$tmp_dir/tanaghum-postgres-20260101T000000Z.dump.sha256" ]]; then
  echo "Pruned dump checksum was not removed" >&2
  exit 1
fi
python3 - "$tmp_dir/retention-latest.json" <<'PY'
import json, sys
evidence = json.load(open(sys.argv[1]))
assert evidence["status"] == "passed"
assert evidence["artifactsKept"] == 3
assert evidence["artifactsRemoved"] == 5
PY

echo "Backup retention test passed."
