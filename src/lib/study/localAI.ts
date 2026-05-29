// [study] [all tenants] — local Ollama detection, model pull, system check
import { invoke } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

const OLLAMA_BASE = 'http://localhost:11434';

export interface SystemInfo {
  total_ram_gb: number;
  available_ram_gb: number;
  free_disk_gb: number;
  os_name: string;
  cpu_count: number;
}

export interface ModelRecommendation {
  model: string;
  label: string;
  sizeGb: number;
  quality: string;
  minRamGb: number;
  minDiskGb: number;
}

export const MODEL_OPTIONS: ModelRecommendation[] = [
  { model: 'gemma3:1b', label: 'Gemma 3 (1B) — Fast', sizeGb: 0.8,  quality: 'Good',      minRamGb: 4,  minDiskGb: 2  },
  { model: 'gemma3:4b', label: 'Gemma 3 (4B) — Better', sizeGb: 2.7, quality: 'Very Good', minRamGb: 8,  minDiskGb: 4  },
  { model: 'gemma3:12b',label: 'Gemma 3 (12B) — Best',  sizeGb: 8.1, quality: 'Excellent', minRamGb: 16, minDiskGb: 10 },
];

export function recommendModel(ramGb: number, diskGb: number): ModelRecommendation {
  if (ramGb >= 16 && diskGb >= 10) return MODEL_OPTIONS[2];
  if (ramGb >= 8  && diskGb >= 4)  return MODEL_OPTIONS[1];
  return MODEL_OPTIONS[0];
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>('get_system_info');
}

export async function checkLocalOllama(): Promise<{ available: boolean; model: string | null }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { available: false, model: null };
    const data = await res.json() as { models: { name: string }[] };
    const supported = (data.models ?? []).find(m =>
      m.name.startsWith('gemma3') || m.name.startsWith('dolphin3')
    );
    return { available: !!supported, model: supported?.name ?? null };
  } catch {
    return { available: false, model: null };
  }
}

export async function openOllamaDownloadPage(): Promise<void> {
  await shellOpen('https://ollama.com/download');
}

export interface PullProgress {
  status: string;
  percent: number;
  done: boolean;
}

export async function pullModel(
  model: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
    signal,
  });
  if (!res.ok) throw new Error('Failed to start model download');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as { status: string; total?: number; completed?: number };
        const percent = chunk.total && chunk.completed
          ? Math.round((chunk.completed / chunk.total) * 100)
          : 0;
        const isDone = chunk.status === 'success';
        onProgress({ status: chunk.status, percent, done: isDone });
        if (isDone) return;
      } catch {}
    }
  }
}

// Call Ollama directly (bypass the server) — used when local AI is installed
export async function askLocalOllama(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature: 0.3, num_predict: 2048 },
    }),
    signal,
  });
  if (!res.ok) throw new Error('Local AI not available');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as { message?: { content: string }; done: boolean };
        if (chunk.message?.content) { full += chunk.message.content; onChunk(chunk.message.content); }
        if (chunk.done) return full;
      } catch {}
    }
  }
  return full;
}
