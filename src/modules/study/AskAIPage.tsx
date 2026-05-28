// [study] [all tenants]
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Plus, Trash2, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listConversations, createConversation, getMessages, saveMessage, deleteConversation,
  getStudyConfig, type StudyMessage,
} from '@/lib/db/study';
import { askTutor, checkAIAvailable } from '@/lib/study/studyAI';

const SUBJECTS = ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Hindi', 'Economics', 'Other'];

export function AskAIPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [activeId, setActiveId]     = useState<string | null>(null);
  const [input, setInput]           = useState('');
  const [thinking, setThinking]     = useState(false);
  const [aiOnline, setAiOnline]     = useState<boolean | null>(null);
  const [subject, setSubject]       = useState<string | null>(null);
  const [localMsgs, setLocalMsgs]   = useState<StudyMessage[]>([]);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const abortRef                    = useRef<AbortController | null>(null);

  const { data: config }  = useQuery({ queryKey: ['study-config', tenantId], queryFn: () => getStudyConfig(tenantId), enabled: !!tenantId });
  const { data: convs = [] } = useQuery({ queryKey: ['study-convs', tenantId], queryFn: () => listConversations(tenantId), enabled: !!tenantId });

  useEffect(() => { checkAIAvailable().then(setAiOnline); }, []);

  useEffect(() => {
    if (!activeId) { setLocalMsgs([]); return; }
    getMessages(activeId).then(setLocalMsgs);
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [localMsgs, thinking]);

  const newConvMutation = useMutation({
    mutationFn: async () => {
      const id = await createConversation(tenantId, 'New conversation', subject);
      return id;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ['study-convs'] }); setActiveId(id); setLocalMsgs([]); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-convs'] }); if (activeId) setActiveId(null); },
  });

  async function sendMessage() {
    if (!input.trim() || thinking) return;
    if (!activeId) {
      const id = await createConversation(tenantId, input.trim().substring(0, 60), subject);
      qc.invalidateQueries({ queryKey: ['study-convs'] });
      setActiveId(id);
      await doSend(id, input.trim());
    } else {
      await doSend(activeId, input.trim());
    }
  }

  async function doSend(convId: string, text: string) {
    setInput('');
    const userMsg: StudyMessage = { id: 'tmp-' + Date.now(), conversation_id: convId, role: 'user', content: text, created_at: new Date().toISOString(), tenant_id: tenantId } as any;
    setLocalMsgs(prev => [...prev, userMsg]);
    await saveMessage(tenantId, convId, 'user', text);

    setThinking(true);
    abortRef.current = new AbortController();
    try {
      const history = localMsgs.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const reply = await askTutor(tenantId, text, subject ?? config?.subjects?.split(',')[0] ?? null, history, abortRef.current.signal);
      const aiMsg: StudyMessage = { id: 'tmp-ai-' + Date.now(), conversation_id: convId, role: 'assistant', content: reply, created_at: new Date().toISOString(), tenant_id: tenantId } as any;
      setLocalMsgs(prev => [...prev, aiMsg]);
      await saveMessage(tenantId, convId, 'assistant', reply);
      qc.invalidateQueries({ queryKey: ['study-convs'] });
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e?.message ?? 'AI not available. Check internet.');
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-full" style={{ maxHeight: 'calc(100vh - 0px)' }}>
      {/* Sidebar — conversation list */}
      <div className="hidden lg:flex w-64 flex-col flex-shrink-0" style={{ background: 'var(--surface)', borderRight: '1px solid var(--surface-border)' }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Conversations</p>
          <button onClick={() => newConvMutation.mutate()}
            className="p-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {convs.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No conversations yet</p>
          )}
          {convs.map(c => (
            <div key={c.id}
              className={`flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer group transition-colors ${activeId === c.id ? '' : 'hover:bg-slate-50'}`}
              style={activeId === c.id ? { background: 'var(--surface-2)' } : {}}
              onClick={() => setActiveId(c.id)}>
              <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: activeId === c.id ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                {c.subject && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.subject}</p>}
              </div>
              <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 flex-shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* AI status */}
        <div className="p-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: aiOnline ? '#16a34a' : '#dc2626' }}>
            {aiOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {aiOnline ? 'AI is online' : 'AI offline — saved answers still available'}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Ask AI Anything</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your AI tutor — explains concepts, never just gives answers</p>
          </div>
          <select value={subject ?? ''} onChange={e => setSubject(e.target.value || null)}
            className="rounded-xl border px-3 py-1.5 text-xs outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            <option value="">Any Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!activeId && localMsgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <p className="text-5xl">🤖</p>
              <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Hi {config?.student_name || 'there'}! What do you want to learn today?</p>
              <p className="text-sm max-w-sm" style={{ color: 'var(--text-tertiary)' }}>Ask me anything — I'll explain it clearly, step by step. No question is too simple.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Explain photosynthesis', 'How does interest compound?', 'What is Newton\'s 2nd law?', 'Explain the French Revolution'].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="px-3 py-1.5 rounded-full text-xs border font-medium"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {localMsgs.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm`}
                style={msg.role === 'user'
                  ? { background: 'var(--accent)', color: 'white', borderBottomRightRadius: '4px' }
                  : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', borderBottomLeftRadius: '4px' }}>
                {msg.role === 'assistant' && (
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent)' }}>🤖 StudyMate</p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>🤖 StudyMate</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
          {!aiOnline && aiOnline !== null && (
            <div className="mb-2 text-xs px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <WifiOff className="h-3.5 w-3.5" /> AI offline — no internet. You can still read saved conversations.
            </div>
          )}
          <div className="flex gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none resize-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            <button onClick={sendMessage} disabled={!input.trim() || thinking || !aiOnline}
              className="px-4 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
              style={{ background: 'var(--accent)' }}>
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
