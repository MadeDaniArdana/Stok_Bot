'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SliderPhoto {
  url: string;
  label: string;
}

/** Tambahkan ?w= agar server mengirim versi kecil (lihat lib/proof-response.ts). */
export const withWidth = (url: string, width: number) => `${url}${url.includes('?') ? '&' : '?'}w=${width}`;

/**
 * Slider foto: geser dengan jari/trackpad (scroll-snap native) atau tombol panah.
 * Foto di luar layar baru dimuat (lazy) dan memakai versi kecil sesuai `width`.
 */
export function PhotoSlider({
  photos,
  width,
  alt,
  className = 'aspect-[4/3]',
  fit = 'object-cover',
  onSlideClick,
  startIndex = 0,
  onIndexChange,
}: {
  photos: SliderPhoto[];
  width: number;
  alt: string;
  className?: string;
  fit?: 'object-cover' | 'object-contain';
  onSlideClick?: (index: number) => void;
  startIndex?: number;
  onIndexChange?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const el = track.current;
    if (el && startIndex > 0) el.scrollTo({ left: startIndex * el.clientWidth });
  }, [startIndex]);

  const go = (delta: number) => track.current?.scrollBy({ left: delta * track.current.clientWidth, behavior: 'smooth' });

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      <div
        ref={track}
        onScroll={(event) => {
          const next = Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth);
          if (next !== index) {
            setIndex(next);
            onIndexChange?.(next);
          }
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => onSlideClick?.(i)}
            className="relative h-full w-full shrink-0 snap-center"
            aria-label={`${alt}: ${photo.label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withWidth(photo.url, width)} alt={`${alt}: ${photo.label}`} loading="lazy" decoding="async" className={`h-full w-full ${fit}`} />
            {photos.length > 1 && (
              <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{photo.label}</span>
            )}
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Foto sebelumnya" className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Foto berikutnya" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{index + 1}/{photos.length}</span>
        </>
      )}
    </div>
  );
}
