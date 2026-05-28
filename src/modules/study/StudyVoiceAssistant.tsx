// [study] [all tenants] — StudyMate voice assistant — draggable, custom AI avatar, heart voice
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Volume2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { speakText, stopSpeaking } from '@/lib/voice/shopAIService';
import { useQuery } from '@tanstack/react-query';
import { getStudyConfig } from '@/lib/db/study';

// Default AI avatar SVG — shown when no custom image is set
function DefaultAIFace({ size = 48, color = '#7dd3fc' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="face-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id="face-glow" cx="40%" cy="35%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="23" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      {/* Face */}
      <circle cx="24" cy="24" r="19" fill="url(#face-bg)" />
      <circle cx="24" cy="24" r="19" fill="url(#face-glow)" />
      {/* Eyes */}
      <ellipse cx="17" cy="22" rx="3.5" ry="2.5" fill="white" fillOpacity="0.95" />
      <ellipse cx="17" cy="22" rx="1.8" ry="1.4" fill={color} />
      <circle cx="16.2" cy="21.3" r="0.7" fill="white" />
      <ellipse cx="31" cy="22" rx="3.5" ry="2.5" fill="white" fillOpacity="0.95" />
      <ellipse cx="31" cy="22" rx="1.8" ry="1.4" fill={color} />
      <circle cx="30.2" cy="21.3" r="0.7" fill="white" />
      {/* Smile */}
      <path d="M17 29 Q24 33 31 29" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.9" />
      {/* Antenna */}
      <line x1="24" y1="5" x2="24" y2="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="24" cy="4" r="1.8" fill={color} fillOpacity="0.8" />
      {/* Sparkle */}
      <path d="M38 7 L38.4 8.6 L40 9 L38.4 9.4 L38 11 L37.6 9.4 L36 9 L37.6 8.6Z" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

const POS_KEY = 'studymate_voice_pos';
const BTN_SIZE = 56;

function getSavedPos(): { x: number; y: number } {
  try {
    const s = localStorage.getItem(POS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { x: window.innerWidth - BTN_SIZE - 24, y: window.innerHeight - BTN_SIZE - 24 };
}

function clamp(val: number, min: number, max: number) { return Math.max(min, Math.min(max, val)); }

const SERVER  = 'https://update.frontstores.com';
const VOICE   = 'heart';
const SILENCE_THRESHOLD = 8;
const SILENCE_DURATION  = 750;   // ms quiet before sending
const MAX_DURATION      = 12000; // ms max recording per chunk

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

function buildSystem(aiName: string, studentName: string | null): string {
  return `Your name is ${aiName}. You are a friendly voice tutor for ${studentName ? studentName : 'a student'}.
Rules:
- Keep every answer SHORT: 2 to 3 spoken sentences maximum.
- Use simple everyday English like a friend talking — not a textbook.
- No lists, no asterisks, no bullet points — just plain spoken sentences.
- Address the student by name (${studentName ?? 'friend'}) occasionally to feel personal.
- If student asks for more explanation, give a bit more but still brief.
- Be warm and encouraging. Never make them feel bad for not knowing.
- Always refer to yourself as ${aiName}.`;
}

async function sendToStudyAI(
  tenantId: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  aiName: string,
  studentName: string | null,
): Promise<string> {
  const messages = [
    { role: 'system', content: buildSystem(aiName, studentName) },
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
  const { data: studyConfig } = useQuery({
    queryKey: ['study-config', tenantId],
    queryFn:  () => getStudyConfig(tenantId),
    enabled:  !!tenantId,
  });
  const aiName   = studyConfig?.ai_name   ?? 'StudyMate';
  const aiAvatar = studyConfig?.ai_avatar ?? null;
  const accent   = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7dd3fc';

  const [status, setStatus]         = useState<Status>('idle');
  const [userText, setUserText]     = useState('');   // what user said (shown while thinking)
  const [aiText, setAiText]         = useState('');   // what AI said (shown while speaking)
  const [showBubble, setShowBubble] = useState(false);
  const [error, setError]           = useState('');

  const micOnRef    = useRef(false);
  const speakingRef = useRef(false);
  const recRef      = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const historyRef  = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────
  const [pos, setPos]       = useState<{ x: number; y: number }>(getSavedPos);
  const posRef              = useRef(pos);
  const dragInfo            = useRef({ active: false, startMX: 0, startMY: 0, startX: 0, startY: 0, moved: false });

  function onDragStart(clientX: number, clientY: number) {
    dragInfo.current = { active: true, startMX: clientX, startMY: clientY, startX: posRef.current.x, startY: posRef.current.y, moved: false };
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!dragInfo.current.active) return;
    const dx = clientX - dragInfo.current.startMX;
    const dy = clientY - dragInfo.current.startMY;
    if (!dragInfo.current.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    dragInfo.current.moved = true;
    const newX = clamp(dragInfo.current.startX + dx, 0, window.innerWidth  - BTN_SIZE);
    const newY = clamp(dragInfo.current.startY + dy, 0, window.innerHeight - BTN_SIZE);
    posRef.current = { x: newX, y: newY };
    setPos({ x: newX, y: newY });
  }

  function onDragEnd() {
    if (!dragInfo.current.active) return;
    dragInfo.current.active = false;
    localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
  }

  // Attach global mouse/touch listeners for drag
  useEffect(() => {
    function onMouseMove(e: MouseEvent) { onDragMove(e.clientX, e.clientY); }
    function onMouseUp()  { onDragEnd(); }
    function onTouchMove(e: TouchEvent) { if (e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY); }
    function onTouchEnd() { onDragEnd(); }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend',  onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onTouchEnd);
    };
  }, []);

  // cleanup on unmount
  useEffect(() => () => {
    micOnRef.current = false;
    speakingRef.current = false;
    stopSpeaking();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  function openBubble() {
    setShowBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }

  function closeBubbleAfter(ms: number) {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setShowBubble(false), ms);
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

        // Show what user said immediately
        setUserText(transcript);
        setAiText('');
        openBubble();
        historyRef.current.push({ role: 'user', content: transcript });

        const answer = await sendToStudyAI(tenantId, transcript, historyRef.current, aiName, studyConfig?.student_name ?? null);
        if (!answer) { if (micOnRef.current) startRec(); return; }

        historyRef.current.push({ role: 'assistant', content: answer });

        // Show AI answer in bubble
        setAiText(answer);
        closeBubbleAfter(20000);

        if (!micOnRef.current) { setStatus('idle'); return; }
        setStatus('speaking');
        speakingRef.current = true;

        const sentences = answer.match(/[^.!?।]+[.!?।]+/g) ?? [answer];
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
      micOnRef.current = false;
      speakingRef.current = false;
      stopSpeaking();
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStatus('idle');
      setShowBubble(false);
      setUserText('');
      setAiText('');
    } else {
      micOnRef.current = true;
      setUserText('');
      setAiText('');
      setShowBubble(true);
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

  // Decide bubble position: above button if enough space, else below
  const bubbleAbove = pos.y > 160;

  return createPortal(
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, userSelect: 'none' }}>
      {/* Answer bubble */}
      {showBubble && (
        <div
          style={{
            position: 'absolute',
            [bubbleAbove ? 'bottom' : 'top']: BTN_SIZE + 10,
            right: pos.x > window.innerWidth / 2 ? 0 : 'auto',
            left:  pos.x > window.innerWidth / 2 ? 'auto' : 0,
            width: '280px', borderRadius: '18px', padding: '14px 16px',
            background: 'var(--surface, #162a3d)',
            border: `1px solid ${btnColor}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${btnColor}25`,
            animation: 'fadeInUp 0.18s ease',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setShowBubble(false)}
            style={{ position: 'absolute', top: '8px', right: '10px', width: '20px', height: '20px',
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>

          {/* What user said */}
          {userText && (
            <div style={{ marginBottom: aiText ? '10px' : 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>You said</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>{userText}</p>
            </div>
          )}

          {/* Divider */}
          {userText && aiText && (
            <div style={{ height: '1px', background: `${btnColor}25`, margin: '8px 0' }} />
          )}

          {/* What AI said */}
          {aiText ? (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: btnColor, marginBottom: '4px', opacity: 0.9 }}>{aiName}</p>
              <p style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.55, fontWeight: 500 }}>{aiText}</p>
            </div>
          ) : status === 'thinking' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: btnColor, opacity: 0.9 }}>Thinking</p>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%',
                  background: btnColor, animation: `bounce 0.7s ease infinite ${i*0.15}s` }} />)}
              </div>
            </div>
          ) : null}
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

      {/* Main mic button — drag to move, click to toggle mic */}
      <button
        onMouseDown={e => { e.preventDefault(); onDragStart(e.clientX, e.clientY); }}
        onTouchStart={e => { if (e.touches[0]) onDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
        onClick={() => { if (!dragInfo.current.moved) toggleMic(); }}
        title={isActive ? 'Click to stop · Drag to move' : 'Click to talk · Drag to move'}
        style={{
          width: `${BTN_SIZE}px`, height: `${BTN_SIZE}px`, borderRadius: '50%',
          background: btnColor,
          border: 'none',
          cursor: dragInfo.current.active ? 'grabbing' : 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive
            ? `0 0 0 6px ${btnColor}30, 0 0 0 12px ${btnColor}15, 0 6px 20px rgba(0,0,0,0.4)`
            : `0 4px 16px rgba(0,0,0,0.3)`,
          transition: 'box-shadow 0.2s ease, background 0.2s ease',
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

        {/* Mic icon by default; custom avatar if set; dots when thinking */}
        {status === 'thinking' ? (
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff',
                animation: `bounce 0.8s ease infinite ${i*0.15}s` }} />
            ))}
          </div>
        ) : aiAvatar ? (
          <img src={aiAvatar} alt={aiName}
            style={{ width: BTN_SIZE, height: BTN_SIZE, borderRadius: '50%', objectFit: 'cover' }} />
        ) : status === 'speaking' ? (
          <Volume2 size={24} color="#fff" />
        ) : (
          <Mic size={24} color="#fff" />
        )}
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
