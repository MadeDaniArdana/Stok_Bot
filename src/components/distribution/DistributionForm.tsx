'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, PackageOpen, Plus, Printer, Save, Send, Trash2, X } from 'lucide-react';
import { ProductPicker } from '@/components/products/ProductPicker';
import { ProofLinkBox } from './ProofLinkBox';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';
import { cn } from '@/lib/cn';
import type { StockGroupConfig } from '@/lib/stock-groups';

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  unit: string;
}

interface Row {
  key: number;
  productId: string;
  quantity: string;
}

interface Template {
  id: string;
  name: string;
  recipientUnit: string;
  storageLocation: string | null;
  receiverName: string | null;
  items: { productId: string; quantity: number; product: { name: string; isActive: boolean } }[];
}

interface SavedDistribution {
  id: string;
  number: string;
  recipientUnit: string;
  handoverName: string;
  officerPhone?: string | null;
  items: { id: string; quantity: number; unit: string; product: { name: string } }[];
  /** Token link foto bukti (khusus Peralatan Listrik). */
  proofToken?: string | null;
}

/** Tanggal hari ini menurut WIB, format YYYY-MM-DD untuk input type=date. */
function todayInJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-slate-50';

export function DistributionForm({ group }: { group: StockGroupConfig }) {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isListrik = group.id === 'LISTRIK';
  const nextKey = useRef(1);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);

  const [date, setDate] = useState(todayInJakarta);
  const [recipientUnit, setRecipientUnit] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [officerPhone, setOfficerPhone] = useState('');
  const [handoverName, setHandoverName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<SavedDistribution | null>(null);

  // Paket distribusi (template tabel per unit), hanya untuk ATK & Logistik.
  const usesTemplates = !isListrik;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState<string | null>(null);
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null;

  // Untuk ATK/Logistik, "Yang menyerahkan" biasanya admin yang login.
  useEffect(() => {
    if (!isListrik && currentUser?.name) setHandoverName((current) => current || currentUser.name);
  }, [currentUser?.name, isListrik]);

  const loadProducts = () => {
    setProductsLoading(true);
    fetch(`/api/products?jenis=${group.id}&status=active&limit=500`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Gagal memuat barang'))))
      .then((data) => setProducts(data.items || []))
      .catch(() => showToast('Gagal Memuat', `Daftar barang ${group.label} tidak dapat dimuat.`, 'error'))
      .finally(() => setProductsLoading(false));
  };

  const loadTemplates = () => {
    if (!usesTemplates) return;
    fetch(`/api/distribution-templates?jenis=${group.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => showToast('Gagal Memuat', 'Daftar paket distribusi tidak dapat dimuat.', 'error'));
  };

  useEffect(() => {
    loadProducts();
    loadTemplates();
    fetch(`/api/distributions/recipients?jenis=${group.id}`)
      .then((res) => (res.ok ? res.json() : { recipients: [] }))
      .then((data) => setRecipients(data.recipients || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const rowState = rows.map((row) => {
    const product = productById.get(row.productId);
    const quantity = Number(row.quantity);
    const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
    const overStock = Boolean(product && validQuantity && quantity > product.currentStock);
    return { row, product, quantity, validQuantity, overStock };
  });
  const filledRows = rowState.filter((state) => state.row.productId);
  const canSubmit =
    !submitting &&
    recipientUnit.trim() !== '' &&
    handoverName.trim() !== '' &&
    filledRows.length > 0 &&
    filledRows.every((state) => state.validQuantity && !state.overStock);

  // Tabel dianggap berubah dari paket bila ada barang/jumlah/isian kepala yang berbeda.
  const tableSignature = (items: { productId: string; quantity: number }[]) =>
    items.map((item) => `${item.productId}:${item.quantity}`).sort().join('|');
  const currentItems = filledRows
    .filter((state) => state.validQuantity)
    .map((state) => ({ productId: state.row.productId, quantity: state.quantity }));
  const templateChanged = Boolean(
    activeTemplate &&
      (tableSignature(currentItems) !== tableSignature(activeTemplate.items) ||
        recipientUnit.trim() !== activeTemplate.recipientUnit ||
        (storageLocation.trim() || null) !== activeTemplate.storageLocation ||
        (receiverName.trim() || null) !== activeTemplate.receiverName)
  );
  const tableValidForTemplate =
    recipientUnit.trim() !== '' && filledRows.length > 0 && filledRows.every((state) => state.validQuantity);

  const applyTemplate = (template: Template) => {
    const hasData = filledRows.length > 0 && activeTemplateId !== template.id;
    if (hasData && !confirm(`Ganti isi tabel dengan paket "${template.name}"?`)) return;
    const usable = template.items.filter((item) => item.product.isActive);
    const skipped = template.items.length - usable.length;
    setActiveTemplateId(template.id);
    setNewTemplateName(null);
    setRecipientUnit(template.recipientUnit);
    setStorageLocation(template.storageLocation || '');
    setReceiverName(template.receiverName || '');
    setRows(
      usable.length
        ? usable.map((item) => ({ key: nextKey.current++, productId: item.productId, quantity: String(item.quantity) }))
        : [{ key: nextKey.current++, productId: '', quantity: '' }]
    );
    if (skipped > 0) showToast('Sebagian Dilewati', `${skipped} barang di paket ini sudah nonaktif dan tidak dimasukkan.`, 'error');
  };

  const clearTemplate = () => {
    setActiveTemplateId(null);
    setNewTemplateName(null);
    setRecipientUnit('');
    setStorageLocation('');
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
      setTemplates((current) =>
        [...current.filter((template) => template.id !== data.template.id), data.template].sort((a, b) => a.name.localeCompare(b.name, 'id'))
      );
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
      setTemplates((current) => current.filter((template) => template.id !== activeTemplate.id));
      setActiveTemplateId(null);
      showToast('Paket Dihapus', `Paket "${activeTemplate.name}" dihapus.`);
    } catch (error: any) {
      showToast('Gagal Menghapus', error.message, 'error');
    } finally {
      setTemplateBusy(false);
    }
  };

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = () => setRows((current) => [...current, { key: nextKey.current++, productId: '', quantity: '' }]);

  const removeRow = (key: number) =>
    setRows((current) => (current.length === 1 ? [{ key: nextKey.current++, productId: '', quantity: '' }] : current.filter((row) => row.key !== key)));

  const resetForm = () => {
    setSaved(null);
    setRecipientUnit('');
    setOrderNumber('');
    setStorageLocation('');
    setReceiverName('');
    setOfficerPhone('');
    setNotes('');
    if (isListrik) setHandoverName('');
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
          items: filledRows.map((state) => ({ productId: state.row.productId, quantity: state.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Form distribusi gagal disimpan.');
      setSaved({ ...data.distribution, proofToken: data.proofToken });
      showToast('Distribusi Tersimpan', `${data.distribution.number}: stok ${data.distribution.items.length} barang telah dikurangi.`);
      loadProducts();
      if (!recipients.includes(recipientUnit.trim())) setRecipients((current) => [recipientUnit.trim(), ...current]);
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
              itemsLabel={saved.items.map((item) => `${item.product.name} (${item.quantity} ${item.unit})`).join(', ')}
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
    <form onSubmit={submit} className="space-y-5">
      {usesTemplates && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-maroon-800" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Pilih Paket Distribusi</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Paket berisi daftar barang tetap untuk setiap unit. Pilih paket, lalu ubah jumlah atau tambah/hapus barang di tabel bila perlu.
          </p>
          {templates.length === 0 ? (
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
                    <span className="block text-[11px] text-slate-500">{template.items.length} barang</span>
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
            <input
              id="dist-recipient"
              required
              list="dist-recipient-options"
              value={recipientUnit}
              onChange={(e) => setRecipientUnit(e.target.value)}
              placeholder={group.recipientPlaceholder}
              maxLength={150}
              className={inputClass}
            />
            <datalist id="dist-recipient-options">
              {recipients.map((recipient) => (
                <option key={recipient} value={recipient} />
              ))}
            </datalist>
          </div>

          {isListrik && (
            <div>
              <label htmlFor="dist-handover" className="mb-1 block text-xs font-semibold text-slate-700">
                {group.handoverLabel} <span className="text-rose-500">*</span>
              </label>
              <input id="dist-handover" required value={handoverName} onChange={(e) => setHandoverName(e.target.value)} placeholder="Petugas yang memasang/mengambil" maxLength={150} className={inputClass} />
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
                <input id="dist-handover" required value={handoverName} onChange={(e) => setHandoverName(e.target.value)} maxLength={150} className={inputClass} />
              </div>
            </>
          )}

          <div>
            <label htmlFor="dist-receiver" className="mb-1 block text-xs font-semibold text-slate-700">
              Penerima <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input id="dist-receiver" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder={isListrik ? 'Boleh dikosongkan' : 'Nama penerima (boleh diisi saat tanda tangan)'} maxLength={150} className={inputClass} />
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
            <p className="text-xs text-slate-500">Hanya barang aktif berjenis {group.label} yang bisa dipilih.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{filledRows.length} barang</span>
        </div>

        <div className="divide-y divide-slate-100">
          {rowState.map(({ row, product, overStock, validQuantity }, index) => {
            const takenElsewhere = new Set(rows.filter((other) => other.key !== row.key).map((other) => other.productId));
            const options = products.filter((option) => !takenElsewhere.has(option.id));
            return (
              <div key={row.key} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5 py-3 sm:grid-cols-[2rem_1fr_9rem_2.5rem]">
                <span className="pt-2.5 text-xs font-bold text-slate-400">{index + 1}</span>
                <div className="min-w-0">
                  <ProductPicker
                    id={`dist-product-${row.key}`}
                    products={options}
                    value={row.productId}
                    onChange={(productId) => updateRow(row.key, { productId })}
                    loading={productsLoading}
                    showHint={false}
                    required={rows.length === 1}
                    placeholder={isListrik ? 'Cari alat, contoh: lampu LED' : 'Cari barang, contoh: kertas A4'}
                  />
                  {product && (
                    <p className={cn('mt-1 text-[11px]', product.currentStock === 0 ? 'text-rose-600' : 'text-slate-500')}>
                      Stok tersedia: {product.currentStock} {product.unit}
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
                        inputMode="numeric"
                        min={1}
                        step={1}
                        max={product?.currentStock}
                        required={Boolean(row.productId)}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        placeholder="Jumlah"
                        aria-invalid={overStock || (Boolean(row.quantity) && !validQuantity)}
                        className={cn(inputClass, 'pr-14', overStock && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20')}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{product?.unit || ''}</span>
                    </div>
                    {overStock && <p className="mt-1 text-[11px] text-rose-600">Melebihi stok.</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Hapus baris ${index + 1}`}
                    className="action-button action-icon action-danger mt-0.5 sm:hidden"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  aria-label={`Hapus baris ${index + 1}`}
                  className="action-button action-icon action-danger mt-0.5 hidden sm:inline-flex"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
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
            <Send className="h-4 w-4" />
            {submitting ? 'Menyimpan...' : 'Simpan & Kurangi Stok'}
          </button>
        </div>
      </section>
    </form>
  );
}
