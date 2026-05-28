// [study] [all tenants]
import { getDb, uuid, now } from './index';

// ── New feature types ─────────────────────────────────────────────────────────

export interface StudyTimetableSlot {
  id: string;
  tenant_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  label: string | null;
  color: string | null;
}

export interface StudyExam {
  id: string;
  tenant_id: string;
  subject: string;
  exam_name: string;
  exam_date: string;
  notes: string | null;
  created_at: string;
}

export interface StudyAssignment {
  id: string;
  tenant_id: string;
  subject: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'done';
  notes: string | null;
  created_at: string;
}

export interface StudyGoal {
  id: string;
  tenant_id: string;
  title: string;
  subject: string | null;
  target_minutes: number;
  period: 'weekly' | 'monthly';
  week_start: string | null;
  month: string | null;
  created_at: string;
}

export interface StudyFormulaEntry {
  id: string;
  tenant_id: string;
  subject: string;
  title: string;
  content: string;
  tags: string | null;
  created_at: string;
}

export interface StudyMindmap {
  id: string;
  tenant_id: string;
  title: string;
  subject: string | null;
  tree_json: string;
  created_at: string;
  updated_at: string;
}

export interface StudyPYQ {
  id: string;
  tenant_id: string;
  subject: string;
  exam_board: string | null;
  year: number;
  paper_name: string;
  resource_id: string | null;
  total_questions: number;
  done_questions: number;
  notes: string | null;
  created_at: string;
}

export interface StudyChapterChecklist {
  id: string;
  tenant_id: string;
  subject: string;
  chapter_name: string;
  status: 'not_started' | 'in_progress' | 'revised' | 'done';
  notes: string | null;
  created_at: string;
}

export interface StudyRevisionPlan {
  id: string;
  tenant_id: string;
  exam_id: string;
  plan_date: string;
  subject: string;
  chapter_or_topic: string;
  status: 'pending' | 'done';
}

export interface StudyDailyChallenge {
  id: string;
  tenant_id: string;
  challenge_date: string;
  question: string;
  correct_answer: string;
  user_answer: string | null;
  subject: string | null;
  answered_at: string | null;
}

export interface StudyBookmark {
  id: string;
  tenant_id: string;
  resource_id: string;
  highlighted_text: string;
  note: string | null;
  created_at: string;
}

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

export async function getWeakTopics(tenantId: string): Promise<{ subject: string; chapter: string; avg_score: number; attempts: number }[]> {
  const db = await getDb();
  return db.select<{ subject: string; chapter: string; avg_score: number; attempts: number }[]>(
    `SELECT subject, chapter, AVG(score * 100.0 / total_questions) as avg_score, COUNT(*) as attempts
     FROM study_mock_tests WHERE tenant_id=? AND status='completed' AND chapter IS NOT NULL AND deleted_at IS NULL
     GROUP BY subject, chapter ORDER BY avg_score ASC LIMIT 10`,
    [tenantId]
  );
}

// ── Spaced repetition (SM-2) ──────────────────────────────────────────────────

export async function updateCardSM2(cardId: string, quality: number): Promise<void> {
  // quality: 0-5 (0-2 = fail, 3-5 = pass)
  const db = await getDb();
  const rows = await db.select<{ ease_factor: number; interval_days: number }[]>(
    `SELECT ease_factor, interval_days FROM study_flashcards WHERE id=?`, [cardId]
  );
  if (!rows.length) return;
  let { ease_factor, interval_days } = rows[0];
  let nextInterval: number;
  if (quality < 3) {
    nextInterval = 1;
  } else {
    if (interval_days <= 1) nextInterval = 1;
    else if (interval_days === 1) nextInterval = 6;
    else nextInterval = Math.round(interval_days * ease_factor);
  }
  const newEF = Math.max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + nextInterval);
  await db.execute(
    `UPDATE study_flashcards SET ease_factor=?, interval_days=?, next_review=?, times_reviewed=times_reviewed+1, times_correct=times_correct+?, last_reviewed=? WHERE id=?`,
    [newEF, nextInterval, nextReview.toISOString().slice(0, 10), quality >= 3 ? 1 : 0, now(), cardId]
  );
}

export async function getDueCards(tenantId: string, deckId: string): Promise<StudyFlashcard[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select<StudyFlashcard[]>(
    `SELECT * FROM study_flashcards WHERE deck_id=? AND tenant_id=? AND deleted_at IS NULL
     AND (next_review IS NULL OR next_review <= ?)
     ORDER BY CASE WHEN next_review IS NULL THEN 0 ELSE 1 END, next_review`,
    [deckId, tenantId, today]
  );
}

// ── Timetable ─────────────────────────────────────────────────────────────────

export async function getTimetable(tenantId: string): Promise<StudyTimetableSlot[]> {
  const db = await getDb();
  return db.select<StudyTimetableSlot[]>(
    `SELECT * FROM study_timetable WHERE tenant_id=? AND deleted_at IS NULL ORDER BY day_of_week, start_time`,
    [tenantId]
  );
}

