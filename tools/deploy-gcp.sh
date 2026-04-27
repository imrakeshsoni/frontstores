#!/usr/bin/env bash
# =============================================================================
# deploy-gcp.sh — Full deploy to Google Cloud Run (cloudystores project)
#
# DATA SAFETY POLICY (non-negotiable):
#   - No deployment step may modify, overwrite, reset, or delete user data.
#   - A full database backup is taken automatically before every migration run.
#   - All migrations are audited for destructive commands before execution.
#   - Migrations are skipped if already applied (checksum-tracked).
#
# Usage:
#   bash tools/deploy-gcp.sh              # build + deploy everything
#   bash tools/deploy-gcp.sh --no-build   # skip Cloud Build, just redeploy
#   bash tools/deploy-gcp.sh --migrate    # also run DB migrations (with backup)
#   bash tools/deploy-gcp.sh --dry-run    # print plan, execute nothing
#
# Prerequisites:
#   - gcloud CLI installed and logged in (gcloud auth login)
#   - gcloud config set project cloudystores
# =============================================================================
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()   { echo -e "${CYAN}[deploy]${NC}  $*"; }
ok()    { echo -e "${GREEN}[deploy]${NC}  ✓ $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC}  ⚠ $*"; }
fatal() { echo -e "${RED}[deploy]${NC}  ✗ $*" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-cloudystores}"
REGION="${REGION:-asia-south1}"
REPOSITORY="${REPOSITORY:-shoposphere}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
DB_INSTANCE="${DB_INSTANCE:-shoposphere-sql}"
DB_NAME="${DB_NAME:-shoposphere}"
DB_USER="${DB_USER:-shoposphere}"
VPC_CONNECTOR="${VPC_CONNECTOR:-shoposphere-connector}"
BACKUP_BUCKET="${BACKUP_BUCKET:-gs://cloudystores-db-backups}"

# ── Log setup ─────────────────────────────────────────────────────────────────
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../.deploy-logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/deploy_production_${TIMESTAMP}.log"
# Tee all output to the log file
exec > >(tee -a "$LOG_FILE") 2>&1

log "Deployment started at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
log "Git commit : $(git rev-parse HEAD)"
log "Git branch : $(git rev-parse --abbrev-ref HEAD)"
log "Log file   : ${LOG_FILE}"

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
RUN_MIGRATE=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --no-build) SKIP_BUILD=true ;;
    --migrate)  RUN_MIGRATE=true ;;
    --dry-run)  DRY_RUN=true ;;
  esac
done

if [[ "$DRY_RUN" == true ]]; then
  warn "DRY RUN MODE — no changes will be made to infrastructure or database."
fi

# ── Read live config from existing Cloud Run services ─────────────────────────
log "Reading config from existing Cloud Run services..."
_SVC_ENV=$(gcloud run services describe auth-service \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || true)

