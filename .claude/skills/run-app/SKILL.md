---
name: run-app
description: Open/launch/run the FrontStores desktop app (medical store & all shop types — single Tauri codebase) in dev mode. Use whenever the user says "open the app", "run the medical store", "launch the app", "open it again", etc.
---

# Run the FrontStores desktop app

One Tauri (Rust + React/Vite) codebase serves every shop type (medical, grocery,
restaurant, …). `shopType` is chosen in the Setup Wizard / stored in `app_config`.
"Open the medical store app" = launch this same app.

## Launch (do this directly — it's pre-approved)

From the project root `/Users/rakeshsoni/Documents/Cloud Software/frontstores`:

1. Kill any stale instance so the window/port is free:
   ```bash
   pkill -f "target/debug/frontstores" 2>/dev/null; pkill -f "tauri dev" 2>/dev/null; pkill -f "cargo run" 2>/dev/null; sleep 2
   ```
2. Launch in the **background** (long-running; keeps the window open):
   ```bash
   cd "/Users/rakeshsoni/Documents/Cloud Software/frontstores" && source "$HOME/.cargo/env" && npm run tauri dev
   ```
   Use `run_in_background: true`. Rust is already compiled, so warm launches take
   ~5–10s; a cold first build can take a few minutes.
3. Confirm it's up by watching the task output for the line
   `Running \`target/debug/frontstores\`` (or `pgrep -f "target/debug/frontstores"`).
   That means the native window is open on the Mac.

## Dev convenience already wired (do NOT remove — both are DEV-guarded)

The app boots straight into the dashboard in dev — no login, no subscription wall:

- **Auto-login** as `owner` — `src/App.tsx` (`if (import.meta.env.DEV)` block in the
  auth-check effect).
- **Subscription gate skipped** — `src/modules/subscription/SubscriptionGate.tsx`
  (`if (import.meta.env.DEV) return <>{children}</>` near the top).

Both are wrapped in `import.meta.env.DEV`, so production customer builds still
enforce login + the live license check. Never strip the guards.

## Notes

- HMR (code edits) re-renders but does NOT re-run mount effects — if a change to
  the login/auth flow doesn't take effect, do a full reload (Cmd+R) or relaunch.
- Closing the app window ends `tauri dev` (clean exit 0). To reopen, just relaunch.
- Backend (license/sync) now runs on the Cloudflare Worker, not the Mac.
