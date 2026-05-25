#!/usr/bin/env python3
# FrontStores Kokoro TTS Server — runs on your Mac, serves audio to all customer apps
# Port 8880 — localhost only, proxied via update-server.cjs at /ai/tts
# Usage: python3 tools/kokoro-server.py

import http.server
import json
import io
import os
import sys

PORT = int(os.environ.get("KOKORO_PORT", "8880"))

try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    import numpy as np
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False
    print("⚠️  kokoro-onnx not installed. Run: /opt/homebrew/bin/python3.11 -m pip install kokoro-onnx soundfile")

VOICES = {
    "heart":   "af_heart",
    "bella":   "af_bella",
    "sarah":   "af_sarah",
    "nicole":  "af_nicole",
    "emma":    "bf_emma",
    "isabella":"bf_isabella",
    "adam":    "am_adam",
    "michael": "am_michael",
    "george":  "bm_george",
    "lewis":   "bm_lewis",
}

# Load model once at startup
kokoro = None
if KOKORO_AVAILABLE:
    try:
        print("🔊 Loading Kokoro TTS model...")
        model_path = os.path.join(os.path.dirname(__file__), "kokoro", "models", "kokoro-v1.0.onnx")
        voices_path = os.path.join(os.path.dirname(__file__), "kokoro", "models", "voices-v1.0.bin")
        kokoro = Kokoro(model_path, voices_path)
        print("✅ Kokoro TTS ready")
    except Exception as e:
        print(f"⚠️  Kokoro model load failed: {e}")
        print("   Download models from: https://github.com/thewh1teagle/kokoro-onnx/releases")

class TTSHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress access logs

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "kokoro": kokoro is not None}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/tts":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        text = str(body.get("text", "")).strip()[:500]
        voice_key = str(body.get("voice", "heart")).lower()
        speed = float(body.get("speed", 1.0))

        if not text:
            self.send_response(400)
            self.end_headers()
            return

        if not kokoro:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Kokoro not available"}).encode())
            return

        try:
            voice_name = VOICES.get(voice_key, "af_heart")
            samples, sample_rate = kokoro.create(text, voice=voice_name, speed=speed, lang="en-us")

            buf = io.BytesIO()
            sf.write(buf, samples, sample_rate, format="WAV")
            audio_bytes = buf.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio_bytes)))
            self.end_headers()
            self.wfile.write(audio_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

if __name__ == "__main__":
    server = http.server.HTTPServer(("127.0.0.1", PORT), TTSHandler)
    print(f"🔊 Kokoro TTS server: http://127.0.0.1:{PORT}")
    print(f"   Voices available: {', '.join(VOICES.keys())} (default: heart)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nKokoro TTS server stopped.")
