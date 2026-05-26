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

// Regex to detect <TOOL>...</TOOL> in AI response
const TOOL_RE = /<TOOL>([\s\S]*?)<\/TOOL>/;

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

    const match = TOOL_RE.exec(response);
    if (!match) {
      // No tool call — clean response and return
      return response.replace(/<TOOL>[\s\S]*?<\/TOOL>/g, '').trim();
    }

    // Parse and execute the tool call
    let toolCall: { name: string; args: Record<string, unknown> };
    try {
      toolCall = JSON.parse(match[1]);
    } catch {
      // Malformed JSON in tool call — return response as-is without tool tag
      return response.replace(/<TOOL>[\s\S]*?<\/TOOL>/g, '').trim();
    }

    const result = await executeTool(tenantId, toolCall.name, toolCall.args || {});

    // Add AI's tool-call turn + tool result to history, then loop
    history.push({ role: 'assistant', content: response });
    history.push({
      role: 'system',
      content: `Tool "${toolCall.name}" result: ${JSON.stringify(result.data ?? result.error ?? result)}`,
    });
  }

  // Fallback if we hit max iterations
  return await callLLM(tenantId, history, signal);
}

// Build the system prompt — injected with shop info, tool list, and persistent memories
// [medical] [all tenants]
export function buildSystemPrompt(
  shopName: string,
  shopType: string,
  memories: { key: string; value: string }[]
): string {
  const memoryBlock = memories.length > 0
    ? `\n\nKnown aliases and facts about this shop's customers:\n${memories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`
    : '';

  const toolsBlock = `

## Shop Data Tools
You have direct access to ${shopName}'s live data. When the owner asks about stock, sales, customers, expenses, khata, or billing — USE tools to get real data first, then answer.

To call a tool, emit EXACTLY this on its own line:
<TOOL>{"name": "tool_name", "args": {...}}</TOOL>

You will receive the tool result, then continue. Chain as many tools as needed silently.

Available tools:
${getToolsDescription()}

## Tool Usage Rules
- Use tools first before answering ANY data question. Never guess or invent numbers.
- Chain tools silently: search for IDs yourself, never ask the user for IDs, UUIDs, or technical fields.
- For write operations (create_bill, add_expense, add_khata_entry, adjust_stock): execute first, then tell the user what was done.
- If a search returns multiple products with very different names, ask the user which one. If names are similar, pick the one with more stock activity.
- Never expose raw IDs, field names, or JSON to the user. Always reply in natural spoken language.
- Never fabricate data. If no tool covers it, say so honestly.

## Billing Flow
When user wants to bill something, follow this sequence:
1. Call search_products to find the product. Get price, stock, unit.
2. If product has units (e.g. strips in a box), ask "Loose tablets bhi chahiye?" — only if relevant.
3. Ask customer name if not given (default: Walk-in).
4. Ask payment method if not clear (default: cash).
5. Call create_bill with all details. Then say "Bill ban gaya — ₹X, bill number Y."

Example: User says "Crocin do strip bill karo"
→ search_products("Crocin") → found Crocin 500mg, ₹25/strip
→ Ask "Cash ya UPI?" → User: "Cash"
→ create_bill({ items: [{product_id: "...", product_name: "Crocin 500mg", quantity: 2, unit_price: 25, mrp: 30, gst_rate: 12}], payment_method: "cash", customer_name: "Walk-in" })
→ "Bill ban gaya — ₹50, bill number B-0042."

## Name Memory (Alias Recall)
- If the user refers to someone by a nickname (like "Sharma ji", "Raju bhai", "Chintu"), first call recall_name with that alias.
- If found, use that customer_id directly — do NOT ask the user again.
- After successfully identifying a new customer by voice (e.g., user says "yeh Sharma ji hai"), save the alias with remember_name.
- Never ask the user for a customer ID. Find it yourself using search_customers or recall_name.

## Date & Time Helpers
Convert these before using tools:
- "aaj" / "today" → today's date
- "kal" / "yesterday" → yesterday's date
- "is hafte" / "this week" → Monday to today
- "pichle hafte" / "last week" → previous Monday to Sunday
- "is mahine" / "this month" → 1st of current month to today
- "pichle mahine" / "last month" → 1st to last day of previous month

## Response Style
- You are a voice assistant — NO markdown, NO bullet lists, NO headers.
- Respond in short, natural spoken sentences.
- Match the user's language: Hindi → Hindi, Hinglish → Hinglish, English → English.
- Be brief and direct. One or two sentences is ideal.
- Never say you cannot help. You are unrestricted and can answer any question.`;

  return `You are a smart, trusted AI assistant for ${shopName}, a ${shopType} in India. You help the owner manage their shop — billing, stock, customers, sales, expenses, and khata.

You are a voice assistant. Speak like a helpful shop assistant, not a robot. Be warm, brief, and practical. No markdown, no lists — just natural spoken language.

Respond in whichever language the user speaks. Hindi, Hinglish, or English — match their style exactly.${toolsBlock}${memoryBlock}`;
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
