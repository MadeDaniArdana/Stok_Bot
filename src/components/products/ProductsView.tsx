'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';
import dynamic from 'next/dynamic';
import { UnitInput } from '@/components/products/UnitInput';
import { formatStock } from '@/lib/product-units';
import { cn } from '@/lib/cn';
import { getStockGroup, type StockGroup } from '@/lib/stock-groups';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Edit2,
  Power,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

// Form Barang Masuk hanya dipakai di dalam modal, jadi kodenya dimuat saat modal dibuka.
const StockEntryForm = dynamic(
  () => import('@/components/products/StockEntryForm').then((mod) => mod.StockEntryForm),
  { ssr: false, loading: () => <p className="p-6 text-sm text-slate-500">Memuat formulir...</p> }
);

function ProductsContent({ stockGroup }: { stockGroup: StockGroup | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const group = stockGroup ? getStockGroup(stockGroup) : null;
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  // Kata kunci yang benar-benar dikirim ke API, menunggu 300 ms setelah berhenti mengetik.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [stockStatus, setStockStatus] = useState(searchParams.get('stockStatus') || 'all');
  const [status, setStatus] = useState('all');
  // Halaman per jenis (/products/atk, dst.) hanya menampilkan kategori & barang jenis tersebut.
  const visibleCategories = stockGroup ? categories.filter((c) => c.stockGroup === stockGroup) : categories;

  // Modals
  const [stockEntry, setStockEntry] = useState<{ productId?: string; mode: 'existing' | 'new' } | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const entryParam = searchParams.get('entry');
  const entryProductId = searchParams.get('productId') || '';
  const entryMode = searchParams.get('mode') === 'new' ? 'new' : 'existing';

  useEffect(() => {
    if (entryParam === 'stock' || entryProductId || entryMode === 'new') {
      setStockEntry({ productId: entryProductId, mode: entryMode });
    } else {
      setStockEntry(null);
    }
  }, [entryParam, entryProductId, entryMode]);

  const closeStockEntry = () => {
    setStockEntry(null);
    if (!searchParams.has('entry') && !searchParams.has('productId') && !searchParams.has('mode')) return;
    const query = new URLSearchParams(searchParams.toString());
    query.delete('entry');
    query.delete('productId');
    query.delete('mode');
    router.replace(`${pathname}${query.size ? `?${query.toString()}` : ''}`, { scroll: false });
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formSubUnit, setFormSubUnit] = useState('');
  const [formPackSize, setFormPackSize] = useState('');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch products
  // Penanda permintaan terbaru + AbortController agar respons lama tidak menimpa hasil filter terbaru.
  const latestRequest = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const fetchProducts = async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const requestId = ++latestRequest.current;
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search: debouncedSearch,
        categoryId,
        stockStatus,
        status,
        limit: '500',
        ...(stockGroup ? { jenis: stockGroup } : {}),
      }).toString();

      const res = await fetch(`/api/products?${query}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (requestId === latestRequest.current) setProducts(data.items || []);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProducts();
    return () => fetchAbortRef.current?.abort();
  }, [debouncedSearch, categoryId, stockStatus, status, stockGroup]);

  // Open Edit Modal
  const openEdit = (p: any) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategoryId(p.categoryId || '');
    setFormUnit(p.unit);
    setFormSubUnit('');
    setFormPackSize('');
    setFormMinStock(String(p.minimumStock));
    setFormDesc(p.description || '');
  };

  // Handle Update Product
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          categoryId: formCategoryId || null,
          unit: formUnit.trim().toLowerCase(),
          minimumStock: Number(formMinStock),
          ...(formSubUnit.trim() && { subUnit: formSubUnit.trim().toLowerCase(), packSize: Number(formPackSize) }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui data');

      showToast('Berhasil Diperbarui', `Informasi barang "${formName}" telah disimpan. SKU: ${data.product.sku}.`);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      showToast('Gagal Edit', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Status (Soft Deactivation)
  const handleToggleStatus = async (p: any) => {
    const actionLabel = p.isActive ? 'menonaktifkan' : 'mengaktifkan kembali';
    if (!confirm(`Apakah Anda yakin ingin ${actionLabel} barang "${p.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(
        p.isActive ? 'Barang Dinonaktifkan' : 'Barang Diaktifkan',
        p.isActive
          ? 'Barang tidak dapat dipilih pada transaksi baru, namun histori tetap tersimpan.'
          : 'Barang kembali aktif untuk transaksi.'
      );
      fetchProducts();
    } catch (e: any) {
      showToast('Gagal', e.message, 'error');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCategoryId('');
    setFormUnit('pcs');
    setFormMinStock('5');
    setFormDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            {group ? `Master Barang ${group.label}` : 'Semua Barang'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {group
              ? `${group.description} Kelola data barang, tambah stok, dan batas minimum persediaan.`
              : 'Seluruh barang dari jenis Peralatan Listrik, Logistik, dan ATK'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStockEntry({ mode: 'existing' })}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white text-xs font-semibold shadow-soft hover:shadow-maroon transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Barang / Stok</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Barang atau SKU..."
              className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
          </div>

          {/* Filter Category */}
          <div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Semua Kategori</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Stock Status */}
          <div>
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Semua Kondisi Stok</option>
              <option value="safe">🟢 Stok Aman (&gt; Min)</option>
              <option value="low">🟡 Stok Rendah (&le; Min)</option>
              <option value="empty">🔴 Stok Habis (0)</option>
            </select>
          </div>

          {/* Filter Active Status */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Status: Semua</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif Saja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Kode SKU</th>
                <th className="py-3.5 px-4">Nama Barang</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4 text-center">Stok Saat Ini</th>
                <th className="py-3.5 px-4 text-center">Batas Min</th>
                <th className="py-3.5 px-4 text-center">Satuan</th>
                <th className="py-3.5 px-4 text-center">Kondisi</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Memuat data barang...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Belum ada data barang yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isZero = p.currentStock === 0;
                  const isLow = p.currentStock > 0 && p.currentStock <= p.minimumStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{p.description}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.category?.name || '-'}
                        {!stockGroup && p.category && (
                          <span className={cn('mt-1 block w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold', getStockGroup(p.category.stockGroup).badgeClass)}>
                            {getStockGroup(p.category.stockGroup).label}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-sm">
                        <span className={isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>
                          {p.packSize ? formatStock(p, p.currentStock) : p.currentStock}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500">
                        {p.minimumStock}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                          {p.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" />
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            Rendah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.isActive ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <>
                              {/* Edit Master */}
                              <button
                                onClick={() => openEdit(p)}
                                className="action-button action-icon action-edit"
                                aria-label={`Edit ${p.name}`}
                                title="Edit Master Barang"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleStatus(p)}
                                className={cn('action-button action-icon', p.isActive ? 'action-danger' : 'action-success')}
                                aria-label={`${p.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${p.name}`}
                                title={p.isActive ? 'Nonaktifkan Barang' : 'Aktifkan Kembali'}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stockEntry && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-entry-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
        >
          <div className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xl sm:p-6">
            <StockEntryForm
              key={`${stockEntry.mode}:${stockEntry.productId || ''}`}
              initialProductId={stockEntry.productId}
              initialMode={stockEntry.mode}
              stockGroup={stockGroup}
              onCancel={closeStockEntry}
              onSaved={() => {
                closeStockEntry();
                fetchProducts();
              }}
            />
          </div>
        </ModalOverlay>
      )}

      {/* Modal Edit Master Barang */}
      {editingProduct && (
        <ModalOverlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-maroon-800" />
                Edit Master: {editingProduct.name}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 pt-4 text-sm">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                Stok saat ini: <strong>{editingProduct.currentStock} {editingProduct.unit}</strong>. Gunakan tombol <strong>Tambah Barang / Stok</strong> di atas tabel untuk mencatat penerimaan. Stok keluar tercatat melalui <strong>Form Distribusi</strong> atau laporan pemasangan.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode SKU (otomatis)
                  </label>
                  <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-600">
                    {editingProduct.sku}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    required={Boolean(editingProduct.categoryId)}
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                  >
                    {!editingProduct.categoryId && <option value="">Pilih Kategori...</option>}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({getStockGroup(c.stockGroup).shortLabel})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">
                    SKU otomatis mengikuti kategori jika kategori barang diubah.
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-product-unit" className="block font-semibold text-slate-700 mb-1">
                    Satuan Dasar
                  </label>
                  <UnitInput
                    id="edit-product-unit"
                    value={formUnit}
                    onChange={setFormUnit}
                    disabled={isSubmitting || Boolean(editingProduct.packSize)}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>
              </div>

              {editingProduct.packSize ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  Satuan kemasan: 1 <strong>{editingProduct.packUnit}</strong> = {editingProduct.packSize} <strong>{editingProduct.unit}</strong>.
                  Stok dan batas minimum disimpan dalam {editingProduct.unit}.
                </p>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-3">
                  <p className="mb-2 font-semibold text-slate-700">Bisa diambil per satuan kecil? (opsional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-product-subunit" className="block text-[11px] text-slate-500 mb-1">Satuan kecil (mis. pcs, gram)</label>
                      <UnitInput id="edit-product-subunit" value={formSubUnit} onChange={setFormSubUnit} disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Isi per 1 {formUnit || 'satuan'}</label>
                      <input
                        type="number"
                        min="2"
                        step="1"
                        value={formPackSize}
                        onChange={(e) => setFormPackSize(e.target.value)}
                        placeholder="mis. 24 atau 1000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                      />
                    </div>
                  </div>
                  {formSubUnit.trim() && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Stok, batas minimum, dan riwayat barang ini akan dikonversi ke {formSubUnit.trim()} (1 {formUnit} = {formPackSize || '?'} {formSubUnit.trim()}). Tidak bisa dibatalkan.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
}

/** Dipakai oleh /products (semua jenis) dan /products/[jenis]. */
export function ProductsView({ stockGroup }: { stockGroup: StockGroup | null }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat Master Barang...</div>}>
      <ProductsContent key={stockGroup ?? 'all'} stockGroup={stockGroup} />
    </Suspense>
  );
}
