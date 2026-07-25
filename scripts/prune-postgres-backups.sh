#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${DATABASE_BACKUP_DIR:-/var/backups/tanaghum/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MIN_KEEP="${BACKUP_MIN_KEEP:-7}"
FILE_PATTERN="${BACKUP_FILE_PATTERN:-tanaghum-postgres-*.dump}"
EVIDENCE_PATH="${BACKUP_RETENTION_EVIDENCE_PATH:-$BACKUP_DIR/retention-latest.json}"

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 2
fi
if [[ ! "$MIN_KEEP" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_MIN_KEEP must be a positive integer" >&2
  exit 2
fi
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory does not exist: $BACKUP_DIR" >&2
  exit 2
fi

mapfile -t artifacts < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "$FILE_PATTERN" \
    -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-
)

cutoff_epoch="$(date -u -d "$RETENTION_DAYS days ago" +%s)"
removed=0
kept=0

for index in "${!artifacts[@]}"; do
  artifact="${artifacts[$index]}"
  modified_epoch="$(stat -c '%Y' "$artifact")"

  if (( index < MIN_KEEP )) || (( modified_epoch >= cutoff_epoch )); then
    kept=$((kept + 1))
    continue
  fi

  rm -f -- "$artifact" "$artifact.sha256"
  if [[ "$artifact" == *.dump ]]; then
    rm -f -- "$artifact.enc" "$artifact.enc.sha256"
  fi
  removed=$((removed + 1))
done

mkdir -p "$(dirname "$EVIDENCE_PATH")"
cat > "$EVIDENCE_PATH" <<JSON
{
  "prunedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "retentionDays": $RETENTION_DAYS,
  "minimumArtifactsKept": $MIN_KEEP,
  "matchingArtifactsBeforePrune": ${#artifacts[@]},
  "artifactsKept": $kept,
  "artifactsRemoved": $removed,
  "filePattern": "$FILE_PATTERN",
  "status": "passed"
}
JSON

echo "Backup retention passed: kept=$kept removed=$removed"
echo "Evidence written: $EVIDENCE_PATH"
