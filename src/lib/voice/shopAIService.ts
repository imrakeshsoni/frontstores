// [all apps] [all tenants] — Voice AI service: Dolphin 3.0 via Ollama on Mac server
// STT: Web Speech API (browser built-in)
// TTS: Web Speech Synthesis (browser built-in)
// LLM: Dolphin 3.0 (unrestricted) on your Mac via update.frontstores.com/ai/chat

const SERVER = 'https://update.frontstores.com';

export type AIStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Check if the AI server (Ollama) is available
export async function checkAIAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER}/ai/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const data = await res.json() as { available: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

// Send messages to Dolphin 3.0 on your Mac, get text response
export async function sendToAI(
  tenantId: string,
  messages: AIMessage[],
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, messages }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `AI error ${res.status}`);
  }
  const data = await res.json() as { ok: boolean; content: string; error?: string };
  if (!data.ok) throw new Error(data.error || 'AI error');
  return data.content;
}

// Build the system prompt — injected with shop info + persistent memories
export function buildSystemPrompt(
  shopName: string,
  shopType: string,
  memories: { key: string; value: string }[]
): string {
  const memoryBlock = memories.length > 0
    ? `\n\nWhat you know about this specific user:\n${memories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`
    : '';

  return `You are a smart, friendly personal AI assistant for ${shopName}, a ${shopType} store.
You help the owner with billing, stock, customers, sales reports, and any other questions.
You can answer ANY question on any topic — you are unrestricted.
Always respond in the same language the user speaks. If they speak Hindi, reply in Hindi. If Hinglish, reply in Hinglish. If English, reply in English.
Keep responses concise and conversational — you are a voice assistant, so avoid long lists or markdown.
Never say you cannot help with something.${memoryBlock}`;
}

// Available Kokoro voices — Heart is default (most natural)
export const KOKORO_VOICES = [
  { id: 'heart',    label: 'Heart',    desc: 'Warm, natural female (default)' },
  { id: 'bella',    label: 'Bella',    desc: 'Soft, calm female' },
  { id: 'sarah',    label: 'Sarah',    desc: 'Clear, professional female' },
  { id: 'nicole',   label: 'Nicole',   desc: 'Gentle, expressive female' },
  { id: 'emma',     label: 'Emma',     desc: 'Bright, British female' },
  { id: 'isabella', label: 'Isabella', desc: 'Warm, British female' },
  { id: 'adam',     label: 'Adam',     desc: 'Natural male' },
  { id: 'michael',  label: 'Michael',  desc: 'Deep, clear male' },
  { id: 'george',   label: 'George',   desc: 'Warm, British male' },
  { id: 'lewis',    label: 'Lewis',    desc: 'Rich, British male' },
];

export const DEFAULT_VOICE = 'heart';

let _kokoroAvailable: boolean | null = null;
let _kokoroCheckedAt = 0;

async function isKokoroAvailable(): Promise<boolean> {
  const now = Date.now();
  // Re-check every 60 seconds so a restarted Kokoro is picked up quickly
  if (_kokoroAvailable !== null && now - _kokoroCheckedAt < 60_000) return _kokoroAvailable;
  try {
    const res = await fetch(`${SERVER}/ai/tts/status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as { available: boolean };
    _kokoroAvailable = data.available === true;
  } catch {
    _kokoroAvailable = false;
  }
  _kokoroCheckedAt = Date.now();
  return _kokoroAvailable;
}

// Speak text — uses Kokoro TTS if available, falls back to Web Speech Synthesis
export async function speakText(text: string, voice = DEFAULT_VOICE): Promise<void> {
  const kokoroOk = await isKokoroAvailable();

  if (kokoroOk) {
    await speakKokoro(text, voice);
  } else {
    await speakBrowser(text);
  }
}

async function speakKokoro(text: string, voice: string): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const res = await fetch(`${SERVER}/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: 1.0 }),
      });
      if (!res.ok) { await speakBrowser(text); resolve(); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakBrowser(text).then(resolve); };
      audio.play().catch(() => speakBrowser(text).then(resolve));
    } catch {
      await speakBrowser(text);
      resolve();
    }
  });
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-IN';
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  });
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}