export async function addTimetableSlot(tenantId: string, slot: Omit<StudyTimetableSlot, 'id' | 'tenant_id'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_timetable (id, tenant_id, day_of_week, start_time, end_time, subject, label, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, slot.day_of_week, slot.start_time, slot.end_time, slot.subject, slot.label, slot.color, now(), now()]
  );
  return id;
}

export async function deleteTimetableSlot(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_timetable SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Exams ─────────────────────────────────────────────────────────────────────

export async function listExams(tenantId: string): Promise<StudyExam[]> {
  const db = await getDb();
  return db.select<StudyExam[]>(
    `SELECT * FROM study_exams WHERE tenant_id=? AND deleted_at IS NULL ORDER BY exam_date ASC`,
    [tenantId]
  );
}

export async function addExam(tenantId: string, subject: string, exam_name: string, exam_date: string, notes: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_exams (id, tenant_id, subject, exam_name, exam_date, notes, created_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, subject, exam_name, exam_date, notes, now()]
  );
  return id;
}

export async function deleteExam(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_exams SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function getUpcomingExams(tenantId: string, days: number = 30): Promise<StudyExam[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(); future.setDate(future.getDate() + days);
  return db.select<StudyExam[]>(
    `SELECT * FROM study_exams WHERE tenant_id=? AND deleted_at IS NULL AND exam_date >= ? AND exam_date <= ? ORDER BY exam_date`,
    [tenantId, today, future.toISOString().slice(0, 10)]
  );
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function listAssignments(tenantId: string): Promise<StudyAssignment[]> {
  const db = await getDb();
  return db.select<StudyAssignment[]>(
    `SELECT * FROM study_assignments WHERE tenant_id=? AND deleted_at IS NULL ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END, due_date ASC`,
    [tenantId]
  );
}

export async function addAssignment(tenantId: string, subject: string, title: string, due_date: string | null, notes: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_assignments (id, tenant_id, subject, title, due_date, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, subject, title, due_date, 'pending', notes, now(), now()]
  );
  return id;
}

export async function toggleAssignment(tenantId: string, id: string, status: 'pending' | 'done'): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_assignments SET status=?, updated_at=? WHERE id=? AND tenant_id=?`, [status, now(), id, tenantId]);
}

export async function deleteAssignment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_assignments SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function getDueAssignments(tenantId: string): Promise<StudyAssignment[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(); soon.setDate(soon.getDate() + 3);
  return db.select<StudyAssignment[]>(
    `SELECT * FROM study_assignments WHERE tenant_id=? AND status='pending' AND deleted_at IS NULL AND (due_date IS NULL OR due_date <= ?) ORDER BY due_date ASC LIMIT 5`,
    [tenantId, soon.toISOString().slice(0, 10)]
  );
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function listGoals(tenantId: string): Promise<StudyGoal[]> {
  const db = await getDb();
  return db.select<StudyGoal[]>(
    `SELECT * FROM study_goals WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function addGoal(tenantId: string, title: string, subject: string | null, target_minutes: number, period: 'weekly' | 'monthly'): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today); monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const week_start = period === 'weekly' ? monday.toISOString().slice(0, 10) : null;
  const month = period === 'monthly' ? today.toISOString().slice(0, 7) : null;
  await db.execute(
    `INSERT INTO study_goals (id, tenant_id, title, subject, target_minutes, period, week_start, month, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, title, subject, target_minutes, period, week_start, month, now(), now()]
  );
  return id;
}

export async function deleteGoal(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_goals SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function getGoalProgress(tenantId: string, goal: StudyGoal): Promise<number> {
  const db = await getDb();
  let from: string, to: string;
  if (goal.period === 'weekly' && goal.week_start) {
    from = goal.week_start;
    const end = new Date(goal.week_start); end.setDate(end.getDate() + 6);
    to = end.toISOString().slice(0, 10);
  } else if (goal.period === 'monthly' && goal.month) {
    from = goal.month + '-01';
    to = goal.month + '-31';
  } else return 0;
  const where = goal.subject ? `AND subject=?` : '';
  const params: (string | number)[] = goal.subject ? [tenantId, from, to, goal.subject] : [tenantId, from, to];
  const rows = await db.select<{ total: number }[]>(
    `SELECT SUM(duration_minutes) as total FROM study_sessions WHERE tenant_id=? AND session_date BETWEEN ? AND ? AND deleted_at IS NULL ${where}`,
    params
  );
  return rows[0]?.total ?? 0;
}

// ── Achievements ──────────────────────────────────────────────────────────────

export async function getEarnedBadges(tenantId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ badge_key: string }[]>(
    `SELECT badge_key FROM study_achievements WHERE tenant_id=? ORDER BY earned_at DESC`,
    [tenantId]
  );
  return rows.map(r => r.badge_key);
}

export async function awardBadge(tenantId: string, badge_key: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO study_achievements (id, tenant_id, badge_key, earned_at) VALUES (?,?,?,?)`,
    [uuid(), tenantId, badge_key, now()]
  );
}

