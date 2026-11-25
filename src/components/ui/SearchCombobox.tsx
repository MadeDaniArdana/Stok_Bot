'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ComboOption {
  value: string;
  /** Keterangan kecil di bawah nama (mis. nama paket distribusi). */
  hint?: string;
}

interface SearchComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | ComboOption)[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  /** Boleh mengetik nama baru yang belum ada di daftar (default: ya). */
  allowNew?: boolean;
  ariaLabel?: string;
}

/**
 * Dropdown yang bisa dicari. Ketik untuk menyaring daftar, pilih salah satu,
 * atau ketik nama baru (opsi "Gunakan ... sebagai nama baru" muncul otomatis).
 */
export function SearchCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
  maxLength = 150,
  className,
  allowNew = true,
  ariaLabel,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = `${id ?? 'combo'}-list`;

  const normalized = useMemo(() => {
    const seen = new Set<string>();
    const result: ComboOption[] = [];
    for (const option of options) {
      const item = typeof option === 'string' ? { value: option } : option;
      const key = item.value.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }, [options]);

  const query = value.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized
        .filter((option) => !query || option.value.toLowerCase().includes(query) || (option.hint ?? '').toLowerCase().includes(query))
        .slice(0, 50),
    [normalized, query]
  );
  const exact = normalized.some((option) => option.value.trim().toLowerCase() === query);
  const showNew = allowNew && query !== '' && !exact;

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const total = filtered.length;
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(total - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filtered[active]) {
      event.preventDefault();
      pick(filtered[active].value);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        required={required}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        role="combobox"
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20',
          className
        )}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />

      {open && (filtered.length > 0 || showNew) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
        >
          {filtered.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option.value);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn('flex cursor-pointer items-start justify-between gap-2 px-3 py-2', index === active && 'bg-maroon-50')}
            >
              <span className="min-w-0">
                <span className="block break-words font-medium text-slate-800">{option.value}</span>
                {option.hint && <span className="block text-[11px] text-slate-500">{option.hint}</span>}
              </span>
              {option.value === value && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-maroon-700" aria-hidden="true" />}
            </li>
          ))}
          {showNew && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(value.trim());
              }}
              className="flex cursor-pointer items-center gap-1.5 border-t border-slate-100 px-3 py-2 font-semibold text-maroon-800 hover:bg-maroon-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Lainnya: gunakan &quot;{value.trim()}&quot; sebagai nama baru
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
