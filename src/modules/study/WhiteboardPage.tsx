// [study] [all tenants]
import { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, Download, Pen, Eraser, Minus } from 'lucide-react';

type Tool = 'pen' | 'eraser';

const COLORS = ['#1e293b','#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2'];
const SIZES = [2, 4, 8, 14];

export function WhiteboardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1e293b');
  const [size, setSize] = useState(4);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef<{x:number;y:number}|null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, [drawing, tool, color, size]);

  const stopDraw = useCallback(() => { setDrawing(false); lastPos.current = null; }, []);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  };

  const download = () => {
    const canvas = canvasRef.current!;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `whiteboard-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)' }}>
        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🖊 Whiteboard</span>

        {/* Tool */}
        <div className="flex gap-1">
          {([['pen', <Pen className="h-4 w-4" />], ['eraser', <Eraser className="h-4 w-4" />]] as [Tool, React.ReactNode][]).map(([t, icon]) => (
            <button key={t} onClick={() => setTool(t)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
              style={tool === t ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen'); }}
              className="h-6 w-6 rounded-full border-2 transition-all"
              style={{ background: c, borderColor: color === c && tool === 'pen' ? '#7c3aed' : 'transparent' }} />
          ))}
        </div>

        {/* Sizes */}
        <div className="flex items-center gap-1.5">
          {SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)}
              className="flex items-center justify-center rounded-full transition-all"
              style={{ width: 24, height: 24, background: size === s ? 'var(--accent)' : 'var(--surface-2)' }}>
              <div className="rounded-full" style={{ width: s + 2, height: s + 2, background: size === s ? '#fff' : 'var(--text-tertiary)' }} />
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
            <Download className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={clear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" style={{ background: '#fff' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        />
      </div>

      <div className="px-4 py-2 text-xs text-center" style={{ color: 'var(--text-tertiary)', background: 'var(--surface)', borderTop: '1px solid var(--surface-border)' }}>
        Draw freely — works with mouse and touch · Save as PNG to keep your work
      </div>
    </div>
  );
}