export async function checkAndAwardBadges(tenantId: string): Promise<string[]> {
  const [streak, testStats, sessions, earned] = await Promise.all([
    getStreak(tenantId),
    getTestStats(tenantId),
    getSessionsByDate(tenantId, '2000-01-01', '2099-12-31'),
    getEarnedBadges(tenantId),
  ]);
  const newBadges: string[] = [];
  const award = async (key: string) => {
    if (!earned.includes(key)) { await awardBadge(tenantId, key); newBadges.push(key); }
  };
  if (streak.current >= 3)  await award('streak_3');
  if (streak.current >= 7)  await award('streak_7');
  if (streak.current >= 14) await award('streak_14');
  if (streak.current >= 30) await award('streak_30');
  if (testStats.completed >= 1)  await award('first_test');
  if (testStats.completed >= 10) await award('test_10');
  if (testStats.completed >= 50) await award('test_50');
  if (sessions.length >= 1)  await award('first_session');
  if (sessions.length >= 10) await award('session_10');
  if (sessions.length >= 50) await award('session_50');
  const totalMinutes = sessions.reduce((s, x) => s + x.duration_minutes, 0);
  if (totalMinutes >= 60)   await award('hour_1');
  if (totalMinutes >= 600)  await award('hour_10');
  if (totalMinutes >= 3000) await award('hour_50');
  return newBadges;
}

// ── Formula Bank ──────────────────────────────────────────────────────────────

export async function listFormulas(tenantId: string, subject?: string): Promise<StudyFormulaEntry[]> {
  const db = await getDb();
  if (subject) {
    return db.select<StudyFormulaEntry[]>(
      `SELECT * FROM study_formula_bank WHERE tenant_id=? AND subject=? AND deleted_at IS NULL ORDER BY subject, title`,
      [tenantId, subject]
    );
  }
  return db.select<StudyFormulaEntry[]>(
    `SELECT * FROM study_formula_bank WHERE tenant_id=? AND deleted_at IS NULL ORDER BY subject, title`,
    [tenantId]
  );
}

export async function addFormula(tenantId: string, subject: string, title: string, content: string, tags: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_formula_bank (id, tenant_id, subject, title, content, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, subject, title, content, tags, now(), now()]
  );
  return id;
}

export async function updateFormula(tenantId: string, id: string, title: string, content: string, tags: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_formula_bank SET title=?, content=?, tags=?, updated_at=? WHERE id=? AND tenant_id=?`, [title, content, tags, now(), id, tenantId]);
}

export async function deleteFormula(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_formula_bank SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Daily Challenge ───────────────────────────────────────────────────────────

export async function getTodayChallenge(tenantId: string): Promise<StudyDailyChallenge | null> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<StudyDailyChallenge[]>(
    `SELECT * FROM study_daily_challenge WHERE tenant_id=? AND challenge_date=?`,
    [tenantId, today]
  );
  return rows[0] ?? null;
}

export async function saveDailyChallenge(tenantId: string, question: string, correct_answer: string, subject: string | null): Promise<string> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const id = uuid();
  await db.execute(
    `INSERT OR IGNORE INTO study_daily_challenge (id, tenant_id, challenge_date, question, correct_answer, subject, created_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, today, question, correct_answer, subject, now()]
  );
  const rows = await db.select<{ id: string }[]>(`SELECT id FROM study_daily_challenge WHERE tenant_id=? AND challenge_date=?`, [tenantId, today]);
  return rows[0]?.id ?? id;
}

export async function answerDailyChallenge(tenantId: string, challengeId: string, answer: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_daily_challenge SET user_answer=?, answered_at=? WHERE id=? AND tenant_id=?`, [answer, now(), challengeId, tenantId]);
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function getBookmarks(tenantId: string, resourceId: string): Promise<StudyBookmark[]> {
  const db = await getDb();
  return db.select<StudyBookmark[]>(
    `SELECT * FROM study_bookmarks WHERE tenant_id=? AND resource_id=? AND deleted_at IS NULL ORDER BY created_at`,
    [tenantId, resourceId]
  );
}

export async function addBookmark(tenantId: string, resourceId: string, highlighted_text: string, note: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO study_bookmarks (id, tenant_id, resource_id, highlighted_text, note, created_at) VALUES (?,?,?,?,?,?)`,
    [id, tenantId, resourceId, highlighted_text, note, now()]
  );
  return id;
}