JWT_SECRET="${JWT_SECRET:-$(echo "$_SVC_ENV" | grep -o "'JWT_SECRET', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(echo "$_SVC_ENV" | grep -o "'JWT_REFRESH_SECRET', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"
REDIS_HOST="${REDIS_HOST:-$(echo "$_SVC_ENV" | grep -o "'REDIS_HOST', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"

JWT_SECRET="${JWT_SECRET:-shoposphere-production-jwt-secret-secure-key}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-shoposphere-production-refresh-secret-secure-key}"
REDIS_HOST="${REDIS_HOST:-10.78.59.211}"

# ── Derived values ────────────────────────────────────────────────────────────
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
DB_SOCKET="/cloudsql/${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
DATABASE_URL="postgresql://${DB_USER}:\${DB_PASSWORD}@/${DB_NAME}?host=${DB_SOCKET}"
COMMON_ENV="NODE_ENV=production,DB_SSL=false,\
APP_URL=https://frontstores.com,\
API_URL=https://core-api-${PROJECT_ID}.a.run.app,\
JWT_SECRET=${JWT_SECRET},\
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET},\
JWT_EXPIRY=3600,JWT_REFRESH_EXPIRY=604800,\
REDIS_HOST=${REDIS_HOST},REDIS_PORT=6379,\
REDIS_URL=redis://${REDIS_HOST}:6379,\
DATABASE_URL=${DATABASE_URL}"

echo ""
echo "============================================"
echo "  ShopOS GCP Deploy"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Tag     : ${IMAGE_TAG}"
echo "  Build   : $([[ $SKIP_BUILD == true ]] && echo SKIPPED || echo YES)"
echo "  Migrate : $([[ $RUN_MIGRATE == true ]] && echo YES || echo NO)"
echo "  Dry run : $([[ $DRY_RUN == true ]] && echo YES || echo NO)"
echo "  Log     : ${LOG_FILE}"
echo "============================================"
echo ""

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
log "[1/5] Enabling required GCP APIs..."
if [[ "$DRY_RUN" == false ]]; then
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    vpcaccess.googleapis.com \
    secretmanager.googleapis.com \
    --project "${PROJECT_ID}" --quiet
fi
ok "APIs enabled."

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
log "[2/5] Ensuring Artifact Registry repository exists..."
if [[ "$DRY_RUN" == false ]]; then
  gcloud artifacts repositories describe "${REPOSITORY}" \
    --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null \
    || gcloud artifacts repositories create "${REPOSITORY}" \
         --repository-format=docker \
         --location="${REGION}" \
         --description="Shoposphere containers" \
         --project="${PROJECT_ID}" --quiet
fi
ok "Artifact Registry ready."

# ── 3. Build images ───────────────────────────────────────────────────────────
if [[ "${SKIP_BUILD}" == false ]]; then
  log "[3/5] Building container images via Cloud Build (~8 min)..."
  if [[ "$DRY_RUN" == false ]]; then
    gcloud builds submit \
      --config cloudbuild.gcp.yaml \
      --substitutions "_REGION=${REGION},_REPOSITORY=${REPOSITORY},_TAG=${IMAGE_TAG}" \
      --project "${PROJECT_ID}" \
      .
  else
    log "[dry-run] Would run Cloud Build with tag ${IMAGE_TAG}"
  fi
  ok "Images built."
else
  log "[3/5] Skipping build (--no-build). Using tag: ${IMAGE_TAG}"
fi

# ── 4. Deploy backend services ────────────────────────────────────────────────
log "[4/5] Deploying backend services to Cloud Run..."

deploy_backend() {
  local name="$1" port="$2"
  log "  → Deploying ${name}..."
  if [[ "$DRY_RUN" == false ]]; then
    gcloud run deploy "${name}" \
      --image "${IMAGE_BASE}/${name}:${IMAGE_TAG}" \
      --region "${REGION}" \
      --platform managed \
      --allow-unauthenticated \
      --port "${port}" \
      --vpc-connector "${VPC_CONNECTOR}" \
      --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${DB_INSTANCE}" \
      --set-env-vars "${COMMON_ENV}" \
      --set-secrets "DB_PASSWORD=shoposphere-db-password:latest" \
      --project "${PROJECT_ID}" \
      --quiet
  else
    log "  [dry-run] Would deploy ${name}:${IMAGE_TAG} on port ${port}"
  fi
  ok "  ${name} deployed."
}

deploy_backend auth-service   3001
deploy_backend tenant-service 3002
deploy_backend core-api       3003
deploy_backend order-service  3007
deploy_backend report-service 3008

# ── 5. Deploy frontend ────────────────────────────────────────────────────────
log "[5/5] Deploying frontend..."
if [[ "$DRY_RUN" == false ]]; then
  AUTH_URL=$(gcloud run services describe auth-service     --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
  TENANT_URL=$(gcloud run services describe tenant-service --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
  CORE_URL=$(gcloud run services describe core-api         --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
  ORDER_URL=$(gcloud run services describe order-service   --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
  REPORT_URL=$(gcloud run services describe report-service --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')

  gcloud run deploy frontend \
    --image "${IMAGE_BASE}/frontend:${IMAGE_TAG}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars "AUTH_SERVICE_URL=${AUTH_URL},TENANT_SERVICE_URL=${TENANT_URL},CORE_API_URL=${CORE_URL},ORDER_SERVICE_URL=${ORDER_URL},REPORT_SERVICE_URL=${REPORT_URL}" \
    --project "${PROJECT_ID}" \
    --quiet
else
  log "[dry-run] Would deploy frontend with backend URLs"
fi
ok "Frontend deployed."

# ── Optional: run DB migrations (with mandatory backup) ───────────────────────
if [[ "${RUN_MIGRATE}" == true ]]; then
  echo ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "MIGRATIONS — Data Safety Protocol Active"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Policy: no migration may destroy or alter existing user data."
  log "A full backup will be taken BEFORE any migration runs."
  echo ""

  MY_IP=$(curl -sf https://api.ipify.org 2>/dev/null || echo "")
  if [[ -z "$MY_IP" ]]; then
    fatal "Could not detect public IP. Cannot open Cloud SQL firewall. Run migrations manually using migrate-safe.sh."
  fi

  log "Authorizing IP ${MY_IP} in Cloud SQL..."
  if [[ "$DRY_RUN" == false ]]; then
    gcloud sql instances patch "${DB_INSTANCE}" \
      --authorized-networks="${MY_IP}/32" --project="${PROJECT_ID}" --quiet
    sleep 5
  fi

  DB_PASS=$(gcloud secrets versions access latest --secret=shoposphere-db-password --project="${PROJECT_ID}" 2>/dev/null)
  SQL_IP=$(gcloud sql instances describe "${DB_INSTANCE}" --project="${PROJECT_ID}" --format='value(ipAddresses[0].ipAddress)')
  PROD_DB_URL="postgresql://${DB_USER}:${DB_PASS}@${SQL_IP}:5432/${DB_NAME}"

  # Delegate entirely to migrate-safe.sh which handles backup + audit + tracking
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "${SCRIPT_DIR}/migrate-safe.sh" \
    --env production \
    --db-url "${PROD_DB_URL}" \
    --instance "${PROJECT_ID}:${REGION}:${DB_INSTANCE}" \
    --backup-bucket "${BACKUP_BUCKET}" \
    $([[ "$DRY_RUN" == true ]] && echo "--dry-run" || echo "")

  log "Revoking IP authorization..."
  if [[ "$DRY_RUN" == false ]]; then
    gcloud sql instances patch "${DB_INSTANCE}" \
      --clear-authorized-networks --project="${PROJECT_ID}" --quiet
  fi
  ok "Migrations complete and IP access revoked."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == false ]]; then
  FRONTEND_URL=$(gcloud run services describe frontend \
    --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
else
  FRONTEND_URL="https://frontstores.com (dry-run)"
fi

echo ""
echo "============================================"
echo "  ✅ Deployment complete!"
echo "  🌐 ${FRONTEND_URL}"
echo "  📋 Log: ${LOG_FILE}"
echo "  📅 $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"

log "Deployment finished at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
