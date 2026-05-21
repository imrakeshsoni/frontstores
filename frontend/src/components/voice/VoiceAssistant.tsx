import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, X, Bot, Loader2, Volume2, AlertCircle, Settings } from 'lucide-react';
import { useAuthStore } from '@/app/store/auth.store';
import {
  fetchShopContext,
  sendToShopAI,
  synthesize,
  clearShopSession,
  getAIBackendURL,
  setAIBackendURL,
  pushCloudAIUrl,
  bootstrapAIUrl,
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
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(getAIBackendURL);
  const [urlSynced, setUrlSynced] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const micOnRef = useRef(false); // user intent: mic toggled on
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(SESSION_ID());

  // Load shop context + auto-configure AI URL when panel opens
  useEffect(() => {
    if (!open) return;
    if (!shopCtx) fetchShopContext().then(setShopCtx);
    // Auto-detect best AI URL (Mac server → cloud → localStorage)
    bootstrapAIUrl().then((url) => setUrlInput(url));
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

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  // Start one recognition instance; auto-restarts on silence if micOn
  const startRec = useCallback(() => {
    if (!micOnRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setErrorMsg('Voice not supported. Use Chrome.'); micOnRef.current = false; setStatus('error'); return; }

    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    setStatus('listening');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      rec.stop();
      processTranscriptRef.current(transcript);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        // Silence timeout — restart if mic is still on
        if (micOnRef.current) setTimeout(() => startRec(), 300);
      } else if (e.error !== 'aborted') {
        setErrorMsg(`Mic error: ${e.error}`);
        micOnRef.current = false;
        setStatus('error');
      }
    };
    rec.onend = () => {
      // If still in listening state and mic is on, restart (handles browser auto-stop)
      if (micOnRef.current && recRef.current === rec) setTimeout(() => startRec(), 300);
    };
    rec.start();
  }, []); // stable ref — deps managed via processTranscriptRef

  // Stable ref so startRec closure always calls latest processTranscript
  const processTranscriptRef = useRef<(t: string) => void>(() => {});

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) { if (micOnRef.current) startRec(); return; }
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
      audio.onended = () => {
        URL.revokeObjectURL(url);
        // Auto-restart listening after AI speaks if mic is still on
        if (micOnRef.current) { startRec(); } else { setStatus('idle'); }
      };
      audio.onerror = () => { if (micOnRef.current) startRec(); else setStatus('idle'); };
      audio.play().catch(() => { if (micOnRef.current) startRec(); else setStatus('idle'); });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error';
      setErrorMsg(msg);
      setStatus('error');
      micOnRef.current = false;
      setTurns((t) => [...t, { role: 'assistant', text: msg.includes('offline') ? 'The AI is offline. Please start it from the Samsung USB.' : 'Sorry, something went wrong. Please try again.' }]);
    }
  }, [shopCtx, voice, startRec]);

  // Keep ref in sync with latest callback
  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);

  // Toggle mic on/off
  const toggleMic = useCallback(() => {
    if (micOnRef.current) {
      // Turn off
      micOnRef.current = false;
      stopRec();
      stopAudio();
      abortRef.current?.abort();
      abortRef.current = null;
      setStatus('idle');
    } else {
      // Turn on
      micOnRef.current = true;
      setErrorMsg('');
      startRec();
    }
  }, [stopRec, stopAudio, startRec]);

  const handleClose = useCallback(() => {
    micOnRef.current = false;
    stopRec();
    stopAudio();
    abortRef.current?.abort();
    setStatus('idle');
    setOpen(false);
  }, [stopRec, stopAudio]);

  const handleClear = useCallback(() => {
    micOnRef.current = false;
    stopRec();
    stopAudio();
    abortRef.current?.abort();
    clearShopSession(sessionId.current);
    sessionId.current = SESSION_ID();
    setTurns([]);
    setErrorMsg('');
    setStatus('idle');
  }, [stopRec, stopAudio]);

  const micOn = status === 'listening' || status === 'thinking' || status === 'speaking';
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
                onClick={() => setShowSettings((s) => !s)}
                title="AI settings"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: showSettings ? 'var(--accent)' : 'var(--text-tertiary)', borderRadius: '6px' }}
              >
                <Settings className="h-4 w-4" />
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

          {/* Settings panel */}
          {showSettings && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                AI Backend URL
                {urlSynced === 'synced' && <span style={{ color: '#10b981', marginLeft: '6px', fontWeight: 400 }}>✓ synced to all devices</span>}
                {urlSynced === 'syncing' && <span style={{ color: '#f59e0b', marginLeft: '6px', fontWeight: 400 }}>syncing…</span>}
                {urlSynced === 'error' && <span style={{ color: '#ef4444', marginLeft: '6px', fontWeight: 400 }}>sync failed</span>}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                Auto-detected on start. "Sync" makes it available on all devices instantly.
              </p>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:3001"
                  style={{
                    flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '8px',
                    border: '1px solid var(--surface-border)', background: 'var(--surface)',
                    color: 'var(--text-primary)', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { setAIBackendURL(urlInput); setShowSettings(false); setErrorMsg(''); }}
                  style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', background: 'var(--surface-border)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>
              <button
                onClick={async () => {
                  setUrlSynced('syncing');
                  try {
                    await pushCloudAIUrl(urlInput);
                    setUrlSynced('synced');
                    setTimeout(() => setUrlSynced('idle'), 4000);
                  } catch { setUrlSynced('error'); }
                }}
                style={{ width: '100%', padding: '6px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Sync to all devices
              </button>
            </div>
          )}

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
          <div style={{ padding: '14px', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleMic}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: micOn ? '3px solid white' : 'none',
                cursor: 'pointer',
                background: statusColor(status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, box-shadow 0.2s',
                boxShadow: micOn
                  ? `0 0 0 6px ${statusColor(status)}40, 0 4px 16px rgba(0,0,0,0.2)`
                  : '0 2px 8px rgba(0,0,0,0.15)',
              }}
              title={micOn ? 'Click to turn mic off' : 'Click to turn mic on'}
            >
              {isBusy
                ? <Loader2 className="h-7 w-7 text-white animate-spin" />
                : micOn
                  ? <Mic className="h-7 w-7 text-white" />
                  : <MicOff className="h-7 w-7 text-white" />
              }
            </button>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
              {statusLabel(status)}{micOn && !isBusy && status !== 'listening' ? ' — mic on' : ''}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
