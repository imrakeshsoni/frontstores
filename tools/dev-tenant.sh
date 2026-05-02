#!/usr/bin/env bash
# Sync production tenant structure to local for development.
# Copies: tenant config, shop config, profiles, roles, users, bill sequences.
# Never copies: orders, customers, products, inventory, or any business data.
# Passwords are replaced with local-only credentials.
#
# Usage:
#   bash tools/dev-tenant.sh --all               # sync all production tenants
#   bash tools/dev-tenant.sh --slug <slug>        # sync one tenant by slug

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CREDS_FILE="$ROOT_DIR/.dev-tenants.json"
LOCAL_DB_URL="${DATABASE_URL:-postgresql://shoposphere:shoposphere@localhost:5432/shoposphere}"
SYNC_SCRIPT="$SCRIPT_DIR/local/sync-prod-metadata-to-local.mjs"
LOCAL_MODULES="$SCRIPT_DIR/local/node_modules"

# ── args ──────────────────────────────────────────────────────────────────────
MODE=""
TENANT_SLUG=""
# Base tenant for --all: roshan-medical-store mirrors a real production store
# and is used as the generic dev context for all-tenant features.
ALL_BASE_SLUG="roshan-medical-store"
ALL_ENTRY_KEY="dev-all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)  MODE="all"; TENANT_SLUG="$ALL_BASE_SLUG"; shift ;;
    --slug) MODE="specific"; TENANT_SLUG="$2"; shift 2 ;;
    *) echo "Usage: $0 --all | --slug <slug>"; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Usage: $0 --all | --slug <slug>"
  exit 1
fi

# ── 1. check .dev-tenants.json — skip if already synced ──────────────────────
ENTRY_KEY="$TENANT_SLUG"
[[ "$MODE" == "all" ]] && ENTRY_KEY="$ALL_ENTRY_KEY"

if [[ -f "$CREDS_FILE" ]]; then
  EXISTING=$(node -e "
    const f = JSON.parse(require('fs').readFileSync('$CREDS_FILE','utf8'));
    if (f['$ENTRY_KEY']) process.stdout.write(JSON.stringify(f['$ENTRY_KEY']));
  " 2>/dev/null || true)

  if [[ -n "$EXISTING" ]]; then
    echo "✓ '$ENTRY_KEY' already synced locally — no changes made."
    echo ""
    echo "  Use --force to re-sync from production."
    echo "  $EXISTING"
    exit 0
  fi
fi

# ── 2. ensure local node_modules for the sync script ─────────────────────────
if [[ ! -d "$LOCAL_MODULES" ]]; then
  echo "→ Installing dependencies for sync script..."
  cd "$SCRIPT_DIR/local" && npm install --silent && cd "$ROOT_DIR"
fi

# ── 3. sync local schema first ───────────────────────────────────────────────
echo "→ Syncing local DB schema..."
if [[ -f "$SCRIPT_DIR/migrate-safe.sh" ]]; then
  bash "$SCRIPT_DIR/migrate-safe.sh" --env local
else
  echo "  WARNING: migrate-safe.sh not found — skipping schema sync"
fi

# ── 4. sync from production ───────────────────────────────────────────────────
echo "→ Syncing tenant structure from production (no business data)..."

SYNC_ARGS=("--local-db-url" "$LOCAL_DB_URL")
if [[ "$MODE" == "specific" ]]; then
  SYNC_ARGS+=("--tenant-slug" "$TENANT_SLUG")
fi

SYNC_OUTPUT=$(node "$SYNC_SCRIPT" "${SYNC_ARGS[@]}" 2>&1)
echo "$SYNC_OUTPUT"

# ── 5. query local DB for tenant IDs and save to .dev-tenants.json ───────────
echo ""
echo "→ Saving credentials to .dev-tenants.json..."

SLUG_FILTER=""
if [[ "$MODE" == "specific" ]]; then
  SLUG_FILTER="AND t.slug = '$TENANT_SLUG'"
fi

TENANT_ROWS=$(psql "$LOCAL_DB_URL" -t -A -F'|' <<SQL
SELECT t.id, t.name, t.slug, s.id as shop_id, u.id as user_id, u.email
FROM tenants t
JOIN shops s ON s.tenant_id = t.id
JOIN users u ON u.tenant_id = t.id
WHERE t.status = 'active' $SLUG_FILTER
ORDER BY t.created_at ASC, u.created_at ASC;
SQL
)

EXISTING_JSON="{}"
[[ -f "$CREDS_FILE" ]] && EXISTING_JSON=$(cat "$CREDS_FILE")

UPDATED_JSON=$(node -e "
const lines = \`$TENANT_ROWS\`.trim().split('\n').filter(Boolean);
const result = JSON.parse(\`$EXISTING_JSON\`);
const mode = '$MODE';
const entryKey = '$ENTRY_KEY';
const seen = {};
for (const line of lines) {
  const [tenant_id, name, slug, shop_id, user_id, email] = line.split('|');
  if (seen[slug]) continue;
  seen[slug] = true;
  // For --all, save under 'dev-all' key regardless of source slug
  const key = (mode === 'all') ? entryKey : slug;
  result[key] = {
    label:       (mode === 'all') ? 'Dev All (base: ' + name + ')' : name,
    mode:        mode,
    source_slug: slug,
    tenant_id:   tenant_id,
    shop_id:     shop_id,
    user_id:     user_id,
    email:       email,
    password:    'Local1234!:' + email.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase(),
    slug:        slug,
    synced_at:   new Date().toISOString()
  };
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
")

echo "$UPDATED_JSON" > "$CREDS_FILE"

echo ""
echo "✓ Done. Local tenant(s) are now in sync with production structure."
echo "  Credentials saved to .dev-tenants.json"
echo ""
echo "  Password format: Local1234!:<your-email-dots>"
echo "  Example: admin@store.com → Local1234!:admin.store.com"
echo ""
