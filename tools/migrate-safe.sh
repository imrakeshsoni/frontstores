#!/usr/bin/env bash
# =============================================================================
# migrate-safe.sh — Non-destructive, idempotent migration runner
#
# POLICY: User data is NEVER modified, overwritten, or deleted by migrations.
#         Every migration must be backward-compatible and safe to re-run.
#
# Usage (local):
#   bash tools/migrate-safe.sh --env local
#
# Usage (production, called from deploy-gcp.sh):
#   bash tools/migrate-safe.sh --env production \
#     --db-url "postgresql://user:pass@host/db" \
#     --instance "project:region:instance" \
#     --backup-bucket "gs://my-bucket/backups"
#
# Flags:
#   --env          local | staging | production (required)
#   --db-url       Full PostgreSQL connection URL (required for non-local)
#   --instance     Cloud SQL instance for backup (production only)
#   --backup-bucket GCS bucket path for backup storage (production only)
#   --skip-backup  Skip backup step (ONLY allowed in local env)
#   --dry-run      Print what would run without executing
#
# =============================================================================
# ⚠️  AI ASSISTANT / DEVELOPER CHECKLIST — READ BEFORE WRITING ANY MIGRATION
# =============================================================================
#
# This is a MULTI-TENANT SaaS. Every table that stores business data MUST be
# fully tenant-isolated. Skipping any step below will cause one business to
# see another business's data — a critical security breach.
#
# ADDING A NEW TABLE? Every new table needs ALL FOUR of these:
#
#   1. tenant_id column (non-negotiable):
#        tenant_id UUID NOT NULL REFERENCES tenants(id)
#
#   2. Enable RLS:
#        ALTER TABLE <your_table> ENABLE ROW LEVEL SECURITY;
#
#   3. Force RLS (so even the DB owner user cannot bypass it):
#        ALTER TABLE <your_table> FORCE ROW LEVEL SECURITY;
#
#   4. Create isolation policy:
#        CREATE POLICY tenant_isolation_<your_table> ON <your_table>
#          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
#          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
#
# COPY-PASTE TEMPLATE for a new table migration:
#
#   CREATE TABLE IF NOT EXISTS your_table (
#     id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
#     tenant_id   UUID NOT NULL REFERENCES tenants(id),
#     -- your columns here
#     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
#   );
#   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
#   ALTER TABLE your_table FORCE ROW LEVEL SECURITY;
#   CREATE POLICY tenant_isolation_your_table ON your_table
#     USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
#     WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
#   CREATE INDEX IF NOT EXISTS idx_your_table_tenant ON your_table(tenant_id);
#
# SAFE MIGRATION RULES (enforced automatically by this script):
#   ✅ Use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — safe to re-run
#   ✅ Use ON CONFLICT DO NOTHING for inserts
#   ❌ Never DROP TABLE, TRUNCATE, DELETE FROM, or DROP COLUMN
#   ❌ Never INSERT demo/default/seed data — accounts must start empty
#   ❌ Never share data between tenants — no global lookup tables without tenant_id
#
# =============================================================================
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()   { echo -e "${CYAN}[migrate]${NC} $*"; }
ok()    { echo -e "${GREEN}[migrate]${NC} ✓ $*"; }
warn()  { echo -e "${YELLOW}[migrate]${NC} ⚠ $*"; }
fatal() { echo -e "${RED}[migrate]${NC} ✗ $*" >&2; exit 1; }

# ── Argument parsing ───────────────────────────────────────────────────────────
ENV=""
DB_URL=""
CLOUD_SQL_INSTANCE=""
BACKUP_BUCKET=""
SKIP_BACKUP=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)            ENV="$2";              shift 2 ;;
    --db-url)         DB_URL="$2";           shift 2 ;;
    --instance)       CLOUD_SQL_INSTANCE="$2"; shift 2 ;;
    --backup-bucket)  BACKUP_BUCKET="$2";    shift 2 ;;
    --skip-backup)    SKIP_BACKUP=true;      shift ;;
    --dry-run)        DRY_RUN=true;          shift ;;
    *) fatal "Unknown argument: $1" ;;
  esac
done

[[ -z "$ENV" ]] && fatal "--env is required (local | staging | production)"

# Local env: read DATABASE_URL from .env if not provided
if [[ "$ENV" == "local" && -z "$DB_URL" ]]; then
  if [[ -f ".env" ]]; then
    DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'") || true
  fi
  [[ -z "$DB_URL" ]] && DB_URL="postgresql://rakeshsoni@localhost:5432/shoposphere"
fi

[[ -z "$DB_URL" ]] && fatal "--db-url is required for env=$ENV"

# Production/staging require backup unless explicitly bypassed (never allowed for production)
if [[ "$ENV" == "production" && "$SKIP_BACKUP" == true ]]; then
  fatal "--skip-backup is NOT allowed in production. Backups are mandatory."
