'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  /** Dipanggil dengan data URL PNG saat ada coretan, atau null bila kosong. */
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
}

/** Kanvas tanda tangan digital (mouse/sentuh/pena). Hasil berupa PNG transparan kecil. */
export function SignaturePad({ onChange, label = 'Tanda tangan', height = 140 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.parentElement?.clientWidth ?? 320;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [height]);

  useEffect(() => {
    setup();
  }, [setup]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
    const ctx = event.currentTarget.getContext('2d');
    const p = last.current;
    // Titik tunggal tetap tergambar.
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
    ctx?.lineTo(p.x + 0.01, p.y + 0.01);
    ctx?.stroke();
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = event.currentTarget.getContext('2d');
    const p = point(event);
    ctx?.beginPath();
    ctx?.moveTo(last.current.x, last.current.y);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    last.current = p;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setEmpty(false);
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden="true" /> Hapus
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="block touch-none"
          aria-label={label}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-300">
            Goreskan tanda tangan di sini
          </span>
        )}
      </div>
    </div>
  );
}
