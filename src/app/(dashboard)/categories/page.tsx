'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { getCategoryAppearance } from '@/lib/category-appearance';
import { DEFAULT_STOCK_GROUP, STOCK_GROUPS, getStockGroup } from '@/lib/stock-groups';
import { cn } from '@/lib/cn';
import { getCurrentReportMonth } from '@/lib/report-period';

import React, { useState, useEffect } from 'react';
import { Tags, Plus, Edit2, Trash2, X, Package, Layers, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

export default function CategoriesPage() {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stockGroup, setStockGroup] = useState<string>(DEFAULT_STOCK_GROUP);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Export PDF per kategori: periode bulan (YYYY-MM) atau tahun (YYYY).
  const currentMonth = getCurrentReportMonth();
  const [pdfPeriodKind, setPdfPeriodKind] = useState<'month' | 'year'>('month');
  const [pdfMonth, setPdfMonth] = useState(currentMonth);
  const [pdfYear, setPdfYear] = useState(currentMonth.slice(0, 4));
  const [exportingId, setExportingId] = useState<string | null>(null);
  const pdfPeriode = pdfPeriodKind === 'year' ? pdfYear : pdfMonth;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(Number(currentMonth.slice(0, 4)) - i));

  const handleExportPdf = async (cat: any) => {
    try {
      setExportingId(cat.id);
      const group = getStockGroup(cat.stockGroup);
      const res = await fetch(`/api/reports/stock-position?periode=${pdfPeriode}&jenis=${group.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Data laporan tidak dapat dimuat.');
      const rows = (data.rows || []).filter((row: any) => row.categoryId === cat.id);
      if (rows.length === 0) {
        showToast('Tidak Ada Data', `Kategori "${cat.name}" belum punya barang pada periode ${data.period?.label || pdfPeriode}.`, 'error');
        return;
      }
      const { downloadStockPositionPdf } = await import('@/lib/stock-position-pdf');
      const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kategori';
      await downloadStockPositionPdf(data, {
        rows,
        scopeLabel: 'Kategori',
        groupLabel: `${cat.name} (${group.label})`,
        groupSlug: `kategori-${slug}`,
      });
    } catch (err: any) {
      showToast('Gagal Export PDF', err.message, 'error');
    } finally {
      setExportingId(null);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), stockGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Berhasil', `Kategori "${name}" berhasil dibuat.`);
      setIsAddOpen(false);
      setName('');
      setDescription('');
      fetchCategories();
    } catch (err: any) {
      showToast('Gagal', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !name.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), stockGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Berhasil', `Kategori berhasil diperbarui.`);
      setEditingCategory(null);
      setName('');
      setDescription('');
      fetchCategories();
    } catch (err: any) {
      showToast('Gagal', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: any) => {
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Berhasil', `Kategori "${cat.name}" berhasil dihapus.`);
      fetchCategories();
    } catch (err: any) {
      showToast('Gagal Menghapus', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            Kategori Persediaan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelompokkan master barang untuk mempermudah inventarisasi dan pelaporan
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setName('');
              setDescription('');
              setStockGroup(groupFilter || DEFAULT_STOCK_GROUP);
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold shadow-soft hover:shadow-maroon transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori Baru</span>
          </button>
        )}
      </div>

      {/* Filter jenis stok */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-soft">
        {[{ id: null as string | null, label: 'Semua Jenis' }, ...STOCK_GROUPS.map((g) => ({ id: g.id as string | null, label: g.label }))].map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-pressed={groupFilter === tab.id}
            onClick={() => setGroupFilter(tab.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
              groupFilter === tab.id ? 'bg-maroon-800 text-white shadow-sm' : 'text-slate-600 hover:bg-maroon-50 hover:text-maroon-900'
            )}
          >
            {tab.label}
            <span className="ml-1.5 opacity-70">
              {tab.id ? categories.filter((c) => c.stockGroup === tab.id).length : categories.length}
            </span>
          </button>
        ))}
      </div>

      {/* Periode export PDF per kategori */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-soft">
          <FileDown className="h-4 w-4 text-maroon-800" />
          <span className="font-semibold text-slate-700">Periode export PDF per kategori:</span>
          <select
            value={pdfPeriodKind}
            onChange={(e) => setPdfPeriodKind(e.target.value as 'month' | 'year')}
            aria-label="Jenis periode"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
          >
            <option value="month">Per Bulan</option>
            <option value="year">Per Tahun</option>
          </select>
          {pdfPeriodKind === 'month' ? (
            <input
              type="month"
              value={pdfMonth}
              max={currentMonth}
              onChange={(e) => e.target.value && setPdfMonth(e.target.value)}
              aria-label="Bulan"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1"
            />
          ) : (
            <select
              value={pdfYear}
              onChange={(e) => setPdfYear(e.target.value)}
              aria-label="Tahun"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <span className="text-slate-500">Isi PDF: stok lama, stok baru, total, keluar, dan sisa akhir tiap barang di kategori.</span>
        </div>
      )}

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            Memuat kategori...
          </div>
        ) : categories.filter((c) => !groupFilter || c.stockGroup === groupFilter).length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Belum ada kategori yang terdaftar.
          </div>
        ) : (
          categories.filter((c) => !groupFilter || c.stockGroup === groupFilter).map((cat) => (
            <div
              key={cat.id}
              data-category-id={cat.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div data-category-icon style={getCategoryAppearance(cat.id)} className="size-9 shrink-0 rounded-lg flex items-center justify-center border">
                      <Tags className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{cat.name}</h3>
                  </div>

                  <span data-category-count style={getCategoryAppearance(cat.id)} className="shrink-0 whitespace-nowrap text-[10px] font-semibold border px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Package className="size-3" />
                    {cat._count?.products || 0} Barang
                  </span>
                </div>

                <span className={cn('mt-3 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold', getStockGroup(cat.stockGroup).badgeClass)}>
                  {getStockGroup(cat.stockGroup).label}
                </span>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {cat.description || 'Tidak ada deskripsi tambahan.'}
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-end gap-1 pt-4 mt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleExportPdf(cat)}
                    disabled={exportingId !== null || !cat._count?.products}
                    className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-maroon-50 hover:text-maroon-900 disabled:opacity-50"
                    title={cat._count?.products ? `Export PDF kategori ${cat.name}` : 'Kategori belum punya barang'}
                  >
                    {exportingId === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    Export PDF
                  </button>

                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setName(cat.name);
                      setDescription(cat.description || '');
                      setStockGroup(cat.stockGroup || DEFAULT_STOCK_GROUP);
                    }}
                    className="action-button action-icon action-edit"
                    aria-label={`Edit kategori ${cat.name}`}
                    title="Edit Kategori"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(cat)}
                    className="action-button action-icon action-danger"
                    aria-label={`Hapus kategori ${cat.name}`}
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Add / Edit */}
      {(isAddOpen || editingCategory) && (
        <ModalOverlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tags className="w-5 h-5 text-maroon-800" />
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingCategory ? handleUpdate : handleCreate}
              className="space-y-4 pt-4 text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Alat Tulis Kantor"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <fieldset>
                <legend className="block font-semibold text-slate-700 mb-1">
                  Jenis Stok <span className="text-rose-500">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {STOCK_GROUPS.map((g) => (
                    <label
                      key={g.id}
                      className={cn(
                        'cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors',
                        stockGroup === g.id ? 'border-maroon-700 bg-maroon-50 text-maroon-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="stockGroup"
                        value={g.id}
                        checked={stockGroup === g.id}
                        onChange={() => setStockGroup(g.id)}
                        className="sr-only"
                      />
                      {g.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Menentukan tab barang di Master Barang dan form distribusi yang bisa memakai barang kategori ini.
                </p>
              </fieldset>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Penjelasan jenis barang yang termasuk kategori ini..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
