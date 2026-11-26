'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';
import dynamic from 'next/dynamic';
import { UnitInput } from '@/components/products/UnitInput';
import { formatStock } from '@/lib/product-units';
import { checkPackSetup, type PackCheck } from '@/lib/unit-guard';
import { cn } from '@/lib/cn';
import { getStockGroup, type StockGroup } from '@/lib/stock-groups';
import { getCurrentReportMonth } from '@/lib/report-period';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Edit2,
  Power,
  Trash2,
  Scale,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';
import { fetchSwrJson, getSwrCache, invalidateSwrPrefix } from '@/lib/client-swr';
import { clearDistributionBootstrapCache } from '@/lib/distribution-bootstrap';

// Form Barang Masuk hanya dipakai di dalam modal, jadi kodenya dimuat saat modal dibuka.
const StockEntryForm = dynamic(
  () => import('@/components/products/StockEntryForm').then((mod) => mod.StockEntryForm),
  { ssr: false, loading: () => <p className="p-6 text-sm text-slate-500">Memuat formulir...</p> }
);

/** Baris laporan posisi stok -> Map per id barang. */
function toPositionMap(report: any): Map<string, any> {
  return new Map((report?.rows || []).map((row: any) => [row.id, row]));
}

/** Label bulan "2026-11" -> "November 2026". */
function monthLabel(value: string) {
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}