export async function deleteBookmark(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_bookmarks SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Mindmaps ──────────────────────────────────────────────────────────────────

export async function listMindmaps(tenantId: string): Promise<StudyMindmap[]> {
  const db = await getDb();
  return db.select<StudyMindmap[]>(`SELECT * FROM study_mindmaps WHERE tenant_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId]);
}

export async function getMindmap(tenantId: string, id: string): Promise<StudyMindmap | null> {
  const db = await getDb();
  const rows = await db.select<StudyMindmap[]>(`SELECT * FROM study_mindmaps WHERE id=? AND tenant_id=?`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function createMindmap(tenantId: string, title: string, subject: string | null): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const tree = JSON.stringify({ id: 'root', text: title, children: [] });
  await db.execute(`INSERT INTO study_mindmaps (id, tenant_id, title, subject, tree_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [id, tenantId, title, subject, tree, now(), now()]);
  return id;
}

export async function saveMindmapTree(tenantId: string, id: string, tree_json: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_mindmaps SET tree_json=?, title=?, updated_at=? WHERE id=? AND tenant_id=?`, [tree_json, title, now(), id, tenantId]);
}

export async function deleteMindmap(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_mindmaps SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── PYQ ───────────────────────────────────────────────────────────────────────

export async function listPYQ(tenantId: string): Promise<StudyPYQ[]> {
  const db = await getDb();
  return db.select<StudyPYQ[]>(`SELECT * FROM study_pyq WHERE tenant_id=? AND deleted_at IS NULL ORDER BY subject, year DESC`, [tenantId]);
}

export async function addPYQ(tenantId: string, data: Omit<StudyPYQ, 'id' | 'tenant_id' | 'created_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO study_pyq (id, tenant_id, subject, exam_board, year, paper_name, resource_id, total_questions, done_questions, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.subject, data.exam_board, data.year, data.paper_name, data.resource_id, data.total_questions, data.done_questions, data.notes, now(), now()]);
  return id;
}

export async function updatePYQProgress(tenantId: string, id: string, done_questions: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_pyq SET done_questions=?, updated_at=? WHERE id=? AND tenant_id=?`, [done_questions, now(), id, tenantId]);
}

export async function deletePYQ(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_pyq SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Chapter Checklist ─────────────────────────────────────────────────────────

export async function listChapters(tenantId: string, subject?: string): Promise<StudyChapterChecklist[]> {
  const db = await getDb();
  if (subject) return db.select<StudyChapterChecklist[]>(`SELECT * FROM study_chapter_checklist WHERE tenant_id=? AND subject=? AND deleted_at IS NULL ORDER BY created_at`, [tenantId, subject]);
  return db.select<StudyChapterChecklist[]>(`SELECT * FROM study_chapter_checklist WHERE tenant_id=? AND deleted_at IS NULL ORDER BY subject, created_at`, [tenantId]);
}

export async function addChapter(tenantId: string, subject: string, chapter_name: string): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO study_chapter_checklist (id, tenant_id, subject, chapter_name, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [id, tenantId, subject, chapter_name, 'not_started', now(), now()]);
  return id;
}

export async function updateChapterStatus(tenantId: string, id: string, status: StudyChapterChecklist['status']): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_chapter_checklist SET status=?, updated_at=? WHERE id=? AND tenant_id=?`, [status, now(), id, tenantId]);
}

export async function deleteChapter(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_chapter_checklist SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── XP / Level System ─────────────────────────────────────────────────────────

const XP_REWARDS: Record<string, number> = {
  session_logged: 10, test_completed: 25, flashcard_reviewed: 2,
  badge_earned: 50, streak_7: 100, goal_completed: 30, daily_challenge: 15,
};

export async function addXP(tenantId: string, action: string, override?: number): Promise<void> {
  const db = await getDb();
  const xp = override ?? XP_REWARDS[action] ?? 5;
  await db.execute(`INSERT INTO study_xp_log (id, tenant_id, action, xp, created_at) VALUES (?,?,?,?,?)`, [uuid(), tenantId, action, xp, now()]);
}

export async function getTotalXP(tenantId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number }[]>(`SELECT COALESCE(SUM(xp), 0) as total FROM study_xp_log WHERE tenant_id=?`, [tenantId]);
  return rows[0]?.total ?? 0;
}

export function xpToLevel(xp: number): { level: number; xpInLevel: number; xpNeeded: number; title: string } {
  const TITLES = ['Beginner', 'Learner', 'Student', 'Scholar', 'Achiever', 'Expert', 'Master', 'Champion', 'Legend', 'Genius'];
  const thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 99999];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1; else break;
  }
  level = Math.min(level, 10);
  const base = thresholds[level - 1];
  const next = thresholds[level] ?? 99999;
  return { level, xpInLevel: xp - base, xpNeeded: next - base, title: TITLES[level - 1] };
}

// ── Streak Freeze ─────────────────────────────────────────────────────────────

export async function getStreakFreeze(tenantId: string): Promise<{ tokens: number; total_earned: number; total_used: number }> {
  const db = await getDb();
  const rows = await db.select<{ tokens: number; total_earned: number; total_used: number }[]>(`SELECT tokens, total_earned, total_used FROM study_streak_freeze WHERE tenant_id=?`, [tenantId]);
  return rows[0] ?? { tokens: 0, total_earned: 0, total_used: 0 };
}

export async function awardFreezeToken(tenantId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`INSERT INTO study_streak_freeze (id, tenant_id, tokens, total_earned, total_used, updated_at) VALUES (?,?,1,1,0,?) ON CONFLICT(tenant_id) DO UPDATE SET tokens=tokens+1, total_earned=total_earned+1, updated_at=?`, [uuid(), tenantId, now(), now()]);
}

export async function useFreezeToken(tenantId: string): Promise<boolean> {
  const db = await getDb();
  const freeze = await getStreakFreeze(tenantId);
  if (freeze.tokens <= 0) return false;
  await db.execute(`UPDATE study_streak_freeze SET tokens=tokens-1, total_used=total_used+1, updated_at=? WHERE tenant_id=?`, [now(), tenantId]);
  return true;
}

// ── Dashboard prefs ───────────────────────────────────────────────────────────

export async function getDashboardPrefs(tenantId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ hidden_widgets: string }[]>(`SELECT hidden_widgets FROM study_dashboard_prefs WHERE tenant_id=?`, [tenantId]);
  try { return JSON.parse(rows[0]?.hidden_widgets ?? '[]'); } catch { return []; }
}

export async function setDashboardPrefs(tenantId: string, hidden_widgets: string[]): Promise<void> {
  const db = await getDb();
  await db.execute(`INSERT INTO study_dashboard_prefs (id, tenant_id, hidden_widgets, updated_at) VALUES (?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET hidden_widgets=?, updated_at=?`,
    [uuid(), tenantId, JSON.stringify(hidden_widgets), now(), JSON.stringify(hidden_widgets), now()]);
}

// ── Revision Plan ─────────────────────────────────────────────────────────────

export async function getRevisionPlan(tenantId: string, examId?: string): Promise<StudyRevisionPlan[]> {
  const db = await getDb();
  if (examId) return db.select<StudyRevisionPlan[]>(`SELECT * FROM study_revision_plan WHERE tenant_id=? AND exam_id=? AND deleted_at IS NULL ORDER BY plan_date`, [tenantId, examId]);
  return db.select<StudyRevisionPlan[]>(`SELECT * FROM study_revision_plan WHERE tenant_id=? AND deleted_at IS NULL ORDER BY plan_date`, [tenantId]);
}

export async function generateRevisionPlan(tenantId: string, examId: string, examDate: string, subject: string, chapters: string[]): Promise<void> {
  const db = await getDb();
  // delete old plan for this exam
  await db.execute(`UPDATE study_revision_plan SET deleted_at=? WHERE tenant_id=? AND exam_id=?`, [now(), tenantId, examId]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate); exam.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(1, Math.ceil((exam.getTime() - today.getTime()) / 86400000));
  const chapPerDay = Math.ceil(chapters.length / daysLeft);
  let dayOffset = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (i > 0 && i % chapPerDay === 0) dayOffset++;
    const d = new Date(today); d.setDate(d.getDate() + dayOffset);
    await db.execute(`INSERT INTO study_revision_plan (id, tenant_id, exam_id, plan_date, subject, chapter_or_topic, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, examId, d.toISOString().slice(0, 10), subject, chapters[i], 'pending', now(), now()]);
  }
}

