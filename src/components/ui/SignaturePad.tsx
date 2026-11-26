'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { MAX_SIGNATURE_LENGTH } from '@/lib/signature-limits';

interface SignaturePadProps {
  /** Dipanggil dengan data URL PNG saat ada coretan, atau null bila kosong. */
  onChange: (dataUrl: string | null) => void;
  onUploadPendingChange?: (pending: boolean) => void;
  label?: string;
  height?: number;
}

/** Kanvas tanda tangan digital (mouse/sentuh/pena). Hasil berupa PNG transparan kecil. */
function DrawSignature({ onChange, label = 'Tanda tangan', height = 140 }: SignaturePadProps) {
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

const SIGNATURE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

async function readSignatureImage(file: File) {
  if (!SIGNATURE_IMAGE_TYPES.includes(file.type)) throw new Error('Pilih gambar PNG, JPG, atau WebP.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Ukuran gambar maksimal 10 MB.');

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Gambar tidak bisa dibuka. Coba pilih file lain.');
  });
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak dapat memproses gambar.');
    for (const [maxWidth, maxHeight] of [[960, 480], [640, 320], [320, 150]]) {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const value = canvas.toDataURL('image/png');
      if (value.length <= MAX_SIGNATURE_LENGTH) return value;
    }
    throw new Error('Gambar terlalu besar setelah diproses. Gunakan gambar yang lebih kecil.');
  } finally {
    bitmap.close();
  }
}

export function SignaturePad({ onChange, onUploadPendingChange, label = 'Tanda tangan', height }: SignaturePadProps) {
  const inputId = useId();
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const clear = () => {
    setPreview(null);
    setError('');
    onChange(null);
  };

  const pickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setPending(true);
    onUploadPendingChange?.(true);
    try {
      const value = await readSignatureImage(file);
      setPreview(value);
      onChange(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gambar tanda tangan gagal diproses.');
    } finally {
      setPending(false);
      onUploadPendingChange?.(false);
    }
  };

  return (
    <div className="space-y-2">
      <div role="group" aria-label={`Cara mengisi ${label}`} className="flex flex-wrap gap-2">
        {([['draw', 'Gambar langsung'], ['upload', 'Unggah gambar']] as const).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={pending}
            onClick={() => {
              if (mode === value) return;
              clear();
              setMode(value);
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${mode === value ? 'border-maroon-700 bg-maroon-50 text-maroon-800' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            {text}
          </button>
        ))}
      </div>
      {mode === 'draw' ? <DrawSignature onChange={onChange} label={label} height={height} /> : (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">{label}</label>
          <input
            id={inputId}
            type="file"
            accept={SIGNATURE_IMAGE_TYPES.join(',')}
            disabled={pending}
            onChange={pickImage}
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:font-semibold"
          />
          <p className="text-xs text-slate-500">PNG, JPG, atau WebP hingga 10 MB. Potong gambar hingga menyisakan area tanda tangan agar jelas saat dicetak.</p>
          {pending && <p role="status" className="text-xs text-slate-600">Memproses gambar...</p>}
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          {preview && (
            <div className="flex items-start justify-between gap-2">
              <img src={preview} alt="Pratinjau tanda tangan" className="max-h-28 min-w-0 object-contain" />
              <button type="button" onClick={clear} disabled={pending} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Hapus</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
