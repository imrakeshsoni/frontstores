// [carwash] [all tenants] — offline number plate OCR via Tesseract.js (local files + canvas preprocessing)
import { useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { toast } from 'sonner';

interface Props {
  onDetected: (plate: string) => void;
}

function extractPlate(raw: string): string {
  // Remove spaces, newlines, special chars — keep alphanumeric only
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Indian plate: 2 letters + 2 digits + 1-3 letters + 1-4 digits
  const match = clean.match(/[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}/);
  if (match) return match[0];
  // Fallback: return cleaned string if 6+ chars
  return clean.length >= 6 ? clean.slice(0, 12) : '';
}

// Preprocess image: grayscale + high contrast to help Tesseract
async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const originalUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale up small images; cap large ones
      const scale = Math.min(3, Math.max(1, 1200 / img.width));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;

      // Draw scaled image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to grayscale + boost contrast
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // High contrast: push toward black or white
        const contrasted = gray > 128 ? Math.min(255, gray * 1.4) : Math.max(0, gray * 0.6);
        data[i] = data[i + 1] = data[i + 2] = contrasted;
      }
      ctx.putImageData(imageData, 0, 0);

      URL.revokeObjectURL(originalUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = originalUrl;
  });
}

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;

async function getWorker() {
  if (workerInstance) return workerInstance;
  workerInstance = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/tesseract-core-lstm.wasm.js',
    langPath: '/tesseract',
    logger: () => {},
    cacheMethod: 'none',
  });
  await workerInstance.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    tessedit_pageseg_mode: '6' as any, // uniform block of text
  });
  return workerInstance;
}

export function NumberPlateScanner({ onDetected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  async function handleImage(file: File) {
    setScanning(true);
    try {
      const processedDataUrl = await preprocessImage(file);
      const worker = await getWorker();
      const { data } = await worker.recognize(processedDataUrl);

      console.log('[PlateScanner] raw OCR:', JSON.stringify(data.text));

      const plate = extractPlate(data.text);
      if (plate.length >= 6) {
        onDetected(plate);
        toast.success(`Plate detected: ${plate}`);
      } else {
        toast.error(`Could not read plate clearly. Raw: "${data.text.trim().slice(0, 30)}"`);
      }
    } catch (err) {
      console.error('OCR error:', err);
      toast.error('Scan failed — check console for details');
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        title="Scan number plate from photo"
        className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all"
        style={{
          background: scanning ? 'var(--surface-2)' : 'linear-gradient(135deg, #1e40af, #2563eb)',
          borderColor: '#3b82f6',
          color: scanning ? 'var(--text-secondary)' : 'white',
        }}
      >
        {scanning ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Scanning…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Scan Plate
          </>
        )}
      </button>
    </>
  );
}
