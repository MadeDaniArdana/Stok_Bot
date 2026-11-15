'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Power,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  History,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

export default function ProductsPage() {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');
  const [status, setStatus] = useState('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [detailProduct, setDetailProduct] = useState<any | null>(null);

  // Form State
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formInitialStock, setFormInitialStock] = useState('0');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search,
        categoryId,
        stockStatus,
        status,
      }).toString();

      const res = await fetch(`/api/products?${query}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
    fetchProducts();
  }, [search, categoryId, stockStatus, status]);

  // Open Edit Modal
  const openEdit = (p: any) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategoryId(p.categoryId || '');
    setFormUnit(p.unit);
    setFormMinStock(String(p.minimumStock));
    setFormDesc(p.description || '');
  };

  // Open Detail Modal
  const openDetail = async (p: any) => {
    try {
      const res = await fetch(`/api/products/${p.id}`);
      if (res.ok) {
        const full = await res.json();
        setDetailProduct(full);
      } else {
        setDetailProduct(p);
      }
    } catch (e) {
      setDetailProduct(p);
    }
  };

  // Handle Create Product
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSku.trim() || !formName.trim()) {
      showToast('Gagal', 'SKU dan Nama barang wajib diisi', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formSku.trim(),
          name: formName.trim(),
          description: formDesc.trim(),
          categoryId: formCategoryId || null,
          unit: formUnit.trim().toLowerCase(),
          minimumStock: parseInt(formMinStock, 10) || 0,
          initialStock: parseInt(formInitialStock, 10) || 0,
          actorUserId: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan barang');
      }

      showToast('Berhasil!', `Barang "${formName}" berhasil ditambahkan ke katalog.`);
      setIsAddOpen(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      showToast('Gagal Menambah Barang', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
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
          sku: formSku.trim(),
          name: formName.trim(),
          description: formDesc.trim(),
          categoryId: formCategoryId || null,
          unit: formUnit.trim().toLowerCase(),
          minimumStock: parseInt(formMinStock, 10) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui data');

      showToast('Berhasil Diperbarui', `Informasi barang "${formName}" telah disimpan.`);
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
    setFormSku('');
    setFormName('');
    setFormCategoryId('');
    setFormUnit('pcs');
    setFormMinStock('5');
    setFormInitialStock('0');
    setFormDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Master Katalog Barang
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola data master persediaan, SKU, kategori, dan batas minimum stok
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="btn-3d inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-700 text-white text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Baru</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Barang atau SKU..."
              className="w-full text-xs pl-10 pr-3 py-2.5 bg-white/90 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 shadow-inner font-medium"
            />
          </div>

          {/* Filter Category */}
          <div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
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
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
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
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
            >
              <option value="all">Status: Semua</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif Saja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-panel rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-sm">
                        <span className={isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>
                          {p.currentStock}
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
                          {/* Detail Button */}
                          <button
                            onClick={() => openDetail(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-maroon-800 hover:bg-maroon-50 transition-colors"
                            title="Lihat Detail & Riwayat Mutasi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Fast Restock link */}
                          <Link
                            href={`/stock/in?productId=${p.id}`}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Barang Masuk (Restock)"
                          >
                            <ArrowDownToLine className="w-4 h-4" />
                          </Link>

                          {isAdmin && (
                            <>
                              {/* Edit Master */}
                              <button
                                onClick={() => openEdit(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Edit Master Barang"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleStatus(p)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  p.isActive
                                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
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

      {/* Modal Tambah Barang */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-maroon-800" />
                Tambah Master Barang Baru
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    placeholder="Contoh: PAP-A4-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                  placeholder="Contoh: Kertas HVS A4 80gr PaperOne"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Dasar <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                  >
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="rim">rim</option>
                    <option value="unit">unit</option>
                    <option value="roll">roll</option>
                    <option value="meter">meter</option>
                    <option value="jerigen">jerigen</option>
                    <option value="liter">liter</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stok Minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Awal (Opt)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formInitialStock}
                    onChange={(e) => setFormInitialStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Keterangan Spesifikasi
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Catatan merek, dimensi, atau kegunaan..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Master Barang */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
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

            <form onSubmit={handleUpdate} className="space-y-4 pt-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                ℹ️ <strong>Aturan PRD:</strong> Nilai saldo stok ({editingProduct.currentStock} {editingProduct.unit}) tidak dapat diubah langsung di formulir ini untuk menjaga jejak audit. Perubahan stok harus dilakukan melalui menu <strong>Barang Masuk</strong> atau <strong>Barang Keluar</strong>.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Dasar
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>
              </div>

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
        </div>
      )}

      {/* Modal Detail & Histori Barang */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-maroon-800 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                  {detailProduct.sku}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{detailProduct.name}</h3>
              </div>
              <button
                onClick={() => setDetailProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Stok Saat Ini</span>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {detailProduct.currentStock} {detailProduct.unit}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Batas Minimum</span>
                <p className="text-xl font-extrabold text-slate-700 mt-0.5">
                  {detailProduct.minimumStock} {detailProduct.unit}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Kategori</span>
                <p className="text-sm font-bold text-slate-800 mt-1 truncate">
                  {detailProduct.category?.name || 'Umum'}
                </p>
              </div>
            </div>

            {/* Transaction History for this item */}
            <div className="flex-1 overflow-y-auto border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-maroon-800" />
                Histori Mutasi Barang Ini
              </h4>

              <div className="divide-y divide-slate-100 text-xs">
                {!detailProduct.movements || detailProduct.movements.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs">
                    Belum ada catatan mutasi untuk barang ini.
                  </p>
                ) : (
                  detailProduct.movements.map((m: any) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded ${
                              m.type === 'IN'
                                ? 'bg-emerald-50 text-emerald-700'
                                : m.type === 'REVERSAL'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {m.type}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {m.type === 'IN' ? '+' : '-'}
                            {m.quantity} {detailProduct.unit}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-[11px] text-slate-500">
                            Stok: {m.stockBefore} &rarr; {m.stockAfter}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{m.notes || '-'}</p>
                      </div>

                      <div className="text-right text-[10px] text-slate-400">
                        <span>
                          {new Date(m.createdAt).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                        <p className="text-slate-600 font-medium">{m.actor?.name || 'Sistem'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Status: {detailProduct.isActive ? 'Aktif' : 'Nonaktif'}
              </span>

              <div className="flex items-center gap-2">
                <Link
                  href={`/stock/in?productId=${detailProduct.id}`}
                  onClick={() => setDetailProduct(null)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Barang Masuk
                </Link>
                <Link
                  href={`/stock/out?productId=${detailProduct.id}`}
                  onClick={() => setDetailProduct(null)}
                  className="px-3 py-1.5 rounded-lg bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold"
                >
                  Barang Keluar
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
