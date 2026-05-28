// [study] [all tenants]
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getStudyConfig, saveStudyConfig } from '@/lib/db/study';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'College Year 1', 'College Year 2', 'College Year 3', 'College Year 4'];
const SUBJECTS_LIST = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'English', 'Hindi', 'Economics', 'Science', 'Computer Science', 'Political Science', 'Accountancy', 'Business Studies'];

export function StudySetupPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [name, setName]     = useState('');
  const [grade, setGrade]   = useState('');
  const [school, setSchool] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);

  const { data: config } = useQuery({ queryKey: ['study-config', tenantId], queryFn: () => getStudyConfig(tenantId), enabled: !!tenantId });

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
      class_grade: grade || null,
      school: school.trim() || null,
      subjects: subjects.length ? subjects.join(',') : null,
    }),
    onSuccess: () => { toast.success('Profile saved!'); qc.invalidateQueries({ queryKey: ['study-config'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const toggleSubject = (s: string) => setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>StudyMate</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Student Profile</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Helps AI personalise your experience</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Student's name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          </div>

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
            <input value={school} onChange={e => setSchool(e.target.value)} placeholder="School or college name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Subjects (select all you study)</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS_LIST.map(s => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={subjects.includes(s) ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
          style={{ background: 'var(--accent)' }}>
          {saveMutation.isPending ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
