// [study] [all tenants]
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, FileText, Image, BookOpen, Plus, Eye } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listResources, saveResource, deleteResource, extractPdfText, type StudyResource } from '@/lib/db/studyResources';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Economics', 'Science', 'Hindi', 'Other'];

const TYPE_ICON: Record<string, React.ReactNode> = {
  image: <Image className="h-4 w-4" />,
  pdf:   <FileText className="h-4 w-4" />,
  text:  <BookOpen className="h-4 w-4" />,
  note:  <BookOpen className="h-4 w-4" />,
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  image: { bg: '#ede9fe', color: '#7c3aed' },
  pdf:   { bg: '#fee2e2', color: '#dc2626' },
  text:  { bg: '#dbeafe', color: '#2563eb' },
  note:  { bg: '#dcfce7', color: '#16a34a' },
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function StudyResourcesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject]     = useState('');
  const [showNote, setShowNote]   = useState(false);
  const [noteName, setNoteName]   = useState('');
  const [noteText, setNoteText]   = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [preview, setPreview]     = useState<StudyResource | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['study-resources', tenantId],
    queryFn:  () => listResources(tenantId),
    enabled:  !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource(tenantId, id),
    onSuccess: () => { toast.success('Resource removed'); qc.invalidateQueries({ queryKey: ['study-resources'] }); },
  });

  const saveNoteMutation = useMutation({
    mutationFn: () => {
      if (!noteName.trim() || !noteText.trim()) throw new Error('Name and content required');
      return saveResource(tenantId, { name: noteName.trim(), type: 'note', subject: noteSubject || null, content: noteText.trim(), image_data: null, file_size: noteText.length });
    },
    onSuccess: () => {
      toast.success('Note saved!');
      setShowNote(false); setNoteName(''); setNoteText(''); setNoteSubject('');
      qc.invalidateQueries({ queryKey: ['study-resources'] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const isImage = file.type.startsWith('image/');
        const isPdf   = ext === 'pdf' || file.type === 'application/pdf';
        const isText  = ext === 'txt' || ext === 'md' || file.type.startsWith('text/');

        if (isImage) {
          const b64 = await readAsBase64(file);
          await saveResource(tenantId, { name: file.name, type: 'image', subject: subject || null, content: null, image_data: b64, file_size: file.size });
          toast.success(`${file.name} uploaded`);
        } else if (isPdf) {
          const buf = await file.arrayBuffer();
          const text = extractPdfText(buf);
          if (!text.trim()) { toast.warning(`${file.name}: could not extract text — try copy-pasting instead`); continue; }
          await saveResource(tenantId, { name: file.name, type: 'pdf', subject: subject || null, content: text, image_data: null, file_size: file.size });
          toast.success(`${file.name} — ${text.length} chars extracted`);
        } else if (isText) {
          const text = await file.text();
          await saveResource(tenantId, { name: file.name, type: 'text', subject: subject || null, content: text, image_data: null, file_size: file.size });
          toast.success(`${file.name} uploaded`);
        } else {
          toast.error(`${file.name}: unsupported type. Use images, PDFs, or text files.`);
        }
      }
      qc.invalidateQueries({ queryKey: ['study-resources'] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function readAsBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  const grouped = resources.reduce<Record<string, StudyResource[]>>((acc, r) => {
    const key = r.subject ?? 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const totalSize = resources.reduce((s, r) => s + r.file_size, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>My Resources</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {resources.length} files · {fmtSize(totalSize)} · stored only on this device
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNote(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface)' }}>
            <Plus className="h-4 w-4" /> Add Note
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}>
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* File input */}
      <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md" className="hidden"
        onChange={e => handleFiles(e.target.files)} />

      {/* Subject filter for upload */}
      <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>Tag uploads as:</p>
        <select value={subject} onChange={e => setSubject(e.target.value)}
          className="rounded-xl border px-3 py-1.5 text-sm outline-none"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
          <option value="">No subject</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className="flex-1 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 py-3 cursor-pointer transition-colors hover:bg-slate-50"
          style={{ borderColor: 'var(--surface-border)' }}>
          <Upload className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Drop images, PDFs, or text files here</p>
        </div>
      </div>

      {/* What AI can do with these */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
        <span className="text-2xl">🤖</span>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#5b21b6' }}>AI uses these automatically</p>
          <p className="text-xs mt-0.5" style={{ color: '#6d28d9' }}>
            When you ask a question in Ask AI, the AI searches your resources and uses relevant ones as context — along with web search for the latest info. Everything stays on your device.
          </p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}

      {/* Empty */}
      {!isLoading && resources.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">📂</p>
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No resources yet</p>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
            Upload your notes, textbook images, past papers, or anything you study from. AI will use them when answering your questions.
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowNote(true)} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Add a Note</button>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Upload File</button>
          </div>
        </div>
      )}

      {/* Grouped resource list */}
      {Object.entries(grouped).map(([grp, items]) => (
        <div key={grp} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{grp}</p>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>({items.length})</span>
          </div>
          {items.map((r, idx) => {
            const tc = TYPE_COLOR[r.type] ?? TYPE_COLOR.text;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg, color: tc.color }}>
                  {TYPE_ICON[r.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {r.type.toUpperCase()} · {fmtSize(r.file_size)} · {new Date(r.created_at).toLocaleDateString('en-IN')}
                    {r.content && ` · ${r.content.length.toLocaleString()} chars`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setPreview(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Add Note modal */}
      {showNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-lg space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Study Note</h2>
              <button onClick={() => setShowNote(false)} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note Title *</label>
              <input value={noteName} onChange={e => setNoteName(e.target.value)} placeholder="e.g. Photosynthesis Notes"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
              <select value={noteSubject} onChange={e => setNoteSubject(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="">Select subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Content * (paste your notes or type here)</label>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={8}
                placeholder="Paste chapter notes, important points, formulas, definitions…"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={() => saveNoteMutation.mutate()} disabled={!noteName.trim() || !noteText.trim() || saveNoteMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              {saveNoteMutation.isPending ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{preview.name}</h2>
              <button onClick={() => setPreview(null)} className="text-sm px-3 py-1.5 rounded-lg border flex-shrink-0" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {preview.image_data ? (
                <img src={preview.image_data} alt={preview.name} className="max-w-full rounded-xl" />
              ) : preview.content ? (
                <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}>{preview.content.substring(0, 5000)}{preview.content.length > 5000 ? '\n\n[truncated…]' : ''}</pre>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No preview available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
