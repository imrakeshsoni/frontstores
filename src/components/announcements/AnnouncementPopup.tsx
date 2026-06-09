// [core] [all apps] [all tenants]
// Silent, automatic delivery: polled in the background (see useAnnouncementPolling),
// then surfaced here as a one-time dismissible popup so the user can't miss it —
// no "click update to get it" step.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Megaphone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getUnnotifiedAnnouncements, markAllNotified, acknowledgeAnnouncement, type Announcement } from '@/lib/db/announcements';

export function AnnouncementPopup() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? '');
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data: pending } = useQuery({
    queryKey: ['announcements-unnotified', tenantId],
    queryFn: () => getUnnotifiedAnnouncements(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Reset local dismissal state whenever a fresh batch shows up
  useEffect(() => { if (pending?.length) setDismissed(false); }, [pending?.[0]?.id]);

  if (!pending?.length || dismissed) return null;

  const latest: Announcement = pending[0];
  const moreCount = pending.length - 1;

  const handleDismiss = async () => {
    setDismissed(true);
    await markAllNotified(tenantId);
    // Report each shown announcement as acknowledged to the server
    for (const ann of pending ?? []) {
      acknowledgeAnnouncement(tenantId, ann.id, shopName).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['announcements-unnotified', tenantId] });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-start sm:justify-end" style={{ pointerEvents: 'none' }}>
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1.5px solid var(--surface-border)', pointerEvents: 'auto', animation: 'fs-announcement-in .25s ease-out' }}
      >
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#ede9fe' }}>
            <Megaphone className="h-5 w-5" style={{ color: '#7c3aed' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7c3aed' }}>📣 New announcement</p>
            <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{latest.title}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latest.message}</p>
            {moreCount > 0 && (
              <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>+{moreCount} more announcement{moreCount > 1 ? 's' : ''} — open the Announcements tab to see all</p>
            )}
            <button
              onClick={handleDismiss}
              className="mt-3 rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{ background: '#7c3aed', color: '#fff' }}
            >
              Got it
            </button>
          </div>
          <button onClick={handleDismiss} aria-label="Dismiss" className="flex-shrink-0 rounded-lg p-1 hover:opacity-70">
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fs-announcement-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
