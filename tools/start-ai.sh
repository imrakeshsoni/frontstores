#!/bin/bash
# FrontStores AI — starts Ollama (LLM) + Kokoro TTS on your Mac
# Run this before customers use AI features.
# Usage: bash tools/start-ai.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/ollama/models"
PYTHON="/opt/homebrew/bin/python3.11"

export OLLAMA_MODELS="$MODELS_DIR"

echo "🤖 FrontStores AI Server starting..."

# ── Ollama (LLM) ─────────────────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  echo "❌  Ollama not found. Install: brew install ollama"
  exit 1
fi

if [ ! -d "$MODELS_DIR/manifests" ]; then
  echo "⚠️  Dolphin model not found. Pulling now (4.9GB)..."
  OLLAMA_MODELS="$MODELS_DIR" ollama pull dolphin3
fi

# Start Ollama in background
OLLAMA_MODELS="$MODELS_DIR" ollama serve &
OLLAMA_PID=$!
echo "✅  Ollama started (PID $OLLAMA_PID) on port 11434"

# ── Kokoro TTS ───────────────────────────────────────────────────────────────
if [ -f "$PYTHON" ]; then
  "$PYTHON" "$SCRIPT_DIR/kokoro-server.py" &
  KOKORO_PID=$!
  echo "✅  Kokoro TTS started (PID $KOKORO_PID) on port 8880"
else
  echo "⚠️  Python 3.11 not found — TTS unavailable. Voice will use browser synthesis."
fi

echo ""
echo "🟢 FrontStores AI ready. Press Ctrl+C to stop."
echo ""

# Wait for either process to exit
wait
