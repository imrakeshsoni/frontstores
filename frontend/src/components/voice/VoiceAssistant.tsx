import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, X, Bot, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/app/store/auth.store';
import {
  fetchShopContext,
  sendToShopAI,
  synthesize,
  clearShopSession,
  ShopContext,
  AIStatus,
  AITurn,
} from '@/lib/voice/shopAIService';

const SESSION_ID = () => `shop-${useAuthStore.getState().activeShopId ?? 'default'}`;

type VoiceName = 'heart' | 'bella' | 'emma' | 'nicole' | 'nova';

const VOICE_OPTIONS: { id: VoiceName; label: string }[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'bella', label: 'Bella' },
  { id: 'emma', label: 'Emma' },
  { id: 'nicole', label: 'Nicole' },
  { id: 'nova', label: 'Nova' },
];

function statusColor(s: AIStatus) {
  if (s === 'listening') return '#ef4444';
  if (s === 'thinking') return '#f59e0b';
  if (s === 'speaking') return '#10b981';
  if (s === 'error') return '#6b7280';
  return 'var(--accent)';
}

function statusLabel(s: AIStatus) {
  if (s === 'listening') return 'Listening…';
  if (s === 'thinking') return 'Thinking…';
  if (s === 'speaking') return 'Speaking…';
  if (s === 'error') return 'AI offline';
  return 'Tap to speak';
}

export function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [turns, setTurns] = useState<AITurn[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [voice, setVoice] = useState<VoiceName>('heart');
  const [shopCtx, setShopCtx] = useState<ShopContext | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(SESSION_ID());

  // Load shop context once when panel opens
  useEffect(() => {
    if (open && !shopCtx) {
      fetchShopContext().then(setShopCtx);
    }
  }, [open, shopCtx]);

  // Auto-scroll conversation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    audioRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopAudio();
    stopListening();
    setStatus('idle');
  }, [stopAudio, stopListening]);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setTurns((t) => [...t, { role: 'user', text: transcript }]);
    setStatus('thinking');
    setErrorMsg('');

    const ctx = shopCtx ?? await fetchShopContext();
    abortRef.current = new AbortController();

    try {
      const text = await sendToShopAI(transcript, sessionId.current, ctx, undefined, abortRef.current.signal);
      setTurns((t) => [...t, { role: 'assistant', text }]);
      setStatus('speaking');

      const url = await synthesize(text, voice, abortRef.current.signal);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setStatus('idle'); };
      audio.onerror = () => { setStatus('idle'); };
      audio.play().catch(() => setStatus('idle'));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error';
      setErrorMsg(msg);
      setStatus('error');
      setTurns((t) => [...t, { role: 'assistant', text: `Sorry, ${msg.includes('offline') ? 'the AI is offline. Please start it from the Samsung USB.' : 'something went wrong. Please try again.'}` }]);
    }
  }, [shopCtx, voice]);

  const startListening = useCallback(() => {
    if (status !== 'idle') { abort(); return; }

    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      setErrorMsg('Voice input not supported. Use Chrome or Edge.');
      setStatus('error');
      return;
    }

    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    setStatus('listening');

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      processTranscript(transcript);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') { setErrorMsg(`Mic: ${e.error}`); setStatus('error'); }
    };
    rec.onend = () => {
      if (status === 'listening') setStatus('idle');
    };
    rec.start();
  }, [status, abort, processTranscript]);

  const handleClose = useCallback(() => {
    abort();
    setOpen(false);
  }, [abort]);

  const handleClear = useCallback(() => {
    abort();
    clearShopSession(sessionId.current);
    sessionId.current = SESSION_ID();
    setTurns([]);
    setErrorMsg('');
    setStatus('idle');
  }, [abort]);

  const isBusy = status === 'thinking' || status === 'speaking';

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Voice Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Bot className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '360px',
            maxHeight: '540px',
            borderRadius: '20px',
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              borderBottom: '1px solid var(--surface-border)',
              background: 'var(--surface-2)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Shop Assistant
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Private · Local AI · {shopCtx?.shopName ?? '…'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleClear}
                title="New conversation"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', borderRadius: '6px' }}
              >
                <MicOff className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                title="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', borderRadius: '6px' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Voice selector */}
          <div style={{ display: 'flex', gap: '6px', padding: '8px 14px', borderBottom: '1px solid var(--surface-border)', overflowX: 'auto' }}>
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                style={{
                  flexShrink: 0,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: '1px solid',
                  cursor: 'pointer',
                  background: voice === v.id ? 'var(--accent)' : 'transparent',
                  borderColor: voice === v.id ? 'var(--accent)' : 'var(--surface-border)',
                  color: voice === v.id ? 'white' : 'var(--text-secondary)',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Conversation */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: '180px',
            }}
          >
            {turns.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '24px' }}>
                <Volume2 className="h-8 w-8 mx-auto mb-2" style={{ opacity: 0.3 }} />
                <p style={{ margin: 0 }}>Tap the mic and say something.</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>"Add 50 paracetamol to stock"</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px' }}>"How much Combiflam is left?"</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px' }}>"What are low stock items?"</p>
              </div>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                style={{
                  alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: turn.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: turn.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                  color: turn.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: '13px',
                  lineHeight: '1.45',
                }}
              >
                {turn.text}
              </div>
            ))}
            {isBusy && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {status === 'thinking' ? 'Thinking…' : 'Speaking…'}
              </div>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 14px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p style={{ margin: 0, fontSize: '11px', color: '#dc2626' }}>{errorMsg}</p>
            </div>
          )}

          {/* Mic button */}
          <div style={{ padding: '14px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={isBusy ? abort : startListening}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: statusColor(status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, transform 0.1s',
                boxShadow: status === 'listening' ? `0 0 0 8px ${statusColor(status)}30` : '0 2px 8px rgba(0,0,0,0.15)',
                transform: status === 'listening' ? 'scale(1.05)' : 'scale(1)',
              }}
              title={isBusy ? 'Stop' : 'Start speaking'}
            >
              {isBusy
                ? <Loader2 className="h-7 w-7 text-white animate-spin" />
                : status === 'listening'
                  ? <Mic className="h-7 w-7 text-white" />
                  : <Mic className="h-7 w-7 text-white" />
              }
            </button>
          </div>

          {/* Status label */}
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 12px', letterSpacing: '0.02em' }}>
            {statusLabel(status)}
          </p>
        </div>
      )}
    </>
  );
}
