'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  Package,
  Calendar,
  Building,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

function StockInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { currentUser } = useAuth();

  const preselectedProductId = searchParams.get('productId') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/products?status=active&limit=100');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.items || []);
          if (!selectedProductId && data.items?.length > 0) {
            setSelectedProductId(data.items[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const currentStock = selectedProduct?.currentStock || 0;
  const parsedQty = typeof quantity === 'number' && quantity > 0 ? quantity : 0;
  const projectedStock = currentStock + parsedQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Pilih Barang', 'Silakan pilih barang yang masuk terlebih dahulu.', 'error');
      return;
    }
    if (!parsedQty || parsedQty <= 0) {
      showToast('Kuantitas Tidak Valid', 'Jumlah barang masuk harus lebih dari 0.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: parsedQty,
          actorUserId: currentUser?.id,
          source: 'WEB',
          notes: notes.trim()
            ? `${notes.trim()}${supplier ? ` (Supplier: ${supplier})` : ''}`
            : supplier
            ? `Penerimaan dari ${supplier}`
            : 'Barang Masuk',
          referenceId: referenceId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(
        'Barang Masuk Berhasil Dicatat!',
        `Stok ${selectedProduct?.name} bertambah ${parsedQty} ${selectedProduct?.unit} (Total: ${projectedStock} ${selectedProduct?.unit}).`
      );

      // Reset form
      setQuantity('');
      setSupplier('');
      setReferenceId('');
      setNotes('');

      // Refresh products to update stock
      const refreshRes = await fetch('/api/products?status=active&limit=100');
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setProducts(json.items || []);
      }
    } catch (err: any) {
      showToast('Gagal Menyimpan', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Catat Barang Masuk (Stock In)
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Penambahan saldo persediaan gudang dari pengadaan, pembelian supplier, atau retur
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-soft">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Pilih Barang */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Barang Persediaan <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                required
              >
                <option value="">-- Pilih Barang --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} — Stok Saat Ini: {p.currentStock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Kuantitas & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Barang Masuk ({selectedProduct?.unit || 'satuan'}){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Misal: 10"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                </div>
              </div>
            </div>

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

            {/* Action Submit */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Pencatat: <strong>{currentUser?.name || 'Administrator'}</strong>
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !selectedProductId || !parsedQty}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Memproses...' : 'Simpan Barang Masuk'}</span>
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
                    SKU: {selectedProduct.sku}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Stok Saat Ini:</span>
                    <span className="font-bold text-slate-800">
                      {currentStock} {selectedProduct.unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-emerald-700 font-medium">
                    <span>Jumlah Masuk:</span>
                    <span className="font-bold text-sm">
                      +{parsedQty} {selectedProduct.unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900">Stok Sesudah Transaksi:</span>
                    <span className="font-extrabold text-base text-emerald-800">
                      {projectedStock} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  💡 Saldo baru akan otomatis tercermin di dashboard dan riwayat pergerakan setelah disimpan.
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

export default function StockInPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat formulir barang masuk...</div>}>
      <StockInContent />
    </Suspense>
  );
}
