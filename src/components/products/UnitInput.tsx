'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { getProductUnitOptions, normalizeProductUnit } from '@/lib/product-units';

interface UnitInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function UnitInput({ id, value, onChange, disabled = false }: UnitInputProps) {
  const [options, setOptions] = useState(() => getProductUnitOptions([]));
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const expanded = open && !disabled;
  const normalized = normalizeProductUnit(value);
  const search = normalizeProductUnit(query || '');
  const choices = options.filter((option) => option.includes(search)).map((option) => ({ value: option, isNew: false }));
  if (query !== null && normalized && !options.includes(normalized)) {
    choices.push({ value: normalized, isNew: true });
  }
  const activeOption = choices[activeIndex];

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const choose = (unit: string) => {
    onChange(unit);
    close();
  };

  useEffect(() => {
    if (expanded) listRef.current?.children.item(activeIndex)?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex, choices.length]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products/units', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setOptions(getProductUnitOptions(data.items || []));
      })
      .catch(() => { /* Satuan tetap bisa diketik saat saran tidak tersedia. */ });
    return () => controller.abort();
  }, []);

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        onChange(normalized);
        close();
      }
    }}>
      <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        aria-activedescendant={expanded && activeOption ? `${id}-option-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setQuery(null);
          setOpen(true);
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const lastIndex = Math.max(0, choices.length - 1);
            setActiveIndex((previous) => event.key === 'ArrowDown'
              ? (expanded ? Math.min(previous + 1, lastIndex) : 0)
              : (expanded ? Math.max(previous - 1, 0) : lastIndex));
          } else if (event.key === 'Enter' && expanded) {
            event.preventDefault();
            if (activeOption) choose(activeOption.value);
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === 'Tab') {
            close();
          }
        }}
        disabled={disabled}
        required
        autoComplete="off"
        aria-describedby={`${id}-hint`}
        placeholder="Pilih atau ketik satuan..."
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-slate-50"
      />
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </div>
      {expanded && (
        <ul ref={listRef} id={`${id}-options`} role="listbox" aria-label="Pilihan satuan" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-slate-700 shadow-lg">
          {choices.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-xs text-slate-500">Ketik satuan yang ingin digunakan.</li>
          ) : choices.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={!option.isNew && option.value === normalized}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option.value)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${index === activeIndex ? 'bg-maroon-50 text-maroon-900' : 'text-slate-700'}`}
            >
              {option.isNew ? (
                <span className="inline-flex min-w-0 items-center gap-2"><Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="break-words">Gunakan “{option.value}”</span></span>
              ) : <span>{option.value}</span>}
              {!option.isNew && option.value === normalized && <Check className="h-4 w-4 shrink-0 text-maroon-800" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-hint`} className="mt-1 text-[11px] text-slate-500">Pilih satuan atau ketik sendiri. Boleh menyertakan ukuran isi, misalnya botol 330ml atau botol 800gr.</p>
    </div>
  );
}
