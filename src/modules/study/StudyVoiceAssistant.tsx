// [study] [all tenants] — StudyMate voice assistant
// Heart voice (Kokoro TTS), persistent mic, concise AI answers
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { speakText, stopSpeaking } from '@/lib/voice/shopAIService';

const SERVER  = 'https://update.frontstores.com';
const VOICE   = 'heart';
const SILENCE_THRESHOLD = 8;
const SILENCE_DURATION  = 750;   // ms quiet before sending
const MAX_DURATION      = 12000; // ms max recording per chunk

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

const CONCISE_SYSTEM = `You are StudyMate, a friendly voice tutor. Rules:
- Keep every answer SHORT: 2 to 3 spoken sentences maximum.
- Use simple everyday English, like a friend talking — not a textbook.
- No lists, no asterisks, no bullet points — just plain spoken sentences.
- If student asks for more explanation, give a tiny bit more, still brief.
- Be warm and encouraging. Never make them feel bad for not knowing.`;

async function sendToStudyAI(
  tenantId: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const messages = [
    { role: 'system', content: CONCISE_SYSTEM },
    ...history.slice(-6),
    { role: 'user', content: question },
  ];
  const res = await fetch(`${SERVER}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, messages, model: 'gemma3:4b' }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('AI unavailable');
  const data = await res.json() as { ok: boolean; content: string };
  return data.content ?? '';
}

async function transcribe(blob: Blob, mime: string): Promise<string> {
  const res = await fetch(`${SERVER}/ai/stt`, {
    method: 'POST',
    headers: { 'Content-Type': mime },
    body: blob,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json() as { ok: boolean; transcript?: string };
  return (data.transcript ?? '').trim();
}

export function StudyVoiceAssistant() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');

  const [status, setStatus]         = useState<Status>('idle');
  const [lastQ, setLastQ]           = useState('');
  const [lastA, setLastA]           = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [error, setError]           = useState('');

  const micOnRef   = useRef(false);
  const speakingRef = useRef(false);
  const recRef     = useRef<MediaRecorder | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // cleanup on unmount
  useEffect(() => () => {
    micOnRef.current = false;
    speakingRef.current = false;
    stopSpeaking();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  function showAnswer(q: string, a: string) {
    setLastQ(q); setLastA(a); setShowBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setShowBubble(false), 18000);
  }

  const startRec = useCallback(async () => {
    if (!micOnRef.current) return;
    setStatus('listening');
    setError('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setError('Microphone access denied');
      micOnRef.current = false;
      setStatus('idle');
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recRef.current = rec;

    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    rec.onstop = async () => {
      audioCtx.close();
      stream.getTracks().forEach(t => t.stop());
      if (!micOnRef.current) return;

      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 2500) { if (micOnRef.current) startRec(); return; }

      setStatus('thinking');
      try {
        const transcript = await transcribe(blob, mime);
        if (!transcript) { if (micOnRef.current) startRec(); return; }

        setLastQ(transcript);
        historyRef.current.push({ role: 'user', content: transcript });

        const answer = await sendToStudyAI(tenantId, transcript, historyRef.current);
        if (!answer) { if (micOnRef.current) startRec(); return; }

        historyRef.current.push({ role: 'assistant', content: answer });
        showAnswer(transcript, answer);

        if (!micOnRef.current) { setStatus('idle'); return; }
        setStatus('speaking');
        speakingRef.current = true;

        // Speak sentence by sentence
        const sentences = answer.match(/[^.!?]+[.!?]+/g) ?? [answer];
        for (const s of sentences) {
          if (!speakingRef.current || !micOnRef.current) break;
          await speakText(s.trim(), VOICE);
        }

        speakingRef.current = false;
        if (micOnRef.current) startRec(); else setStatus('idle');
      } catch {
        speakingRef.current = false;
        if (micOnRef.current) startRec(); else setStatus('idle');
      }
    };

    rec.start();

    let spokenOnce = false;
    let silenceStart = 0;
    const startTime = Date.now();

    const poll = setInterval(() => {
      if (!micOnRef.current || recRef.current !== rec) {
        clearInterval(poll);
        if (rec.state === 'recording') rec.stop();
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
        if (rec.state === 'recording') rec.stop();
        return;
      }

      if (now - startTime > MAX_DURATION) {
        clearInterval(poll);
        if (rec.state === 'recording') rec.stop();
      }
    }, 80);
  }, [tenantId]);

  function toggleMic() {
    if (micOnRef.current) {
      // Turn off
      micOnRef.current = false;
      speakingRef.current = false;
      stopSpeaking();
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStatus('idle');
    } else {
      // Turn on
      micOnRef.current = true;
      startRec();
    }
  }

  // Button color based on status
  const btnColor =
    status === 'listening' ? '#ef4444' :
    status === 'thinking'  ? '#f59e0b' :
    status === 'speaking'  ? '#10b981' :
    'var(--accent)';

  const btnLabel =
    status === 'listening' ? 'Listening…' :
    status === 'thinking'  ? 'Thinking…' :
    status === 'speaking'  ? 'Speaking…' :
    'Ask AI';

  const isActive = micOnRef.current || status !== 'idle';

  return createPortal(
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* Answer bubble */}
      {showBubble && (lastQ || lastA) && (
        <div
          style={{
            position: 'absolute', bottom: '72px', right: 0,
            width: '280px', borderRadius: '16px', padding: '14px',
            background: 'var(--surface, #1a3352)',
            border: `1px solid ${btnColor}30`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${btnColor}20`,
            animation: 'fadeInUp 0.2s ease',
          }}
        >
          {lastQ && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '6px', lineHeight: 1.4 }}>
              💬 {lastQ}
            </p>
          )}
          {lastA && (
            <p style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.55, fontWeight: 500 }}>
              {lastA}
            </p>
          )}
          <button
            onClick={() => setShowBubble(false)}
            style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Status label above button */}
      {isActive && (
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, color: btnColor,
            background: `${btnColor}18`, padding: '2px 10px', borderRadius: '20px',
          }}>
            {btnLabel}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* Main mic button */}
      <button
        onClick={toggleMic}
        title={isActive ? 'Click to stop voice' : 'Click to talk to AI'}
        style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: btnColor,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive
            ? `0 0 0 6px ${btnColor}30, 0 0 0 12px ${btnColor}15, 0 6px 20px rgba(0,0,0,0.4)`
            : `0 4px 16px rgba(0,0,0,0.3)`,
          transition: 'all 0.2s ease',
          transform: status === 'listening' ? 'scale(1.08)' : 'scale(1)',
          position: 'relative',
        }}
      >
        {/* Pulse rings when listening */}
        {status === 'listening' && (
          <>
            <span style={{
              position: 'absolute', inset: '-8px', borderRadius: '50%',
              border: `2px solid ${btnColor}`,
              animation: 'ping 1.2s ease-in-out infinite',
            }} />
            <span style={{
              position: 'absolute', inset: '-16px', borderRadius: '50%',
              border: `1.5px solid ${btnColor}`,
              animation: 'ping 1.2s ease-in-out infinite 0.4s',
            }} />
          </>
        )}

        {status === 'idle'      && <Mic size={22} color="#fff" />}
        {status === 'listening' && <Mic size={22} color="#fff" />}
        {status === 'thinking'  && (
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: '5px', height: '5px', borderRadius: '50%', background: '#fff',
                animation: `bounce 0.8s ease infinite ${i * 0.15}s`,
              }} />
            ))}
          </div>
        )}
        {status === 'speaking'  && <Volume2 size={22} color="#fff" />}
      </button>

      {/* Inline keyframes */}
      <style>{`
        @keyframes ping {
          0%   { transform: scale(1); opacity: 0.6; }
          80%  { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
