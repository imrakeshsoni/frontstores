// [study] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { open } from '@tauri-apps/plugin-shell';
import { useAppStore } from '@/app/store/app.store';
import {
  listVideoBookmarks, addVideoBookmark, toggleVideoWatched, deleteVideoBookmark,
  type StudyVideoBookmark,
} from '@/lib/db/study';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Computer Science', 'Economics', 'Other'];

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

export function VideoBookmarksPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filterSubject, setFilterSubject] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', subject: '', notes: '' });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['video-bookmarks', tenantId],
    queryFn: () => listVideoBookmarks(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => addVideoBookmark(tenantId, form.title.trim(), form.url.trim(), form.subject || null, form.notes.trim() || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-bookmarks', tenantId] });
      setShowForm(false);
      setForm({ title: '', url: '', subject: '', notes: '' });
      toast.success('Video bookmark added');
    },
    onError: () => toast.error('Failed to add bookmark'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, watched }: { id: string; watched: number }) => toggleVideoWatched(tenantId, id, watched),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video-bookmarks', tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVideoBookmark(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-bookmarks', tenantId] });
      toast.success('Bookmark deleted');
    },
  });

  const filtered = filterSubject === 'All' ? bookmarks : bookmarks.filter(b => b.subject === filterSubject);
  const subjects = ['All', ...Array.from(new Set(bookmarks.map(b => b.subject).filter(Boolean) as string[]))];

  async function openUrl(url: string) {
    try { await open(url); } catch { toast.error('Could not open URL'); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Video Bookmarks</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{bookmarks.length} saved videos</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          + Add Video
        </button>
      </div>

      {/* Subject filter */}
      <div className="flex flex-wrap gap-2">
        {subjects.map(s => (
          <button key={s} onClick={() => setFilterSubject(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={filterSubject === s
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Video list */}
      {filtered.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">📹</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No videos yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Save YouTube or any video links for later</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(bm => {
          const ytId = getYouTubeId(bm.url);
          return (
            <div key={bm.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {ytId && (
                <div className="relative cursor-pointer group" onClick={() => openUrl(bm.url)} style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                  <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={bm.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  {bm.watched === 1 && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#dcfce7', color: '#16a34a' }}>Watched</div>
                  )}
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{bm.title}</p>
                    {bm.subject && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{bm.subject}</span>
                    )}
                  </div>
                </div>
                {bm.notes && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{bm.notes}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => openUrl(bm.url)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    Open
                  </button>
                  <button onClick={() => toggleMutation.mutate({ id: bm.id, watched: bm.watched === 1 ? 0 : 1 })}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border"
                    style={{ borderColor: 'var(--surface-border)', color: bm.watched === 1 ? '#16a34a' : 'var(--text-secondary)', background: bm.watched === 1 ? '#dcfce7' : 'transparent' }}>
                    {bm.watched === 1 ? 'Watched' : 'Mark Watched'}
                  </button>
                  <button onClick={() => { if (confirm('Delete this bookmark?')) deleteMutation.mutate(bm.id); }}
                    className="py-2 px-3 rounded-xl text-xs font-semibold"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)', border: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Video</h2>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Video title" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="Video URL (YouTube, etc.)" className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: form.subject ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              <option value="">Subject (optional)</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)" rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.title.trim() || !form.url.trim() || addMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {addMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
