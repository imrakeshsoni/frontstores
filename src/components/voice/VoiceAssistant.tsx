// [all apps] [all tenants] — AI assistant: voice + text, streaming TTS, barge-in support
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X, Loader2, AlertCircle, ChevronDown, Send } from 'lucide-react';

function AIWomanIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="orb" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer glow pulse ring */}
      <circle cx="12" cy="12" r="11.5" stroke="url(#orb)" strokeWidth="0.5" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="9.5" stroke="white" strokeWidth="0.3" strokeOpacity="0.2" />
      {/* Core orb */}
      <circle cx="12" cy="12" r="8.5" fill="url(#orb)" />
      {/* Inner glow highlight */}
      <ellipse cx="10" cy="9" rx="4" ry="3" fill="url(#glow)" />
      {/* Left eye */}
      <ellipse cx="9.5" cy="11.5" rx="1.6" ry="1.1" fill="white" fillOpacity="0.95" />
      <ellipse cx="9.5" cy="11.5" rx="0.7" ry="0.5" fill="#6366f1" />
      <circle cx="9.1" cy="11.2" r="0.3" fill="white" />
      {/* Right eye */}
      <ellipse cx="14.5" cy="11.5" rx="1.6" ry="1.1" fill="white" fillOpacity="0.95" />
      <ellipse cx="14.5" cy="11.5" rx="0.7" ry="0.5" fill="#6366f1" />
      <circle cx="14.1" cy="11.2" r="0.3" fill="white" />
      {/* Smile */}
      <path d="M9.5 14 Q12 15.5 14.5 14" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" strokeOpacity="0.9" />
      {/* Sparkle top-right */}
      <path d="M19 3.5 L19.3 4.5 L20.3 4.8 L19.3 5.1 L19 6.1 L18.7 5.1 L17.7 4.8 L18.7 4.5Z" fill="white" fillOpacity="0.9" />
      {/* Sparkle left */}
      <path d="M3.5 10 L3.7 10.7 L4.4 10.9 L3.7 11.1 L3.5 11.8 L3.3 11.1 L2.6 10.9 L3.3 10.7Z" fill="white" fillOpacity="0.7" />
    </svg>
  );
}
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
import { getCustomerBalance } from '@/lib/db/khata';
import { detectIntent, startFlow, handleFlowStep, detectDataQuery, handleDataQuery, FlowName, FlowContext } from '@/lib/voice/aiFlows';

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
  if (s === 'listening') return 'Listening… (tap to stop)';
  if (s === 'thinking') return 'Thinking…';
  if (s === 'speaking') return 'Speaking… (tap mic to interrupt)';
  if (s === 'error') return 'AI offline';
  return 'Tap mic to speak';
}

