#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FrontStores — Migrate server to a new Mac (Mac Mini or any Mac)
#
# Run this ON THE NEW MAC after copying the project folder:
#   bash tools/migrate-to-mac-mini.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   FrontStores — New Mac Setup                    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Node.js ───────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found."
  echo "   Install it: https://nodejs.org  (or: brew install node)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── 2. Cloudflare Tunnel ─────────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo ""
  echo "⚠️  cloudflared not found. Installing via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install cloudflared
  else
    echo "❌ Homebrew not found. Install cloudflared manually:"
    echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
fi
echo "✅ cloudflared $(cloudflared --version 2>&1 | head -1)"

# ── 3. Authenticate cloudflared (links to your Cloudflare account) ───────────
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo ""
  echo "🔑 Cloudflare login required (one-time — opens browser)..."
  cloudflared login
else
  echo "✅ cloudflared already authenticated"
fi

# ── 4. Check tunnel exists ───────────────────────────────────────────────────
if ! cloudflared tunnel list 2>/dev/null | grep -q "frontstores"; then
  echo ""
  echo "⚠️  Tunnel 'frontstores' not found on this account."
  echo "   If this is the same Cloudflare account, run: cloudflared tunnel create frontstores"
  echo "   Then update ~/.cloudflared/config.yml with the new tunnel ID."
fi

# ── 5. Data dir ──────────────────────────────────────────────────────────────
DATA_DIR="${PROJECT_DIR}/tools/data"
mkdir -p "$DATA_DIR"
if [ -f "$DATA_DIR/subscriptions.json" ]; then
  COUNT=$(node -e "try{console.log(Object.keys(require('$DATA_DIR/subscriptions.json')).length)}catch{console.log(0)}")
  echo "✅ Data: $COUNT tenants found in tools/data/"
else
  echo "⚠️  No subscriptions.json found — starting fresh (or copy it from old Mac first)"
fi

# ── 6. Install launchd services (auto-start on login + restart on crash) ─────
echo ""
echo "Installing background services..."
bash "${PROJECT_DIR}/tools/install-tunnel-service.sh"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ Setup complete!                              ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Public server:  http://localhost:3001           ║"
echo "║  Admin panel:    http://localhost:3002           ║"
echo "║  Tunnel URL:     https://update.frontstores.com  ║"
echo "║                                                  ║"
echo "║  Both services auto-start on login.              ║"
echo "║  Open admin panel from your MacBook browser:     ║"
echo "║    http://<mac-mini-local-ip>:3002               ║"
echo "║  (find IP: System Settings → Wi-Fi → Details)   ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
