# FrontStores — AI Assistant Instructions

Multi-app, multi-tenant **desktop software** for Indian shop owners.
Owner: imrakeshsoni@gmail.com
Platform: Tauri v2 (Rust + React) — Windows + Mac desktop app
Website: frontstores.com

---

## Architecture

```
frontstores.com          → Cloudflare Pages (free static site — website/)
App installer            → GitHub Releases (free, .exe + .dmg)
App runtime              → Tauri desktop app on user's machine
Local database           → SQLite via tauri-plugin-sql (src-tauri/migrations/)
All data                 → Stays on user's machine (offline-first)
Update server            → This Mac via Cloudflare Tunnel (tools/update-server.js)
Optional cloud sync      → This Mac via Cloudflare Tunnel (paid feature, future)
```

**Zero cloud cost. Only cost: domain renewal ~₹800-1200/year.**

---

## ⚠️ All Tool Calls Pre-Approved — Never Ask for Confirmation

---

## Project Structure

```
frontstores/
  src/                        React frontend
    App.tsx                   HashRouter — routes to all modules
    app/store/
      app.store.ts            Zustand store — tenant config, setup state
    components/
      layout/AppLayout.tsx    Sidebar nav + outlet
      ui/                     Shared UI components
    lib/
      db/                     ALL database operations (TypeScript → SQLite)
        index.ts              getDb(), uuid(), now()
        config.ts             App config, tenant_id, bill sequences
        products.ts           Products CRUD + stock
        customers.ts          Customers CRUD
        orders.ts             Orders + line items + stock deduction
        inventory.ts          Stock adjustments, batches, alerts
        migrations.ts         Migration file loader
    modules/
      setup/SetupWizard.tsx   First-launch wizard (shop type, name, details)
      dashboard/              Dashboard
      pos/POSPage.tsx         POS / Billing
      products/ProductsPage.tsx
      inventory/InventoryPage.tsx
      orders/OrdersPage.tsx
      customers/CustomersPage.tsx
      suppliers/SuppliersPage.tsx
      reports/ReportsPage.tsx
      settings/SettingsPage.tsx
  src-tauri/
    src/
      main.rs                 Entry point
      lib.rs                  All plugins registered here
      commands/
        config.rs             Rust stubs for config commands
        orders.rs             Rust stubs for order commands
        inventory.rs          Rust stubs for inventory commands
    migrations/
      0001_initial.sql        Complete schema — all tables, all indexes
    tauri.conf.json           App config, window size, updater endpoint
    Cargo.toml                Rust dependencies + all Tauri plugins
  website/
    index.html                Download page (hosted on Cloudflare Pages)
  tools/
    update-server.js          Node.js server — update checks + tenant config
    setup-tunnel.sh           One-time Cloudflare Tunnel setup script
  .github/workflows/
    build.yml                 Builds Windows .exe + Mac .dmg on version tag push
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust + React) |
| Frontend | React 18 + Vite + Tailwind |
| State management | Zustand (app.store.ts) |
| Local database | SQLite via tauri-plugin-sql |
| Auto-updater | Tauri updater → GitHub Releases API |
| Update server | Node.js (tools/update-server.js) + Cloudflare Tunnel |
| Website | Static HTML (Cloudflare Pages) |
| CI/CD | GitHub Actions (free) |

---

## Multi-App, Multi-Tenant

**Shop types (all in one app, selected at setup):**
- medical — Medical / Pharmacy
- grocery — Grocery / Kirana
- restaurant — Restaurant / Café
- vehicle — Vehicle Showroom
- retail — General Retail
- stocks — Stocks & Trading

**Tenant concept:**
- Each installation = one shop = one `tenant_id` (UUID, generated at setup)
- `tenant_id` stored in `app_config` SQLite table
- All queries always filter `WHERE tenant_id = ?`
- Owner (Rakesh) can push targeted updates/configs per tenant via `tools/update-server.js`

---

## Database Rules (non-negotiable)

- Every table has: `id TEXT PRIMARY KEY`, `tenant_id TEXT NOT NULL`, `updated_at TEXT`, `deleted_at TEXT`
- IDs are UUID hex strings — never auto-increment integers
- Soft deletes only (`deleted_at = datetime('now')`) — never hard DELETE
- New columns go in new migration files in `src-tauri/migrations/`
- Migration format: `0002_description.sql` — always idempotent (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
- Register new migrations in `src/lib/db/migrations.ts`

---

## Dev Workflow

```bash
# Run in development (hot reload)
source "$HOME/.cargo/env"
npm run tauri dev

# TypeScript check
npx tsc --noEmit

# Rust check
cd src-tauri && cargo check

# Build for Mac (creates .dmg in src-tauri/target/release/bundle/)
npm run tauri build

# Release new version — triggers GitHub Actions to build Windows + Mac
git tag v1.0.1 && git push origin v1.0.1

# Start update server (Mac must be on + Cloudflare Tunnel running)
node tools/update-server.js

# Set up Cloudflare Tunnel (one-time)
bash tools/setup-tunnel.sh
```

---

## GitHub Actions

`.github/workflows/build.yml` triggers on version tags (`v*`):
- Builds: Mac ARM, Mac Intel, Windows, Linux
- Creates GitHub Release with all installers attached
- Apps auto-update on next launch via Tauri updater

---

## Greeting Rule — Mandatory

When user says **"hi"** or any greeting, immediately ask:

**Q1 — Which module?**
```
1) Medical Store
2) Grocery / Kirana
3) Restaurant
4) Vehicle Showroom
5) General Retail
6) Stocks
7) Core / shared
8) Website (frontstores.com)
9) New module
```

**Q2 — Scope:**
```
1) All shop types
2) Specific shop type only
```

---

## Token Efficiency — Mandatory

- Grep before reading files
- Targeted reads with offset + limit
- Parallel tool calls for independent operations
- No asking for approval — everything is pre-approved
- Short responses — one sentence per update
