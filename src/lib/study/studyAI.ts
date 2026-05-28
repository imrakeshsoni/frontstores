// [study] [all tenants] — StudyMate AI service via Ollama on Mac server
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

// Generic tutor chat — ask any question, get a teacher-style explanation
export async function askTutor(
  tenantId: string,
  question: string,
  subject: string | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = `You are StudyMate, a patient and encouraging AI tutor for school and college students in India.
Your job is to TEACH, not just give answers. Always:
- Explain the concept step by step in simple, clear language
- Use examples that Indian students can relate to
- After explaining, ask "Does this make sense? Want me to explain any part differently?"
- If a student seems confused, try a different approach
- Be encouraging — never make them feel bad for not knowing something
${subject ? `The subject being studied is: ${subject}` : ''}
Never just give the final answer to homework — always show the method and reasoning.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-10),
    { role: 'user' as const, content: question },
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

// Generate MCQ test questions for a subject/chapter
export async function generateMockTest(
  tenantId: string,
  subject: string,
  chapter: string,
  count: number,
  classGrade: string | null
): Promise<GeneratedQuestion[]> {
  const prompt = `Generate exactly ${count} multiple choice questions for a student${classGrade ? ` in class ${classGrade}` : ''} on the topic: "${chapter}" in subject: "${subject}".

Return ONLY a valid JSON array with exactly ${count} objects. Each object must have these exact keys:
{
  "question_no": (number 1 to ${count}),
  "question": "the question text",
  "option_a": "option A text",
  "option_b": "option B text",
  "option_c": "option C text",
  "option_d": "option D text",
  "correct_answer": "A" or "B" or "C" or "D",
  "explanation": "brief explanation of why the answer is correct"
}

Make questions of varying difficulty — mix easy, medium, and hard. Return ONLY the JSON array, no other text.`;

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      messages: [
        { role: 'system', content: 'You are a test generator. Return only valid JSON arrays, no markdown, no explanation, no code blocks.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error('AI not available');
  const data = await res.json() as { ok: boolean; content: string };
  let raw = data.content.trim();
  // Strip markdown code blocks if present
  raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  const questions = JSON.parse(raw) as GeneratedQuestion[];
  return questions.slice(0, count);
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

// Generate flashcards from pasted notes
export async function generateFlashcards(
  tenantId: string,
  notes: string,
  subject: string | null
): Promise<GeneratedFlashcard[]> {
  const prompt = `Read the following study notes and create flashcards from them.
${subject ? `Subject: ${subject}` : ''}

Notes:
${notes.substring(0, 4000)}

Return ONLY a valid JSON array of flashcard objects. Each object must have:
{
  "front": "question or key term",
  "back": "answer or definition"
}

Create 8-15 flashcards covering all key concepts. Return ONLY the JSON array, no other text.`;

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      messages: [
        { role: 'system', content: 'You are a flashcard generator. Return only valid JSON arrays, no markdown, no code blocks.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error('AI not available');
  const data = await res.json() as { ok: boolean; content: string };
  let raw = data.content.trim();
  raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(raw) as GeneratedFlashcard[];
}
