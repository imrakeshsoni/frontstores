# ShopOS — AI Assistant Instructions

This is a multi-tenant SaaS for Indian shop owners (medical, grocery, retail).
Owner: imrakeshsoni@gmail.com | GitHub: github.com/imrakeshsoni/cloudystores

---

## Deploy to Google Cloud (THE ONLY DEPLOY COMMAND YOU NEED)

```bash
bash tools/deploy-gcp.sh
```

That's it. No environment variables needed. The script auto-reads config from
the running Cloud Run services and handles everything:
build → deploy backends → deploy frontend (in correct order).

**Flags:**
```bash
bash tools/deploy-gcp.sh --no-build   # skip rebuild, just redeploy current images
bash tools/deploy-gcp.sh --migrate    # also run DB migrations (first-time setup)
```

**Prerequisites (one-time setup):**
```bash
gcloud auth login
gcloud config set project cloudystores
```

---

## GCP Infrastructure (do not change these)

| Resource         | Value                              |
|------------------|------------------------------------|
| Project ID       | `cloudystores`                     |
| Region           | `asia-south1` (Mumbai)             |
| Cloud SQL        | `shoposphere-sql` (Postgres 15)    |
| Redis            | `shoposphere-redis` (10.78.59.211) |
| VPC Connector    | `shoposphere-connector`            |
| DB Secret        | `shoposphere-db-password`          |
| Image Registry   | `asia-south1-docker.pkg.dev/cloudystores/shoposphere/` |

**Live service URLs:**
| Service          | URL                                                        |
|------------------|------------------------------------------------------------|
| **Frontend**     | https://frontend-bu5d62ltja-el.a.run.app                  |
| auth-service     | https://auth-service-bu5d62ltja-el.a.run.app              |
| tenant-service   | https://tenant-service-bu5d62ltja-el.a.run.app            |
| core-api         | https://core-api-bu5d62ltja-el.a.run.app                  |
| order-service    | https://order-service-bu5d62ltja-el.a.run.app             |
| report-service   | https://report-service-bu5d62ltja-el.a.run.app            |

---

## Project Structure

```
apps/
  auth-service/     NestJS — JWT auth, users          port 3001
  tenant-service/   NestJS — tenant/shop management   port 3002
  core-api/         NestJS — products, inventory       port 3003
  order-service/    NestJS — orders, billing           port 3007
  report-service/   NestJS — analytics                 port 3008
frontend/           React + Vite + Tailwind            port 5173 (dev) / 8080 (prod)
libs/common/        Shared NestJS modules (DB, auth, tenant)
tools/
  deploy-gcp.sh     Full GCP deploy script
  migrations/       SQL migration files (init.sql, 001–004)
infrastructure/
  terraform/        GCP infra (Cloud SQL, Redis, VPC, IAM)
  k8s/              Kubernetes manifests (unused, using Cloud Run)
cloudbuild.gcp.yaml Cloud Build config (builds all Docker images in parallel)
```

---

## Local Development

```bash
cp .env.example .env          # fill in values
docker compose up -d          # starts postgres + redis
psql $DATABASE_URL -f tools/migrations/init.sql
psql $DATABASE_URL -f tools/migrations/001_initial_schema.sql
npm install
npm run dev                   # starts all services via Turborepo
```

---

## Key Architecture Rules

- **DB connection on Cloud Run**: `DATABASE_URL` env var contains `${DB_PASSWORD}` 
  as a literal placeholder. `DB_PASSWORD` is injected as a Cloud Run secret.
  `libs/common/src/database/database.module.ts` detects the injected `DB_PASSWORD`
  and builds TypeORM config with explicit params (no URL parsing) to avoid
  the `pg` empty-host bug with Unix socket paths.

- **Cloud SQL connection**: Uses Unix socket (`/cloudsql/cloudystores:asia-south1:shoposphere-sql`).
  SSL must be `false` — Unix sockets do not support SSL negotiation.
  `DB_SSL=false` env var is always set in production.

- **Tenant isolation**: Every DB table has `tenant_id`. PostgreSQL RLS policies
  enforce isolation. `DatabasePolicyBootstrapService` creates them on startup.

- **Frontend proxy**: nginx proxies `/api/auth/` → auth-service, `/api/core/` → core-api, etc.
  Service URLs are injected at container start via `envsubst` (explicit var list only —
  nginx built-in vars like `$host` must not be substituted).

- **Never use `synchronize: true`** in TypeORM — always use migration files in `tools/migrations/`.

---

## DB Migrations

Migrations only need to run once (or when a new migration file is added).
They have already been run for the live database as of 2026-04-25.

To run them again (e.g. after adding a new migration file):
```bash
bash tools/deploy-gcp.sh --migrate
```

To write a new migration: add a file `tools/migrations/005_description.sql`
and add it to the loop in `tools/deploy-gcp.sh`.

---

## CI/CD via GitHub Actions

`.github/workflows/ci-cd.yml` runs on every push to `main`:
test → build images → deploy staging → deploy production (manual approval)

Required GitHub Secrets (Settings → Secrets → Actions):
```
GCP_PROJECT_ID                = cloudystores
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/140981281714/locations/global/workloadIdentityPools/...
GCP_SERVICE_ACCOUNT           = ...@cloudystores.iam.gserviceaccount.com
GCP_DB_INSTANCE               = shoposphere-sql
GCP_DB_NAME                   = shoposphere
GCP_DB_USER                   = shoposphere
GCP_REDIS_HOST                = 10.78.59.211
GCP_VPC_CONNECTOR             = shoposphere-connector
JWT_SECRET                    = shoposphere-production-jwt-secret-secure-key
JWT_REFRESH_SECRET            = shoposphere-production-refresh-secret-secure-key
```

---

## Common Commands

```bash
# Check service health
curl https://auth-service-bu5d62ltja-el.a.run.app/v1/auth/health

# View live logs
gcloud run services logs read auth-service --region asia-south1 --project cloudystores --limit 50

# Redeploy one service without rebuilding
gcloud run deploy auth-service \
  --image asia-south1-docker.pkg.dev/cloudystores/shoposphere/auth-service:$(git rev-parse --short HEAD) \
  --region asia-south1 --project cloudystores --quiet

# List all Cloud Run services
gcloud run services list --project cloudystores --region asia-south1
```
