#!/bin/bash
# DEPRECATED — the update server now runs on Cloudflare Workers + D1 + R2
# (update.frontstores.com → update-server-webapp). This local Mac server is
# retired; this wrapper is kept only for emergency local fallback.
# Wrapper — keeps update-server.cjs alive under launchd
export PORT=3001
export ADMIN_PORT=3002
# Never hardcode the admin password. Read it from the local-only token file
# (chmod 600), which must match the Worker's ADMIN_PASSWORD secret.
export ADMIN_PASSWORD="$(cat "$HOME/Library/Application Support/FrontStores/admin_local.token" 2>/dev/null)"

NODE="/opt/homebrew/opt/node@20/bin/node"
SCRIPT="/Users/rakeshsoni/Documents/Cloud Software/frontstores/tools/update-server.cjs"

while true; do
  echo "[wrapper] starting server at $(date)"
  "$NODE" "$SCRIPT"
  CODE=$?
  echo "[wrapper] server exited with code $CODE — restarting in 5s"
  sleep 5
done
