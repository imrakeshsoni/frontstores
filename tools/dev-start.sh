#!/usr/bin/env bash
# Local dev: start infra + all services with hot reload.
# Usage: bash tools/dev-start.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Starting postgres + redis..."
docker compose -f "$ROOT/docker-compose.infra.yml" up -d
echo "  Waiting for postgres..."
until docker exec frontstores_db pg_isready -U shoposphere -q 2>/dev/null; do sleep 1; done
echo "  postgres ready."

# Load env
set -a; source "$ROOT/.env"; set +a

export DATABASE_URL="postgresql://shoposphere:shoposphere@127.0.0.1:5432/shoposphere"
export REDIS_URL="redis://:shoposphere@127.0.0.1:6379"

echo ""
echo "▶ Starting services (each in background with hot reload)..."

start_service() {
  local name=$1
  local port=$2
  local dir="$ROOT/apps/$name"
  PORT=$port node_modules/.bin/nest start --watch --preserveWatchOutput 2>&1 \
    | sed "s/^/[$name] /" &
  echo "  $name → http://localhost:$port  (PID $!)"
}

cd "$ROOT"

(cd apps/auth-service   && PORT=3001 npx nest start --watch --preserveWatchOutput 2>&1 | sed 's/^/[auth]    /') &
(cd apps/tenant-service && PORT=3002 npx nest start --watch --preserveWatchOutput 2>&1 | sed 's/^/[tenant]  /') &
(cd apps/core-api       && PORT=3003 npx nest start --watch --preserveWatchOutput 2>&1 | sed 's/^/[core]    /') &
(cd apps/order-service  && PORT=3007 npx nest start --watch --preserveWatchOutput 2>&1 | sed 's/^/[orders]  /') &
(cd apps/report-service && PORT=3008 npx nest start --watch --preserveWatchOutput 2>&1 | sed 's/^/[reports] /') &
(cd frontend            && npx vite   2>&1 | sed 's/^/[web]     /') &

echo ""
echo "  Frontend  → http://localhost:5173/login?slug=all-medical-tenants"
echo "  Email     → rakesh@all-medical-tenants.dev"
echo "  Password  → Local1234!"
echo ""
echo "Press Ctrl+C to stop all services."
trap 'echo "Stopping..."; kill 0' INT
wait
