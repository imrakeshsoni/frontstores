// [all apps] [all tenants] — Voice AI assistant
// STT: Web Speech API | TTS: Web Speech Synthesis | Memory: SQLite per tenant
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X, Bot, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  checkAIAvailable,
  sendToAI,
  buildSystemPrompt,
  speakText,
  stopSpeaking,
  KOKORO_VOICES,
  DEFAULT_VOICE,
  AIStatus,
  AIMessage,
} from '@/lib/voice/shopAIService';
import {
  saveAIMessage,
  loadAIMemories,
  loadRecentHistory,
} from '@/lib/db/ai';

interface DisplayTurn {
  role: 'user' | 'assistant';
  text: string;
}

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
  return 'Tap mic to start';
}

export function VoiceAssistant() {
  const { config } = useAppStore();
  const tenantId = config?.tenant_id ?? '';
  const shopName = config?.shop_name ?? 'Your Store';
  const shopType = config?.shop_type ?? 'store';

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const selectedVoiceRef = useRef(DEFAULT_VOICE);

  // Full message history sent to LLM (includes system prompt + all turns)
  const historyRef = useRef<AIMessage[]>([]);
  const micOnRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`session_${Date.now()}`);

  // Auto-scroll conversation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  // Initialize session when panel opens
  useEffect(() => {
    if (!open || sessionReady || !tenantId) return;

    (async () => {
      // Check if AI is available
      const available = await checkAIAvailable();
      if (!available) {
        setErrorMsg('AI is not available right now. Please make sure the Mac server is running.');
        setStatus('error');
        setSessionReady(true);
        return;
      }

      // Load persistent memories and recent history
      const [memories, recentHistory] = await Promise.all([
        loadAIMemories(tenantId),
        loadRecentHistory(tenantId, 20),
      ]);

      // Build history: system prompt + recent history (context continuity)
      const systemPrompt = buildSystemPrompt(shopName, shopType, memories);
      historyRef.current = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
      ];

      // AI greeting
      const greeting = `Hi! I'm your personal AI assistant for ${shopName}. How can I help you today?`;
      setTurns([{ role: 'assistant', text: greeting }]);
      setStatus('speaking');
      await speakText(greeting, selectedVoiceRef.current);
      setStatus('idle');
      setSessionReady(true);
    })();
  }, [open, sessionReady, tenantId, shopName, shopType]);

  const streamRef = useRef<MediaStream | null>(null);

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // processTranscript needs to be in a ref so startRec closure always gets the latest version
  const processTranscriptRef = useRef<(t: string) => void>(() => {});

  // MediaRecorder + silence detection → Whisper STT
  // Replaces unreliable Web Speech API which doesn't work in Tauri WKWebView
  const startRec = useCallback(async () => {
    if (!micOnRef.current) return;
    setStatus('listening');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setErrorMsg('Microphone access denied.');
      micOnRef.current = false;
      setStatus('error');
      return;
    }

    // Silence detection via AudioContext analyser
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recRef.current = recorder as any;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = async () => {
      audioCtx.close();
      stream.getTracks().forEach(t => t.stop());
      if (!micOnRef.current) return;
      if (chunks.length === 0) { if (micOnRef.current) startRec(); return; }

      const blob = new Blob(chunks, { type: mime });
      // Minimum 0.3s of audio to bother sending
      if (blob.size < 3000) { if (micOnRef.current) startRec(); return; }

      try {
        const res = await fetch('https://update.frontstores.com/ai/stt', {
          method: 'POST',
          headers: { 'Content-Type': mime },
          body: blob,
        });
        const data = await res.json() as { ok: boolean; transcript?: string };
        const transcript = (data.transcript || '').trim();
        if (transcript) {
          processTranscriptRef.current(transcript);
        } else {
          if (micOnRef.current) startRec();
        }
      } catch {
        if (micOnRef.current) startRec();
      }
    };

    recorder.start();

    // Poll audio level — stop when user pauses for 1.5s after speaking
    let spokenOnce = false;
    let silenceStart = 0;
    const SILENCE_THRESHOLD = 10;
    const SILENCE_DURATION = 1500;
    const MAX_DURATION = 12000;
    const startTime = Date.now();

    const poll = setInterval(() => {
      if (!micOnRef.current || recRef.current !== recorder) {
        clearInterval(poll);
        if (recorder.state === 'recording') recorder.stop();
        return;
      }
      analyser.getByteFrequencyData(dataArr);
      const level = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
      const now = Date.now();

      if (level > SILENCE_THRESHOLD) {
        spokenOnce = true;
        silenceStart = now;
      } else if (spokenOnce && silenceStart && now - silenceStart > SILENCE_DURATION) {
        clearInterval(poll);
        if (recorder.state === 'recording') recorder.stop();
        return;
      }

      if (now - startTime > MAX_DURATION) {
        clearInterval(poll);
        if (recorder.state === 'recording') recorder.stop();
      }
    }, 100);
  }, []);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
      if (micOnRef.current) startRec();
      return;
    }

    setTurns(t => [...t, { role: 'user', text: transcript }]);
    setStatus('thinking');
    setErrorMsg('');

    // Add user message to history
    historyRef.current.push({ role: 'user', content: transcript });
    await saveAIMessage(tenantId, sessionId.current, 'user', transcript);

    abortRef.current = new AbortController();

    try {
      const response = await sendToAI(tenantId, historyRef.current, abortRef.current.signal);

      // Add AI response to history
      historyRef.current.push({ role: 'assistant', content: response });
      await saveAIMessage(tenantId, sessionId.current, 'assistant', response);

      setTurns(t => [...t, { role: 'assistant', text: response }]);
      setStatus('speaking');

      // Mic off while speaking — re-enable after
      await speakText(response, selectedVoiceRef.current);

      if (micOnRef.current) {
        startRec();
      } else {
        setStatus('idle');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg.includes('503') || msg.includes('unavailable')
        ? 'AI is not available right now. Make sure the Mac server is on.'
        : msg
      );
      setStatus('error');
      micOnRef.current = false;
    }
  }, [tenantId, startRec]);

  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);

  const toggleMic = useCallback(() => {
    if (micOnRef.current) {
      micOnRef.current = false;
      stopRec();
      stopSpeaking();
      abortRef.current?.abort();
      setStatus('idle');
    } else {
      if (!sessionReady) return;
      micOnRef.current = true;
      setErrorMsg('');
      startRec();
    }
  }, [stopRec, startRec, sessionReady]);

  const handleClose = useCallback(() => {
    micOnRef.current = false;
    stopRec();
    stopSpeaking();
    abortRef.current?.abort();
    setStatus('idle');
    setOpen(false);
    setSessionReady(false);
    setTurns([]);
    historyRef.current = [];
    sessionId.current = `session_${Date.now()}`;
  }, [stopRec]);

  const micOn = status === 'listening';
  const isBusy = status === 'thinking' || status === 'speaking';

  return createPortal(
    <>
      {/* Floating AI button — always visible */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '52px',
            height: '52px',
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
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Bot className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Voice panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '340px',
            maxHeight: '520px',
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--surface-border)',
            background: 'var(--surface-2)',
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                AI Assistant
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {shopName} · AI Assistant
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', borderRadius: '6px' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Voice picker */}
          <div style={{ position: 'relative', borderBottom: '1px solid var(--surface-border)' }}>
            <button
              onClick={() => setShowVoicePicker(v => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '12px',
              }}
            >
              <span>Voice: <strong style={{ color: 'var(--text-primary)' }}>
                {KOKORO_VOICES.find(v => v.id === selectedVoice)?.label ?? 'Heart'}
              </strong></span>
              <ChevronDown className="h-3.5 w-3.5" style={{ transform: showVoicePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {showVoicePicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 10,
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {KOKORO_VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVoice(v.id); selectedVoiceRef.current = v.id; setShowVoicePicker(false); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      background: selectedVoice === v.id ? 'var(--surface-2)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: selectedVoice === v.id ? 600 : 400, color: 'var(--text-primary)' }}>
                      {v.label}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            )}
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
              minHeight: '200px',
            }}
          >
            {!sessionReady && status !== 'error' && (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '40px' }}>
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" style={{ opacity: 0.5 }} />
                <p style={{ margin: 0 }}>Starting AI…</p>
              </div>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                style={{
                  alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
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
                <Loader2 className="h-3 w-3 animate-spin" />
                {status === 'thinking' ? 'Thinking…' : 'Speaking…'}
              </div>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', padding: '8px 14px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p style={{ margin: 0, fontSize: '11px', color: '#dc2626', lineHeight: 1.4 }}>{errorMsg}</p>
            </div>
          )}

          {/* Mic button */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleMic}
              disabled={!sessionReady || isBusy}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: 'none',
                cursor: (sessionReady && !isBusy) ? 'pointer' : 'default',
                background: statusColor(status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, box-shadow 0.2s',
                boxShadow: micOn
                  ? `0 0 0 8px ${statusColor(status)}30, 0 4px 16px rgba(0,0,0,0.2)`
                  : '0 2px 8px rgba(0,0,0,0.15)',
                opacity: (!sessionReady || isBusy) ? 0.7 : 1,
              }}
              title={micOn ? 'Click to stop listening' : 'Click to start speaking'}
            >
              {isBusy
                ? <Loader2 className="h-7 w-7 text-white animate-spin" />
                : micOn
                  ? <Mic className="h-7 w-7 text-white" />
                  : <MicOff className="h-7 w-7 text-white" />
              }
            </button>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
              {statusLabel(status)}
            </p>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
