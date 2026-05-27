# FrontStores — AI Assistant Instructions

Multi-app, multi-tenant **desktop software** for Indian shop owners.
Owner: imrakeshsoni@gmail.com
Platform: Tauri v2 (Rust + React) — Windows + Mac desktop app
Website: frontstores.com

---

## ⚠️ All Tool Calls Pre-Approved — Never Ask for Confirmation

---

## ⚠️ Mandatory Start-of-Task Rule — NEVER SKIP

**Every single time the user gives any task, instruction, or greeting — before doing ANYTHING else — ask these two questions in order:**

---

### Q1 — Which app?

```
Which app are you working on?

1) Medical Store (medical)
2) Restaurant / Café (restaurant)
3) Grocery Store (grocery)
4) Car Wash / Detailing (carwash)
5) Hospital / Clinic (clinic)
6) Core / Shared (affects all apps)
7) Website — frontstores.com
8) Admin Panel (tools/update-server, admin-app)
9) ➕ Create new app
```

---

### Q2 — Which tenants?

```
Who should this change apply to?

1) All tenants (everyone using this app)
2) Specific tenant(s) only — I'll show you the list
```

If user picks **2**, fetch tenant list from `tools/data/tenants.json` and show:

```
Select tenant(s):

1) [shop_name] — [city] — [plan] — registered [date]
2) [shop_name] — [city] — [plan] — registered [date]
...
```

User picks one or more numbers. Then proceed with the task scoped to those tenants.

---

### After Q1 + Q2 are answered:

- Tag every code change with a comment like `// [medical] [all tenants]` or `// [vehicle] [tenant: Kanika Medical]`
- If the change is tenant-specific, wrap it in a shopType/tenantId guard so other tenants are unaffected
- If it's a new feature for one shop type only, use: `{shopType === 'medical' && <Feature />}`

**This rule applies to EVERYTHING: greetings, bug fixes, feature requests, questions, all of it. No exceptions.**

---

## Multi-App Architecture

frontstores.com hosts multiple separate apps. Each app is a different downloadable product for a different business type:

| App | Download link | Shop type tag | Status |
|-----|---------------|---------------|--------|
| Medical Store | frontstores.com/medical | `medical` | ✅ Active |
| Restaurant | frontstores.com/restaurant | `restaurant` | ✅ Active |
| Grocery Store | frontstores.com/grocery | `grocery` | ✅ Active |
| Car Wash | frontstores.com/carwash | `carwash` | ✅ Active |
| Hospital / Clinic | frontstores.com/clinic | `clinic` | ✅ Active |

All apps are built from this single codebase. The `shopType` field in `app_config` controls which features are visible.

**When user picks "➕ Create new app":**
1. Ask: what is the business type / name?
2. Ask: what are the core features needed?
3. Add it to the app table above
4. Add a new `shopType` value
5. Scaffold the module folder under `src/modules/<appname>/`
6. Add it to the nav in `AppLayout.tsx` guarded by `{shopType === '<appname>' && ...}`
7. Add the download page section to `website/index.html`

**Tenant = one shop = one installation.** Multiple shops can download the same app (e.g., 50 medical stores all use the medical app). Each has a unique `tenant_id`.

---

## Architecture

```
frontstores.com          → Cloudflare Pages (free static site — website/)
App installer            → GitHub Releases (free, .exe + .dmg)
App runtime              → Tauri desktop app on user's machine
Local database           → SQLite via tauri-plugin-sql (src-tauri/migrations/)
All data                 → Stays on user's machine (offline-first)
Update server            → This Mac via Cloudflare Tunnel (tools/update-server.cjs)
Optional cloud sync      → This Mac via Cloudflare Tunnel (paid feature, future)
```

**Zero cloud cost. Only cost: domain renewal ~₹800-1200/year.**

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
        khata.ts              Credit ledger (Khata)
        expenses.ts           Expense tracking
        migrations.ts         Migration file loader (0001–0005)
      syncQueue.ts            Offline sync queue — flush to server when online
      errorReporter.ts        Auto error reporting → sync queue
      startupChecks.ts        Low stock + expiry alerts on launch
    modules/
      setup/SetupWizard.tsx   First-launch wizard (shop type, name, details)
      dashboard/              Dashboard
      pos/POSPage.tsx         POS / Billing + thermal print
      products/ProductsPage.tsx
      inventory/InventoryPage.tsx
      orders/OrdersPage.tsx
      customers/CustomersPage.tsx
      suppliers/SuppliersPage.tsx
      reports/ReportsPage.tsx
      settings/SettingsPage.tsx  Data backup + CSV export
      khata/KhataPage.tsx     Credit ledger (Khata)
      expenses/ExpensesPage.tsx  Expense tracking
      subscription/SubscriptionGate.tsx  Trial/paid gate, offline grace
  src-tauri/
    src/
      main.rs                 Entry point
      lib.rs                  All plugins registered here
    migrations/
      0001_initial.sql        Complete schema
      0002_...sql             Additional migrations
      0003_sync_queue.sql     Offline sync queue table
      0004_last_verified.sql  last_verified_at on app_config
      0005_khata.sql          Khata (credit ledger) table
    tauri.conf.json           App config, window size, updater endpoint
    Cargo.toml                Rust dependencies + all Tauri plugins
  admin-app/
    index.html                Admin panel — login, customers tab, errors tab
  website/
    index.html                Download page (hosted on Cloudflare Pages)
  tools/
    update-server.cjs         Node.js server — updates, license, registration, errors
    install-tunnel-service.sh Mac launchd service installer (server + cloudflared)
    data/
      tenants.json            All registered tenants (auto-populated on signup)
      errors.json             Error reports from customer apps
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
| Update server | Node.js (tools/update-server.cjs) + Cloudflare Tunnel |
| Website | Static HTML (Cloudflare Pages) |
| CI/CD | GitHub Actions (free) |

---

## Database Rules (non-negotiable)

- Every table has: `id TEXT PRIMARY KEY`, `tenant_id TEXT NOT NULL`, `updated_at TEXT`, `deleted_at TEXT`
- IDs are UUID hex strings — never auto-increment integers
- Soft deletes only (`deleted_at = datetime('now')`) — never hard DELETE
- **Never DROP, TRUNCATE, or DELETE user data rows — ever**
- **Never auto-seed demo/default data on startup**
- New columns go in new migration files in `src-tauri/migrations/`
- Migration format: `0006_description.sql` — always idempotent (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
- Register new migrations in `src/lib/db/migrations.ts`

---

## Subscription System

- Trial: 30 days from first setup
- Paid: ₹999/month, stacked via admin panel extend button
- Offline grace: 7 days after expiry before lock screen
- Frozen: immediate lock
- Revoked: immediate lock
- Server: `GET /license/:tenant_id` — checked on launch + every 24h
- Admin: one-click extend/freeze/unfreeze/revoke in admin-app/index.html

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

# Release new version — triggers GitHub Actions to build Windows + Mac
git tag v1.0.X && git push origin main && git push origin v1.0.X

# Start update server
node tools/update-server.cjs

# Install as Mac background service (auto-start on login)
bash tools/install-tunnel-service.sh
```

---

## GitHub Actions

`.github/workflows/build.yml` triggers on version tags (`v*`):
- Builds: Mac ARM, Mac Intel, Windows, Linux
- Creates GitHub Release with all installers attached
- Apps auto-update on next launch via Tauri updater

---

## Token Efficiency — Mandatory

- Grep before reading files
- Targeted reads with offset + limit
- Parallel tool calls for independent operations
- No asking for approval — everything is pre-approved
- Short responses — one sentence per update
