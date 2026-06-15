#!/bin/bash
# Build & install the native "FrontStores Admin" Mac app.
# - Wraps the live admin panel (https://update.frontstores.com/admin — Cloudflare
#   Worker + D1) in a real app window
# - Auto-signs in (no password prompt) using a local-only token file
# - Auto-launches at login via a LaunchAgent
#
# Run once: bash tools/install-admin-app.sh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$PROJECT_DIR/tools/admin-app-native"
APP_NAME="FrontStores Admin"
APP_DIR="$HOME/Applications/$APP_NAME.app"
SUPPORT_DIR="$HOME/Library/Application Support/FrontStores"
TOKEN_FILE="$SUPPORT_DIR/admin_local.token"
PLIST_DIR="$HOME/Library/LaunchAgents"
SERVER_PLIST="$PLIST_DIR/com.frontstores.server.plist"
LAUNCH_PLIST="$PLIST_DIR/com.frontstores.adminapp.plist"

# ── 1. Resolve the admin password ────────────────────────────────────────────
# Source of truth is now the Cloudflare Worker's ADMIN_PASSWORD secret. Prefer
# the existing local token file; fall back to the (retired) Mac server plist.
ADMIN_PASSWORD=$(cat "$TOKEN_FILE" 2>/dev/null | xargs)
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD=$(grep -A1 'ADMIN_PASSWORD' "$SERVER_PLIST" 2>/dev/null | grep '<string>' | sed 's/.*<string>\(.*\)<\/string>.*/\1/' | xargs)
fi
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "❌ Could not find the admin password (no token file at $TOKEN_FILE)."
  echo "   It must match the Worker's ADMIN_PASSWORD secret. Set it with:"
  echo "   printf '%s' 'YOUR_PASSWORD' > \"$TOKEN_FILE\" && chmod 600 \"$TOKEN_FILE\""
  exit 1
fi

# ── 2. Store it in a local-only token file (chmod 600 — only you can read it) ─
mkdir -p "$SUPPORT_DIR"
printf '%s' "$ADMIN_PASSWORD" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
echo "✅ Local sign-in token saved to $TOKEN_FILE (readable only by you)"

# ── 3. Compile the Swift wrapper app ─────────────────────────────────────────
echo "🔨 Compiling native app…"
BUILD_DIR=$(mktemp -d)
swiftc -O -parse-as-library \
  -o "$BUILD_DIR/FrontStoresAdmin" \
  "$SRC_DIR/main.swift" \
  -framework SwiftUI -framework WebKit -framework AppKit

# ── 3b. Generate the app icon (violet "fs" + "A" badge — distinguishes it from
#        the rose/pink tenant app icon) and pack it into an .icns ───────────
echo "🎨 Generating app icon…"
swiftc -O -o "$BUILD_DIR/gen_icon" "$SRC_DIR/gen_icon.swift" -framework AppKit
"$BUILD_DIR/gen_icon" "$BUILD_DIR/AdminIcon.iconset" >/dev/null
iconutil -c icns "$BUILD_DIR/AdminIcon.iconset" -o "$BUILD_DIR/AdminIcon.icns"

# ── 4. Assemble the .app bundle ──────────────────────────────────────────────
mkdir -p "$HOME/Applications"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$BUILD_DIR/FrontStoresAdmin" "$APP_DIR/Contents/MacOS/FrontStoresAdmin"
chmod +x "$APP_DIR/Contents/MacOS/FrontStoresAdmin"
cp "$BUILD_DIR/AdminIcon.icns" "$APP_DIR/Contents/Resources/AdminIcon.icns"
rm -rf "$BUILD_DIR"

cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>            <string>FrontStores Admin</string>
  <key>CFBundleDisplayName</key>     <string>FrontStores Admin</string>
  <key>CFBundleIdentifier</key>      <string>com.frontstores.adminapp</string>
  <key>CFBundleVersion</key>         <string>1.0</string>
  <key>CFBundleShortVersionString</key> <string>1.0</string>
  <key>CFBundlePackageType</key>     <string>APPL</string>
  <key>CFBundleExecutable</key>      <string>FrontStoresAdmin</string>
  <key>CFBundleIconFile</key>        <string>AdminIcon</string>
  <key>LSMinimumSystemVersion</key>  <string>13.0</string>
  <key>NSHighResolutionCapable</key> <true/>
  <key>LSApplicationCategoryType</key> <string>public.app-category.business</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key> <true/>
  </dict>
</dict>
</plist>
EOF

echo "✅ App installed to $APP_DIR"

# ── 5. Auto-launch at login via LaunchAgent ──────────────────────────────────
cat > "$LAUNCH_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key> <string>com.frontstores.adminapp</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-a</string>
    <string>${APP_DIR}</string>
  </array>
  <key>RunAtLoad</key> <true/>
</dict>
</plist>
EOF
launchctl unload "$LAUNCH_PLIST" 2>/dev/null || true
launchctl load "$LAUNCH_PLIST"
echo "✅ Auto-launch on login configured"

echo ""
echo "🎉 Done! \"$APP_NAME\" will now:"
echo "   • Open automatically every time you log in to this Mac"
echo "   • Sign you straight into the admin dashboard — no password needed"
echo "   • Show live status of the server, tunnel, Ollama, etc. under the Health tab"
echo ""
echo "Launching it now…"
open -a "$APP_DIR"
