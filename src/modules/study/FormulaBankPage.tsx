// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Search, BookMarked } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listFormulas, addFormula, updateFormula, deleteFormula, StudyFormulaEntry } from '@/lib/db/study';

export function FormulaBankPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StudyFormulaEntry | null>(null);
  const [form, setForm] = useState({ subject: '', title: '', content: '', tags: '' });

  const { data: formulas = [] } = useQuery({
    queryKey: ['study-formulas', tenantId],
    queryFn: () => listFormulas(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addFormula(tenantId, form.subject.trim(), form.title.trim(), form.content.trim(), form.tags.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-formulas'] }); setShowAdd(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateFormula(tenantId, editing!.id, form.title.trim(), form.content.trim(), form.tags.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-formulas'] }); setEditing(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFormula(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-formulas'] }),
  });

  const resetForm = () => setForm({ subject: '', title: '', content: '', tags: '' });

  const subjects = [...new Set(formulas.map(f => f.subject))].sort();

  const filtered = formulas.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = !q || f.title.toLowerCase().includes(q) || f.content.toLowerCase().includes(q) || (f.tags ?? '').toLowerCase().includes(q);
    const matchSubject = !filterSubject || f.subject === filterSubject;
    return matchSearch && matchSubject;
  });

  const grouped = filtered.reduce<Record<string, StudyFormulaEntry[]>>((acc, f) => {
    if (!acc[f.subject]) acc[f.subject] = [];
    acc[f.subject].push(f);
    return acc;
  }, {});

  const openEdit = (f: StudyFormulaEntry) => {
    setEditing(f);
    setForm({ subject: f.subject, title: f.title, content: f.content, tags: f.tags ?? '' });
  };

  const isModal = showAdd || !!editing;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
            <BookMarked className="h-5 w-5" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Formula Bank</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Formulas, definitions, key concepts</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search formulas…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        {subjects.length > 0 && (
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {formulas.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">📐</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No formulas yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Save key formulas, definitions, and concepts for quick revision</p>
        </div>
      )}

      {/* Grouped by subject */}
      {Object.entries(grouped).map(([subject, items]) => (
        <div key={subject}>
          <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{subject} ({items.length})</h2>
          <div className="space-y-3">
            {items.map(f => (
              <div key={f.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(f)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors" style={{ color: '#2563eb' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(f.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{f.content}</p>
                {f.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {f.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add / Edit modal */}
      {isModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Formula' : 'Add Formula'}</h2>
            <div className="space-y-3">
              {!editing && (
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Subject (e.g. Physics)"
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              )}
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title (e.g. Newton's Second Law)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Formula / Definition / Concept…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="Tags (comma-separated, optional)"
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowAdd(false); setEditing(null); resetForm(); }}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => editing ? updateMutation.mutate() : addMutation.mutate()}
                disabled={!form.title.trim() || !form.content.trim() || (!editing && !form.subject.trim()) || addMutation.isPending || updateMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
