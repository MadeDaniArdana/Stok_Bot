'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, LoaderCircle, PackageOpen, Plus, Printer, Save, Send, Trash2, X } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { ProductPicker } from '@/components/products/ProductPicker';
import { SearchCombobox, type ComboOption } from '@/components/ui/SearchCombobox';
import { ProofLinkBox } from './ProofLinkBox';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';
import { cn } from '@/lib/cn';
import {
  fetchDistributionBootstrap,
  getCachedDistributionBootstrap,
  patchCachedDistributionBootstrap,
  prefetchDistributionBootstrap,
  type DistributionBootstrapData,
  type DistributionProductOption as ProductOption,
  type DistributionTemplateOption as Template,
} from '@/lib/distribution-bootstrap';
import { invalidateSwrPrefix } from '@/lib/client-swr';
import { formatItemQuantity, formatStock, toBaseQuantity } from '@/lib/product-units';
import type { StockGroupConfig } from '@/lib/stock-groups';

interface Row {
  key: number;
  productId: string;
  quantity: string;
  /** Satuan input; kosong = satuan dasar. Hanya relevan untuk barang berkemasan. */
  unit?: string;
  /** Lokasi pemasangan (khusus listrik); kosong = sama dengan isian Ruang di atas. */
  location?: string;
}

interface SavedDistribution {
  id: string;
  number: string;
  recipientUnit: string;
  handoverName: string;
  officerPhone?: string | null;
  items: { id: string; quantity: number; unit: string; product: { name: string; unit?: string; packUnit?: string | null; packSize?: number | null } }[];
  /** Token link foto bukti (khusus Peralatan Listrik). */
  proofToken?: string | null;
}

/** Tanggal hari ini menurut WIB, format YYYY-MM-DD untuk input type=date. */
function todayInJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

const OFFICER_OTHER = '__OTHER__';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-slate-50';

interface DistributionRowProps {
  row: Row;
  index: number;
  product: ProductOption | undefined;
  options: ProductOption[];
  invalidQuantity: boolean;
  overStock: boolean;
  inputUnit: string;
  highlight: boolean;
  qtyPlaceholder: string;
  isSingleRow: boolean;
  isListrik: boolean;
  productsLoading: boolean;
  recipientUnit: string;
  onUpdateRow: (key: number, patch: Partial<Row>) => void;
  onRemoveRow: (key: number) => void;
}

