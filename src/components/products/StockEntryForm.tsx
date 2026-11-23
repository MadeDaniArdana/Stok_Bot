'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Building,
  FileText,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';
import { ProductPicker } from './ProductPicker';
import { UnitInput } from './UnitInput';
import { formatStock, toBaseQuantity } from '@/lib/product-units';
import { getStockGroup, type StockGroup } from '@/lib/stock-groups';

interface StockEntryFormProps {
  initialProductId?: string;
  initialMode?: 'existing' | 'new';
  onSaved: () => void;
  onCancel: () => void;
  /** Jika diisi, hanya barang & kategori jenis ini yang ditampilkan. */
  stockGroup?: StockGroup | null;
}

export function StockEntryForm({ initialProductId = '', initialMode = 'existing', onSaved, onCancel, stockGroup = null }: StockEntryFormProps) {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [productMode, setProductMode] = useState<'existing' | 'new'>(
    initialMode
  );
  const isNewProduct = isAdmin && productMode === 'new';
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minimumStock, setMinimumStock] = useState('5');
  const [description, setDescription] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [entryUnit, setEntryUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const allProducts: any[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await fetch(`/api/products?status=active&limit=500&page=${page}${stockGroup ? `&jenis=${stockGroup}` : ''}`);
          if (!res.ok) throw new Error('Gagal memuat daftar barang.');
          const data = await res.json();
          allProducts.push(...(data.items || []));
          totalPages = data.totalPages || 1;
          page += 1;
        } while (page <= totalPages);
        setProducts((previous) => [
          ...allProducts.filter((product) => !previous.some((saved) => saved.id === product.id)),
          ...previous,
        ].sort((a, b) => a.name.localeCompare(b.name, 'id')));
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [stockGroup]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(stockGroup ? `/api/categories?jenis=${stockGroup}` : '/api/categories')
      .then(async (res) => {
        if (!res.ok) throw new Error('Gagal memuat kategori.');
        setCategories(await res.json());
      })
      .catch(() => setCategoriesError(true))
      .finally(() => setCategoriesLoading(false));
  }, [isAdmin, stockGroup]);

  const selectedProduct = isNewProduct
    ? { name: name.trim() || 'Barang baru', unit, currentStock: 0, sku: '' }
    : products.find((p) => p.id === selectedProductId);

  const currentStock = selectedProduct?.currentStock || 0;
  const packUnit: string | null = (!isNewProduct && (selectedProduct as any)?.packUnit) || null;
  const inputUnit = packUnit && entryUnit === packUnit ? packUnit : selectedProduct?.unit || 'satuan';
  const baseQty = typeof quantity === 'number' && selectedProduct && !isNewProduct
    ? toBaseQuantity(selectedProduct as any, quantity, inputUnit)
    : null;
  const validQuantity = isNewProduct
    ? typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity >= 0
    : baseQty !== null;
  const parsedQty = validQuantity ? (isNewProduct ? Number(quantity) : (baseQty as number)) : 0;
  const showStock = (value: number) => (packUnit ? formatStock(selectedProduct as any, value) : `${value} ${selectedProduct?.unit}`);
  const projectedStock = currentStock + parsedQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewProduct && !selectedProductId) {
      showToast('Pilih Barang', 'Silakan pilih barang yang masuk terlebih dahulu.', 'error');
      return;
    }
    if (!validQuantity) {
      showToast('Kuantitas Tidak Valid', isNewProduct ? 'Jumlah stok harus bilangan bulat 0 atau lebih.' : 'Jumlah barang masuk harus bilangan bulat lebih dari 0.', 'error');
      return;
    }
    if (isNewProduct && (!name.trim() || !categoryId || !unit.trim())) {
      showToast('Data Belum Lengkap', 'Isi nama, kategori, dan satuan barang baru.', 'error');
      return;
    }
    if (isNewProduct && (!minimumStock.trim() || !Number.isSafeInteger(Number(minimumStock)) || Number(minimumStock) < 0)) {
      showToast('Stok Minimum Tidak Valid', 'Stok minimum harus bilangan bulat 0 atau lebih.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const receiptNotes = [notes.trim(), supplier.trim() ? `Pemasok: ${supplier.trim()}` : ''].filter(Boolean).join(' · ') || 'Barang Masuk';
      const receipt = { notes: receiptNotes, referenceId: referenceId.trim() || undefined };
      const res = await fetch(isNewProduct ? '/api/products' : '/api/stock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNewProduct ? {
          name: name.trim(),
          description: description.trim(),
          categoryId,
          unit: unit.trim().toLowerCase(),
          minimumStock: Number(minimumStock),
          initialStock: parsedQty,
          actorUserId: currentUser?.id,
          receipt,
        } : {
          productId: selectedProductId,
          quantity: parsedQty,
          actorUserId: currentUser?.id,
          source: 'WEB',
          ...receipt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const savedProduct = isNewProduct ? data.product : data.data.product;

      showToast(
        isNewProduct ? 'Barang Baru Berhasil Disimpan' : 'Barang Masuk Berhasil Dicatat!',
        `${savedProduct.name}: stok ${formatStock(savedProduct, savedProduct.currentStock)}.`
      );

      // Reset form
      setQuantity('');
      setSupplier('');
      setReferenceId('');
      setNotes('');
      setName('');
      setCategoryId('');
      setUnit('pcs');
      setMinimumStock('5');
      setDescription('');
      setProducts((previous) => [savedProduct, ...previous.filter((p) => p.id !== savedProduct.id)]
        .sort((a, b) => a.name.localeCompare(b.name, 'id')));
      setSelectedProductId(savedProduct.id);
      setProductMode('existing');
      onSaved();
    } catch (err: any) {
      showToast('Gagal Menyimpan', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <h2 id="stock-entry-title" className="text-lg font-semibold text-slate-900">
            Tambah Barang / Stok
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Tambah stok barang yang sudah ada atau daftarkan barang baru beserta stok pertamanya.
        </p>
        </div>
        <button type="button" onClick={onCancel} disabled={isSubmitting} aria-label="Tutup formulir tambah barang dan stok" className="action-button action-icon action-neutral">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-soft">
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {isAdmin && (
              <fieldset disabled={isSubmitting} className="space-y-2">
                <legend className="font-semibold text-slate-700 mb-2">Barang yang akan ditambahkan</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['existing', 'Barang Sudah Ada'],
                    ['new', 'Barang Baru'],
                  ] as const).map(([value, label]) => (
                    <label key={value} className={`flex items-center gap-2 rounded-lg border px-3 py-3 cursor-pointer text-xs font-semibold ${productMode === value ? 'border-maroon-700 bg-maroon-50 text-maroon-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="radio" name="productMode" value={value} checked={productMode === value} onChange={() => setProductMode(value)} className="accent-maroon-800" />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {isNewProduct ? 'Data barang dan stok pertama disimpan sekaligus. SKU dibuat otomatis.' : 'Pilih barang dari daftar untuk menambah stoknya.'}
                </p>
              </fieldset>
            )}

            <fieldset disabled={isSubmitting} className="space-y-4">
              {isNewProduct ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-product-name" className="block font-semibold text-slate-700 mb-1">Nama Barang <span className="text-rose-500">*</span></label>
                    <input id="new-product-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kertas HVS A4 80gr" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700" />
                  </div>
                  <div>
                    <label htmlFor="new-product-category" className="block font-semibold text-slate-700 mb-1">Kategori <span className="text-rose-500">*</span></label>
                    <select id="new-product-category" required disabled={categoriesLoading || categoriesError} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700">
                      <option value="">{categoriesLoading ? 'Memuat kategori...' : 'Pilih kategori'}</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({getStockGroup(category.stockGroup).shortLabel})</option>)}
                    </select>
                    {categoriesError ? (
                      <p className="text-xs text-rose-600 mt-1">Kategori gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p>
                    ) : !categoriesLoading && categories.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">Belum ada kategori. <Link href="/categories" className="text-maroon-800 underline">Tambahkan kategori terlebih dahulu.</Link></p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="new-product-unit" className="block font-semibold text-slate-700 mb-1">Satuan <span className="text-rose-500">*</span></label>
                      <UnitInput id="new-product-unit" value={unit} onChange={setUnit} disabled={isSubmitting} />
                    </div>
                    <div>
                      <label htmlFor="new-product-minimum" className="block font-semibold text-slate-700 mb-1">Stok Minimum</label>
                      <input id="new-product-minimum" type="number" min="0" step="1" required value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="new-product-description" className="block font-semibold text-slate-700 mb-1">Deskripsi Barang (Opsional)</label>
                    <textarea id="new-product-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Merek, ukuran, atau spesifikasi barang" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none" />
                  </div>
                </div>
              ) : (
              <div>
                <label htmlFor="existing-product" className="block font-semibold text-slate-700 mb-1">
                  Pilih Barang Persediaan <span className="text-rose-500">*</span>
                </label>
                <ProductPicker
                  id="existing-product"
                  products={products}
                  value={selectedProductId}
                  disabled={loading || loadError || isSubmitting}
                  loading={loading}
                  onChange={setSelectedProductId}
                />
                {loadError ? (
                  <p className="text-xs text-rose-600 mt-2">Daftar barang gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p>
                ) : !loading && products.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">Belum ada barang aktif. {isAdmin && <button type="button" onClick={() => setProductMode('new')} className="text-maroon-800 underline">Daftarkan barang baru.</button>}</p>
                )}
              </div>
              )}

              {/* Kuantitas */}
              <div>
                <div>
                  <label htmlFor="stock-in-quantity" className="block font-semibold text-slate-700 mb-1">
                    {isNewProduct ? 'Jumlah Stok Pertama' : 'Jumlah Barang Masuk'} ({packUnit ? '' : selectedProduct?.unit || 'satuan'}){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                  <input
                    id="stock-in-quantity"
                    type="number"
                    min={isNewProduct ? 0 : packUnit ? 0.01 : 1}
                    step={packUnit ? 'any' : '1'}
                    required
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Misal: 10"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                  {packUnit && (
                    <select
                      aria-label="Satuan jumlah masuk"
                      value={inputUnit}
                      onChange={(e) => setEntryUnit(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                    >
                      <option value={packUnit}>{packUnit}</option>
                      <option value={selectedProduct?.unit}>{selectedProduct?.unit}</option>
                    </select>
                  )}
                  </div>
                  {isNewProduct && <p className="text-xs text-slate-500 mt-1">Isi 0 jika barang belum memiliki stok. Stok 0 hanya mendaftarkan barang, tanpa transaksi penerimaan.</p>}
                </div>
              </div>

              {(!isNewProduct || quantity !== 0) && (
              <div className="space-y-4">
              {/* Supplier & No Dokumen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pemasok / Supplier (Opsional)
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Contoh: PT Sumber Berkah"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor PO / Surat Jalan (Opsional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      placeholder="Contoh: PO-2026-11-09"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Penerimaan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Diterima dalam kondisi baik, disimpan di rak B-02"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none"
                />
              </div>
              </div>
              )}
            </fieldset>

            {/* Action Submit */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Pencatat: <strong>{currentUser?.name || 'Administrator'}</strong>
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !validQuantity || (isNewProduct ? !name.trim() || !categoryId || categoriesLoading || categoriesError : loading || loadError || !selectedProduct)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Memproses...' : isNewProduct ? 'Simpan Barang & Stok' : 'Simpan Tambahan Stok'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Calculation Preview Card (Required by UX Spec 6.6) */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-maroon-800">
              <HelpCircle className="w-4 h-4" />
              Ringkasan Perubahan Stok
            </h3>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Barang Dipilih</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedProduct.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {isNewProduct ? 'SKU dibuat otomatis saat disimpan' : `SKU: ${selectedProduct.sku}`}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Stok Saat Ini:</span>
                    <span className="font-bold text-slate-800">
                      {showStock(currentStock)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-emerald-700 font-medium">
                    <span>{isNewProduct ? 'Stok Pertama:' : 'Jumlah Masuk:'}</span>
                    <span className="font-bold text-sm">
                      +{showStock(parsedQty)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900">Stok Sesudah Transaksi:</span>
                    <span className="font-extrabold text-base text-emerald-800">
                      {showStock(projectedStock)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  Waktu pencatatan otomatis mengikuti saat penyimpanan. Stok diperbarui setelah disimpan.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Pilih barang untuk melihat kalkulasi perubahan stok
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