export async function markRevisionDone(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_revision_plan SET status='done', updated_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

export async function getYearHeatmap(tenantId: string): Promise<{ date: string; minutes: number }[]> {
  const db = await getDb();
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  return db.select<{ date: string; minutes: number }[]>(
    `SELECT session_date as date, SUM(duration_minutes) as minutes FROM study_sessions WHERE tenant_id=? AND session_date >= ? AND deleted_at IS NULL GROUP BY session_date ORDER BY session_date`,
    [tenantId, from.toISOString().slice(0, 10)]
  );
}

export async function getSubjectHealthScores(tenantId: string): Promise<{ subject: string; time_score: number; test_score: number; flashcard_score: number; health: number }[]> {
  const db = await getDb();
  const sessions = await db.select<{ subject: string; minutes: number }[]>(
    `SELECT subject, SUM(duration_minutes) as minutes FROM study_sessions WHERE tenant_id=? AND deleted_at IS NULL GROUP BY subject`, [tenantId]);
  const tests = await db.select<{ subject: string; avg_score: number }[]>(
    `SELECT subject, AVG(score * 100.0 / total_questions) as avg_score FROM study_mock_tests WHERE tenant_id=? AND status='completed' AND deleted_at IS NULL GROUP BY subject`, [tenantId]);
  const decks = await db.select<{ subject: string; correct_rate: number }[]>(
    `SELECT d.subject, AVG(CASE WHEN f.times_reviewed > 0 THEN f.times_correct * 100.0 / f.times_reviewed ELSE 50 END) as correct_rate
     FROM study_flashcard_decks d JOIN study_flashcards f ON f.deck_id=d.id
     WHERE d.tenant_id=? AND d.deleted_at IS NULL AND f.deleted_at IS NULL AND d.subject IS NOT NULL GROUP BY d.subject`, [tenantId]);
  const subjects = [...new Set([...sessions.map(s => s.subject), ...tests.map(t => t.subject), ...decks.map(d => d.subject)])];
  const maxMin = Math.max(...sessions.map(s => s.minutes), 1);
  return subjects.map(sub => {
    const time_score = Math.min(100, Math.round(((sessions.find(s => s.subject === sub)?.minutes ?? 0) / maxMin) * 100));
    const test_score = Math.round(tests.find(t => t.subject === sub)?.avg_score ?? 50);
    const flashcard_score = Math.round(decks.find(d => d.subject === sub)?.correct_rate ?? 50);
    const health = Math.round((time_score + test_score + flashcard_score) / 3);
    return { subject: sub, time_score, test_score, flashcard_score, health };
  }).sort((a, b) => b.health - a.health);
}

export async function getMonthlyReport(tenantId: string, yearMonth: string): Promise<{
  total_minutes: number; sessions: number; tests_done: number; avg_test_score: number;
  streak_days: number; subjects: { subject: string; minutes: number }[];
}> {
  const db = await getDb();
  const from = yearMonth + '-01';
  const to = yearMonth + '-31';
  const sessions = await db.select<{ total: number; count: number }[]>(
    `SELECT SUM(duration_minutes) as total, COUNT(*) as count FROM study_sessions WHERE tenant_id=? AND session_date BETWEEN ? AND ? AND deleted_at IS NULL`, [tenantId, from, to]);
  const tests = await db.select<{ count: number; avg: number }[]>(
    `SELECT COUNT(*) as count, AVG(score * 100.0 / total_questions) as avg FROM study_mock_tests WHERE tenant_id=? AND completed_at BETWEEN ? AND ? AND status='completed' AND deleted_at IS NULL`, [tenantId, from + 'T00:00', to + 'T23:59']);
  const subjRows = await db.select<{ subject: string; minutes: number }[]>(
    `SELECT subject, SUM(duration_minutes) as minutes FROM study_sessions WHERE tenant_id=? AND session_date BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY subject ORDER BY minutes DESC`, [tenantId, from, to]);
  const dayRows = await db.select<{ d: string }[]>(
    `SELECT DISTINCT session_date as d FROM study_sessions WHERE tenant_id=? AND session_date BETWEEN ? AND ? AND deleted_at IS NULL`, [tenantId, from, to]);
  return {
    total_minutes: sessions[0]?.total ?? 0,
    sessions: sessions[0]?.count ?? 0,
    tests_done: tests[0]?.count ?? 0,
    avg_test_score: Math.round(tests[0]?.avg ?? 0),
    streak_days: dayRows.length,
    subjects: subjRows,
  };
}

// ── Round-3 types ─────────────────────────────────────────────────────────────

export interface StudyExamResult {
  id: string; tenant_id: string; subject: string; test_name: string;
  marks_obtained: number; max_marks: number; test_date: string; notes: string | null; created_at: string;
}
export interface StudyAttendance {
  id: string; tenant_id: string; subject: string; att_date: string; status: 'present' | 'absent' | 'late';
}
export interface StudyDoubt {
  id: string; tenant_id: string; question: string; subject: string | null; source: string | null;
  status: 'unsolved' | 'solved'; resolution: string | null; created_at: string;
}
export interface StudyVocab {
  id: string; tenant_id: string; word: string; meaning: string; example: string | null;
  subject: string | null; mastered: number; created_at: string;
}
export interface StudyWritingPractice {
  id: string; tenant_id: string; title: string; content: string; subject: string | null;
  time_taken_seconds: number; word_count: number; practice_date: string; created_at: string;
}
export interface StudyVideoBookmark {
  id: string; tenant_id: string; title: string; url: string; subject: string | null;
  notes: string | null; watched: number; created_at: string;
}
export interface StudyConceptCard {
  id: string; tenant_id: string; subject: string; deck_name: string; title: string;
  content: string; image_data: string | null; tags: string | null; times_reviewed: number; created_at: string;
}
export interface StudyExamRegistration {
  id: string; tenant_id: string; exam_name: string; registration_deadline: string;
  exam_date: string | null; fee: string | null; status: 'pending' | 'registered' | 'missed'; notes: string | null;
}
export interface StudySleepLog {
  id: string; tenant_id: string; sleep_date: string; hours_slept: number; quality: number; notes: string | null;
}
export interface StudyRichNote {
  id: string; tenant_id: string; title: string; subject: string | null;
  content_html: string; created_at: string; updated_at: string;
}
export interface StudyFocusItem { id: string; text: string; done: boolean; }

// ── Exam Results ──────────────────────────────────────────────────────────────
export async function listExamResults(tenantId: string): Promise<StudyExamResult[]> {
  const db = await getDb();
  return db.select<StudyExamResult[]>(`SELECT * FROM study_exam_results WHERE tenant_id=? AND deleted_at IS NULL ORDER BY test_date DESC`, [tenantId]);
}
export async function addExamResult(tenantId: string, data: Omit<StudyExamResult, 'id'|'tenant_id'|'created_at'>): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_exam_results (id,tenant_id,subject,test_name,marks_obtained,max_marks,test_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.subject, data.test_name, data.marks_obtained, data.max_marks, data.test_date, data.notes, now()]);
  return id;
}
export async function deleteExamResult(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_exam_results SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}
export async function getGradeTrends(tenantId: string, subject: string): Promise<{date:string;pct:number;test:string}[]> {
  const db = await getDb();
  const rows = await db.select<StudyExamResult[]>(`SELECT * FROM study_exam_results WHERE tenant_id=? AND subject=? AND deleted_at IS NULL ORDER BY test_date`, [tenantId, subject]);
  return rows.map(r => ({ date: r.test_date, pct: Math.round((r.marks_obtained/r.max_marks)*100), test: r.test_name }));
}

