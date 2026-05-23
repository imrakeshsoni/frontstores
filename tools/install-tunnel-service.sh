#!/bin/bash
# Install Cloudflare Tunnel + Admin Server as Mac background services
# Run once: bash tools/install-tunnel-service.sh
# They will auto-start on login and restart if they crash.

set -e
PLIST_DIR="$HOME/Library/LaunchAgents"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$PLIST_DIR"

# ── 1. Admin server (node tools/update-server.cjs) ──────────────────────────
cat > "$PLIST_DIR/com.frontstores.server.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>              <string>com.frontstores.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${PROJECT_DIR}/tools/update-server.cjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>             <string>3001</string>
    <key>ADMIN_PORT</key>       <string>3002</string>
    <key>ADMIN_PASSWORD</key>   <string>frontstores2025</string>
  </dict>
  <key>WorkingDirectory</key>   <string>${PROJECT_DIR}/tools</string>
  <key>RunAtLoad</key>          <true/>
  <key>KeepAlive</key>          <true/>
  <key>StandardOutPath</key>    <string>${PROJECT_DIR}/tools/server.log</string>
  <key>StandardErrorPath</key>  <string>${PROJECT_DIR}/tools/server.log</string>
</dict>
</plist>
EOF

# ── 2. Cloudflare Tunnel ─────────────────────────────────────────────────────
# Only install if cloudflared is present
if command -v cloudflared &> /dev/null; then
  TUNNEL_NAME="frontstores"
  cat > "$PLIST_DIR/com.frontstores.tunnel.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>              <string>com.frontstores.tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(which cloudflared)</string>
    <string>tunnel</string>
    <string>run</string>
    <string>${TUNNEL_NAME}</string>
  </array>
  <key>RunAtLoad</key>          <true/>
  <key>KeepAlive</key>          <true/>
  <key>StandardOutPath</key>    <string>${PROJECT_DIR}/tools/tunnel.log</string>
  <key>StandardErrorPath</key>  <string>${PROJECT_DIR}/tools/tunnel.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST_DIR/com.frontstores.tunnel.plist" 2>/dev/null || true
  launchctl load "$PLIST_DIR/com.frontstores.tunnel.plist"
  echo "✅ Cloudflare Tunnel service installed"
else
  echo "⚠️  cloudflared not found — skipping tunnel service. Install with: brew install cloudflared"
fi

# Load the server service
launchctl unload "$PLIST_DIR/com.frontstores.server.plist" 2>/dev/null || true
launchctl load "$PLIST_DIR/com.frontstores.server.plist"

echo "✅ Admin server service installed on port 3001"
echo "✅ Both services will auto-start on login and restart if they crash."
echo ""
echo "To check status: launchctl list | grep frontstores"
echo "To view logs:    tail -f ${PROJECT_DIR}/tools/server.log"
