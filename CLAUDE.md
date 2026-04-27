# ShopOS — AI Assistant Instructions

This is a multi-tenant SaaS for Indian shop owners (medical, grocery, retail).
Owner: imrakeshsoni@gmail.com | GitHub: github.com/imrakeshsoni/cloudystores

---

## ⚠️ Data Safety Policy — Non-Negotiable

**Preserving user data is an absolute requirement. Any change that violates this
policy must be blocked regardless of urgency.**

| Rule | Detail |
|------|--------|
| No data destruction | Migrations must never DROP, TRUNCATE, or DELETE user rows |
| No auto-seeding | Application code must never insert demo/default data on startup or login |
| Backup before migrate | Every migration run takes a full DB backup first |
| Idempotent migrations | Every migration must be safe to re-run (IF NOT EXISTS, ON CONFLICT DO NOTHING, ADD COLUMN IF NOT EXISTS) |
| Checksum tracking | `_schema_migrations` table records every applied file; already-applied files are skipped |
| Env isolation | Local, staging, and production use completely separate databases — never share or copy between envs |
| Audit before run | `migrate-safe.sh` scans every migration for DROP/TRUNCATE/DELETE/destructive ALTER before executing |
| Destructive ops blocked | Any script containing destructive SQL fails immediately with a clear error |

**How to write a safe migration:**
```sql
-- ✅ Good — idempotent, non-destructive
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
UPDATE bill_sequences SET prefix = 'OD' WHERE prefix = 'ORD';  -- safe, targeted

-- ❌ Blocked — migrate-safe.sh will refuse to run these
DROP TABLE old_sessions;
TRUNCATE products;
DELETE FROM customers;
ALTER TABLE users DROP COLUMN legacy_field;
```

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
bash tools/deploy-gcp.sh --migrate    # also run DB migrations (backup taken first)
bash tools/deploy-gcp.sh --dry-run    # print the full plan without executing anything
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
| **Frontend**     | https://frontstores.com                                    |
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

All migrations go through `tools/migrate-safe.sh` which enforces:
1. Destructive-command audit (blocks DROP, TRUNCATE, DELETE, destructive ALTER)
2. Full database backup before any migration runs
3. Checksum-based skip — already-applied files are never re-executed
4. Applied-file log in `_schema_migrations` table

**To add a new migration:**
1. Create `tools/migrations/008_description.sql` — use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
2. Add the filename to the `MIGRATIONS` array in `tools/migrate-safe.sh`
3. Test locally: `bash tools/migrate-safe.sh --env local`
4. Deploy with: `bash tools/deploy-gcp.sh --migrate`

---

## ⚠️ Multi-Tenant Isolation Rules — Mandatory for Every New Table

This app serves N independent businesses (medical stores, grocery shops, etc.).
**Each business must be 100% isolated — they must never see each other's data.**
This is enforced at two layers: application code (tenant_id in every query) AND
PostgreSQL Row Level Security (RLS). Both layers must be present.

### Every new table MUST have all four of these — no exceptions:

```sql
-- 1. tenant_id column
CREATE TABLE IF NOT EXISTS your_table (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),   -- ← REQUIRED
  -- ... your columns ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- 3. Force RLS (blocks the DB owner user from bypassing policies)
ALTER TABLE your_table FORCE ROW LEVEL SECURITY;

-- 4. Isolation policy
CREATE POLICY tenant_isolation_your_table ON your_table
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 5. Index (performance)
CREATE INDEX IF NOT EXISTS idx_your_table_tenant ON your_table(tenant_id);
```

### What NEVER goes in a migration:
- `DROP TABLE` / `TRUNCATE` / `DELETE FROM` / `DROP COLUMN` — blocked by migrate-safe.sh
- Demo data, seed data, default records — accounts must always start empty
- Tables without `tenant_id` that store per-business data

**To run migrations locally (safe, with backup):**
```bash
bash tools/migrate-safe.sh --env local
```

**To run migrations in production (backup mandatory, auto-taken):**
```bash
bash tools/deploy-gcp.sh --migrate
```

Migration history is tracked in the `_schema_migrations` table.
Migrations already applied are silently skipped on every subsequent run.

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
