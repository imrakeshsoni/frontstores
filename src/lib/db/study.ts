// [study] [all tenants]
import { getDb, uuid, now } from './index';

export interface StudyConfig {
  id: string;
  tenant_id: string;
  student_name: string | null;
  class_grade: string | null;
  school: string | null;
  subjects: string | null;
  parent_pin: string | null;
  ai_name: string | null;
  ai_avatar: string | null;
}

export interface StudyConversation {
  id: string;
  tenant_id: string;
  title: string;
  subject: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudyMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface StudyMockTest {
  id: string;
  tenant_id: string;
  subject: string;
  chapter: string | null;
  total_questions: number;
  score: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface StudyMockQuestion {
  id: string;
  test_id: string;
  question_no: number;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  user_answer: string | null;
  explanation: string | null;
}

export interface StudyFlashcardDeck {
  id: string;
  tenant_id: string;
  name: string;
  subject: string | null;
  card_count: number;
  created_at: string;
}

export interface StudyFlashcard {
  id: string;
  deck_id: string;
  tenant_id: string;
  front: string;
  back: string;
  times_reviewed: number;
  times_correct: number;
  last_reviewed: string | null;
}

export interface StudySession {
  id: string;
  tenant_id: string;
  session_date: string;
  subject: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getStudyConfig(tenantId: string): Promise<StudyConfig | null> {
  const db = await getDb();
  const rows = await db.select<StudyConfig[]>(`SELECT * FROM study_config WHERE tenant_id = ?`, [tenantId]);
  return rows[0] ?? null;
}

export async function saveStudyConfig(tenantId: string, data: Partial<StudyConfig>): Promise<void> {
  const db = await getDb();
  const existing = await getStudyConfig(tenantId);
  if (existing) {
    await db.execute(
      `UPDATE study_config SET student_name=?, class_grade=?, school=?, subjects=?, parent_pin=?, ai_name=?, ai_avatar=?, updated_at=? WHERE tenant_id=?`,
      [data.student_name ?? existing.student_name, data.class_grade ?? existing.class_grade,
       data.school ?? existing.school, data.subjects ?? existing.subjects,
       data.parent_pin !== undefined ? data.parent_pin : existing.parent_pin,
       data.ai_name !== undefined ? data.ai_name : existing.ai_name,
       data.ai_avatar !== undefined ? data.ai_avatar : existing.ai_avatar,
       now(), tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO study_config (id, tenant_id, student_name, class_grade, school, subjects, parent_pin, ai_name, ai_avatar, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.student_name, data.class_grade, data.school, data.subjects, data.parent_pin, data.ai_name ?? null, data.ai_avatar ?? null, now(), now()]
    );
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function listConversations(tenantId: string): Promise<StudyConversation[]> {
  const db = await getDb();
  return db.select<StudyConversation[]>(
    `SELECT * FROM study_conversations WHERE tenant_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [tenantId]
  );
}

export async function createConversation(tenantId: string, title: string, subject: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_conversations (id, tenant_id, title, subject, message_count, created_at, updated_at) VALUES (?,?,?,?,0,?,?)`,
    [id, tenantId, title, subject, now(), now()]
  );
  return id;
}

export async function getMessages(conversationId: string): Promise<StudyMessage[]> {
  const db = await getDb();
  return db.select<StudyMessage[]>(
    `SELECT * FROM study_messages WHERE conversation_id=? ORDER BY created_at ASC`,
    [conversationId]
  );
}

export async function saveMessage(tenantId: string, conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO study_messages (id, tenant_id, conversation_id, role, content, created_at) VALUES (?,?,?,?,?,?)`,
    [uuid(), tenantId, conversationId, role, content, now()]
  );
  await db.execute(
    `UPDATE study_conversations SET message_count = message_count + 1, updated_at=? WHERE id=?`,
    [now(), conversationId]
  );
}

export async function deleteConversation(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_conversations SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Mock Tests ────────────────────────────────────────────────────────────────

export async function listMockTests(tenantId: string): Promise<StudyMockTest[]> {
  const db = await getDb();
  return db.select<StudyMockTest[]>(
    `SELECT * FROM study_mock_tests WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function createMockTest(tenantId: string, subject: string, chapter: string | null, questions: Omit<StudyMockQuestion, 'id' | 'test_id' | 'user_answer'>[]): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_mock_tests (id, tenant_id, subject, chapter, total_questions, status, created_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, subject, chapter, questions.length, 'pending', now()]
  );
  for (const q of questions) {
    await db.execute(
      `INSERT INTO study_mock_questions (id, tenant_id, test_id, question_no, question, option_a, option_b, option_c, option_d, correct_answer, explanation, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, q.question_no, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, now()]
    );
  }
  return id;
}

export async function getTestWithQuestions(testId: string): Promise<{ test: StudyMockTest; questions: StudyMockQuestion[] } | null> {
  const db = await getDb();
  const tests = await db.select<StudyMockTest[]>(`SELECT * FROM study_mock_tests WHERE id=?`, [testId]);
  if (!tests.length) return null;
  const questions = await db.select<StudyMockQuestion[]>(
    `SELECT * FROM study_mock_questions WHERE test_id=? ORDER BY question_no`, [testId]
  );
  return { test: tests[0], questions };
}

export async function submitTestAnswer(questionId: string, answer: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_mock_questions SET user_answer=? WHERE id=?`, [answer, questionId]);
}

export async function completeTest(tenantId: string, testId: string, score: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE study_mock_tests SET status='completed', score=?, completed_at=? WHERE id=? AND tenant_id=?`,
    [score, now(), testId, tenantId]
  );
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export async function listDecks(tenantId: string): Promise<StudyFlashcardDeck[]> {
  const db = await getDb();
  return db.select<StudyFlashcardDeck[]>(
    `SELECT * FROM study_flashcard_decks WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function createDeck(tenantId: string, name: string, subject: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_flashcard_decks (id, tenant_id, name, subject, card_count, created_at, updated_at) VALUES (?,?,?,?,0,?,?)`,
    [id, tenantId, name, subject, now(), now()]
  );
  return id;
}

export async function deleteDeck(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_flashcard_decks SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function getCards(tenantId: string, deckId: string): Promise<StudyFlashcard[]> {
  const db = await getDb();
  return db.select<StudyFlashcard[]>(
    `SELECT * FROM study_flashcards WHERE deck_id=? AND tenant_id=? AND deleted_at IS NULL ORDER BY created_at`,
    [deckId, tenantId]
  );
}

export async function addCard(tenantId: string, deckId: string, front: string, back: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO study_flashcards (id, tenant_id, deck_id, front, back, times_reviewed, times_correct, created_at) VALUES (?,?,?,?,?,0,0,?)`,
    [uuid(), tenantId, deckId, front, back, now()]
  );
  await db.execute(`UPDATE study_flashcard_decks SET card_count = card_count + 1, updated_at=? WHERE id=?`, [now(), deckId]);
}

export async function addCards(tenantId: string, deckId: string, cards: { front: string; back: string }[]): Promise<void> {
  for (const c of cards) await addCard(tenantId, deckId, c.front, c.back);
}

export async function recordCardReview(cardId: string, correct: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE study_flashcards SET times_reviewed = times_reviewed + 1, times_correct = times_correct + ?, last_reviewed=? WHERE id=?`,
    [correct ? 1 : 0, now(), cardId]
  );
}

export async function deleteCard(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_flashcards SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
  const rows = await db.select<{ deck_id: string }[]>(`SELECT deck_id FROM study_flashcards WHERE id=?`, [id]);
  if (rows[0]) await db.execute(`UPDATE study_flashcard_decks SET card_count = MAX(0, card_count - 1), updated_at=? WHERE id=?`, [now(), rows[0].deck_id]);
}

// ── Study Sessions ────────────────────────────────────────────────────────────

export async function logSession(tenantId: string, subject: string, duration_minutes: number, notes: string | null): Promise<void> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    `INSERT INTO study_sessions (id, tenant_id, session_date, subject, duration_minutes, notes, created_at) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, today, subject, duration_minutes, notes, now()]
  );
}

export async function getSessionsByDate(tenantId: string, from: string, to: string): Promise<StudySession[]> {
  const db = await getDb();
  return db.select<StudySession[]>(
    `SELECT * FROM study_sessions WHERE tenant_id=? AND session_date BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId, from, to]
  );
}

export async function getStreak(tenantId: string): Promise<{ current: number; longest: number; totalDays: number }> {
  const db = await getDb();
  const rows = await db.select<{ d: string }[]>(
    `SELECT DISTINCT session_date as d FROM study_sessions WHERE tenant_id=? AND deleted_at IS NULL ORDER BY session_date DESC`,
    [tenantId]
  );
  if (!rows.length) return { current: 0, longest: 0, totalDays: 0 };
  const totalDays = rows.length;
  const dates = rows.map(r => r.d);
  let current = 0;
  let d = new Date(); d.setHours(0, 0, 0, 0);
  for (const date of dates) {
    const ds = d.toISOString().slice(0, 10);
    if (date === ds) { current++; d.setDate(d.getDate() - 1); }
    else if (current === 0 && date === new Date(d.getTime() - 86400000).toISOString().slice(0, 10)) { current++; d.setDate(d.getDate() - 2); }
    else break;
  }
  let longest = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]); const curr = new Date(dates[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) { run++; if (run > longest) longest = run; } else run = 1;
  }
  return { current, longest, totalDays };
}

export async function getTodayStudyTime(tenantId: string): Promise<number> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<{ total: number }[]>(
    `SELECT SUM(duration_minutes) as total FROM study_sessions WHERE tenant_id=? AND session_date=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  return rows[0]?.total ?? 0;
}

export async function getWeeklySubjectBreakdown(tenantId: string): Promise<{ subject: string; minutes: number }[]> {
  const db = await getDb();
  const from = new Date(); from.setDate(from.getDate() - 6);
  const rows = await db.select<{ subject: string; minutes: number }[]>(
    `SELECT subject, SUM(duration_minutes) as minutes FROM study_sessions WHERE tenant_id=? AND session_date >= ? AND deleted_at IS NULL GROUP BY subject ORDER BY minutes DESC`,
    [tenantId, from.toISOString().slice(0, 10)]
  );
  return rows;
}

export async function getTestStats(tenantId: string): Promise<{ total: number; avg_score: number; completed: number }> {
  const db = await getDb();
  const rows = await db.select<{ total: number; avg_score: number; completed: number }[]>(
    `SELECT COUNT(*) as total, AVG(CASE WHEN score IS NOT NULL THEN score * 100.0 / total_questions END) as avg_score, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed FROM study_mock_tests WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  return rows[0] ?? { total: 0, avg_score: 0, completed: 0 };
}
