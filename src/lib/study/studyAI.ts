// [study] [all tenants] — StudyMate AI service via gemma3:4b on Mac server
const SERVER = 'https://update.frontstores.com';

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

export interface WebSearchResult {
  source: string;
  text: string;
}

// Search the web for latest info on a topic
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  try {
    const res = await fetch(`${SERVER}/ai/study/websearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { ok: boolean; results: WebSearchResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// Ask the AI tutor — friendly, no markdown, uses resource context + web results
export async function askTutor(
  tenantId: string,
  question: string,
  subject: string | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  options?: {
    resourceContext?: string;
    webResults?: WebSearchResult[];
    imageBase64?: string | null;
    signal?: AbortSignal;
  }
): Promise<string> {
  const { resourceContext, webResults, imageBase64, signal } = options ?? {};

  let contextSection = '';
  if (resourceContext) {
    contextSection += `\n\nHere are the student's own study notes and resources — use these as reference:\n${resourceContext}`;
  }
  if (webResults && webResults.length > 0) {
    contextSection += `\n\nLatest info from the web (use this for current or recent topics):\n` +
      webResults.map((r, i) => `[${i + 1}] ${r.text}`).join('\n');
  }

  const systemPrompt = `You are StudyMate, a friendly AI study buddy for school and college students in India.

How to talk:
- Talk like a smart friend, not a textbook. Keep it warm, simple, and encouraging.
- Never use asterisks (*) or markdown formatting. No bullet points with * or -. No bold with **. Just plain conversational sentences.
- If you need to list things, use numbers like "First... Second... Third..." or just say them in a sentence.
- Explain step by step, but in a conversational way — like you're sitting next to the student and explaining it.
- After explaining, ask "Does that make sense? Want me to go deeper on any part?"
- Never just give the final answer to homework — always explain the why and how.
- Be encouraging. Never make them feel bad for not knowing something.
- If web results are provided, use them to give the most current and accurate information.
- If the student's own notes are provided, reference them and validate or gently correct if something seems off.
${subject ? `The subject is: ${subject}` : ''}${contextSection}`;

  const userMessage: { role: 'user'; content: string; images?: string[] } = {
    role: 'user',
    content: question,
  };
  if (imageBase64) {
    // Strip data URL prefix for Ollama
    const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    (userMessage as any).images = [b64];
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
    userMessage,
  ];

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, messages, model: 'gemma3:4b' }),
    signal,
  });
  if (!res.ok) throw new Error('AI not available. Check your internet connection.');
  const data = await res.json() as { ok: boolean; content: string };
  return data.content;
}

export interface GeneratedQuestion {
  question_no: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
}

export async function generateMockTest(
  tenantId: string,
  subject: string,
  chapter: string,
  count: number,
  classGrade: string | null
): Promise<GeneratedQuestion[]> {
  const prompt = `Generate exactly ${count} multiple choice questions for a student${classGrade ? ` in class ${classGrade}` : ''} on the topic: "${chapter}" in subject: "${subject}".
Return ONLY a valid JSON array with exactly ${count} objects. Each object must have these exact keys:
{"question_no":(number 1 to ${count}),"question":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A" or "B" or "C" or "D","explanation":"..."}
Mix easy, medium, and hard questions. Return ONLY the JSON array, no other text.`;

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId, model: 'gemma3:4b',
      messages: [
        { role: 'system', content: 'You are a test generator. Return only valid JSON arrays, no markdown, no code blocks.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error('AI not available');
  const data = await res.json() as { ok: boolean; content: string };
  let raw = data.content.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return (JSON.parse(raw) as GeneratedQuestion[]).slice(0, count);
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export async function generateFlashcards(
  tenantId: string,
  notes: string,
  subject: string | null
): Promise<GeneratedFlashcard[]> {
  const prompt = `Read the following study notes and create flashcards from them.
${subject ? `Subject: ${subject}` : ''}
Notes:\n${notes.substring(0, 4000)}
Return ONLY a valid JSON array of flashcard objects. Each object must have:
{"front":"question or key term","back":"answer or definition"}
Create 8-15 flashcards. Return ONLY the JSON array, no other text.`;

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId, model: 'gemma3:4b',
      messages: [
        { role: 'system', content: 'You are a flashcard generator. Return only valid JSON arrays, no markdown, no code blocks.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error('AI not available');
  const data = await res.json() as { ok: boolean; content: string };
  let raw = data.content.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(raw) as GeneratedFlashcard[];
}
