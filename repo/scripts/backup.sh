#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CivicForum nightly database backup
#
# Strategy:
#   • mysqldump compressed snapshot → BACKUP_VOLUME_PATH/civicforum_TIMESTAMP.sql.gz
#   • Retains last RETENTION_DAYS backups; older files are purged automatically
#   • MySQL binlog-based PITR: enable log_bin and configure binlog retention
#     in the MySQL server configuration. For managed services (AWS RDS,
#     GCP Cloud SQL, Azure Database for MySQL) enable the provider's
#     automated PITR feature — no additional scripting needed.
#
# Environment variables:
#   DATABASE_URL           — mysql://user:pass@host:3306/dbname  (required)
#   BACKUP_VOLUME_PATH     — destination directory (default: /backups)
#   BACKUP_RETENTION_DAYS  — days to keep (default: 14)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_VOLUME_PATH:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/civicforum_${TIMESTAMP}.sql.gz"

# ── Validate prerequisites ───────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v mysqldump &>/dev/null; then
  echo "[backup] ERROR: mysqldump not found in PATH" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# ── Resolve DB connection details ────────────────────────────────────────────
# Prefer explicit env vars (safe for passwords with special characters).
# Fall back to parsing DATABASE_URL only when the explicit vars are absent.
if [[ -n "${DB_HOST:-}" && -n "${DB_USER:-}" && -n "${DB_NAME:-}" ]]; then
  DB_HOST="${DB_HOST}"
  DB_PORT="${DB_PORT:-3306}"
  DB_USER="${DB_USER}"
  DB_PASS="${DB_PASS:-}"
  DB_NAME="${DB_NAME}"
else
  # Fallback: parse DATABASE_URL (mysql://user:pass@host:port/dbname).
  # NOTE: This regex can break if the password contains '@' or ':'.
  DB_USER=$(echo "${DATABASE_URL}" | sed -E 's|mysql://([^:]+):.*|\1|')
  DB_PASS=$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
  DB_HOST=$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
  DB_PORT=$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
  DB_NAME=$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^/]+/([^?]+).*|\1|')
fi

# ── Run dump ─────────────────────────────────────────────────────────────────
echo "[backup] Starting backup → ${DUMP_FILE}"

mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --routines \
  --triggers \
  "${DB_NAME}" | gzip > "${DUMP_FILE}"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
echo "[backup] Completed: ${DUMP_FILE} (${DUMP_SIZE})"

# ── Prune old backups ────────────────────────────────────────────────────────
PRUNED=0
while IFS= read -r old_file; do
  rm -f "${old_file}"
  echo "[backup] Pruned: ${old_file}"
  PRUNED=$((PRUNED + 1))
done < <(find "${BACKUP_DIR}" -maxdepth 1 -name "civicforum_*.sql.gz" -mtime "+${RETENTION_DAYS}" -type f)

echo "[backup] Pruned ${PRUNED} file(s) older than ${RETENTION_DAYS} days"
echo "[backup] Done at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
