#!/usr/bin/env bash
# Sets up Cloudflare Tunnel to expose this Mac as api.frontstores.com
# Run once. After that the tunnel starts automatically on login.

set -e

TUNNEL_NAME="frontstores"
HOSTNAME="api.frontstores.com"
LOCAL_PORT=4000

echo "=== FrontStores — Cloudflare Tunnel Setup ==="

# 1. Install cloudflared if not present
if ! command -v cloudflared &>/dev/null; then
  echo "Installing cloudflared..."
  brew install cloudflare/cloudflare/cloudflared
fi

# 2. Authenticate with Cloudflare
echo "Opening browser to authenticate with Cloudflare..."
cloudflared tunnel login

# 3. Create the tunnel
echo "Creating tunnel '$TUNNEL_NAME'..."
cloudflared tunnel create "$TUNNEL_NAME"

# 4. Route DNS
echo "Routing $HOSTNAME → tunnel..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"

# 5. Write config
TUNNEL_ID=$(cloudflared tunnel list --output json | python3 -c "import sys,json; data=json.load(sys.stdin); [print(t['id']) for t in data if t['name']=='$TUNNEL_NAME']" 2>/dev/null | head -1)

mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME
    service: http://localhost:$LOCAL_PORT
  - service: http_status:404
EOF

# 6. Install as a system service (auto-start on login)
cloudflared service install

echo ""
echo "=== Done! ==="
echo "Tunnel '$TUNNEL_NAME' → https://$HOSTNAME → localhost:$LOCAL_PORT"
echo "The tunnel will start automatically when your Mac starts."
echo ""
echo "Next: start the update server with: node tools/update-server.js"
