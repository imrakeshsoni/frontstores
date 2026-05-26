#!/bin/bash
# Wrapper — keeps update-server.cjs alive under launchd
export PORT=3001
export ADMIN_PORT=3002
export ADMIN_PASSWORD=qodXjlMOr4YZG25wDSLoRANZ

NODE="/opt/homebrew/opt/node@20/bin/node"
SCRIPT="/Users/rakeshsoni/Documents/Cloud Software/frontstores/tools/update-server.cjs"

while true; do
  echo "[wrapper] starting server at $(date)"
  "$NODE" "$SCRIPT"
  CODE=$?
  echo "[wrapper] server exited with code $CODE — restarting in 5s"
  sleep 5
done
