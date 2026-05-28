// [study] [all tenants]
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getStudyConfig, saveStudyConfig } from '@/lib/db/study';
import {
  STUDY_THEMES, THEME_CATEGORIES, applyStudyTheme, getSavedThemeId,
  type StudyTheme,
} from '@/lib/study/studyThemes';

const CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12','College Year 1','College Year 2','College Year 3','College Year 4'];
const SUBJECTS_LIST = ['Mathematics','Physics','Chemistry','Biology','History','Geography','English','Hindi','Economics','Science','Computer Science','Political Science','Accountancy','Business Studies'];

export function StudySetupPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [name, setName]       = useState('');
  const [grade, setGrade]     = useState('');
  const [school, setSchool]   = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeThemeId, setActiveThemeId] = useState(getSavedThemeId);
  const [activeCategory, setActiveCategory] = useState('Ocean & Sky');

  const { data: config } = useQuery({
    queryKey: ['study-config', tenantId],
    queryFn:  () => getStudyConfig(tenantId),
    enabled:  !!tenantId,
  });

  useEffect(() => {
    if (config) {
      setName(config.student_name ?? '');
      setGrade(config.class_grade ?? '');
      setSchool(config.school ?? '');
      setSubjects(config.subjects ? config.subjects.split(',') : []);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => saveStudyConfig(tenantId, {
      student_name: name.trim() || null,
      class_grade:  grade || null,
      school:       school.trim() || null,
      subjects:     subjects.length ? subjects.join(',') : null,
    }),
    onSuccess: () => { toast.success('Profile saved!'); qc.invalidateQueries({ queryKey: ['study-config'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  function handleThemeSelect(theme: StudyTheme) {
    setActiveThemeId(theme.id);
    applyStudyTheme(theme); // instant — no save button needed
  }

  const toggleSubject = (s: string) =>
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const categoryThemes = STUDY_THEMES.filter(t => t.category === activeCategory);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* ── Theme Picker ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Appearance</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Choose Your Theme</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Click any theme — it applies instantly.</p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {THEME_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={activeCategory === cat
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-text, #fff)' }
                : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Theme swatches */}
        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-3">
          {categoryThemes.map(theme => {
            const isActive = activeThemeId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme)}
                title={theme.name}
                className="flex flex-col items-center gap-1.5 group"
              >
                {/* Swatch preview */}
                <div
                  className="w-full aspect-square rounded-xl overflow-hidden transition-all"
                  style={{
                    background: theme.bg,
                    border: isActive ? `3px solid ${theme.accent}` : `2px solid ${theme.accent}40`,
                    boxShadow: isActive ? `0 0 0 3px ${theme.accent}50, 0 4px 12px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.2)',
                    transform: isActive ? 'scale(1.08)' : undefined,
                  }}
                >
                  {/* Mini app preview inside swatch */}
                  <div className="h-full flex">
                    {/* Sidebar strip */}
                    <div className="w-1/3 h-full" style={{ background: theme.surface }} />
                    {/* Content area */}
                    <div className="flex-1 flex flex-col p-1 gap-1" style={{ background: theme.bg }}>
                      <div className="h-1 rounded-full" style={{ background: theme.accent, opacity: 0.9 }} />
                      <div className="h-1 rounded-full w-3/4" style={{ background: theme.accent, opacity: 0.5 }} />
                      <div className="h-1 rounded-full w-1/2" style={{ background: theme.accent, opacity: 0.3 }} />
                    </div>
                  </div>
                </div>
                {/* Theme name */}
                <p className="text-center leading-tight" style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  {theme.emoji} {theme.name}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active theme indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-4 w-4 rounded-full" style={{ background: STUDY_THEMES.find(t => t.id === activeThemeId)?.accent ?? 'var(--accent)', border: '2px solid rgba(255,255,255,0.3)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {STUDY_THEMES.find(t => t.id === activeThemeId)?.name ?? 'Sky Blue'} — applied
          </p>
        </div>
      </div>

      {/* ── Profile Details ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Student Profile</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Helps AI personalise your experience.</p>
        </div>

        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Student's name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Class / Grade</label>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                <option value="">Select class</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>School / College</label>
              <input value={school} onChange={e => setSchool(e.target.value)} placeholder="School name"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>My Subjects</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS_LIST.map(s => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={subjects.includes(s)
                    ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-text, #fff)' }
                    : { borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accent-text, #fff)' }}>
            {saveMutation.isPending ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
