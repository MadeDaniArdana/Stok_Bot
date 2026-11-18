'use client';

import { formatStock } from '@/lib/product-units';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

const MAX_VISIBLE_OPTIONS = 50;

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  unit: string;
  packUnit?: string | null;
  packSize?: number | null;
}

interface ProductPickerProps {
  id: string;
  products: ProductOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Tampilkan teks petunjuk di bawah kolom (matikan untuk tabel berbaris banyak). */
  showHint?: boolean;
  placeholder?: string;
  required?: boolean;
}

export function ProductPicker({ id, products, value, onChange, disabled = false, loading = false, showHint = true, placeholder, required = true }: ProductPickerProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = products.find((product) => product.id === value);
  const expanded = open && !disabled;
  const listId = `${id}-options`;
  // Teks pencarian per barang dihitung sekali, bukan di setiap ketukan tombol.
  const searchIndex = useMemo(
    () => products.map((product) => ({ product, text: `${product.name} ${product.sku}`.toLocaleLowerCase('id-ID') })),
    [products]
  );
  const matches = useMemo(() => {
    const words = (query || '').trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
    return searchIndex.filter(({ text }) => words.every((word) => text.includes(word))).map(({ product }) => product);
  }, [searchIndex, query]);
  // Hanya sebagian hasil yang dirender agar dropdown tetap ringan walau barangnya ratusan.
  const filtered = useMemo(() => matches.slice(0, MAX_VISIBLE_OPTIONS), [matches]);
  const hiddenCount = matches.length - filtered.length;
  const activeOption = filtered[activeIndex];

  useEffect(() => {
    if (expanded && activeOption) {
      listRef.current?.children.item(activeIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, activeOption]);

  const choose = (product: ProductOption) => {
    onChange(product.id);
    setQuery(null);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
    }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && activeOption ? `${listId}-${activeOption.id}` : undefined}
          aria-describedby={showHint ? `${id}-hint` : undefined}
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={query ?? (selected ? `[${selected.sku}] ${selected.name}` : '')}
          placeholder={loading ? 'Memuat barang...' : placeholder || 'Ketik nama barang atau SKU...'}
          onFocus={(event) => {
            setOpen(true);
            setActiveIndex(0);
            event.currentTarget.select();
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('');
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              const lastIndex = Math.max(0, filtered.length - 1);
              setActiveIndex((previous) => event.key === 'ArrowDown'
                ? (expanded ? Math.min(previous + 1, lastIndex) : 0)
                : (expanded ? Math.max(previous - 1, 0) : lastIndex));
            } else if (event.key === 'Enter' && expanded) {
              event.preventDefault();
              if (activeOption) choose(activeOption);
            } else if (event.key === 'Escape' && expanded) {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === 'Tab') {
              close();
            }
          }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-16 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            aria-label="Hapus pilihan barang"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setActiveIndex(0);
              inputRef.current?.focus();
              setOpen(true);
            }}
            className="absolute right-7 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-maroon-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </div>

      {expanded && (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Barang persediaan" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filtered.length === 0 ? (
            <li role="presentation" className="px-3 py-5 text-center text-xs text-slate-500">Barang tidak ditemukan. Coba nama atau SKU lain.</li>
          ) : filtered.map((product, index) => (
            <li
              key={product.id}
              id={`${listId}-${product.id}`}
              role="option"
              aria-selected={product.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(product)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 ${index === activeIndex ? 'bg-maroon-50 text-maroon-900' : 'text-slate-700'}`}
            >
              <div className="min-w-0">
                <p className="break-words text-xs font-semibold">{product.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{product.sku} · Stok: {formatStock(product, product.currentStock)}</p>
              </div>
              {product.id === value && <Check className="h-4 w-4 shrink-0 text-maroon-800" aria-hidden="true" />}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li role="presentation" className="px-3 py-2 text-center text-[11px] text-slate-500">
              {hiddenCount} barang lain tidak ditampilkan. Ketik lebih spesifik untuk mempersempit.
            </li>
          )}
        </ul>
      )}
      {showHint && (
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-slate-500">Ketik nama atau SKU, lalu pilih barang dari hasil pencarian.</p>
      )}
    </div>
  );
}