/** Baris item dimemoisasi agar mengetik jumlah di satu baris tidak merender ulang 35+ baris checklist lain. */
const DistributionRow = memo(function DistributionRow({
  row,
  index,
  product,
  options,
  invalidQuantity,
  overStock,
  inputUnit,
  highlight,
  qtyPlaceholder,
  isSingleRow,
  isListrik,
  productsLoading,
  recipientUnit,
  onUpdateRow,
  onRemoveRow,
}: DistributionRowProps) {
  const handleProductChange = useCallback(
    (productId: string) => onUpdateRow(row.key, { productId, unit: '' }),
    [onUpdateRow, row.key]
  );

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5 py-3 sm:grid-cols-[2rem_1fr_9rem_2.5rem]',
        highlight && 'bg-maroon-50/40'
      )}
    >
      <span className="pt-2.5 text-xs font-bold text-slate-400">{index + 1}</span>
      <div className="min-w-0">
        <ProductPicker
          id={`dist-product-${row.key}`}
          products={options}
          value={row.productId}
          onChange={handleProductChange}
          loading={productsLoading}
          showHint={false}
          required={isSingleRow}
          placeholder={isListrik ? 'Cari alat, contoh: lampu LED' : 'Cari barang, contoh: kertas A4'}
        />
        {isListrik && (
          <input
            aria-label={`Lokasi pemasangan baris ${index + 1}`}
            value={row.location ?? ''}
            onChange={(e) => onUpdateRow(row.key, { location: e.target.value })}
            placeholder={recipientUnit ? `Lokasi pemasangan (kosong = ${recipientUnit})` : 'Lokasi pemasangan (opsional)'}
            maxLength={150}
            className={cn(inputClass, 'mt-1.5')}
          />
        )}
        {product && (
          <p className={cn('mt-1 text-[11px]', product.currentStock === 0 ? 'text-rose-600' : 'text-slate-500')}>
            Stok tersedia: {formatStock(product, product.currentStock)}
          </p>
        )}
      </div>
      <div className="col-span-2 col-start-2 flex items-start gap-2 sm:col-span-1 sm:col-start-auto">
        <div className="flex-1">
          <label htmlFor={`dist-qty-${row.key}`} className="sr-only">Jumlah baris {index + 1}</label>
          <div className="relative">
            <input
              id={`dist-qty-${row.key}`}
              type="number"
              inputMode={product?.packUnit ? 'decimal' : 'numeric'}
              min={0}
              step={product?.packUnit ? 'any' : 1}
              max={product?.packUnit || !product?.currentStock ? undefined : product.currentStock}
              value={row.quantity}
              onChange={(e) => onUpdateRow(row.key, { quantity: e.target.value })}
              placeholder={qtyPlaceholder}
              aria-invalid={overStock || invalidQuantity}
              className={cn(inputClass, 'pr-14', overStock && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20')}
            />
            {!product?.packUnit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{product?.unit || ''}</span>}
          </div>
          {product?.packUnit && (
            <div className="mt-1 space-y-1">
              <select
                aria-label={`Satuan baris ${index + 1}`}
                value={inputUnit}
                onChange={(e) => onUpdateRow(row.key, { unit: e.target.value })}
                className={cn(inputClass, 'py-1.5')}
              >
                <option value={product.packUnit}>{product.packUnit}</option>
                <option value={product.unit}>{product.unit}</option>
              </select>
              {product.packUnit === 'kg' && (
                <div className="flex flex-wrap gap-1">
                  {[['¼', '0.25'], ['½', '0.5'], ['¾', '0.75'], ['1', '1']].map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onUpdateRow(row.key, { unit: 'kg', quantity: value })}
                      className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-maroon-50 hover:text-maroon-800"
                    >
                      {label} kg
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {product?.packUnit && product.packSize && inputUnit === product.packUnit && row.quantity !== '' && (() => {
            const base = toBaseQuantity(product, Number(row.quantity), inputUnit);
            return base ? <p className="mt-1 text-[11px] font-medium text-slate-600">= {base.toLocaleString('id-ID')} {product.unit}</p> : null;
          })()}
          {invalidQuantity && <p className="mt-1 text-[11px] text-rose-600">Jumlah tidak valid (hasil harus bilangan bulat {product?.unit}).</p>}
          {overStock && <p className="mt-1 text-[11px] text-rose-600">Melebihi stok.</p>}
        </div>
        <button
          type="button"
          onClick={() => onRemoveRow(row.key)}
          aria-label={`Hapus baris ${index + 1}`}
          className="action-button action-icon action-danger mt-0.5 sm:hidden"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onRemoveRow(row.key)}
        aria-label={`Hapus baris ${index + 1}`}
        className="action-button action-icon action-danger mt-0.5 hidden sm:inline-flex"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
});

export function DistributionForm({ group }: { group: StockGroupConfig }) {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isListrik = group.id === 'LISTRIK';
  const usesTemplates = !isListrik;
  const nextKey = useRef(1);
  // Baca cache memori secara sinkron saat mount agar pindah menu ATK <-> Logistik langsung tampil 0 ms.
  const initialCache = getCachedDistributionBootstrap(group.id);

  const [products, setProducts] = useState<ProductOption[]>(() => initialCache?.products ?? []);
  const [productsLoading, setProductsLoading] = useState(() => !initialCache);
  const [recipients, setRecipients] = useState<string[]>(() => initialCache?.recipients ?? []);
  const [handoverNames, setHandoverNames] = useState<string[]>(() => initialCache?.handoverNames ?? []);
  const [receiverNames, setReceiverNames] = useState<string[]>(() => initialCache?.receiverNames ?? []);

  const [date, setDate] = useState(todayInJakarta);
  const [recipientUnit, setRecipientUnit] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [officerPhone, setOfficerPhone] = useState('');
  const [handoverName, setHandoverName] = useState('');
  const [handoverSelect, setHandoverSelect] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<SavedDistribution | null>(null);

  // Paket distribusi (template tabel per unit), hanya untuk ATK & Logistik.
  const [templates, setTemplates] = useState<Template[]>(() => initialCache?.templates ?? []);
  const [templatesLoading, setTemplatesLoading] = useState(() => usesTemplates && !initialCache);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState<string | null>(null);
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null;

  // Untuk ATK/Logistik, "Yang menyerahkan" biasanya admin yang login.
  // Selama belum diubah manual di form ini, kolom selalu mengikuti nama admin terbaru
  // (mis. setelah nama diganti di Pengaturan).
  const handoverTouched = useRef(false);
  // Penerima otomatis sama dengan Kepada sampai diubah/dikosongkan manual.
  const receiverTouched = useRef(false);
  // ATK: nama admin yang login. Logistik: nama terakhir yang dipakai (penanda tangannya bisa orang lain).
  const defaultHandover =
    group.handoverDefault === 'last' ? handoverNames[0] || currentUser?.name || '' : currentUser?.name || '';
  const receiverSuggestions = Array.from(new Set([...(group.receiverOptions ?? []), ...receiverNames]));
  // "Kepada": nama tujuan sesuai paket distribusi (hint = nama paket) + tujuan yang pernah dipakai.
  const recipientOptions = useMemo<ComboOption[]>(
    () => [
      ...templates.map((template) => ({ value: template.recipientUnit, hint: template.name !== template.recipientUnit ? `Paket: ${template.name}` : undefined })),
      ...recipients.map((value) => ({ value })),
    ],
    [templates, recipients]
  );
  // Penerima: penerima bawaan paket + daftar tetap + nama yang pernah diketik.
  const receiverOptions = useMemo(
    () => Array.from(new Set([...templates.flatMap((template) => (template.receiverName ? [template.receiverName] : [])), ...receiverSuggestions])),
    [templates, receiverSuggestions]
  );
  useEffect(() => {
    if (!isListrik && defaultHandover && !handoverTouched.current) setHandoverName(defaultHandover);
  }, [defaultHandover, isListrik]);

  // Kepada & Penerima memakai pilihan yang sama.
  const sharedOptions = useMemo<ComboOption[]>(() => [...recipientOptions, ...receiverOptions.map((value) => ({ value }))], [recipientOptions, receiverOptions]);
  const changeRecipient = (value: string) => {
    setRecipientUnit(value);
    if (!isListrik && !receiverTouched.current) setReceiverName(value);
  };

  const applyBootstrap = useCallback((data: DistributionBootstrapData) => {
    setProducts(data.products);
    setTemplates(data.templates);
    setRecipients(data.recipients);
    setHandoverNames(data.handoverNames);
    setReceiverNames(data.receiverNames);
    setProductsLoading(false);
    setTemplatesLoading(false);
  }, []);

  const refreshBootstrap = useCallback(
    (showError = true) =>
      fetchDistributionBootstrap(group.id)
        .then((data) => {
          applyBootstrap(data);
          return data;
        })
        .catch(() => {
          if (showError) showToast('Gagal Memuat', `Data distribusi ${group.label} tidak dapat dimuat.`, 'error');
          setProductsLoading(false);
          setTemplatesLoading(false);
          return null;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group.id, group.label, applyBootstrap]
  );

  useEffect(() => {
    let active = true;
    const cached = getCachedDistributionBootstrap(group.id);
    setHandoverSelect('');
    if (cached) {
      applyBootstrap(cached);
    } else {
      setProducts([]);
      setTemplates([]);
      setProductsLoading(true);
      setTemplatesLoading(usesTemplates);
    }

    fetchDistributionBootstrap(group.id)
      .then((data) => {
        if (!active) return;
        applyBootstrap(data);
        // Hangatkan cache menu sebelah (ATK <-> Logistik) di latar belakang agar pindah menu pertama kali juga instan.
        if (group.id === 'LOGISTIK') prefetchDistributionBootstrap('ATK', 60_000);
        else if (group.id === 'ATK') prefetchDistributionBootstrap('LOGISTIK', 60_000);
      })
      .catch(() => {
        if (!active) return;
        if (!cached) showToast('Gagal Memuat', `Data distribusi ${group.label} tidak dapat dimuat.`, 'error');
        setProductsLoading(false);
        setTemplatesLoading(false);
      });

    // Sinkronisasi ulang diam-diam saat tab kembali aktif (jeda minimal 15 detik).
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const latest = getCachedDistributionBootstrap(group.id);
      if (latest && Date.now() - latest.fetchedAt < 15_000) return;
      fetchDistributionBootstrap(group.id)
        .then((data) => {
          if (active) applyBootstrap(data);
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, usesTemplates, applyBootstrap]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Daftar pilihan per baris (tanpa barang yang sudah dipilih di baris lain) dihitung dalam O(N)
  // hanya saat pilihan barang berubah, bukan setiap mengetik jumlah.
  const selectionKey = rows.map((row) => `${row.key}:${row.productId}`).join('|');
  const optionsByRow = useMemo(() => {
    const map = new Map<number, ProductOption[]>();
    if (isListrik) {
      // Peralatan listrik: barang yang sama boleh dipakai lagi di lokasi lain, jadi tidak disembunyikan.
      for (const row of rows) map.set(row.key, products);
      return map;
    }
    const takenCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.productId) takenCounts.set(row.productId, (takenCounts.get(row.productId) ?? 0) + 1);
    }
    for (const row of rows) {
      if (takenCounts.size === 0 || (takenCounts.size === 1 && row.productId && takenCounts.get(row.productId) === 1)) {
        map.set(row.key, products);
      } else {
        map.set(
          row.key,
          products.filter((option) => option.id === row.productId || !takenCounts.has(option.id))
        );
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, selectionKey, isListrik]);

  const rowState = rows.map((row) => {
    const product = productById.get(row.productId);
    const rawQty = row.quantity.trim();
    const isBlankQty = rawQty === '' || rawQty === '0';
    const typed = Number(rawQty.replace(',', '.'));
    const inputUnit = product?.packUnit && row.unit === product.packUnit ? product.packUnit : product?.unit ?? '';
    // Jumlah selalu dikirim dalam satuan dasar (pcs/gram); konversi kemasan dilakukan di sini.
    const quantity = isBlankQty
      ? 0
      : (product ? toBaseQuantity(product, typed, inputUnit) : Number.isSafeInteger(typed) && typed > 0 ? typed : null) ?? 0;
    const validQuantity = quantity > 0;
    const invalidQuantity = !isBlankQty && !validQuantity;
    const overStock = Boolean(product && validQuantity && quantity > product.currentStock);
    return { row, product, quantity, validQuantity, isBlankQty, invalidQuantity, overStock, inputUnit };
  });
  const filledRows = rowState.filter((state) => state.row.productId);
  const submittableRows = filledRows.filter((state) => state.validQuantity);
  const hasInvalidFilledRow = filledRows.some((state) => state.invalidQuantity || state.overStock);
  const canSubmit =
    !submitting &&
    recipientUnit.trim() !== '' &&
    handoverName.trim() !== '' &&
    submittableRows.length > 0 &&
    !hasInvalidFilledRow;

  // Tabel dianggap berubah dari paket bila ada barang/jumlah/isian kepala yang berbeda.
  const tableSignature = (items: { productId: string; quantity: number }[]) =>
    items.map((item) => `${item.productId}:${item.quantity}`).sort().join('|');
  const currentItems = filledRows
    .filter((state) => !state.invalidQuantity)
    .map((state) => ({ productId: state.row.productId, quantity: state.validQuantity ? state.quantity : 0 }));
  const templateChanged = Boolean(
    activeTemplate &&
      (tableSignature(currentItems) !== tableSignature(activeTemplate.items) ||
        recipientUnit.trim() !== activeTemplate.recipientUnit ||
        (storageLocation.trim() || null) !== activeTemplate.storageLocation ||
        (receiverName.trim() || null) !== (activeTemplate.receiverName ?? (isListrik ? null : activeTemplate.recipientUnit)))
  );
  const tableValidForTemplate =
    recipientUnit.trim() !== '' && filledRows.every((state) => !state.invalidQuantity);

  const applyTemplate = (template: Template) => {
    const hasData = (activeTemplateId ? submittableRows.length > 0 : filledRows.length > 0) && activeTemplateId !== template.id;
    if (hasData && !confirm(`Ganti isi tabel dengan paket "${template.name}"?`)) return;
    const usable = template.items.filter((item) => item.product.isActive);
    const skipped = template.items.length - usable.length;
    setActiveTemplateId(template.id);
    setNewTemplateName(null);
    setRecipientUnit(template.recipientUnit);
    setStorageLocation(template.storageLocation || '');
    receiverTouched.current = false;
    setReceiverName(template.receiverName || (isListrik ? '' : template.recipientUnit));
    setRows(
      usable.length
        ? usable.map((item) => ({ key: nextKey.current++, productId: item.productId, quantity: item.quantity > 0 ? String(item.quantity) : '' }))
        : [{ key: nextKey.current++, productId: '', quantity: '' }]
    );
    if (skipped > 0) showToast('Sebagian Dilewati', `${skipped} barang di paket ini sudah nonaktif dan tidak dimasukkan.`, 'error');
  };

  const clearTemplate = () => {
    setActiveTemplateId(null);
    setNewTemplateName(null);
    setRecipientUnit('');
    setStorageLocation('');
    receiverTouched.current = false;
    setReceiverName('');
    setRows([{ key: nextKey.current++, productId: '', quantity: '' }]);
  };

  const saveTemplate = async (mode: 'update' | 'create') => {
    const name = mode === 'update' ? activeTemplate?.name : newTemplateName?.trim();
    if (!name || !tableValidForTemplate) return;
    setTemplateBusy(true);
    try {
      const res = await fetch(mode === 'update' ? `/api/distribution-templates/${activeTemplateId}` : '/api/distribution-templates', {
        method: mode === 'update' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockGroup: group.id, name, recipientUnit, storageLocation, receiverName, items: currentItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Paket gagal disimpan.');
      setTemplates((current) => {
        const next = [...current.filter((template) => template.id !== data.template.id), data.template].sort((a, b) => a.name.localeCompare(b.name, 'id'));
        patchCachedDistributionBootstrap(group.id, (cached) => ({ ...cached, templates: next, fetchedAt: Date.now() }));
        return next;
      });
      setActiveTemplateId(data.template.id);
      setNewTemplateName(null);
      showToast('Paket Disimpan', mode === 'update' ? `Isi paket "${name}" diperbarui.` : `Paket "${name}" dibuat.`);
    } catch (error: any) {
      showToast('Gagal Menyimpan Paket', error.message, 'error');
    } finally {
      setTemplateBusy(false);
    }
  };

  const deleteTemplate = async () => {
    if (!activeTemplate || !confirm(`Hapus paket "${activeTemplate.name}"? Riwayat distribusi tidak ikut terhapus.`)) return;
    setTemplateBusy(true);
    try {
      const res = await fetch(`/api/distribution-templates/${activeTemplate.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Paket gagal dihapus.');
      setTemplates((current) => {
        const next = current.filter((template) => template.id !== activeTemplate.id);
        patchCachedDistributionBootstrap(group.id, (cached) => ({ ...cached, templates: next, fetchedAt: Date.now() }));
        return next;
      });
      setActiveTemplateId(null);
      showToast('Paket Dihapus', `Paket "${activeTemplate.name}" dihapus.`);
    } catch (error: any) {
      showToast('Gagal Menghapus', error.message, 'error');
    } finally {
      setTemplateBusy(false);
    }
  };

  const updateRow = useCallback((key: number, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  const addRow = useCallback(() => {
    setRows((current) => [...current, { key: nextKey.current++, productId: '', quantity: '' }]);
  }, []);

  const removeRow = useCallback((key: number) => {
    setRows((current) => (current.length === 1 ? [{ key: nextKey.current++, productId: '', quantity: '' }] : current.filter((row) => row.key !== key)));
  }, []);

  const resetForm = () => {
    setSaved(null);
    setRecipientUnit('');
    setOrderNumber('');
    setStorageLocation('');
    receiverTouched.current = false;
    setReceiverName('');
    setOfficerPhone('');
    setNotes('');
    handoverTouched.current = false;
    setHandoverSelect('');
    setHandoverName(isListrik ? '' : defaultHandover);
    setActiveTemplateId(null);
    setNewTemplateName(null);
    setRows([{ key: nextKey.current++, productId: '', quantity: '' }]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/distributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockGroup: group.id,
          date,
          recipientUnit,
          orderNumber,
          storageLocation: storageLocation || (isListrik ? '' : recipientUnit),
          receiverName,
          handoverName,
          officerPhone: isListrik ? officerPhone : '',
          notes,
          items: submittableRows.map((state) => ({
            productId: state.row.productId,
            quantity: state.quantity,
            ...(isListrik && state.row.location?.trim() && { location: state.row.location.trim() }),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Form distribusi gagal disimpan.');
      setSaved({ ...data.distribution, proofToken: data.proofToken });
      showToast('Distribusi Tersimpan', `${data.distribution.number}: stok ${data.distribution.items.length} barang telah dikurangi.`);
      invalidateSwrPrefix('/api/distributions');
      invalidateSwrPrefix('/api/products');
      invalidateSwrPrefix('/api/reports/summary');
      refreshBootstrap(false);
      const usedRecipient = recipientUnit.trim();
      const usedHandover = handoverName.trim();
      const usedReceiver = receiverName.trim();
      if (!recipients.includes(usedRecipient)) setRecipients((current) => [usedRecipient, ...current]);
      // Ingat nama yang baru dipakai agar jadi pilihan (dan isian awal Logistik) pada form berikutnya.
      setHandoverNames((current) => [usedHandover, ...current.filter((name) => name !== usedHandover)]);
      if (usedReceiver) setReceiverNames((current) => [usedReceiver, ...current.filter((name) => name !== usedReceiver)]);
      patchCachedDistributionBootstrap(group.id, (cached) => ({
        ...cached,
        recipients: cached.recipients.includes(usedRecipient) ? cached.recipients : [usedRecipient, ...cached.recipients],
        handoverNames: [usedHandover, ...cached.handoverNames.filter((name) => name !== usedHandover)],
        receiverNames: usedReceiver ? [usedReceiver, ...cached.receiverNames.filter((name) => name !== usedReceiver)] : cached.receiverNames,
      }));
    } catch (error: any) {
      showToast('Gagal Menyimpan', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-soft sm:p-10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Distribusi {saved.number} tersimpan</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          {saved.items.length} barang untuk <strong>{saved.recipientUnit}</strong> sudah tercatat sebagai barang keluar dan stok telah diperbarui.
        </p>
        {saved.proofToken && (
          <div className="mx-auto mt-5 max-w-lg">
            <ProofLinkBox
              token={saved.proofToken}
              officerName={saved.handoverName}
              phone={saved.officerPhone}
              location={saved.recipientUnit}
              itemsLabel={saved.items.map((item) => `${item.product.name} (${formatItemQuantity(item.quantity, item.unit, item.product)})`).join(', ')}
            />
          </div>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <a
            href={`/print/distribution/${saved.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-maroon-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-maroon-900"
          >
            <Printer className="h-4 w-4" /> Cetak Form
          </a>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Buat Form Baru
          </button>
          <Link
            href={`/distribution-reports/${group.slug}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" /> Lihat Riwayat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={submitting}>
      {submitting && (
        <ModalOverlay role="alertdialog" aria-modal="true" aria-live="assertive" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-maroon-800" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-900">Menyimpan distribusi...</p>
            <p className="mt-1 text-xs text-slate-500">
              Mengurangi stok {submittableRows.length} barang dan membuat dokumen. Jangan tutup halaman ini.
            </p>
          </div>
        </ModalOverlay>
      )}
      {usesTemplates && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-maroon-800" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Pilih Paket Distribusi</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Paket berisi daftar barang tetap untuk setiap unit. Pilih paket, lalu ubah jumlah atau tambah/hapus barang di tabel bila perlu.
          </p>
          {templatesLoading && templates.length === 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" aria-busy="true" aria-label="Memuat daftar paket distribusi">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-[52px] w-28 animate-pulse rounded-xl border border-slate-100 bg-slate-100/80" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              Belum ada paket. Isi tabel di bawah, lalu klik <strong>Simpan sebagai Paket Baru</strong>.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {templates.map((template) => {
                const active = template.id === activeTemplateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                      active ? 'border-maroon-700 bg-maroon-50 text-maroon-900' : 'border-slate-200 text-slate-700 hover:border-maroon-300 hover:bg-maroon-50/40'
                    )}
                  >
                    <span className="block font-semibold">{template.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {template.items.length === 0 ? 'Belum ada barang' : `${template.items.length} barang`}
                    </span>
                  </button>
                );
              })}
              {activeTemplateId && (
                <button
                  type="button"
                  onClick={clearTemplate}
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5" /> Form kosong
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Kepala formulir, mengikuti formulir kertas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">{group.formTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
          </div>
          {group.documentCode && (
            <p className="text-[11px] text-slate-400">
              Kode Dok: {group.documentCode} · Revisi {group.documentRevision}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="dist-date" className="mb-1 block text-xs font-semibold text-slate-700">
              {isListrik ? 'Tanggal' : 'Tanggal Pesanan'} <span className="text-rose-500">*</span>
            </label>
            <input id="dist-date" type="date" required max={todayInJakarta()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>

          <div className={isListrik ? '' : 'lg:col-span-2'}>
            <label htmlFor="dist-recipient" className="mb-1 block text-xs font-semibold text-slate-700">
              {group.recipientLabel} <span className="text-rose-500">*</span>
            </label>
            <SearchCombobox
              id="dist-recipient"
              required
              value={recipientUnit}
              onChange={changeRecipient}
              options={sharedOptions}
              placeholder={group.recipientPlaceholder}
            />
          </div>

          {isListrik && (
            <div>
              <label htmlFor="dist-handover-select" className="mb-1 block text-xs font-semibold text-slate-700">
                {group.handoverLabel} <span className="text-rose-500">*</span>
              </label>
              <select
                id="dist-handover-select"
                required
                value={handoverSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setHandoverSelect(val);
                  setHandoverName(val === OFFICER_OTHER ? '' : val);
                }}
                className={inputClass}
              >
                <option value="">Pilih nama petugas...</option>
                {(group.handoverOptions ?? []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value={OFFICER_OTHER}>Lainnya (ketik manual)</option>
              </select>
              {handoverSelect === OFFICER_OTHER && (
                <>
                  <input
                    id="dist-handover"
                    required
                    autoFocus
                    list="dist-handover-options"
                    value={handoverName}
                    onChange={(e) => setHandoverName(e.target.value)}
                    placeholder="Ketik nama petugas..."
                    maxLength={150}
                    className={cn(inputClass, 'mt-2')}
                  />
                  <datalist id="dist-handover-options">
                    {handoverNames
                      .filter((name) => !(group.handoverOptions ?? []).includes(name))
                      .map((name) => <option key={name} value={name} />)}
                  </datalist>
                </>
              )}
            </div>
          )}

          {isListrik && (
            <div>
              <label htmlFor="dist-phone" className="mb-1 block text-xs font-semibold text-slate-700">
                No. WhatsApp Petugas <span className="font-normal text-slate-400">(opsional)</span>
              </label>
              <input
                id="dist-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={officerPhone}
                onChange={(e) => setOfficerPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                maxLength={20}
                aria-describedby="dist-phone-hint"
                className={inputClass}
              />
              <p id="dist-phone-hint" className="mt-1 text-[11px] text-slate-500">Jika diisi, link foto bukti bisa langsung dikirim ke WhatsApp petugas.</p>
            </div>
          )}

          {!isListrik && (
            <>
              <div>
                <label htmlFor="dist-order" className="mb-1 block text-xs font-semibold text-slate-700">No. Nota Pesanan</label>
                <input id="dist-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Kosongkan jika tidak ada" maxLength={150} className={inputClass} />
              </div>
              <div>
                <label htmlFor="dist-storage" className="mb-1 block text-xs font-semibold text-slate-700">Tempat Penyimpanan</label>
                <input id="dist-storage" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder={recipientUnit ? `Default: ${recipientUnit}` : 'Default: sama dengan tujuan'} maxLength={150} className={inputClass} />
              </div>
              <div>
                <label htmlFor="dist-handover" className="mb-1 block text-xs font-semibold text-slate-700">
                  {group.handoverLabel} <span className="text-rose-500">*</span>
                </label>
                <input id="dist-handover" required list="dist-handover-options" value={handoverName} onChange={(e) => { handoverTouched.current = true; setHandoverName(e.target.value); }} maxLength={150} aria-describedby="dist-handover-hint" placeholder="Contoh: Muntasiroh, S.Kom." className={inputClass} />
                <datalist id="dist-handover-options">
                  {Array.from(new Set([...handoverNames, ...(currentUser?.name ? [currentUser.name] : [])])).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <p id="dist-handover-hint" className="mt-1 text-[11px] text-slate-500">
                  {group.handoverDefault === 'last' ? (
                    <>Otomatis nama terakhir yang dipakai di {group.label}. Ketik nama lain (mis. Muntasiroh, S.Kom.) dan nama itu akan diingat.</>
                  ) : (
                    <>
                      Otomatis nama admin yang login. Ubah untuk form ini saja, atau ganti permanen di{' '}
                      <Link href="/settings" className="font-semibold text-maroon-800 underline">Pengaturan</Link>.
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          <div>
            <label htmlFor="dist-receiver" className="mb-1 block text-xs font-semibold text-slate-700">
              Penerima <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <SearchCombobox
              id="dist-receiver"
              value={receiverName}
              onChange={(value) => {
                receiverTouched.current = true;
                setReceiverName(value);
              }}
              options={isListrik ? [] : sharedOptions}
              placeholder={isListrik ? 'Boleh dikosongkan' : 'Cari, pilih, atau ketik nama baru'}
            />
            {!isListrik && <p className="mt-1 text-[11px] text-slate-500">Otomatis sama dengan Kepada. Ubah, ketik nama lain, atau kosongkan bila perlu.</p>}
          </div>

          <div className={isListrik ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-1'}>
            <label htmlFor="dist-notes" className="mb-1 block text-xs font-semibold text-slate-700">
              Catatan <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input id="dist-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isListrik ? 'Contoh: ganti lampu mati' : 'Boleh dikosongkan'} maxLength={500} className={inputClass} />
          </div>
        </div>
      </section>

      {/* Daftar barang */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{isListrik ? 'Alat yang Didistribusikan' : 'Daftar Barang'}</h3>
            <p className="text-xs text-slate-500">
              {filledRows.length > submittableRows.length
                ? 'Isi jumlah pada barang yang diambil saja; baris yang dikosongkan otomatis dilewati saat simpan.'
                : `Hanya barang aktif berjenis ${group.label} yang bisa dipilih.`}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {submittableRows.length === filledRows.length
              ? `${filledRows.length} barang`
              : `${submittableRows.length} dari ${filledRows.length} barang diisi`}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {rowState.map(({ row, product, validQuantity, invalidQuantity, overStock, inputUnit }, index) => (
            <DistributionRow
              key={row.key}
              row={row}
              index={index}
              product={product}
              options={optionsByRow.get(row.key) ?? products}
              invalidQuantity={invalidQuantity}
              overStock={overStock}
              inputUnit={inputUnit}
              highlight={validQuantity && !overStock && filledRows.length !== submittableRows.length}
              qtyPlaceholder={filledRows.length > 1 ? '0' : 'Jumlah'}
              isSingleRow={rows.length === 1}
              isListrik={isListrik}
              productsLoading={productsLoading}
              recipientUnit={recipientUnit}
              onUpdateRow={updateRow}
              onRemoveRow={removeRow}
            />
          ))}
        </div>

        {usesTemplates && (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-slate-500">
              {activeTemplate ? (
                templateChanged ? (
                  <>Tabel berbeda dari paket <strong className="text-slate-700">{activeTemplate.name}</strong>.</>
                ) : (
                  <>Sesuai paket <strong className="text-slate-700">{activeTemplate.name}</strong>.</>
                )
              ) : (
                'Tabel ini belum tersimpan sebagai paket.'
              )}
            </span>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {activeTemplate && templateChanged && (
                <button
                  type="button"
                  disabled={templateBusy || !tableValidForTemplate}
                  onClick={() => saveTemplate('update')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-maroon-300 bg-white px-3 py-1.5 font-semibold text-maroon-800 hover:bg-maroon-50 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> Perbarui Paket {activeTemplate.name}
                </button>
              )}
              {newTemplateName === null ? (
                <button
                  type="button"
                  disabled={templateBusy || !tableValidForTemplate}
                  onClick={() => setNewTemplateName(storageLocation.trim() || recipientUnit.replace(/^Tata Usaha( Divisi)?\s+/i, '').trim())}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Simpan sebagai Paket Baru
                </button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <label htmlFor="new-template-name" className="sr-only">Nama paket baru</label>
                  <input
                    id="new-template-name"
                    autoFocus
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveTemplate('create');
                      } else if (e.key === 'Escape') setNewTemplateName(null);
                    }}
                    placeholder="Nama paket, mis. BAAK FSIP"
                    maxLength={150}
                    className="w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
                  />
                  <button
                    type="button"
                    disabled={templateBusy || !newTemplateName.trim()}
                    onClick={() => saveTemplate('create')}
                    className="rounded-lg bg-maroon-800 px-3 py-1.5 font-semibold text-white hover:bg-maroon-900 disabled:opacity-50"
                  >
                    Simpan
                  </button>
                  <button type="button" onClick={() => setNewTemplateName(null)} aria-label="Batal buat paket" className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {activeTemplate && (
                <button
                  type="button"
                  disabled={templateBusy}
                  onClick={deleteTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus Paket
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= 50}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-maroon-300 px-4 py-2.5 text-xs font-semibold text-maroon-800 hover:bg-maroon-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Tambah Baris Barang
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-maroon-800 px-5 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting
              ? 'Menyimpan...'
              : submittableRows.length > 0 && submittableRows.length < filledRows.length
                ? `Simpan & Kurangi Stok (${submittableRows.length} barang)`
                : 'Simpan & Kurangi Stok'}
          </button>
        </div>
      </section>
    </form>
  );
}
