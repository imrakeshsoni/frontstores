#!/usr/bin/env bash
# ── FrontStores Android Setup ────────────────────────────────────────────────
# Run this ONCE on your Mac to initialize the Android project.
# Prerequisites: Android Studio installed, ANDROID_HOME set.
#
# Usage:
#   bash scripts/android-setup.sh
# ────────────────────────────────────────────────────────────────────────────

set -e

echo "🤖 FrontStores Android Setup"
echo "════════════════════════════"

# Check Rust Android targets
echo "→ Adding Android Rust targets..."
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android

# Check ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
  # Try common Android Studio locations
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    echo "→ Found Android SDK at $ANDROID_HOME"
  else
    echo "❌ ANDROID_HOME not set. Install Android Studio first:"
    echo "   https://developer.android.com/studio"
    exit 1
  fi
fi

export NDK_HOME="$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | sort -V | tail -1)"
echo "→ Using NDK: $NDK_HOME"

# Initialize Android project
echo "→ Initializing Android project (tauri android init)..."
npm run tauri android init

echo ""
echo "✅ Android project initialized!"
echo ""
echo "To build an APK:"
echo "   npm run tauri android build --apk"
echo ""
echo "To run on a connected device/emulator:"
echo "   npm run tauri android dev"
echo ""
echo "The APK will be at:"
echo "   src-tauri/gen/android/app/build/outputs/apk/universal/release/"