// ── Attendance ────────────────────────────────────────────────────────────────
export async function markAttendance(tenantId: string, subject: string, att_date: string, status: 'present'|'absent'|'late'): Promise<void> {
  const db = await getDb();
  await db.execute(`INSERT OR REPLACE INTO study_attendance (id,tenant_id,subject,att_date,status,created_at) VALUES (?,?,?,?,?,?)`,
    [uuid(), tenantId, subject, att_date, status, now()]);
}
export async function getAttendanceBySubject(tenantId: string): Promise<{subject:string;present:number;absent:number;late:number;total:number;pct:number}[]> {
  const db = await getDb();
  const rows = await db.select<{subject:string;status:string;count:number}[]>(
    `SELECT subject, status, COUNT(*) as count FROM study_attendance WHERE tenant_id=? GROUP BY subject, status`, [tenantId]);
  const map: Record<string, {present:number;absent:number;late:number}> = {};
  rows.forEach(r => {
    if (!map[r.subject]) map[r.subject] = {present:0,absent:0,late:0};
    (map[r.subject] as any)[r.status] = r.count;
  });
  return Object.entries(map).map(([subject, counts]) => {
    const total = counts.present + counts.absent + counts.late;
    return { subject, ...counts, total, pct: total > 0 ? Math.round((counts.present / total) * 100) : 0 };
  }).sort((a,b) => a.pct - b.pct);
}
export async function getAttendanceForMonth(tenantId: string, subject: string, yearMonth: string): Promise<StudyAttendance[]> {
  const db = await getDb();
  return db.select<StudyAttendance[]>(`SELECT * FROM study_attendance WHERE tenant_id=? AND subject=? AND att_date LIKE ? ORDER BY att_date`, [tenantId, subject, yearMonth+'%']);
}