// Split response into speakable sentences for streaming TTS
function splitSentences(text: string): string[] {
  return text
    .replace(/<TOOL>[\s\S]*?<\/TOOL>/g, '')
    .split(/(?<=[।.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function VoiceAssistant() {
  const { config, lastBilledCustomer, setLastBilledCustomer } = useAppStore();
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
  const [textInput, setTextInput] = useState('');
  const selectedVoiceRef = useRef(DEFAULT_VOICE);
  const activeFlowRef = useRef<FlowName | null>(null);
  const flowCtxRef = useRef<FlowContext>({ step: 0 });

  const historyRef = useRef<AIMessage[]>([]);
  const initStartedRef = useRef(false);
  const micOnRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(`session_${Date.now()}`);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  // Initialize session when panel opens — ref guard prevents StrictMode double-fire
  useEffect(() => {
    if (!open || sessionReady || initStartedRef.current || !tenantId) return;
    initStartedRef.current = true;

    (async () => {
      const available = await checkAIAvailable();
      if (!available) {
        setErrorMsg('AI is not available right now. Please make sure the Mac server is running.');
        setStatus('error');
        setSessionReady(true);
        return;
      }

      const [memories, recentHistory] = await Promise.all([
        loadAIMemories(tenantId),
        loadRecentHistory(tenantId, 20),
      ]);

      const systemPrompt = buildSystemPrompt(shopName, shopType, memories);
      historyRef.current = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
      ];
      activeFlowRef.current = null;
      flowCtxRef.current = { step: 0 };

      const greeting = `Namaste! Main ${shopName} ka AI assistant hoon. Kya karna hai aapko?`;
      setTurns([{ role: 'assistant', text: greeting }]);
      setStatus('speaking');
      isSpeakingRef.current = true;
      await speakText(greeting, selectedVoiceRef.current);
      isSpeakingRef.current = false;
      setStatus('idle');
      setSessionReady(true);
    })();
  }, [open, sessionReady, tenantId, shopName, shopType]);

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const processTranscriptRef = useRef<(t: string) => void>(() => {});

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

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recRef.current = recorder as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = async () => {
      audioCtx.close();
      stream.getTracks().forEach(t => t.stop());
      if (!micOnRef.current) return;
      if (chunks.length === 0) { if (micOnRef.current) startRec(); return; }

      const blob = new Blob(chunks, { type: mime });
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

    let spokenOnce = false;
    let silenceStart = 0;
    const SILENCE_THRESHOLD = 8;
    const SILENCE_DURATION = 700;
    const MAX_DURATION = 10000;
    const startTime = Date.now();

    const poll = setInterval(() => {
      // Barge-in: if mic is on while AI is speaking, stop AI and listen
      if (isSpeakingRef.current && micOnRef.current) {
        analyser.getByteFrequencyData(dataArr);
        const level = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        if (level > SILENCE_THRESHOLD) {
          stopSpeaking();
          isSpeakingRef.current = false;
          abortRef.current?.abort();
        }
      }

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

  // Speak response sentence by sentence (streaming TTS) while adding to display
  const speakStreaming = useCallback(async (text: string): Promise<void> => {
    const sentences = splitSentences(text);
    if (!sentences.length) return;

    setStatus('speaking');
    isSpeakingRef.current = true;

    for (const sentence of sentences) {
      if (!isSpeakingRef.current) break; // barge-in stopped us
      await speakText(sentence, selectedVoiceRef.current);
    }

    isSpeakingRef.current = false;
  }, []);

  const reply = useCallback(async (text: string) => {
    setTurns(t => [...t, { role: 'assistant', text }]);
    historyRef.current.push({ role: 'assistant', content: text });
    await saveAIMessage(tenantId, sessionId.current, 'assistant', text);
    await speakStreaming(text);
    if (micOnRef.current) startRec(); else setStatus('idle');
  }, [tenantId, speakStreaming, startRec]);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) { if (micOnRef.current) startRec(); return; }

    stopSpeaking();
    isSpeakingRef.current = false;

    setTurns(t => [...t, { role: 'user', text: transcript }]);
    setStatus('thinking');
    setErrorMsg('');
    historyRef.current.push({ role: 'user', content: transcript });
    await saveAIMessage(tenantId, sessionId.current, 'user', transcript);

    // ── Flow engine: structured intent handling ────────────────────────────
    try {
      // Check if currently inside a flow
      if (activeFlowRef.current) {
        const result = await handleFlowStep(activeFlowRef.current, flowCtxRef.current, transcript, tenantId);
        if (result.retry) {
          await reply(result.say);
        } else if (result.done) {
          activeFlowRef.current = null;
          flowCtxRef.current = { step: 0 };
          await reply(result.say);
        } else {
          if (result.newContext) flowCtxRef.current = { ...flowCtxRef.current, ...result.newContext };
          await reply(result.say);
        }
        return;
      }

      // Check for direct data queries (no LLM needed)
      const dataQuery = detectDataQuery(transcript);
      if (dataQuery) {
        const answer = await handleDataQuery(dataQuery, tenantId);
        await reply(answer);
        return;
      }

      // Check for new intent
      const intent = detectIntent(transcript);
      if (intent) {
        activeFlowRef.current = intent;
        flowCtxRef.current = { step: 0, fresh: true };
        const { say, ctx } = await startFlow(intent, transcript);
        flowCtxRef.current = ctx;
        await reply(say);
        return;
      }
    } catch (flowErr) {
      activeFlowRef.current = null;
      flowCtxRef.current = { step: 0 };
      console.error('Flow error:', flowErr);
      // Fall through to LLM
    }

    // ── Fallback: free-form LLM for Q&A ───────────────────────────────────
    abortRef.current = new AbortController();
    try {
      const response = await sendToAI(tenantId, historyRef.current, abortRef.current.signal);
      historyRef.current.push({ role: 'assistant', content: response });
      await saveAIMessage(tenantId, sessionId.current, 'assistant', response);
      setTurns(t => [...t, { role: 'assistant', text: response }]);
      await speakStreaming(response);
      if (micOnRef.current) startRec(); else setStatus('idle');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg.includes('503') || msg.includes('unavailable')
        ? 'AI not available. Make sure the Mac server is on.'
        : msg
      );
      setStatus('error');
      micOnRef.current = false;
    }
  }, [tenantId, startRec, speakStreaming, reply]);

  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);

  // [medical] [all tenants] — post-bill khata reminder
  useEffect(() => {
    if (!lastBilledCustomer?.id || !tenantId || !sessionReady) return;
    const customerId = lastBilledCustomer.id;
    const customerName = lastBilledCustomer.name ?? 'Customer';
    setLastBilledCustomer(null);

    (async () => {
      try {
        const balance = await getCustomerBalance(tenantId, customerId);
        if (balance > 0) {
          const msg = `${customerName} ka ₹${balance.toFixed(0)} abhi bhi baki hai.`;
          setTurns(t => [...t, { role: 'assistant', text: msg }]);
          isSpeakingRef.current = true;
          await speakText(msg, selectedVoiceRef.current);
          isSpeakingRef.current = false;
        }
      } catch { /* silent */ }
    })();
  }, [lastBilledCustomer, tenantId, sessionReady, setLastBilledCustomer]);

  const handleSendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || !sessionReady) return;
    setTextInput('');
    await processTranscript(text);
  }, [textInput, sessionReady, processTranscript]);

  const toggleMic = useCallback(() => {
    if (micOnRef.current) {
      micOnRef.current = false;
      stopRec();
      stopSpeaking();
      isSpeakingRef.current = false;
      abortRef.current?.abort();
      setStatus('idle');
    } else {
      // Barge-in: if AI is speaking, interrupt it and start listening
      if (isSpeakingRef.current) {
        stopSpeaking();
        isSpeakingRef.current = false;
        abortRef.current?.abort();
      }
      if (!sessionReady) return;
      micOnRef.current = true;
      setErrorMsg('');
      startRec();
    }
  }, [stopRec, startRec, sessionReady]);

  const handleClose = useCallback(() => {
    micOnRef.current = false;
    initStartedRef.current = false;
    stopRec();
    stopSpeaking();
    isSpeakingRef.current = false;
    abortRef.current?.abort();
    setStatus('idle');
    setOpen(false);
    setSessionReady(false);
    setTurns([]);
    historyRef.current = [];
    activeFlowRef.current = null;
    flowCtxRef.current = { step: 0 };
    sessionId.current = `session_${Date.now()}`;
  }, [stopRec]);

  const isBusy = status === 'thinking';
  const micOn = status === 'listening';

  return createPortal(
    <>
      {/* Floating AI button */}
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
            background: 'linear-gradient(135deg, #6366f1 0%, #1d4ed8 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 24px rgba(99,102,241,0.55)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <AIWomanIcon size={24} />
        </button>
      )}

      {/* AI panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '360px',
            maxHeight: '560px',
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
              background: 'linear-gradient(135deg, #6366f1 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AIWomanIcon size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                AI Assistant
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {statusLabel(status)}
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
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '11px',
              }}
            >
              <span>Voice: <strong style={{ color: 'var(--text-primary)' }}>
                {KOKORO_VOICES.find(v => v.id === selectedVoice)?.label ?? 'Heart'}
              </strong></span>
              <ChevronDown className="h-3 w-3" style={{ transform: showVoicePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
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
                maxHeight: '180px',
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
                      padding: '7px 14px',
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
                Thinking…
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

          {/* Input row: text + mic */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              ref={textInputRef}
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
              placeholder="Type a message…"
              disabled={!sessionReady || isBusy}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid var(--surface-border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                opacity: (!sessionReady || isBusy) ? 0.6 : 1,
              }}
            />
            {/* Send button */}
            <button
              onClick={handleSendText}
              disabled={!sessionReady || isBusy || !textInput.trim()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                cursor: (sessionReady && !isBusy && textInput.trim()) ? 'pointer' : 'default',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: (!sessionReady || isBusy || !textInput.trim()) ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <Send className="h-4 w-4 text-white" />
            </button>
            {/* Mic button */}
            <button
              onClick={toggleMic}
              disabled={!sessionReady && !isSpeakingRef.current}
              title={micOn ? 'Stop listening' : status === 'speaking' ? 'Interrupt AI' : 'Speak'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: statusColor(status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s',
                boxShadow: micOn
                  ? `0 0 0 6px ${statusColor(status)}30, 0 2px 8px rgba(0,0,0,0.15)`
                  : '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              {isBusy
                ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                : micOn
                  ? <Mic className="h-4 w-4 text-white" />
                  : <MicOff className="h-4 w-4 text-white" />
              }
            </button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
