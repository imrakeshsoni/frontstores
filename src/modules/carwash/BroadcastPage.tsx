// [carwash] [all tenants]
import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { listCustomers } from '@/lib/db/customers';
import { sendWhatsAppBulk } from '@/lib/whatsapp';
import { useQuery } from '@tanstack/react-query';
import { Send, Users, MessageSquare, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    label: '🚫 Shop Closed Today',
    message: `Hi {name} 👋\n\nOur car wash is closed today. We apologize for the inconvenience.\n\nWe'll be back tomorrow with the same great service! 🚗✨\n\n— ${'{shop}'}`,
  },
  {
    label: '🎉 Special Offer',
    message: `Hi {name} 👋\n\n✨ *Special Offer!* ✨\n\nGet 20% OFF on all car wash services this weekend!\n\nBook now or walk in — limited slots available! 🚗\n\n— ${'{shop}'}`,
  },
  {
    label: '🎊 Festive Greetings',
    message: `Hi {name} 👋\n\nWishing you and your family a joyful celebration! 🎊\n\nAs a token of our appreciation, enjoy ₹50 OFF your next car wash visit.\n\nPresent this message at the counter.\n\n— ${'{shop}'}`,
  },
  {
    label: '📅 Back in Business',
    message: `Hi {name} 👋\n\nWe are open again and ready to make your car shine! 🚗✨\n\nCome visit us — your car deserves the best!\n\n— ${'{shop}'}`,
  },
  {
    label: '✍️ Custom Message',
    message: '',
  },
];

export function BroadcastPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Car Wash');
  const hasApi   = !!(useAppStore(s => s.config?.settings?.wa_phone_id) && useAppStore(s => s.config?.settings?.wa_token));

  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [message, setMessage] = useState(TEMPLATES[0].message);
  const [filter, setFilter] = useState<'all' | 'recent'>('all');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: customerData } = useQuery({
    queryKey: ['customers-broadcast', tenantId],
    queryFn: () => listCustomers(tenantId, { perPage: 1000 }),
    enabled: !!tenantId,
  });

  const allCustomers = (customerData?.items ?? []).filter((c: any) => c.phone?.replace(/\D/g,'').length === 10);
  const customers = allCustomers; // future: add 'recent' filter

  const previewMsg = (name: string) =>
    message.replace(/{name}/g, name).replace(/{shop}/g, shopName);

  const handleTemplateSelect = (i: number) => {
    setSelectedTemplate(i);
    if (TEMPLATES[i].message) setMessage(TEMPLATES[i].message);
    setResult(null);
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Write a message first'); return; }
    if (customers.length === 0) { toast.error('No customers with valid phone numbers'); return; }

    const confirmed = confirm(
      `Send this message to ${customers.length} customers?\n\n` +
      (hasApi ? '✅ Will send automatically via WhatsApp Business API.' : '⚠️ Will open WhatsApp one-by-one (no API configured). This takes time.')
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    setProgress({ done: 0, total: customers.length });

    const res = await sendWhatsAppBulk(
      customers.map((c: any) => ({ phone: c.phone, name: c.name })),
      (name) => previewMsg(name),
      (done, total) => setProgress({ done, total })
    );

    setSending(false);
    setResult(res);
    toast.success(`Broadcast done: ${res.sent} sent, ${res.failed} failed`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Broadcast Message</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Send a message to all your customers at once</p>
        </div>
      </div>

      {/* API status banner */}
      {!hasApi && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <Info className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
          <div className="text-sm" style={{ color: '#92400e' }}>
            <p className="font-semibold">No WhatsApp Business API configured</p>
            <p className="mt-0.5">Messages will open WhatsApp Desktop one by one — you must tap Send each time. <strong>Go to Settings → WhatsApp Business API</strong> to enable automatic sending.</p>
          </div>
        </div>
      )}
      {hasApi && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>
          <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#16a34a' }} />
          <p className="text-sm font-semibold" style={{ color: '#15803d' }}>WhatsApp Business API connected — messages will send automatically</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Left — Compose */}
        <div className="space-y-4">
          {/* Template picker */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Choose Template</p>
            <div className="space-y-1.5">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => handleTemplateSelect(i)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={selectedTemplate === i
                    ? { background: 'var(--accent)', color: 'var(--on-accent, #111)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message editor */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
              Message <span className="font-normal normal-case" style={{ color: 'var(--text-tertiary)' }}>— use {'{name}'} for customer name</span>
            </p>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8}
              className="w-full rounded-xl border px-3.5 py-3 text-sm outline-none resize-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
              placeholder="Type your message here…" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{message.length} characters</p>
          </div>
        </div>

        {/* Right — Recipients + Preview */}
        <div className="space-y-4">
          {/* Recipients */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Recipients</p>
              <span className="ml-auto text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{customers.length}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              All customers with a valid 10-digit phone number
            </p>
            {allCustomers.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>No customers with phone numbers yet. They appear here after job cards are created.</p>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" style={{ color: '#25d366' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#25d366' }}>Preview</p>
            </div>
            <div className="rounded-xl p-3 text-sm whitespace-pre-wrap" style={{ background: '#dcfce7', color: '#14532d', fontSize: '0.8rem', lineHeight: 1.5 }}>
              {previewMsg('Amit') || '(no message yet)'}
            </div>
          </div>

          {/* Progress / Result */}
          {sending && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sending…</p>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  background: '#25d366',
                }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                {progress.done} of {progress.total} messages
              </p>
            </div>
          )}
          {result && !sending && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: result.failed === 0 ? '#dcfce7' : '#fef3c7', border: `1px solid ${result.failed === 0 ? '#bbf7d0' : '#fcd34d'}` }}>
              {result.failed === 0
                ? <CheckCircle className="h-5 w-5" style={{ color: '#16a34a' }} />
                : <AlertCircle className="h-5 w-5" style={{ color: '#d97706' }} />}
              <div>
                <p className="text-sm font-bold" style={{ color: result.failed === 0 ? '#15803d' : '#92400e' }}>
                  {result.sent} sent{result.failed > 0 ? `, ${result.failed} failed` : ' successfully!'}
                </p>
                {result.failed > 0 && <p className="text-xs" style={{ color: '#92400e' }}>Failed numbers may be invalid or unreachable.</p>}
              </div>
            </div>
          )}

          {/* Send button */}
          <button onClick={handleSend} disabled={sending || customers.length === 0 || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 transition-all"
            style={{ background: '#25d366', color: '#fff' }}>
            <Send className="h-5 w-5" />
            {sending ? 'Sending…' : `Send to ${customers.length} customers`}
          </button>
        </div>
      </div>
    </div>
  );
}
