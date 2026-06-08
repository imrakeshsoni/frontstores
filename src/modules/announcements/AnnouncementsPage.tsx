// [core] [all apps] [all tenants]
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAnnouncements, markAllRead } from '@/lib/db/announcements';
import { PageIntro } from '@/components/ui/PageIntro';

export default function AnnouncementsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();

  const { data: announcements } = useQuery({
    queryKey: ['announcements', tenantId],
    queryFn: () => listAnnouncements(tenantId),
    enabled: !!tenantId,
  });

  // Opening this page is what clears the glow/badge — mark everything read.
  useEffect(() => {
    if (!tenantId) return;
    markAllRead(tenantId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['announcements-unread-count', tenantId] });
    });
  }, [tenantId, queryClient]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageIntro
        eyebrow="Announcements"
        title="Messages from FrontStores"
        description="Important notices we've sent you — like planned maintenance, new features, or service changes."
      />

      {!announcements?.length ? (
        <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Megaphone className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No announcements yet</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>We'll let you know here whenever there's something important.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="card p-4 border-l-4" style={{ borderLeftColor: '#7c3aed' }}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
                  <Megaphone className="h-4 w-4" style={{ color: '#7c3aed' }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{a.message}</p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
