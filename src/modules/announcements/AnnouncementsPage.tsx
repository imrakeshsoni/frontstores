// [core] [all apps] [all tenants]
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Megaphone, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAnnouncements, markAllRead, acknowledgeAnnouncement, type Announcement } from '@/lib/db/announcements';
import { PageIntro } from '@/components/ui/PageIntro';

export default function AnnouncementsPage() {
  const tenantId  = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? '');
  const queryClient = useQueryClient();
  const [signing, setSigning] = useState<string | null>(null);

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', tenantId],
    queryFn: () => listAnnouncements(tenantId),
    enabled: !!tenantId,
  });

  // Opening this page clears the glow/badge
  useEffect(() => {
    if (!tenantId) return;
    markAllRead(tenantId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['announcements-unread-count', tenantId] });
    });
  }, [tenantId, queryClient]);

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAnnouncement(tenantId, id, shopName),
    onMutate: (id) => setSigning(id),
    onSettled: () => {
      setSigning(null);
      queryClient.invalidateQueries({ queryKey: ['announcements', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['announcements-unread-count', tenantId] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageIntro
        eyebrow="Announcements"
        title="Messages from FrontStores"
        description="Important notices — new features, maintenance windows, or service updates. Acknowledge each one to confirm you've read it."
      />

      {!announcements.length ? (
        <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Megaphone className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No announcements yet</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>We'll let you know here whenever there's something important.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(announcements as Announcement[]).map(a => {
            const isRead = !!a.read_at;
            return (
              <div key={a.id} className="card p-5"
                style={{ borderLeft: `4px solid ${isRead ? '#16a34a' : '#7c3aed'}` }}>
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: isRead ? '#dcfce7' : '#ede9fe' }}>
                    {isRead
                      ? <CheckCircle2 className="h-5 w-5" style={{ color: '#16a34a' }} />
                      : <Megaphone className="h-5 w-5" style={{ color: '#7c3aed' }} />
                    }
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      {isRead
                        ? <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d', borderRadius: '2px', padding: '2px 7px', letterSpacing: '.06em', textTransform: 'uppercase' as const }}>Acknowledged</span>
                        : <span style={{ fontSize: '10px', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', borderRadius: '2px', padding: '2px 7px', letterSpacing: '.06em', textTransform: 'uppercase' as const }}>New</span>
                      }
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{a.message}</p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {!isRead && (
                      <button
                        onClick={() => ackMutation.mutate(a.id)}
                        disabled={signing === a.id}
                        style={{
                          marginTop: '14px', background: '#0f1523', color: '#fff',
                          border: 'none', borderRadius: '4px', padding: '8px 20px',
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', letterSpacing: '.04em',
                          opacity: signing === a.id ? 0.6 : 1,
                        }}>
                        {signing === a.id ? 'Signing…' : '✅ Sign & Acknowledge'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
