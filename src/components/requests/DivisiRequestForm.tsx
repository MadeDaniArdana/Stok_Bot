'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Search, Send } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
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

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20';

export function DivisiRequestForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [group, setGroup] = useState<'ATK' | 'LOGISTIK'>('ATK');
  const [search, setSearch] = useState('');
  // Jumlah diminta per barang (kosong/0 = tidak diminta), satuan dasar barang.
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/divisi/products', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProducts);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => p.stockGroup === group && (!q || p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q)));
  }, [products, group, search]);

  const chosen = (products ?? []).filter((p) => p.stockGroup === group && Number(qty[p.id]) > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chosen.length === 0) {
      showToast('Belum Ada Barang', 'Isi jumlah pada minimal satu barang.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/divisi/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockGroup: group, notes, items: chosen.map((p) => ({ productId: p.id, quantity: Number(qty[p.id]) })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pengajuan gagal dikirim.');
      showToast('Pengajuan Terkirim', `Nomor ${data.request.number}. Menunggu persetujuan admin.`);
      router.push('/divisi/riwayat');
    } catch (err: any) {
      showToast('Gagal Mengirim', err.message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis Barang</label>
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as 'ATK' | 'LOGISTIK');
              setQty({});
              setSearch('');
            }}
            className={inputClass}
          >
            <option value="ATK">ATK</option>
            <option value="LOGISTIK">Logistik</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Cari Barang</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama barang atau kategori" className={`${inputClass} pl-9`} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[26rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Barang</th>
                <th className="hidden px-3 py-2 sm:table-cell">Kategori</th>
                <th className="px-3 py-2 text-right">Sisa Stok</th>
                <th className="w-32 px-3 py-2">Jumlah Diminta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products === null ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Memuat daftar barang...</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Barang tidak ditemukan.</td>
                </tr>
              ) : (
                visible.map((p) => {
                  const empty = p.currentStock <= 0;
                  const over = Number(qty[p.id]) > p.currentStock;
                  return (
                    <tr key={p.id} className={Number(qty[p.id]) > 0 ? 'bg-maroon-50/40' : undefined}>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="hidden px-3 py-2 text-slate-500 sm:table-cell">{p.categoryName}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${empty ? 'text-rose-600' : 'text-slate-700'}`}>{empty ? 'Habis' : formatStock(p, p.currentStock)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={empty}
                            value={qty[p.id] ?? ''}
                            onChange={(e) => setQty((cur) => ({ ...cur, [p.id]: e.target.value }))}
                            placeholder="0"
                            aria-label={`Jumlah ${p.name}`}
                            className={`w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-slate-100 ${over ? 'border-rose-400' : 'border-slate-200'}`}
                          />
                          <span className="text-xs text-slate-500">{p.unit}</span>
                        </div>
                        {over && <p className="mt-0.5 text-[10px] text-rose-600">Melebihi sisa stok</p>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">Catatan (opsional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Keperluan atau keterangan tambahan" className={inputClass} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{chosen.length} barang dipilih</p>
        <button type="submit" disabled={submitting || chosen.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-maroon-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-maroon-900 disabled:opacity-50">
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Pengajuan
        </button>
      </div>
    </form>
  );
}
