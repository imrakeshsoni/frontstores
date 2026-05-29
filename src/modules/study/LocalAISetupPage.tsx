// [study] [all tenants] — on-demand local AI install: system check, Ollama download, model pull
import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Download, Cpu, HardDrive, MemoryStick, Loader2, RefreshCw } from 'lucide-react';
import {
  getSystemInfo, checkLocalOllama, openOllamaDownloadPage, pullModel,
  recommendModel, MODEL_OPTIONS,
  type SystemInfo, type ModelRecommendation,
} from '@/lib/study/localAI';
import { resetLocalOllamaCache } from '@/lib/study/studyAI';

type Step = 'check' | 'install-ollama' | 'waiting-ollama' | 'pull-model' | 'done';

export function LocalAISetupPage() {
  const [sysInfo, setSysInfo]           = useState<SystemInfo | null>(null);
  const [loading, setLoading]           = useState(true);
  const [step, setStep]                 = useState<Step>('check');
  const [recommendation, setRec]        = useState<ModelRecommendation | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelRecommendation | null>(null);
  const [ollamaReady, setOllamaReady]   = useState(false);
  const [installedModel, setInstalledModel] = useState<string | null>(null);
  const [pullStatus, setPullStatus]     = useState('');
  const [pullPercent, setPullPercent]   = useState(0);
  const [pulling, setPulling]           = useState(false);
  const [error, setError]               = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [info, local] = await Promise.all([getSystemInfo(), checkLocalOllama()]);
        setSysInfo(info);
        if (local.available && local.model) {
          setInstalledModel(local.model);
          setOllamaReady(true);
          setStep('done');
        } else {
          const rec = recommendModel(info.total_ram_gb, info.free_disk_gb);
          setRec(rec);
          setSelectedModel(rec);
        }
      } catch (e: any) {
        setError('Could not read system info: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { pollRef.current && clearInterval(pollRef.current); };
  }, []);

  function canRun(m: ModelRecommendation): boolean {
    if (!sysInfo) return false;
    return sysInfo.total_ram_gb >= m.minRamGb && sysInfo.free_disk_gb >= m.minDiskGb;
  }

  async function handleInstallOllama() {
    setStep('install-ollama');
    await openOllamaDownloadPage();
    // Start polling after a short delay
    setTimeout(() => startPollingOllama(), 3000);
    setStep('waiting-ollama');
  }

  function startPollingOllama() {
    pollRef.current = setInterval(async () => {
      const { available } = await checkLocalOllama();
      if (available) {
        clearInterval(pollRef.current!);
        setOllamaReady(true);
        setStep('pull-model');
      }
    }, 3000);
  }

  async function handlePullModel() {
    if (!selectedModel) return;
    setPulling(true);
    setError('');
    abortRef.current = new AbortController();
    try {
      await pullModel(selectedModel.model, (p) => {
        setPullStatus(p.status);
        setPullPercent(p.percent);
        if (p.done) {
          setInstalledModel(selectedModel.model);
          resetLocalOllamaCache();
          setStep('done');
        }
      }, abortRef.current.signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError('Download failed: ' + e.message);
    } finally {
      setPulling(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Local AI Setup</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Install AI on this device. Once set up, AI works offline, faster, and uses zero server resources.
        </p>
      </div>

      {/* System Check Card */}
      {sysInfo && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Your System</p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<MemoryStick className="h-4 w-4" />} label="RAM"
              value={`${sysInfo.total_ram_gb.toFixed(1)} GB`}
              ok={sysInfo.total_ram_gb >= 4} note={`${sysInfo.available_ram_gb.toFixed(1)} GB free`} />
            <StatCard icon={<HardDrive className="h-4 w-4" />} label="Disk Free"
              value={`${sysInfo.free_disk_gb.toFixed(0)} GB`}
              ok={sysInfo.free_disk_gb >= 2} />
            <StatCard icon={<Cpu className="h-4 w-4" />} label="CPU"
              value={`${sysInfo.cpu_count} cores`}
              ok={sysInfo.cpu_count >= 4} note={sysInfo.os_name} />
          </div>
        </div>
      )}

      {/* Model Selection */}
      {step !== 'done' && sysInfo && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Choose AI Model</p>
          <div className="space-y-2">
            {MODEL_OPTIONS.map(m => {
              const ok = canRun(m);
              const isSelected = selectedModel?.model === m.model;
              const isRec = recommendation?.model === m.model;
              return (
                <button key={m.model} disabled={!ok}
                  onClick={() => ok && setSelectedModel(m)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:opacity-40"
                  style={isSelected
                    ? { background: 'var(--accent)', color: 'white' }
                    : { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{m.label}</span>
                      {isRec && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isSelected ? 'rgba(255,255,255,0.2)' : '#dcfce7', color: isSelected ? 'white' : '#16a34a' }}>Recommended</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                      {m.sizeGb} GB download · Quality: {m.quality} · Min {m.minRamGb}GB RAM
                    </p>
                  </div>
                  {ok ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Check → Install Ollama */}
      {(step === 'check') && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Step 1 — Install Ollama</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ollama is a free app that runs AI models locally on your device. Click below — it will open the download page in your browser. Install it, then come back here.
          </p>
          <button onClick={handleInstallOllama} disabled={!selectedModel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>
            <Download className="h-4 w-4" />
            Download & Install Ollama
          </button>
        </div>
      )}

      {/* Step: Waiting for Ollama */}
      {step === 'waiting-ollama' && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Waiting for Ollama…</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Install Ollama from the browser window that just opened. Once installed and running, this page will automatically continue.
          </p>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking every 3 seconds…
          </div>
          <button onClick={startPollingOllama}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
            <RefreshCw className="h-3.5 w-3.5" /> Check now
          </button>
        </div>
      )}

      {/* Step: Pull Model */}
      {step === 'pull-model' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Step 2 — Download AI Model</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ollama is running! Now download the AI model ({selectedModel?.sizeGb} GB). This is a one-time download.
          </p>
          {!pulling ? (
            <button onClick={handlePullModel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'var(--accent)' }}>
              <Download className="h-4 w-4" />
              Download {selectedModel?.label}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{pullStatus}</span>
                <span>{pullPercent}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pullPercent}%`, background: 'var(--accent)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Do not close the app during download…</p>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-sm text-green-800">Local AI is ready!</p>
              <p className="text-xs text-green-700 mt-0.5">
                Model: <strong>{installedModel}</strong> · Running on this device · Zero server load
              </p>
            </div>
          </div>
          <p className="text-sm text-green-700">
            Every AI feature in StudyMate now runs locally on your device. Faster responses, works offline, no internet needed for AI.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, ok, note }: {
  icon: React.ReactNode; label: string; value: string; ok: boolean; note?: string;
}) {
  return (
    <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        {icon}
        <span className="text-xs">{label}</span>
        {ok ? <CheckCircle className="h-3 w-3 text-green-500 ml-auto" /> : <XCircle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {note && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{note}</p>}
    </div>
  );
}
