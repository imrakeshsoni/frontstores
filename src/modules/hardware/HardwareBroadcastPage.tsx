// [hardware] [all tenants]
import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { listHwBroadcastRecipients } from '@/lib/db/hardware';
import { sendWhatsAppBulk } from '@/lib/whatsapp';
import { useQuery } from '@tanstack/react-query';
import { Send, Users, MessageSquare, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

const ACCENT = '#2563eb';

const TEMPLATES = [
  {
    label: '🚫 Shop Closed Today',
    message: `Hi {name} 👋\n\nOur shop is closed today. We apologize for the inconvenience.\n\nWe'll be back open tomorrow with everything you need! 🔧🎨\n\n— ${'{shop}'}`,
  },
  {
    label: '🎉 Special Offer',
    message: `Hi {name} 👋\n\n✨ *Special Offer!* ✨\n\nGet great discounts on paints, tools & hardware this week!\n\nVisit us before stock runs out! 🛠️\n\n— ${'{shop}'}`,
  },
  {
    label: '📦 New Stock Arrived',
    message: `Hi {name} 👋\n\nFresh stock has just arrived — new paints, tools & hardware supplies now available! 🎨🔩\n\nCome check it out today!\n\n— ${'{shop}'}`,
  },
  {
    label: '💳 Payment Reminder',
    message: `Hi {name} 👋\n\nThis is a gentle reminder about your pending balance at our shop.\n\nKindly visit us at your convenience to settle the account. Thank you! 🙏\n\n— ${'{shop}'}`,
  },
  {
    label: '🎊 Festive Greetings',
    message: `Hi {name} 👋\n\nWishing you and your family a joyful celebration! 🎊\n\nAs a token of our appreciation, enjoy a special discount on your next visit.\n\nPresent this message at the counter.\n\n— ${'{shop}'}`,
  },
  {
    label: '✍️ Custom Message',
    message: '',
  },
];

export function HardwareBroadcastPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Hardware Store');
  const hasApi   = !!(useAppStore(s => s.config?.settings?.wa_phone_id) && useAppStore(s => s.config?.settings?.wa_token));

  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [message, setMessage] = useState(TEMPLATES[0].message);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: recipients = [] } = useQuery({
    queryKey: ['hw-broadcast-recipients', tenantId],
    queryFn: () => listHwBroadcastRecipients(tenantId),
    enabled: !!tenantId,
  });

  const previewMsg = (name: string) =>
    message.replace(/{name}/g, name).replace(/{shop}/g, shopName);

  const handleTemplateSelect = (i: number) => {
    setSelectedTemplate(i);
    if (TEMPLATES[i].message) setMessage(TEMPLATES[i].message);
    setResult(null);
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Write a message first'); return; }
    if (recipients.length === 0) { toast.error('No customers with valid phone numbers'); return; }

    const confirmed = confirm(
      `Send this message to ${recipients.length} customers?\n\n` +
      (hasApi ? '✅ Will send automatically via WhatsApp Business API.' : '⚠️ Will open WhatsApp one-by-one (no API configured). This takes time.')
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    setProgress({ done: 0, total: recipients.length });

    const res = await sendWhatsAppBulk(
      recipients.map(c => ({ phone: c.phone, name: c.name })),
      (name) => previewMsg(name),
      (done, total) => setProgress({ done, total })
    );

    setSending(false);
    setResult(res);
    toast.success(`Broadcast done: ${res.sent} sent, ${res.failed} failed`);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" style={{ color: ACCENT }} /> Broadcast Message
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Send a WhatsApp message to all your customers at once</p>
      </div>

      {/* API status banner */}
      {!hasApi && (
        <div className="rounded-2xl p-4 flex items-start gap-3 bg-amber-50 border border-amber-100">
          <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">No WhatsApp Business API configured</p>
            <p className="mt-0.5">Messages will open WhatsApp Desktop one by one — you must tap Send each time. <strong>Go to Settings → WhatsApp Business API</strong> to enable automatic sending.</p>
          </div>
        </div>
      )}
      {hasApi && (
        <div className="rounded-2xl p-4 flex items-center gap-3 bg-green-50 border border-green-100">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
          <p className="text-sm font-semibold text-green-800">WhatsApp Business API connected — messages will send automatically</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Compose */}
        <div className="space-y-4">
          {/* Template picker */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Choose Template</p>
            <div className="space-y-1.5">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => handleTemplateSelect(i)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={selectedTemplate === i
                    ? { background: ACCENT, color: '#ffffff' }
                    : { background: '#f1f5f9', color: '#1e293b' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message editor */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
              Message <span className="font-normal normal-case text-slate-400">— use {'{name}'} for customer name</span>
            </p>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none resize-none bg-slate-50 text-slate-800"
              style={{ fontFamily: 'monospace' }}
              placeholder="Type your message here…" />
            <p className="text-xs mt-1 text-slate-400">{message.length} characters</p>
          </div>
        </div>

        {/* Right — Recipients + Preview */}
        <div className="space-y-4">
          {/* Recipients */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" style={{ color: ACCENT }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>Recipients</p>
              <span className="ml-auto text-sm font-bold text-slate-900">{recipients.length}</span>
            </div>
            <p className="text-sm text-slate-500">
              All customers (from bills & credit accounts) with a valid 10-digit phone number
            </p>
            {recipients.length === 0 && (
              <p className="text-xs mt-2 text-slate-400">No customers with phone numbers yet. They appear here after bills or credit accounts are created.</p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <p className="text-xs font-bold uppercase tracking-widest text-green-600">Preview</p>
            </div>
            <div className="rounded-xl p-3 text-sm whitespace-pre-wrap bg-green-50 text-green-900" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
              {previewMsg('Amit') || '(no message yet)'}
            </div>
          </div>

          {/* Progress / Result */}
          {sending && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-sm font-semibold mb-2 text-slate-800">Sending…</p>
              <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  background: '#25d366',
                }} />
              </div>
              <p className="text-xs mt-1.5 text-slate-400">
                {progress.done} of {progress.total} messages
              </p>
            </div>
          )}
          {result && !sending && (
            <div className={`rounded-2xl p-4 flex items-center gap-3 border ${result.failed === 0 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              {result.failed === 0
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-amber-600" />}
              <div>
                <p className={`text-sm font-bold ${result.failed === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                  {result.sent} sent{result.failed > 0 ? `, ${result.failed} failed` : ' successfully!'}
                </p>
                {result.failed > 0 && <p className="text-xs text-amber-700">Failed numbers may be invalid or unreachable.</p>}
              </div>
            </div>
          )}

          {/* Send button */}
          <button onClick={handleSend} disabled={sending || recipients.length === 0 || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base text-white disabled:opacity-40 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: '#25d366' }}>
            <Send className="h-5 w-5" />
            {sending ? 'Sending…' : `Send to ${recipients.length} customers`}
          </button>
        </div>
      </div>
    </div>
  );
}