// ── Doubt Bank ────────────────────────────────────────────────────────────────
export async function listDoubts(tenantId: string, status?: string): Promise<StudyDoubt[]> {
  const db = await getDb();
  if (status) return db.select<StudyDoubt[]>(`SELECT * FROM study_doubt_bank WHERE tenant_id=? AND status=? AND deleted_at IS NULL ORDER BY created_at DESC`, [tenantId, status]);
  return db.select<StudyDoubt[]>(`SELECT * FROM study_doubt_bank WHERE tenant_id=? AND deleted_at IS NULL ORDER BY status ASC, created_at DESC`, [tenantId]);
}
export async function addDoubt(tenantId: string, question: string, subject: string|null, source: string|null): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_doubt_bank (id,tenant_id,question,subject,source,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, question, subject, source, 'unsolved', now(), now()]);
  return id;
}
export async function resolveDoubt(tenantId: string, id: string, resolution: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_doubt_bank SET status='solved', resolution=?, updated_at=? WHERE id=? AND tenant_id=?`, [resolution, now(), id, tenantId]);
}
export async function deleteDoubt(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_doubt_bank SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Vocabulary ────────────────────────────────────────────────────────────────
export async function listVocab(tenantId: string): Promise<StudyVocab[]> {
  const db = await getDb();
  return db.select<StudyVocab[]>(`SELECT * FROM study_vocabulary WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`, [tenantId]);
}
export async function addVocab(tenantId: string, word: string, meaning: string, example: string|null, subject: string|null): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_vocabulary (id,tenant_id,word,meaning,example,subject,mastered,created_at) VALUES (?,?,?,?,?,?,0,?)`,
    [id, tenantId, word, meaning, example, subject, now()]);
  return id;
}
export async function toggleVocabMastered(tenantId: string, id: string, mastered: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_vocabulary SET mastered=? WHERE id=? AND tenant_id=?`, [mastered, id, tenantId]);
}
export async function deleteVocab(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_vocabulary SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Writing Practice ──────────────────────────────────────────────────────────
export async function listWritingPractice(tenantId: string): Promise<StudyWritingPractice[]> {
  const db = await getDb();
  return db.select<StudyWritingPractice[]>(`SELECT * FROM study_writing_practice WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`, [tenantId]);
}
export async function saveWritingPractice(tenantId: string, data: Omit<StudyWritingPractice,'id'|'tenant_id'|'created_at'>): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_writing_practice (id,tenant_id,title,content,subject,time_taken_seconds,word_count,practice_date,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.title, data.content, data.subject, data.time_taken_seconds, data.word_count, data.practice_date, now()]);
  return id;
}
export async function deleteWritingPractice(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_writing_practice SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Video Bookmarks ───────────────────────────────────────────────────────────
export async function listVideoBookmarks(tenantId: string): Promise<StudyVideoBookmark[]> {
  const db = await getDb();
  return db.select<StudyVideoBookmark[]>(`SELECT * FROM study_video_bookmarks WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`, [tenantId]);
}
export async function addVideoBookmark(tenantId: string, title: string, url: string, subject: string|null, notes: string|null): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_video_bookmarks (id,tenant_id,title,url,subject,notes,watched,created_at) VALUES (?,?,?,?,?,?,0,?)`,
    [id, tenantId, title, url, subject, notes, now()]);
  return id;
}
export async function toggleVideoWatched(tenantId: string, id: string, watched: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_video_bookmarks SET watched=? WHERE id=? AND tenant_id=?`, [watched, id, tenantId]);
}
export async function deleteVideoBookmark(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_video_bookmarks SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Concept Cards ─────────────────────────────────────────────────────────────
export async function listConceptCards(tenantId: string, subject?: string): Promise<StudyConceptCard[]> {
  const db = await getDb();
  if (subject) return db.select<StudyConceptCard[]>(`SELECT * FROM study_concept_cards WHERE tenant_id=? AND subject=? AND deleted_at IS NULL ORDER BY deck_name, created_at`, [tenantId, subject]);
  return db.select<StudyConceptCard[]>(`SELECT * FROM study_concept_cards WHERE tenant_id=? AND deleted_at IS NULL ORDER BY subject, deck_name, created_at`, [tenantId]);
}
export async function addConceptCard(tenantId: string, data: Omit<StudyConceptCard,'id'|'tenant_id'|'times_reviewed'|'created_at'>): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_concept_cards (id,tenant_id,subject,deck_name,title,content,image_data,tags,times_reviewed,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)`,
    [id, tenantId, data.subject, data.deck_name, data.title, data.content, data.image_data, data.tags, now()]);
  return id;
}
export async function deleteConceptCard(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_concept_cards SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Today's Focus ─────────────────────────────────────────────────────────────
export async function getTodayFocus(tenantId: string): Promise<StudyFocusItem[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0,10);
  const rows = await db.select<{items:string}[]>(`SELECT items FROM study_today_focus WHERE tenant_id=? AND focus_date=?`, [tenantId, today]);
  try { return JSON.parse(rows[0]?.items ?? '[]'); } catch { return []; }
}
export async function saveTodayFocus(tenantId: string, items: StudyFocusItem[]): Promise<void> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0,10);
  await db.execute(`INSERT OR REPLACE INTO study_today_focus (id,tenant_id,focus_date,items,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,focus_date) DO UPDATE SET items=?, updated_at=?`,
    [uuid(), tenantId, today, JSON.stringify(items), now(), now(), JSON.stringify(items), now()]);
}