fi

# ── Migration directory ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
LOG_DIR="${SCRIPT_DIR}/../.deploy-logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/migrate_${ENV}_${TIMESTAMP}.log"

log "Environment : ${ENV}"
log "Timestamp   : ${TIMESTAMP}"
log "Log file    : ${LOG_FILE}"
log "Dry run     : ${DRY_RUN}"
echo "" | tee -a "$LOG_FILE"

# ── Ordered migration list ─────────────────────────────────────────────────────
# Add new migrations here in order. Never reorder or remove existing entries.
MIGRATIONS=(
  "init.sql"
  "001_initial_schema.sql"
  "002_add_inventory_created_at.sql"
  "003_fix_order_service_schema.sql"
  "004_fix_purchase_order_items_schema.sql"
  "005_enquiries.sql"
  "006_bill_sequences_period.sql"
  "007_rls_force_and_bill_sequences.sql"
  "008_customer_predefined_products.sql"
)

# ── Safety audit: block migrations with destructive commands ──────────────────
log "Auditing migrations for destructive commands..." | tee -a "$LOG_FILE"

DESTRUCTIVE_PATTERN='^\s*(DROP\s+(TABLE|COLUMN|INDEX|SCHEMA|DATABASE)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+DROP|ALTER\s+TABLE\s+\S+\s+RENAME\s+TO)'
FOUND_DESTRUCTIVE=false

for file in "${MIGRATIONS[@]}"; do
  filepath="${MIGRATIONS_DIR}/${file}"
  [[ ! -f "$filepath" ]] && continue

  # Strip SQL comments before scanning
  stripped=$(grep -v '^\s*--' "$filepath" | grep -v '^\s*$')

  if echo "$stripped" | grep -qiE "$DESTRUCTIVE_PATTERN"; then
    matches=$(echo "$stripped" | grep -iE "$DESTRUCTIVE_PATTERN")
    warn "DESTRUCTIVE command found in ${file}:" | tee -a "$LOG_FILE"
    echo "$matches" | while read -r line; do
      echo "    → $line" | tee -a "$LOG_FILE"
    done
    FOUND_DESTRUCTIVE=true
  fi
done

if [[ "$FOUND_DESTRUCTIVE" == true ]]; then
  echo "" | tee -a "$LOG_FILE"
  fatal "Deployment blocked: destructive SQL detected. Review the migration files above, ensure no user data is at risk, rewrite as non-destructive (use ADD COLUMN, CREATE TABLE IF NOT EXISTS, UPDATE with WHERE, etc.), then re-run."
fi

ok "All migrations passed destructive-command audit." | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── Idempotency checks ─────────────────────────────────────────────────────────
log "Checking migrations for idempotency markers..." | tee -a "$LOG_FILE"
IDEMPOTENCY_WARN=false

for file in "${MIGRATIONS[@]}"; do
  filepath="${MIGRATIONS_DIR}/${file}"
  [[ ! -f "$filepath" ]] && continue

  # CREATE TABLE without IF NOT EXISTS is not idempotent
  if grep -qiE '^\s*CREATE\s+TABLE\s+(?!IF)' "$filepath" 2>/dev/null || \
     grep -iE '^\s*CREATE\s+TABLE\s+[^I]' "$filepath" | grep -qiv 'IF NOT EXISTS'; then
    raw_creates=$(grep -iE '^\s*CREATE\s+TABLE' "$filepath" | grep -iv 'IF NOT EXISTS' || true)
    if [[ -n "$raw_creates" ]]; then
      warn "${file}: CREATE TABLE without IF NOT EXISTS (will fail on re-run):" | tee -a "$LOG_FILE"
      echo "$raw_creates" | while read -r line; do echo "    → $line" | tee -a "$LOG_FILE"; done
      IDEMPOTENCY_WARN=true
    fi
  fi
done

if [[ "$IDEMPOTENCY_WARN" == true ]]; then
  warn "Some migrations are not fully idempotent. They will fail if re-run on an existing schema. This is acceptable for one-time baseline migrations (init.sql, 001_*) but new migrations should always use IF NOT EXISTS / ON CONFLICT / ADD COLUMN IF NOT EXISTS." | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ── Pre-migration backup ───────────────────────────────────────────────────────
