'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { formatStock } from '@/lib/product-units';

interface Product {
  id: string;
  name: string;
  unit: string;
  packUnit: string | null;
  packSize: number | null;
  currentStock: number;
  categoryName: string;
  stockGroup: 'ATK' | 'LOGISTIK';
}

interface CustomRow {
  key: number;
  name: string;
  specification: string;
  unit: string;
  quantity: string;
  itemNotes: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20';

/**
 * Form pengajuan pengadaan barang ATK dari divisi (mengikuti template resmi
 * "PENGAJUAN PENGADAAN BARANG ATK — UNIVERSITAS TEKNOKRAT INDONESIA":
 * Nama Barang, Spesifikasi, Kebutuhan*, Ket., Ka. Divisi, Yang Mengajukan + tanda tangan digital).
 */
export function DivisiRequestForm({ divisionName, template }: {
  divisionName: string;
  template: { name: string; items: { productId: string; quantity: number }[] } | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productsError, setProductsError] = useState(false);
  const [search, setSearch] = useState('');
  // Jumlah dibutuhkan (Kebutuhan*), spesifikasi, & keterangan per barang master.
  const [qty, setQty] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<Record<string, string>>({});
  const [itemNote, setItemNote] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [receiverName, setReceiverName] = useState('');
  const [divisionHeadName, setDivisionHeadName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/divisi/products', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) setProducts(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProductsError(true);
      });
    return () => controller.abort();
  }, []);

  const templateRows = useMemo(() => new Map(
    template?.items.map((item, index) => [item.productId, { index, quantity: item.quantity }])
  ), [template]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(
      (p) => p.stockGroup === 'ATK' && (!q || p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q))
    ).sort((a, b) => (templateRows.get(a.id)?.index ?? Infinity) - (templateRows.get(b.id)?.index ?? Infinity));
  }, [products, search, templateRows]);

  const chosen = (products ?? []).filter((p) => p.stockGroup === 'ATK' && Number(qty[p.id]) > 0);
  const customFilled = custom.filter((row) => row.name.trim() && Number(row.quantity) > 0);
  const totalItems = chosen.length + customFilled.length;

  const addCustom = () =>
    setCustom((rows) => [...rows, { key: Date.now() + rows.length, name: '', specification: '', unit: 'Pcs', quantity: '', itemNotes: '' }]);
  const updateCustom = (key: number, patch: Partial<CustomRow>) =>
    setCustom((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalItems === 0) {
      showToast('Belum Ada Barang', 'Isi jumlah kebutuhan pada minimal satu barang.', 'error');
      return;
    }
    if (custom.some((row) => (row.name.trim() !== '') !== (Number(row.quantity) > 0))) {
      showToast('Barang Lainnya Belum Lengkap', 'Isi nama dan jumlah pada setiap baris barang lainnya, atau hapus barisnya.', 'error');
      return;
    }
    if (!signature) {
      showToast('Tanda Tangan Kosong', 'Goreskan tanda tangan digital sebelum mengirim.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/divisi/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockGroup: 'ATK',
          notes,
          receiverName,
          divisionHeadName,
          signature,
          items: [
            ...chosen.map((p) => ({
              productId: p.id,
              quantity: Number(qty[p.id]),
              specification: spec[p.id] || '',
              itemNotes: itemNote[p.id] || '',
            })),
            ...customFilled.map((row) => ({
              name: row.name,
              unit: row.unit,
              specification: row.specification,
              itemNotes: row.itemNotes,
              quantity: Number(row.quantity),
            })),
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pengajuan gagal dikirim.');
      showToast('Pengajuan Terkirim', `Nomor ${data.request.number}. Menunggu review admin.`);
      router.push('/divisi/riwayat');
    } catch (err: any) {
      showToast('Gagal Mengirim', err.message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div>
        <p className="text-sm font-semibold text-slate-800">{divisionName}</p>
        <p className="text-xs text-slate-500">{template ? `Template ATK ${template.name}` : 'Formulir ATK standar'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="req-name" className="mb-1 block text-xs font-semibold text-slate-700">
            Yang Mengajukan (Nama) <span className="text-rose-500">*</span>
          </label>
          <input
            id="req-name"
            required
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            maxLength={100}
            placeholder="Contoh: Ageng Nugrahani, S.Kom."
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Tercetak pada kolom <strong>Yang Mengajukan</strong> di surat pengajuan &amp; <strong>Penerima</strong> di form distribusi.
          </p>
        </div>
        <div>
          <label htmlFor="req-head" className="mb-1 block text-xs font-semibold text-slate-700">
            Mengetahui — Ka. Divisi <span className="font-normal text-slate-400">(opsional)</span>
          </label>
          <input
            id="req-head"
            value={divisionHeadName}
            onChange={(e) => setDivisionHeadName(e.target.value)}
            maxLength={100}
            placeholder="Nama Kepala Divisi (kosongkan jika diisi manual)"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Tercetak pada kolom <strong>Mengetahui, Ka. Divisi</strong> di PDF pengajuan.
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">Cari Barang ATK</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama barang atau kategori" className={`${inputClass} pl-9`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[26rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Nama Barang</th>
                <th className="hidden px-3 py-2 md:table-cell">Spesifikasi</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="w-36 px-3 py-2">Kebutuhan*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productsError ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-rose-600" role="alert">Daftar barang gagal dimuat. Muat ulang halaman untuk mencoba lagi.</td>
                </tr>
              ) : products === null ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Memuat daftar barang...</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Barang tidak ditemukan. Gunakan &quot;Barang Lainnya&quot; di bawah bila perlu.</td>
                </tr>
              ) : (
                visible.map((p) => {
                  const empty = p.currentStock <= 0;
                  const chosenQty = Number(qty[p.id]) > 0;
                  const over = Number(qty[p.id]) > p.currentStock;
                  const suggestedQuantity = templateRows.get(p.id)?.quantity;
                  return (
                    <tr key={p.id} className={chosenQty ? 'bg-maroon-50/40' : undefined}>
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-[11px] text-slate-500">{p.categoryName}</p>
                        {suggestedQuantity !== undefined && (
                          <p className="text-[11px] text-maroon-800">Jumlah di template {suggestedQuantity} {p.unit}</p>
                        )}
                        {chosenQty && (
                          <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row">
                            <input
                              value={spec[p.id] ?? ''}
                              onChange={(e) => setSpec((cur) => ({ ...cur, [p.id]: e.target.value }))}
                              maxLength={120}
                              placeholder="Spesifikasi (opsional)"
                              aria-label={`Spesifikasi ${p.name}`}
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-maroon-700 focus:outline-none md:hidden"
                            />
                            <input
                              value={itemNote[p.id] ?? ''}
                              onChange={(e) => setItemNote((cur) => ({ ...cur, [p.id]: e.target.value }))}
                              maxLength={150}
                              placeholder="Ket. baris ini (opsional)"
                              aria-label={`Keterangan ${p.name}`}
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-maroon-700 focus:outline-none"
                            />
                          </div>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 align-top md:table-cell">
                        <input
                          value={spec[p.id] ?? ''}
                          onChange={(e) => setSpec((cur) => ({ ...cur, [p.id]: e.target.value }))}
                          maxLength={120}
                          placeholder="Merek / ukuran / warna"
                          aria-label={`Spesifikasi ${p.name}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-maroon-700 focus:outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className={`px-3 py-2 align-top text-right font-semibold ${empty ? 'text-rose-600' : 'text-slate-700'}`}>
                        {empty ? 'Habis' : formatStock(p, p.currentStock)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={qty[p.id] ?? ''}
                            onChange={(e) => setQty((cur) => ({ ...cur, [p.id]: e.target.value }))}
                            placeholder="0"
                            aria-label={`Kebutuhan ${p.name}`}
                            className={`w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-slate-100 ${over ? 'border-rose-400' : 'border-slate-200'}`}
                          />
                          <span className="text-xs text-slate-500">{p.unit}</span>
                        </div>
                        {over && <p className="mt-0.5 text-[10px] text-rose-600">Melebihi stok</p>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          Ket : *Jumlah yang dibutuhkan. Kolom Pesanan (ACC) diisi oleh admin saat review.
        </div>
      </div>

      {/* Barang di luar daftar/template */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-800">Barang Lainnya (tidak ada di daftar)</p>
            <p className="text-[11px] text-slate-500">Isi nama barang, spesifikasi, jumlah kebutuhan, satuan, dan keterangan.</p>
          </div>
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>
        {custom.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {custom.map((row, index) => (
              <div key={row.key} className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                <div className="grid grid-cols-[1fr_4.5rem_5rem_2rem] items-center gap-2 sm:grid-cols-[1fr_5.5rem_6.5rem_2rem]">
                  <input
                    value={row.name}
                    onChange={(e) => updateCustom(row.key, { name: e.target.value })}
                    maxLength={150}
                    placeholder="Nama barang"
                    aria-label={`Nama barang lainnya ${index + 1}`}
                    className={`${inputClass} bg-white`}
                  />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) => updateCustom(row.key, { quantity: e.target.value })}
                    placeholder="Jml"
                    aria-label={`Kebutuhan barang lainnya ${index + 1}`}
                    className={`${inputClass} bg-white`}
                  />
                  <input
                    value={row.unit}
                    onChange={(e) => updateCustom(row.key, { unit: e.target.value })}
                    maxLength={30}
                    placeholder="Satuan"
                    aria-label={`Satuan barang lainnya ${index + 1}`}
                    className={`${inputClass} bg-white`}
                  />
                  <button
                    type="button"
                    onClick={() => setCustom((rows) => rows.filter((r) => r.key !== row.key))}
                    aria-label={`Hapus barang lainnya ${index + 1}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={row.specification}
                    onChange={(e) => updateCustom(row.key, { specification: e.target.value })}
                    maxLength={120}
                    placeholder="Spesifikasi (opsional)"
                    aria-label={`Spesifikasi barang lainnya ${index + 1}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-maroon-700 focus:outline-none"
                  />
                  <input
                    value={row.itemNotes}
                    onChange={(e) => updateCustom(row.key, { itemNotes: e.target.value })}
                    maxLength={150}
                    placeholder="Ket. (opsional)"
                    aria-label={`Keterangan barang lainnya ${index + 1}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-maroon-700 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">Catatan Umum (opsional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Keperluan atau keterangan tambahan" className={inputClass} />
      </div>

      <div className="sm:max-w-sm">
        <SignaturePad label="Tanda Tangan Yang Mengajukan *" onChange={setSignature} />
        <p className="mt-1 text-[11px] text-slate-500">Tanda tangan tercetak pada surat pengajuan &amp; form distribusi barang saat disetujui.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{totalItems} barang dipilih</p>
        <button
          type="submit"
          disabled={submitting || totalItems === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-maroon-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-maroon-900 disabled:opacity-50"
        >
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Pengajuan
        </button>
      </div>
    </form>
  );
}
