// [study] [all tenants]
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, ChevronLeft, FileText, Bold, Italic, List, Heading1, Heading2, Underline } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listRichNotes, saveRichNote, deleteRichNote, StudyRichNote } from '@/lib/db/study';

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','Geography','English','Economics','Science','Hindi','Other'];

function ToolbarBtn({ icon: Icon, title, cmd, arg }: { icon: React.ComponentType<{className?:string}>; title: string; cmd: string; arg?: string }) {
  return (
    <button title={title}
      onMouseDown={e => { e.preventDefault(); document.execCommand(cmd, false, arg); }}
      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
      style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function RichNotesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [active, setActive] = useState<StudyRichNote | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);

  const { data: notes = [] } = useQuery({ queryKey: ['study-rich-notes', tenantId], queryFn: () => listRichNotes(tenantId), enabled: !!tenantId });

  const saveMutation = useMutation({
    mutationFn: () => saveRichNote(tenantId, active?.id ?? null, title.trim() || 'Untitled', subject || null, editorRef.current?.innerHTML ?? ''),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['study-rich-notes'] });
      if (isNew) {
        const updated = await listRichNotes(tenantId);
        setActive(updated.find(n => n.id === id) ?? null);
        setIsNew(false);
      }
      setDirty(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRichNote(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-rich-notes'] }); setActive(null); setIsNew(false); },
  });

  const openNote = (note: StudyRichNote) => {
    setActive(note); setIsNew(false); setTitle(note.title); setSubject(note.subject ?? '');
    setDirty(false);
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = note.content_html; }, 0);
  };

  const newNote = () => {
    setActive(null); setIsNew(true); setTitle(''); setSubject(''); setDirty(false);
    setTimeout(() => { if (editorRef.current) { editorRef.current.innerHTML = ''; editorRef.current.focus(); } }, 0);
  };

  // Auto-save on change (debounced)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInput = useCallback(() => {
    setDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveMutation.mutate(), 1500);
  }, []);

  if (active || isNew) return (
    <div className="flex-1 flex flex-col">
      {/* Editor header */}
      <div className="flex items-center gap-3 p-4 border-b flex-wrap" style={{ borderColor: 'var(--surface-border)' }}>
        <button onClick={() => { if (dirty) saveMutation.mutate(); setActive(null); setIsNew(false); }}
          className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <ChevronLeft className="h-4 w-4" /> Notes
        </button>
        <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Note title…"
          className="flex-1 min-w-0 font-bold text-lg bg-transparent outline-none"
          style={{ color: 'var(--text-primary)' }} />
        <select value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }}
          className="px-3 py-1.5 rounded-xl text-xs border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
          <option value="">No subject</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: dirty ? 'var(--accent)' : '#94a3b8' }}>
          <Save className="h-3.5 w-3.5" />{dirty ? 'Save' : 'Saved'}
        </button>
        {active && (
          <button onClick={() => deleteMutation.mutate(active.id)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b flex-wrap" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)' }}>
        <ToolbarBtn icon={Bold} title="Bold" cmd="bold" />
        <ToolbarBtn icon={Italic} title="Italic" cmd="italic" />
        <ToolbarBtn icon={Underline} title="Underline" cmd="underline" />
        <div className="w-px h-5 mx-1" style={{ background: 'var(--surface-border)' }} />
        <ToolbarBtn icon={Heading1} title="Heading 1" cmd="formatBlock" arg="h2" />
        <ToolbarBtn icon={Heading2} title="Heading 2" cmd="formatBlock" arg="h3" />
        <ToolbarBtn icon={List} title="Bullet list" cmd="insertUnorderedList" />
        <button title="Numbered list" onMouseDown={e => { e.preventDefault(); document.execCommand('insertOrderedList', false); }}
          className="h-8 px-2 rounded-lg text-xs font-bold hover:bg-opacity-80" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          1.
        </button>
        <button title="Highlight" onMouseDown={e => { e.preventDefault(); document.execCommand('hiliteColor', false, '#fef3c7'); }}
          className="h-8 w-8 rounded-lg text-sm" style={{ background: '#fef3c7' }}>🖊</button>
        <button title="Clear formatting" onMouseDown={e => { e.preventDefault(); document.execCommand('removeFormat', false); }}
          className="h-8 px-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
          Aa
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="flex-1 overflow-y-auto p-6 outline-none"
        style={{
          color: 'var(--text-primary)', minHeight: 200, lineHeight: 1.75, fontSize: 15,
          fontFamily: 'inherit',
        }}
        data-placeholder="Start writing your notes here…"
      />
      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--text-tertiary); pointer-events: none; }
        [contenteditable] h2 { font-size: 1.3em; font-weight: 700; margin: 12px 0 4px; }
        [contenteditable] h3 { font-size: 1.1em; font-weight: 600; margin: 10px 0 4px; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.5em; margin: 4px 0; }
        [contenteditable] li { margin: 2px 0; }
      `}</style>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
            <FileText className="h-5 w-5" style={{ color: '#2563eb' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Rich Notes</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Formatted notes with bold, headings, lists</p>
          </div>
        </div>
        <button onClick={newNote}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Note
        </button>
      </div>

      {notes.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📝</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No notes yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Create formatted notes with bold, headings, and bullet points</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {notes.map(note => (
          <button key={note.id} onClick={() => openNote(note)}
            className="rounded-2xl p-5 text-left hover:shadow-md transition-shadow"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{note.title}</p>
            {note.subject && <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{note.subject}</span>}
            <p className="text-xs mt-2 line-clamp-2"
              style={{ color: 'var(--text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: note.content_html.replace(/<[^>]+>/g,' ').substring(0,120) }} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {new Date(note.updated_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