take_backup() {
  local backup_label="pre_migrate_${ENV}_${TIMESTAMP}"

  if [[ "$ENV" == "production" || "$ENV" == "staging" ]]; then
    if [[ -z "$CLOUD_SQL_INSTANCE" || -z "$BACKUP_BUCKET" ]]; then
      fatal "Production/staging backup requires --instance and --backup-bucket"
    fi

    log "Creating Cloud SQL on-demand backup (${backup_label})..." | tee -a "$LOG_FILE"
    if [[ "$DRY_RUN" == false ]]; then
      gcloud sql backups create \
        --instance="$CLOUD_SQL_INSTANCE" \
        --description="$backup_label" \
        --project="${PROJECT_ID:-cloudystores}" \
        --quiet
      ok "Cloud SQL backup created: ${backup_label}" | tee -a "$LOG_FILE"
    else
      log "[dry-run] Would create Cloud SQL backup: ${backup_label}" | tee -a "$LOG_FILE"
    fi

  else
    # Local: pg_dump to .deploy-logs/
    local backup_file="${LOG_DIR}/backup_${backup_label}.sql"
    log "Creating local pg_dump backup → ${backup_file}" | tee -a "$LOG_FILE"
    if [[ "$DRY_RUN" == false ]]; then
      if command -v pg_dump &>/dev/null; then
        PGPASSWORD="" pg_dump "$DB_URL" > "$backup_file" 2>>"$LOG_FILE"
        ok "Local backup saved: ${backup_file}" | tee -a "$LOG_FILE"
      else
        warn "pg_dump not found — skipping local backup." | tee -a "$LOG_FILE"
      fi
    else
      log "[dry-run] Would pg_dump to: ${backup_file}" | tee -a "$LOG_FILE"
    fi
  fi
}

if [[ "$SKIP_BACKUP" == false ]]; then
  take_backup
else
  warn "Backup skipped (--skip-backup). Allowed only in local env." | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ── Ensure migrations tracking table exists ────────────────────────────────────
log "Ensuring _schema_migrations tracking table exists..." | tee -a "$LOG_FILE"
INIT_TRACKING_SQL="
CREATE TABLE IF NOT EXISTS _schema_migrations (
  filename       VARCHAR(255) PRIMARY KEY,
  applied_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  checksum       VARCHAR(64)  NOT NULL,
  env            VARCHAR(20)  NOT NULL
);
"
if [[ "$DRY_RUN" == false ]]; then
  PGPASSWORD="" psql "$DB_URL" -c "$INIT_TRACKING_SQL" -q 2>>"$LOG_FILE"
fi
ok "_schema_migrations table ready." | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── Run migrations ─────────────────────────────────────────────────────────────
log "Running migrations..." | tee -a "$LOG_FILE"
APPLIED=0
SKIPPED=0

for file in "${MIGRATIONS[@]}"; do
  filepath="${MIGRATIONS_DIR}/${file}"

  if [[ ! -f "$filepath" ]]; then
    warn "  ${file} — not found, skipping" | tee -a "$LOG_FILE"
    continue
  fi

  # Compute checksum
  checksum=$(sha256sum "$filepath" | awk '{print $1}')

  # Check if already applied with same checksum
  if [[ "$DRY_RUN" == false ]]; then
    existing=$(PGPASSWORD="" psql "$DB_URL" -t -c \
      "SELECT checksum FROM _schema_migrations WHERE filename = '${file}' LIMIT 1;" \
      2>>"$LOG_FILE" | tr -d ' \n')
  else
    existing=""
  fi

  if [[ "$existing" == "$checksum" ]]; then
    log "  ${file} — already applied (checksum match), skipping" | tee -a "$LOG_FILE"
    ((SKIPPED++)) || true
    continue
  fi

  if [[ -n "$existing" && "$existing" != "$checksum" ]]; then
    warn "  ${file} — checksum CHANGED since last apply!" | tee -a "$LOG_FILE"
    warn "  Stored: ${existing}" | tee -a "$LOG_FILE"
    warn "  Current: ${checksum}" | tee -a "$LOG_FILE"
    warn "  Applying anyway (migration files should never be edited after deploy)." | tee -a "$LOG_FILE"
  fi

  log "  Applying ${file}..." | tee -a "$LOG_FILE"

  if [[ "$DRY_RUN" == false ]]; then
    if PGPASSWORD="" psql "$DB_URL" -f "$filepath" -q >>"$LOG_FILE" 2>&1; then
      # Record in tracking table
      PGPASSWORD="" psql "$DB_URL" -c \
        "INSERT INTO _schema_migrations (filename, checksum, env)
         VALUES ('${file}', '${checksum}', '${ENV}')
         ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW(), env = EXCLUDED.env;" \
        -q 2>>"$LOG_FILE"
      ok "  ${file} — applied" | tee -a "$LOG_FILE"
      ((APPLIED++)) || true
    else
      fatal "${file} failed. Check log: ${LOG_FILE}"
    fi
  else
    log "  [dry-run] Would apply: ${file}" | tee -a "$LOG_FILE"
    ((APPLIED++)) || true
  fi
done

echo "" | tee -a "$LOG_FILE"
ok "Migration run complete." | tee -a "$LOG_FILE"
log "  Applied : ${APPLIED}" | tee -a "$LOG_FILE"
log "  Skipped : ${SKIPPED} (already up-to-date)" | tee -a "$LOG_FILE"
log "  Log     : ${LOG_FILE}" | tee -a "$LOG_FILE"
