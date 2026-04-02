#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CivicForum nightly database backup
#
# Strategy:
#   • pg_dump compressed snapshot → BACKUP_VOLUME_PATH/civicforum_TIMESTAMP.dump
#   • Retains last RETENTION_DAYS backups; older files are purged automatically
#   • PostgreSQL WAL-based PITR: enable archive_mode = on and set archive_command
#     in postgresql.conf to copy WAL segments into BACKUP_VOLUME_PATH/wal/.
#     For managed services (AWS RDS, GCP Cloud SQL, Azure Database) enable the
#     provider's automated PITR feature — no additional scripting needed.
#
# Environment variables:
#   DATABASE_URL           — postgres://user:pass@host:5432/dbname  (required)
#   BACKUP_VOLUME_PATH     — destination directory (default: /backups)
#   BACKUP_RETENTION_DAYS  — days to keep (default: 14)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_VOLUME_PATH:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/civicforum_${TIMESTAMP}.dump"

# ── Validate prerequisites ───────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  echo "[backup] ERROR: pg_dump not found in PATH" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# ── Run dump ─────────────────────────────────────────────────────────────────
echo "[backup] Starting backup → ${DUMP_FILE}"

pg_dump \
  --format=custom \
  --compress=9 \
  --no-password \
  "${DATABASE_URL}" \
  --file="${DUMP_FILE}"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
echo "[backup] Completed: ${DUMP_FILE} (${DUMP_SIZE})"

# ── Prune old backups ────────────────────────────────────────────────────────
PRUNED=0
while IFS= read -r old_file; do
  rm -f "${old_file}"
  echo "[backup] Pruned: ${old_file}"
  PRUNED=$((PRUNED + 1))
done < <(find "${BACKUP_DIR}" -maxdepth 1 -name "civicforum_*.dump" -mtime "+${RETENTION_DAYS}" -type f)

echo "[backup] Pruned ${PRUNED} file(s) older than ${RETENTION_DAYS} days"
echo "[backup] Done at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
