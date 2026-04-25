#!/usr/bin/env bash
# =============================================================================
# deploy-gcp.sh — Full deploy to Google Cloud Run (cloudystores project)
#
# Usage:
#   bash tools/deploy-gcp.sh              # build + deploy everything
#   bash tools/deploy-gcp.sh --no-build   # skip Cloud Build, just redeploy
#   bash tools/deploy-gcp.sh --migrate    # also run DB migrations
#
# Prerequisites:
#   - gcloud CLI installed and logged in (gcloud auth login)
#   - gcloud config set project cloudystores
# =============================================================================
set -euo pipefail

# ── Config (all defaults match the live cloudystores project) ─────────────────
PROJECT_ID="${PROJECT_ID:-cloudystores}"
REGION="${REGION:-asia-south1}"
REPOSITORY="${REPOSITORY:-shoposphere}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
DB_INSTANCE="${DB_INSTANCE:-shoposphere-sql}"
DB_NAME="${DB_NAME:-shoposphere}"
DB_USER="${DB_USER:-shoposphere}"
VPC_CONNECTOR="${VPC_CONNECTOR:-shoposphere-connector}"

# Auto-read JWT secrets and Redis from the running auth-service (no manual input needed)
echo "Reading config from existing Cloud Run services..."
_SVC_ENV=$(gcloud run services describe auth-service --region "${REGION}" --project "${PROJECT_ID}" --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || true)
JWT_SECRET="${JWT_SECRET:-$(echo "$_SVC_ENV" | grep -o "'JWT_SECRET', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(echo "$_SVC_ENV" | grep -o "'JWT_REFRESH_SECRET', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"
REDIS_HOST="${REDIS_HOST:-$(echo "$_SVC_ENV" | grep -o "'REDIS_HOST', 'value': '[^']*'" | cut -d"'" -f6 || echo '')}"

# Fallback defaults if service not yet deployed
JWT_SECRET="${JWT_SECRET:-shoposphere-production-jwt-secret-secure-key}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-shoposphere-production-refresh-secret-secure-key}"
REDIS_HOST="${REDIS_HOST:-10.78.59.211}"

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
RUN_MIGRATE=false
for arg in "$@"; do
  case "$arg" in
    --no-build) SKIP_BUILD=true ;;
    --migrate)  RUN_MIGRATE=true ;;
  esac
done

# ── Derived values ────────────────────────────────────────────────────────────
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
DB_SOCKET="/cloudsql/${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
DATABASE_URL="postgresql://${DB_USER}:\${DB_PASSWORD}@/${DB_NAME}?host=${DB_SOCKET}"
COMMON_ENV="NODE_ENV=production,DB_SSL=false,\
APP_URL=https://frontend-${PROJECT_ID}.a.run.app,\
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
echo "============================================"
echo ""

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
echo "[1/5] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}" --quiet

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
echo "[2/5] Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null \
  || gcloud artifacts repositories create "${REPOSITORY}" \
       --repository-format=docker \
       --location="${REGION}" \
       --description="Shoposphere containers" \
       --project="${PROJECT_ID}" --quiet

# ── 3. Build images ───────────────────────────────────────────────────────────
if [[ "${SKIP_BUILD}" == false ]]; then
  echo "[3/5] Building container images via Cloud Build (~8 min)..."
  gcloud builds submit \
    --config cloudbuild.gcp.yaml \
    --substitutions "_REGION=${REGION},_REPOSITORY=${REPOSITORY},_TAG=${IMAGE_TAG}" \
    --project "${PROJECT_ID}" \
    .
else
  echo "[3/5] Skipping build (--no-build flag set). Using tag: ${IMAGE_TAG}"
fi

# ── 4. Deploy backend services ────────────────────────────────────────────────
echo "[4/5] Deploying backend services to Cloud Run..."

deploy_backend() {
  local name="$1" port="$2"
  echo "  → Deploying ${name}..."
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
  echo "  ✓ ${name} deployed"
}

deploy_backend auth-service   3001
deploy_backend tenant-service 3002
deploy_backend core-api       3003
deploy_backend order-service  3007
deploy_backend report-service 3008

# ── 5. Deploy frontend (after backends so URLs are known) ─────────────────────
echo "[5/5] Deploying frontend..."
AUTH_URL=$(gcloud run services describe auth-service    --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
TENANT_URL=$(gcloud run services describe tenant-service --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
CORE_URL=$(gcloud run services describe core-api        --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
ORDER_URL=$(gcloud run services describe order-service  --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
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
echo "  ✓ frontend deployed"

# ── Optional: run DB migrations ───────────────────────────────────────────────
if [[ "${RUN_MIGRATE}" == true ]]; then
  echo ""
  echo "[migrations] Running DB migrations..."
  echo "  NOTE: This needs your public IP authorized in Cloud SQL."
  MY_IP=$(curl -sf https://api.ipify.org 2>/dev/null || echo "")
  if [[ -z "$MY_IP" ]]; then
    echo "  ERROR: Could not detect public IP. Run migrations manually."
  else
    echo "  Authorizing IP ${MY_IP}..."
    gcloud sql instances patch "${DB_INSTANCE}" \
      --authorized-networks="${MY_IP}/32" --project="${PROJECT_ID}" --quiet
    sleep 3
    DB_PASS=$(gcloud secrets versions access latest --secret=shoposphere-db-password --project="${PROJECT_ID}")
    SQL_IP=$(gcloud sql instances describe "${DB_INSTANCE}" --project="${PROJECT_ID}" --format='value(ipAddresses[0].ipAddress)')
    PSQL_URL="postgresql://${DB_USER}@${SQL_IP}:5432/${DB_NAME}"
    for f in tools/migrations/init.sql tools/migrations/001_initial_schema.sql \
              tools/migrations/002_add_inventory_created_at.sql \
              tools/migrations/003_fix_order_service_schema.sql \
              tools/migrations/004_fix_purchase_order_items_schema.sql; do
      [[ -f "$f" ]] && { echo "  Running $f..."; PGPASSWORD="$DB_PASS" psql "$PSQL_URL" -f "$f" -q; }
    done
    echo "  Revoking IP authorization..."
    gcloud sql instances patch "${DB_INSTANCE}" \
      --clear-authorized-networks --project="${PROJECT_ID}" --quiet
    echo "  ✓ Migrations complete"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
FRONTEND_URL=$(gcloud run services describe frontend --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')
echo ""
echo "============================================"
echo "  ✅ Deployment complete!"
echo "  🌐 ${FRONTEND_URL}"
echo "============================================"
