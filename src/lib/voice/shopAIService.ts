// [all apps] [all tenants] — Voice AI service: Dolphin 3.0 via Ollama on Mac server
// STT: MediaRecorder + Whisper (faster-whisper tiny)
// TTS: Kokoro TTS (kokoro-onnx) → falls back to Web Speech Synthesis
// LLM: Dolphin 3.0 (unrestricted) on your Mac via update.frontstores.com/ai/chat

import { executeTool, getToolsDescription } from './aiTools';

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

// Send messages to Dolphin 3.0 on your Mac, get raw text response
async function callLLM(tenantId: string, messages: AIMessage[], signal?: AbortSignal): Promise<string> {
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

// Extract the JSON blob from a tool call — handles closed AND unclosed </TOOL> tags
function extractToolJSON(response: string): string | null {
  // Try closed tag first
  let m = /<TOOL>([\s\S]*?)<\/TOOL>/.exec(response);
  // Fall back to unclosed tag — take everything after <TOOL>
  if (!m) m = /<TOOL>([\s\S]*)/.exec(response);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw.startsWith('{')) return null;
  // Walk to find the first complete JSON object
  let open = 0, end = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') open++;
    else if (raw[i] === '}') { open--; if (open === 0) { end = i; break; } }
  }
  return end >= 0 ? raw.substring(0, end + 1) : null;
}

function stripToolTags(text: string): string {
  // Remove everything from <TOOL> onwards (including any text before it that's just preamble)
  return text
    .replace(/<TOOL>[\s\S]*/g, '')  // remove from <TOOL> to end
    .replace(/\s*$/, '')
    .trim();
}

// Agentic loop: call LLM → execute any tool calls → feed results back → repeat
export async function sendToAI(
  tenantId: string,
  messages: AIMessage[],
  signal?: AbortSignal
): Promise<string> {
  const history = [...messages];
  const MAX_ITERATIONS = 6;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callLLM(tenantId, history, signal);

    const jsonStr = extractToolJSON(response);
    if (!jsonStr) {
      return stripToolTags(response);
    }

    let toolCall: { name: string; args: Record<string, unknown> };
    try {
      toolCall = JSON.parse(jsonStr);
    } catch {
      return stripToolTags(response);
    }

    const result = await executeTool(tenantId, toolCall.name, toolCall.args || {});

    history.push({ role: 'assistant', content: response });
    history.push({
      role: 'system',
      content: `Tool "${toolCall.name}" result: ${JSON.stringify(result.data ?? result.error ?? result)}`,
    });
  }

  return await callLLM(tenantId, history, signal);
}

// Build the system prompt — injected with shop info, tool list, and persistent memories
// [all apps] [all tenants]
export function buildSystemPrompt(
  shopName: string,
  shopType: string,
  memories: { key: string; value: string }[]
): string {
  const memoryBlock = memories.length > 0
    ? `\n\nYaad karo — yeh facts aur aliases already store hain:\n${memories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`
    : '';

  return `You are an AI agent inside ${shopName}'s shop management app. You ACT — you call tools, navigate pages, ask one question at a time. You NEVER explain concepts or describe how things work.

ABSOLUTE RULES:
1. NEVER give explanations, steps, or instructions. The user wants you to DO it, not describe it.
2. Ask ONE question per message. Never two.
3. Always navigate_to_page FIRST before any action so the user sees it on screen.
4. Use tools for all real data. Never invent numbers.
5. Respond in Hindi/Hinglish/English matching the user. Short spoken sentences only.

TOOL CALL FORMAT (exact):
<TOOL>{"name":"tool_name","args":{...}}</TOOL>

TOOLS AVAILABLE:
${getToolsDescription()}

BILLING: navigate pos → search product → ask qty → ask customer (default Walk-in) → ask payment (default cash) → prepare_bill_in_pos → confirm → create_bill
ADD PRODUCT: navigate products → ask name → ask MRP → ask selling price → ask opening stock → add_product
STOCK: navigate inventory → ask product → search → ask qty → adjust_stock
KHATA: navigate khata → ask customer → search → ask amount → ask credit/debit → add_khata_entry
DATA QUESTIONS: call the right tool first, then answer from the result.
NAME ALIASES: recall_name first, remember_name to save new ones.
DATES: aaj=today, kal=yesterday, is mahine=this month, pichle mahine=last month.${memoryBlock}`;
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

let _currentAudio: HTMLAudioElement | null = null;
let _resolveCurrentSpeech: (() => void) | null = null;

async function speakKokoro(text: string, voice: string): Promise<void> {
  return new Promise(async (resolve) => {
    _resolveCurrentSpeech = resolve;
    try {
      const res = await fetch(`${SERVER}/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: 1.0 }),
      });
      if (!res.ok) { await speakBrowser(text); _resolveCurrentSpeech = null; resolve(); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.onended = () => { _currentAudio = null; _resolveCurrentSpeech = null; URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { _currentAudio = null; _resolveCurrentSpeech = null; URL.revokeObjectURL(url); speakBrowser(text).then(resolve); };
      audio.play().catch(() => { _currentAudio = null; _resolveCurrentSpeech = null; speakBrowser(text).then(resolve); });
    } catch {
      _currentAudio = null;
      _resolveCurrentSpeech = null;
      await speakBrowser(text);
      resolve();
    }
  });
}

let _resolveBrowserSpeech: (() => void) | null = null;

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    _resolveBrowserSpeech = resolve;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-IN';
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.onend = () => { _resolveBrowserSpeech = null; resolve(); };
    utt.onerror = () => { _resolveBrowserSpeech = null; resolve(); };
    window.speechSynthesis.speak(utt);
  });
}

export function stopSpeaking() {
  // Stop Kokoro audio and unblock its promise
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
  if (_resolveCurrentSpeech) {
    _resolveCurrentSpeech();
    _resolveCurrentSpeech = null;
  }
  // Stop browser TTS and unblock its promise
  // Note: cancel() does NOT fire onend/onerror, so we must resolve manually first
  if (_resolveBrowserSpeech) {
    _resolveBrowserSpeech();
    _resolveBrowserSpeech = null;
  }
  window.speechSynthesis.cancel();
}
