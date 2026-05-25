// [all apps] [all tenants] — AI voice assistant: session memory + persistent memory
import { getDb, uuid, now } from './index';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIMemoryEntry {
  id: string;
  key: string;
  value: string;
  confidence: number;
}

// Save a message to the current session
export async function saveAIMessage(
  tenantId: string,
  sessionId: string,
  role: AIMessage['role'],
  content: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ai_conversations (id, tenant_id, session_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), tenantId, sessionId, role, content, now()]
  );
}

// Load all messages for the current session (ordered chronologically)
export async function loadSessionMessages(
  tenantId: string,
  sessionId: string
): Promise<AIMessage[]> {
  const db = await getDb();
  const rows = await db.select<{ role: string; content: string }[]>(
    `SELECT role, content FROM ai_conversations
     WHERE tenant_id = ? AND session_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [tenantId, sessionId]
  );
  return rows as AIMessage[];
}

// Load persistent memories for this tenant (for system prompt context)
export async function loadAIMemories(tenantId: string): Promise<AIMemoryEntry[]> {
  const db = await getDb();
  return db.select<AIMemoryEntry[]>(
    `SELECT id, key, value, confidence FROM ai_memory
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY confidence DESC, updated_at DESC
     LIMIT 50`,
    [tenantId]
  );
}

// Upsert a memory entry — if key exists, update value and bump confidence
export async function upsertAIMemory(
  tenantId: string,
  key: string,
  value: string
): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ id: string; confidence: number }[]>(
    `SELECT id, confidence FROM ai_memory
     WHERE tenant_id = ? AND key = ? AND deleted_at IS NULL`,
    [tenantId, key]
  );
  if (existing.length > 0) {
    await db.execute(
      `UPDATE ai_memory SET value = ?, confidence = confidence + 1, updated_at = ?
       WHERE id = ?`,
      [value, now(), existing[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO ai_memory (id, tenant_id, key, value, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [uuid(), tenantId, key, value, now(), now()]
    );
  }
}

// Load last N conversations across all sessions (for context on resume)
export async function loadRecentHistory(
  tenantId: string,
  limit = 20
): Promise<AIMessage[]> {
  const db = await getDb();
  const rows = await db.select<{ role: string; content: string }[]>(
    `SELECT role, content FROM ai_conversations
     WHERE tenant_id = ? AND deleted_at IS NULL AND role != 'system'
     ORDER BY created_at DESC LIMIT ?`,
    [tenantId, limit]
  );
  return (rows as AIMessage[]).reverse();
}