// ── Exam Registrations ────────────────────────────────────────────────────────
export async function listExamRegistrations(tenantId: string): Promise<StudyExamRegistration[]> {
  const db = await getDb();
  return db.select<StudyExamRegistration[]>(`SELECT * FROM study_exam_registrations WHERE tenant_id=? AND deleted_at IS NULL ORDER BY registration_deadline ASC`, [tenantId]);
}
export async function addExamRegistration(tenantId: string, data: Omit<StudyExamRegistration,'id'|'tenant_id'>): Promise<string> {
  const db = await getDb(); const id = uuid();
  await db.execute(`INSERT INTO study_exam_registrations (id,tenant_id,exam_name,registration_deadline,exam_date,fee,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.exam_name, data.registration_deadline, data.exam_date, data.fee, data.status, data.notes, now()]);
  return id;
}
export async function updateExamRegStatus(tenantId: string, id: string, status: StudyExamRegistration['status']): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_exam_registrations SET status=? WHERE id=? AND tenant_id=?`, [status, id, tenantId]);
}
export async function deleteExamRegistration(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_exam_registrations SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Sleep Log ─────────────────────────────────────────────────────────────────
export async function listSleepLog(tenantId: string, days: number = 30): Promise<StudySleepLog[]> {
  const db = await getDb();
  const from = new Date(); from.setDate(from.getDate() - days);
  return db.select<StudySleepLog[]>(`SELECT * FROM study_sleep_log WHERE tenant_id=? AND sleep_date >= ? ORDER BY sleep_date DESC`, [tenantId, from.toISOString().slice(0,10)]);
}
export async function logSleep(tenantId: string, sleep_date: string, hours_slept: number, quality: number, notes: string|null): Promise<void> {
  const db = await getDb();
  await db.execute(`INSERT OR REPLACE INTO study_sleep_log (id,tenant_id,sleep_date,hours_slept,quality,notes,created_at) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, sleep_date, hours_slept, quality, notes, now()]);
}

// ── Rich Notes ────────────────────────────────────────────────────────────────
export async function listRichNotes(tenantId: string): Promise<StudyRichNote[]> {
  const db = await getDb();
  return db.select<StudyRichNote[]>(`SELECT * FROM study_rich_notes WHERE tenant_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId]);
}
export async function saveRichNote(tenantId: string, id: string|null, title: string, subject: string|null, content_html: string): Promise<string> {
  const db = await getDb();
  if (id) {
    await db.execute(`UPDATE study_rich_notes SET title=?, subject=?, content_html=?, updated_at=? WHERE id=? AND tenant_id=?`, [title, subject, content_html, now(), id, tenantId]);
    return id;
  }
  const newId = uuid();
  await db.execute(`INSERT INTO study_rich_notes (id,tenant_id,title,subject,content_html,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [newId, tenantId, title, subject, content_html, now(), now()]);
  return newId;
}
export async function deleteRichNote(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE study_rich_notes SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}