function ProductsContent({ stockGroup }: { stockGroup: StockGroup | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const group = stockGroup ? getStockGroup(stockGroup) : null;
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  // Kata kunci yang benar-benar dikirim ke API, menunggu 300 ms setelah berhenti mengetik.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [stockStatus, setStockStatus] = useState(searchParams.get('stockStatus') || 'all');
  const [status, setStatus] = useState('all');

  const buildProductsUrl = (opts?: { s?: string; cat?: string; ss?: string; st?: string }) => {
    const query = new URLSearchParams({
      search: opts?.s ?? debouncedSearch,
      categoryId: opts?.cat ?? categoryId,
      stockStatus: opts?.ss ?? stockStatus,
      status: opts?.st ?? status,
      limit: '500',
      ...(stockGroup ? { jenis: stockGroup } : {}),
    }).toString();
    return `/api/products?${query}`;
  };

  const initialProductsUrl = buildProductsUrl({ s: '', cat: 'all', ss: searchParams.get('stockStatus') || 'all', st: 'all' });
  const [products, setProducts] = useState<any[]>(() => getSwrCache<any>(initialProductsUrl)?.items || []);
  const [categories, setCategories] = useState<any[]>(() => getSwrCache<any[]>('/api/categories') || []);
  const [loading, setLoading] = useState(() => !getSwrCache<any>(initialProductsUrl));
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
  // Edit kemasan untuk barang yang sudah berkemasan.
  const [formPackUnit, setFormPackUnit] = useState('');
  const [formRemovePack, setFormRemovePack] = useState(false);
  // Barang tanpa satuan beli: aktifkan "1 <satuan beli> = <isi> <satuan dasar>".
  const [formUsePack, setFormUsePack] = useState(false);
  // Angka stok yang tersimpan sekarang dihitung dalam satuan beli atau satuan dasar (null = tebak otomatis).
  const [formStockInManual, setFormStockInManual] = useState<'beli' | 'dasar' | null>(null);
  const [formMinStock, setFormMinStock] = useState('5');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Penyesuaian stok (stok opname) di modal edit.
  const [adjQty, setAdjQty] = useState('');
  const [adjUnit, setAdjUnit] = useState<'base' | 'pack'>('base');
  const [adjReason, setAdjReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // Posisi stok per bulan untuk kolom tabel.
  const currentMonth = getCurrentReportMonth();
  const [periodMonth, setPeriodMonth] = useState(currentMonth);
  const positionUrl = `/api/reports/stock-position?periode=${periodMonth}${stockGroup ? `&jenis=${stockGroup}` : ''}`;
  const [positions, setPositions] = useState<Map<string, any>>(() => toPositionMap(getSwrCache<any>(positionUrl)));
  const [positionLoading, setPositionLoading] = useState(false);
  const isCurrentMonth = periodMonth === currentMonth;

  // Fetch products
  // Penanda permintaan terbaru + AbortController agar respons lama tidak menimpa hasil filter terbaru.
  const latestRequest = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const fetchProducts = async (force = false) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const requestId = ++latestRequest.current;
    const url = buildProductsUrl();
    const cached = getSwrCache<any>(url);
    if (cached && !force) {
      setProducts(cached.items || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const data = await fetchSwrJson<any>(url, { force, signal: controller.signal });
      if (requestId === latestRequest.current) setProducts(data.items || []);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  const positionRequest = useRef(0);
  const fetchPositions = async (force = false) => {
    if (!isAdmin) return;
    const requestId = ++positionRequest.current;
    const cached = getSwrCache<any>(positionUrl);
    if (cached && !force) setPositions(toPositionMap(cached));
    else setPositionLoading(true);
    try {
      const data = await fetchSwrJson<any>(positionUrl, { force });
      if (requestId === positionRequest.current) setPositions(toPositionMap(data));
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === positionRequest.current) setPositionLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [positionUrl, isAdmin]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const data = await fetchSwrJson<any[]>('/api/categories');
      setCategories(data || []);
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
    setFormPackSize(p.packSize ? String(p.packSize) : '');
    setFormPackUnit(p.packUnit || '');
    setFormRemovePack(false);
    setFormUsePack(false);
    setFormStockInManual(null);
    setFormMinStock(String(p.minimumStock));
    setFormDesc(p.description || '');
    setAdjQty('');
    setAdjUnit('base');
    setAdjReason('');
  };

  // Stok fisik yang diisi, dikonversi ke satuan dasar.
  const adjActual = (() => {
    if (!editingProduct || adjQty.trim() === '') return null;
    const n = Number(adjQty);
    if (!Number.isFinite(n) || n < 0) return null;
    const factor = adjUnit === 'pack' && editingProduct.packSize ? editingProduct.packSize : 1;
    const base = n * factor;
    return Number.isSafeInteger(base) ? base : null;
  })();
  const adjDiff = adjActual === null || !editingProduct ? null : adjActual - editingProduct.currentStock;

  const refreshAfterStockChange = () => {
    invalidateSwrPrefix('/api/products');
    invalidateSwrPrefix('/api/reports');
    invalidateSwrPrefix('/api/stock');
    clearDistributionBootstrapCache();
    fetchProducts(true);
    fetchPositions(true);
  };

  const handleAdjust = async () => {
    if (!editingProduct || adjActual === null || !adjDiff) return;
    if (!adjReason.trim()) {
      showToast('Alasan Wajib Diisi', 'Tulis alasan penyesuaian, mis. hasil stok opname, barang rusak, atau salah input.', 'error');
      return;
    }
    const sign = adjDiff > 0 ? '+' : '-';
    if (!confirm(`Sesuaikan stok "${editingProduct.name}"?

${formatStock(editingProduct, editingProduct.currentStock)} -> ${formatStock(editingProduct, adjActual)} (${sign}${formatStock(editingProduct, Math.abs(adjDiff))})

Alasan: ${adjReason.trim()}`)) return;

    try {
      setAdjSubmitting(true);
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: editingProduct.id, actualStock: adjActual, reason: adjReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Penyesuaian gagal disimpan.');

      showToast('Stok Disesuaikan', `Stok "${editingProduct.name}" sekarang ${formatStock(editingProduct, adjActual)}.`);
      setEditingProduct({ ...editingProduct, currentStock: adjActual });
      setAdjQty('');
      setAdjReason('');
      refreshAfterStockChange();
    } catch (err: any) {
      showToast('Gagal Menyesuaikan', err.message, 'error');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Satuan stok sekarang: otomatis "beli" bila nama satuan beli sama dengan satuan barang saat ini.
  const stockIn: 'beli' | 'dasar' =
    formStockInManual ??
    (editingProduct && formPackUnit.trim().toLowerCase() === String(editingProduct.unit).toLowerCase() ? 'beli' : 'dasar');

  // Pengaturan kemasan yang sedang diisi: "1 <pack> = <size> <base>".
  const packDraft: { pack: string; size: number; base: string; stock: number } | null = (() => {
    if (!editingProduct) return null;
    const size = Number(formPackSize);
    if (editingProduct.packSize) {
      return formRemovePack ? null : { pack: formPackUnit, size, base: formUnit, stock: editingProduct.currentStock };
    }
    if (formUsePack && formPackUnit.trim() && formSubUnit.trim()) {
      const factor = stockIn === 'beli' && Number.isFinite(size) && size > 0 ? size : 1;
      return { pack: formPackUnit, size, base: formSubUnit, stock: editingProduct.currentStock * factor };
    }
    return null;
  })();
  const packCheck = packDraft && formPackSize ? checkPackSetup(packDraft.pack, packDraft.size, packDraft.base) : null;

  // Tukar kemasan <-> satuan dasar bila tertukar.
  const swapPack = () => {
    if (!editingProduct) return;
    if (editingProduct.packSize) {
      const pack = formPackUnit;
      setFormPackUnit(formUnit);
      setFormUnit(pack);
    } else if (formUsePack) {
      setFormPackUnit(formSubUnit);
      setFormSubUnit(formPackUnit);
      // Angka stok tetap milik nama satuan yang sama, jadi perannya ikut berpindah.
      setFormStockInManual(stockIn === 'beli' ? 'dasar' : 'beli');
    }
  };

  // Handle Update Product
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (packCheck?.errors.length) {
      showToast('Periksa Satuan Kemasan', packCheck.errors[0], 'error');
      return;
    }
    if (packCheck?.warnings.length && packDraft) {
      const ok = confirm(
        `Periksa lagi pengaturan kemasan:\n\n1 ${packDraft.pack} = ${packDraft.size} ${packDraft.base}\n\n- ${packCheck.warnings.join('\n- ')}\n\nTetap simpan?`
      );
      if (!ok) return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          categoryId: formCategoryId || null,
          ...(!editingProduct.packSize && formUsePack && formPackUnit.trim() && formSubUnit.trim()
            ? {}
            : { unit: formUnit.trim().toLowerCase() }),
          minimumStock: Number(formMinStock),
          ...(editingProduct.packSize
            ? formRemovePack
              ? { removePack: true }
              : { packUnit: formPackUnit.trim().toLowerCase(), packSize: Number(formPackSize) }
            : formUsePack && formPackUnit.trim() && formSubUnit.trim()
              ? stockIn === 'beli'
                ? // Angka sekarang dalam satuan beli -> dikalikan isi menjadi satuan dasar.
                  { unit: formPackUnit.trim().toLowerCase(), subUnit: formSubUnit.trim().toLowerCase(), packSize: Number(formPackSize) }
                : // Angka sekarang sudah dalam satuan dasar -> tidak dikonversi.
                  { unit: formSubUnit.trim().toLowerCase(), packUnit: formPackUnit.trim().toLowerCase(), packSize: Number(formPackSize) }
              : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui data');

      showToast('Berhasil Diperbarui', `Informasi barang "${formName}" telah disimpan. SKU: ${data.product.sku}.`);
      setEditingProduct(null);
      resetForm();
      invalidateSwrPrefix('/api/products');
      invalidateSwrPrefix('/api/reports/summary');
      clearDistributionBootstrapCache();
      fetchProducts(true);
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
      invalidateSwrPrefix('/api/products');
      invalidateSwrPrefix('/api/reports/summary');
      clearDistributionBootstrapCache();
      fetchProducts(true);
    } catch (e: any) {
      showToast('Gagal', e.message, 'error');
    }
  };

  // Hapus permanen (hanya barang yang belum dipakai di distribusi / tugas pemasangan).
  const handleDelete = async (p: any) => {
    if (!confirm(`Hapus permanen barang "${p.name}"?\n\nRiwayat stok barang ini ikut terhapus dan tidak bisa dikembalikan. Jika barang sudah dipakai di dokumen distribusi atau tugas, hapus akan ditolak (gunakan Nonaktifkan).`)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${p.id}?permanent=1`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Barang gagal dihapus.');

      showToast('Barang Dihapus', `"${p.name}" telah dihapus permanen.`);
      invalidateSwrPrefix('/api/products');
      invalidateSwrPrefix('/api/reports');
      clearDistributionBootstrapCache();
      fetchProducts(true);
    } catch (e: any) {
      showToast('Tidak Bisa Dihapus', e.message, 'error');
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
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
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

          {/* Periode kolom stok */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={periodMonth}
                max={currentMonth}
                onChange={(e) => e.target.value && setPeriodMonth(e.target.value)}
                aria-label="Periode stok per bulan"
                title="Periode kolom stok sisa / baru / keluar"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
              />
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => setPeriodMonth(currentMonth)}
                  className="shrink-0 text-[11px] font-semibold text-maroon-700 hover:underline"
                >
                  Bulan ini
                </button>
              )}
            </div>
          )}
        </div>
        {isAdmin && (
          <p className="text-[11px] text-slate-500">
            Periode <strong>{monthLabel(periodMonth)}</strong>. Stok awal membawa saldo akhir bulan sebelumnya. Stok pertama barang baru tercatat di Barang Masuk dan ikut menambah saldo. Angka memakai satuan dasar.
            {positionLoading && ' Memuat...'}
          </p>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-3">Barang</th>
                {isAdmin ? (
                  <>
                    <th className="py-3 px-2 text-center w-[5.5rem] whitespace-normal leading-tight">Stok Awal</th>
                    <th className="py-3 px-2 text-center w-[5.5rem] whitespace-normal leading-tight">Barang Masuk</th>
                    <th className="py-3 px-2 text-center w-[5.5rem] whitespace-normal leading-tight">Barang Keluar</th>
                    <th className="py-3 px-2 text-center w-[5.5rem] whitespace-normal leading-tight">{isCurrentMonth ? 'Stok Saat Ini' : 'Stok Akhir'}</th>
                  </>
                ) : (
                  <th className="py-3 px-2 text-center w-[5.5rem] whitespace-normal leading-tight">Stok Saat Ini</th>
                )}
                <th className="py-3 px-2 text-center">Satuan</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 5} className="py-12 text-center text-slate-400">
                    Memuat data barang...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 5} className="py-12 text-center text-slate-400">
                    Belum ada data barang yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isZero = p.currentStock === 0;
                  const isLow = p.currentStock > 0 && p.currentStock <= p.minimumStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 min-w-[12rem]">
                        <div className="font-semibold text-slate-900 leading-snug">{p.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-mono text-[11px] text-slate-400">{p.sku}</span>
                          <span className="text-slate-300">·</span>
                          <span>{p.category?.name || 'Tanpa Kategori'}</span>
                          {!stockGroup && p.category && (
                            <span className={cn('rounded border px-1.5 py-0 text-[10px] font-semibold', getStockGroup(p.category.stockGroup).badgeClass)}>
                              {getStockGroup(p.category.stockGroup).shortLabel}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{p.description}</p>
                        )}
                      </td>
                      {isAdmin ? (
                        (() => {
                          const pos = positions.get(p.id);
                          const cell = (value: number | undefined, prefix = '') =>
                            value === undefined ? <span className="text-slate-300">-</span> : <span className="whitespace-nowrap">{prefix}{value}</span>;
                          const closing = isCurrentMonth ? p.currentStock : pos?.closingStock;
                          return (
                            <>
                              <td className="py-2.5 px-2 text-center text-slate-700 font-medium">
                                {cell(pos?.openingStock)}
                              </td>
                              <td className="py-2.5 px-2 text-center text-emerald-700 font-medium">
                                {pos?.inQty ? cell(pos.inQty, '+') : cell(pos ? 0 : undefined)}
                              </td>
                              <td className="py-2.5 px-2 text-center text-rose-700 font-medium">
                                {pos?.outQty ? cell(pos.outQty, '-') : cell(pos ? 0 : undefined)}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <div className={cn('font-bold', isCurrentMonth ? (isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900') : 'text-slate-900')}>
                                  {cell(closing)}
                                </div>
                                <span className="mt-0.5 block whitespace-nowrap text-xs text-slate-400">
                                  Min: {p.minimumStock}
                                </span>
                                {pos?.adjustment ? (
                                  <span className="mt-0.5 block text-[11px] font-medium text-sky-700 whitespace-nowrap">
                                    ±{pos.adjustment > 0 ? '+' : '-'}{Math.abs(pos.adjustment)}
                                  </span>
                                ) : null}
                              </td>
                            </>
                          );
                        })()
                      ) : (
                        <td className="py-2.5 px-2.5 text-center">
                          <div className={cn('font-bold', isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900')}>
                            <span className="whitespace-nowrap">{p.currentStock}</span>
                          </div>
                          <span className="mt-0.5 block whitespace-nowrap text-xs text-slate-400">
                            Min: {p.minimumStock}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-2 text-center">
                        <span className="inline-block font-medium bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700 whitespace-nowrap">
                          {p.unit}
                        </span>
                        {p.packUnit && p.packSize ? (
                          <span className="mt-0.5 flex flex-col items-center text-[11px] leading-tight text-slate-500">
                            <span className="whitespace-nowrap">1 {p.packUnit}</span>
                            <span className="whitespace-nowrap">= {p.packSize} {p.unit}</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1">
                          {isZero ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Habis
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" />
                              Rendah
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Aman
                            </span>
                          )}
                          {p.isActive ? (
                            <span className="text-[11px] font-medium text-emerald-700">
                              Aktif
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <>
                              {/* Edit Master */}
                              <button
                                onClick={() => openEdit(p)}
                                className="action-button action-icon action-edit"
                                aria-label={`Edit ${p.name}`}
                                title="Edit Master Barang"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleStatus(p)}
                                className={cn('action-button action-icon', p.isActive ? 'action-danger' : 'action-success')}
                                aria-label={`${p.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${p.name}`}
                                title={p.isActive ? 'Nonaktifkan Barang' : 'Aktifkan Kembali'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Hapus permanen */}
                              <button
                                onClick={() => handleDelete(p)}
                                className="action-button action-icon action-danger"
                                aria-label={`Hapus ${p.name}`}
                                title="Hapus Barang Permanen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                refreshAfterStockChange();
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
                Stok saat ini: <strong>{formatStock(editingProduct, editingProduct.currentStock)}</strong>. Penerimaan dicatat lewat <strong>Tambah Barang / Stok</strong>, stok keluar lewat <strong>Form Distribusi</strong>. Jika jumlah fisik di gudang berbeda (stok opname, rusak, salah input), gunakan <strong>Penyesuaian Stok</strong> di bawah.
              </div>

              <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Scale className="h-4 w-4 text-sky-700" />
                  Penyesuaian Stok (stok opname)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Isi jumlah fisik yang benar-benar ada. Selisihnya dicatat di riwayat sebagai penyesuaian, bukan barang masuk/keluar.
                </p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    placeholder="Stok sebenarnya"
                    aria-label="Stok sebenarnya"
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    disabled={adjSubmitting}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                  {editingProduct.packUnit && editingProduct.packSize ? (
                    <select
                      value={adjUnit}
                      onChange={(e) => setAdjUnit(e.target.value as 'base' | 'pack')}
                      aria-label="Satuan stok sebenarnya"
                      disabled={adjSubmitting}
                      className="px-2 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option value="base">{editingProduct.unit}</option>
                      <option value="pack">{editingProduct.packUnit}</option>
                    </select>
                  ) : (
                    <FixedUnit unit={editingProduct.unit} />
                  )}
                </div>
                {adjQty.trim() !== '' && adjActual === null && (
                  <p className="mt-1 text-[11px] text-rose-600">
                    Jumlah harus bilangan bulat 0 atau lebih{adjUnit === 'pack' ? ` (hasil dalam ${editingProduct.unit} harus bulat)` : ''}.
                  </p>
                )}
                {adjActual !== null && adjDiff !== null && (
                  <p className={cn('mt-1 text-[11px] font-medium', adjDiff === 0 ? 'text-slate-500' : adjDiff > 0 ? 'text-emerald-700' : 'text-rose-700')}>
                    {adjDiff === 0
                      ? 'Sama dengan stok sistem, tidak ada selisih.'
                      : `${formatStock(editingProduct, editingProduct.currentStock)} -> ${formatStock(editingProduct, adjActual)} (selisih ${adjDiff > 0 ? '+' : '-'}${formatStock(editingProduct, Math.abs(adjDiff))})`}
                  </p>
                )}
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Alasan, mis. hasil stok opname / barang rusak / salah input"
                  aria-label="Alasan penyesuaian"
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  maxLength={200}
                  disabled={adjSubmitting}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAdjust}
                    disabled={adjSubmitting || adjActual === null || !adjDiff || !adjReason.trim()}
                    className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {adjSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                  </button>
                </div>
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
                {!editingProduct.packSize && !formUsePack && (
                  <div>
                    <label htmlFor="edit-product-unit" className="block font-semibold text-slate-700 mb-1">
                      Satuan Barang
                    </label>
                    <UnitInput id="edit-product-unit" value={formUnit} onChange={setFormUnit} disabled={isSubmitting} />
                  </div>
                )}
                <div className={editingProduct.packSize || formUsePack ? 'col-span-2' : ''}>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Minimum Stok <span className="font-normal text-slate-500">(dalam {!editingProduct.packSize && formUsePack ? (stockIn === 'beli' ? formPackUnit : formSubUnit) || editingProduct.unit : formUnit || editingProduct.unit})</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                  {editingProduct.packSize && !formRemovePack && Number(formPackSize) >= 2 && formMinStock !== '' && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      = {formatStock({ unit: formUnit, packUnit: formPackUnit, packSize: Number(formPackSize) }, Number(formMinStock))}
                    </p>
                  )}
                </div>
              </div>

              {editingProduct.packSize ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-700">Satuan beli &amp; satuan dasar</p>
                    <button
                      type="button"
                      onClick={() => setFormRemovePack((v) => !v)}
                      disabled={isSubmitting}
                      className="text-[11px] font-semibold text-maroon-700 hover:underline"
                    >
                      {formRemovePack ? 'Batal hapus satuan beli' : 'Hapus satuan beli'}
                    </button>
                  </div>
                  {formRemovePack ? (
                    <div>
                      <label htmlFor="edit-product-unit" className="block text-[11px] text-slate-500 mb-1">Satuan barang</label>
                      <UnitInput id="edit-product-unit" value={formUnit} onChange={setFormUnit} disabled={isSubmitting} />
                      <p className="mt-2 text-[11px] text-amber-700">
                        Satuan beli akan dihapus. Stok tetap dicatat dalam <strong>{formUnit || editingProduct.unit}</strong>, angkanya tidak berubah.
                      </p>
                    </div>
                  ) : (
                    <>
                      <PackSentence
                        packField={<UnitInput id="edit-product-packunit" value={formPackUnit} onChange={setFormPackUnit} disabled={isSubmitting} compact />}
                        sizeValue={formPackSize}
                        onSizeChange={setFormPackSize}
                        baseField={<UnitInput id="edit-product-unit" value={formUnit} onChange={setFormUnit} disabled={isSubmitting} compact />}
                        onSwap={swapPack}
                        disabled={isSubmitting}
                      />
                      <PackCheckPanel
                        draft={packDraft}
                        check={packCheck}
                        onSwap={swapPack}
                        onUseSize={(size) => setFormPackSize(String(size))}
                        note="Mengubah nama satuan atau isi tidak mengubah angka stok yang tersimpan; hanya cara tampilnya."
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={formUsePack}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setFormUsePack(e.target.checked);
                        setFormStockInManual(null);
                        setFormPackSize('');
                        setFormPackUnit('');
                        setFormSubUnit(e.target.checked ? formUnit : '');
                      }}
                      className="mt-0.5 h-4 w-4 accent-maroon-800"
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">Pakai satuan beli (opsional)</span>
                      <span className="block text-[11px] text-slate-500">
                        Jika barang dibeli dalam satuan lain dari saat distribusi, mis. beli per dus / liter, keluar per pcs / ml.
                      </span>
                    </span>
                  </label>

                  {formUsePack && (
                    <div className="mt-3">
                      <PackSentence
                        packField={<UnitInput id="edit-product-packunit" value={formPackUnit} onChange={setFormPackUnit} disabled={isSubmitting} compact />}
                        sizeValue={formPackSize}
                        onSizeChange={setFormPackSize}
                        baseField={<UnitInput id="edit-product-subunit" value={formSubUnit} onChange={setFormSubUnit} disabled={isSubmitting} compact />}
                        onSwap={swapPack}
                        disabled={isSubmitting}
                      />

                      {formPackUnit.trim() && formSubUnit.trim() && (
                        <fieldset className="mt-3 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                          <legend className="px-1 text-[11px] font-semibold text-slate-600">
                            Stok sekarang ({editingProduct.currentStock}) dihitung dalam:
                          </legend>
                          <div className="flex flex-wrap gap-4 text-xs">
                            {(['beli', 'dasar'] as const).map((role) => (
                              <label key={role} className="inline-flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="radio"
                                  name="stock-in"
                                  checked={stockIn === role}
                                  onChange={() => setFormStockInManual(role)}
                                  className="accent-maroon-800"
                                />
                                <strong>{role === 'beli' ? formPackUnit : formSubUnit}</strong>
                                <span className="text-slate-500">({role === 'beli' ? 'satuan beli' : 'satuan dasar'})</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}

                      <PackCheckPanel
                        draft={packDraft}
                        check={packCheck}
                        onSwap={swapPack}
                        onUseSize={(size) => setFormPackSize(String(size))}
                        note={
                          stockIn === 'beli'
                            ? `Stok, batas minimum, dan riwayat akan dikalikan ${formPackSize || '?'} dan dicatat dalam ${formSubUnit || 'satuan dasar'}. Tidak bisa dibatalkan.`
                            : `Angka stok tetap; dicatat dalam ${formSubUnit || 'satuan dasar'} tanpa konversi.`
                        }
                        noteTone={stockIn === 'beli' ? 'warn' : 'muted'}
                      />
                    </div>
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
                  disabled={Boolean(packCheck?.errors.length) || isSubmitting}
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

/** Kalimat kemasan: "1 [kemasan] berisi [isi] [satuan dasar]" dengan label besar/kecil yang jelas. */
function PackSentence({
  packField,
  sizeValue,
  onSizeChange,
  baseField,
  onSwap,
  disabled,
}: {
  packField: React.ReactNode;
  sizeValue: string;
  onSizeChange: (value: string) => void;
  baseField: React.ReactNode;
  onSwap: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_5.5rem_minmax(0,1fr)] items-start gap-2">
      <span className="pt-2.5 text-sm font-bold text-slate-700">1</span>
      <div>
        {packField}
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Satuan beli (saat tambah stok)</p>
      </div>
      <div className="flex flex-col items-center">
        <span className="pt-2.5 text-xs text-slate-500">berisi</span>
        <button
          type="button"
          onClick={onSwap}
          disabled={disabled}
          title="Tukar satuan beli dan satuan dasar"
          className="mt-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
        >
          ⇄ Tukar
        </button>
      </div>
      <div>
        <input
          type="number"
          min="2"
          step="1"
          required
          value={sizeValue}
          onChange={(e) => onSizeChange(e.target.value)}
          placeholder="isi"
          aria-label="Isi per kemasan"
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-slate-800 focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
        />
        <p className="mt-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Isi</p>
      </div>
      <div>
        {baseField}
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Satuan dasar (kecil)</p>
      </div>
    </div>
  );
}

/** Satuan yang tidak bisa diubah di mode ini (mis. satuan barang saat ini). */
function FixedUnit({ unit }: { unit: string }) {
  return (
    <div className="flex h-[42px] items-center rounded-lg border border-slate-200 bg-slate-100 px-3 font-semibold text-slate-700">
      {unit || '-'}
    </div>
  );
}

/** Ringkasan + pemeriksaan kemasan: kalimat hasil, contoh tampilan stok, error/peringatan dengan tombol perbaikan. */
function PackCheckPanel({
  draft,
  check,
  onSwap,
  onUseSize,
  note,
  noteTone = 'muted',
}: {
  draft: { pack: string; size: number; base: string; stock: number } | null;
  check: PackCheck | null;
  onSwap: () => void;
  onUseSize: (size: number) => void;
  note: string;
  noteTone?: 'muted' | 'warn';
}) {
  const pack = draft?.pack.trim().toLowerCase() || '';
  const base = draft?.base.trim().toLowerCase() || '';
  const valid = Boolean(draft && pack && base && Number.isSafeInteger(draft.size) && draft.size >= 2);
  return (
    <div className="mt-3 space-y-2 text-[11px]">
      {valid && draft && (
        <div className={cn('rounded-md border px-2.5 py-2', check?.errors.length ? 'border-rose-200 bg-rose-50' : check?.warnings.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
          <p className="text-[13px] font-bold text-slate-900">
            1 {pack} = {draft.size} {base}
          </p>
          <p className="text-slate-600">
            Stok sekarang akan tampil: <strong>{formatStock({ unit: base, packUnit: pack, packSize: draft.size }, draft.stock)}</strong>
            {' '}· contoh 1.5 {pack} = {formatStock({ unit: base, packUnit: pack, packSize: draft.size }, Math.round(draft.size * 1.5))}
          </p>
        </div>
      )}
      {check?.errors.map((msg) => (
        <p key={msg} className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700">✖ {msg}</p>
      ))}
      {check?.warnings.map((msg) => (
        <p key={msg} className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">⚠ {msg}</p>
      ))}
      {(check?.maybeSwapped || check?.suggestedSize) && (
        <div className="flex flex-wrap gap-2">
          {check.maybeSwapped && (
            <button type="button" onClick={onSwap} className="rounded-md border border-maroon-200 bg-white px-2 py-1 font-semibold text-maroon-800 hover:bg-maroon-50">
              ⇄ Tukar satuan beli &amp; satuan dasar
            </button>
          )}
          {check.suggestedSize && (
            <button type="button" onClick={() => onUseSize(check.suggestedSize!)} className="rounded-md border border-maroon-200 bg-white px-2 py-1 font-semibold text-maroon-800 hover:bg-maroon-50">
              Pakai isi {check.suggestedSize}
            </button>
          )}
        </div>
      )}
      <p className={noteTone === 'warn' ? 'text-amber-700' : 'text-slate-500'}>{note}</p>
    </div>
  );
}
