'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpFromLine,
  UserCheck,
  Calendar,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

function StockOutContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { currentUser, availableUsers } = useAuth();

  const preselectedProductId = searchParams.get('productId') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [recipientUserId, setRecipientUserId] = useState(currentUser?.id || '');
  const [purpose, setPurpose] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser?.id && !recipientUserId) {
      setRecipientUserId(currentUser.id);
    }
  }, [currentUser]);

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
  const minStock = selectedProduct?.minimumStock || 0;
  const parsedQty = typeof quantity === 'number' && quantity > 0 ? quantity : 0;
  const projectedStock = currentStock - parsedQty;

  const isExceeding = parsedQty > currentStock;
  const isNowLow = projectedStock <= minStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Pilih Barang', 'Silakan pilih barang yang dikeluarkan terlebih dahulu.', 'error');
      return;
    }
    if (!parsedQty || parsedQty <= 0) {
      showToast('Kuantitas Tidak Valid', 'Jumlah barang keluar harus lebih dari 0.', 'error');
      return;
    }
    if (isExceeding) {
      showToast(
        'Stok Tidak Mencukupi',
        `Jumlah yang diminta (${parsedQty} ${selectedProduct?.unit}) melebihi stok tersedia (${currentStock} ${selectedProduct?.unit}).`,
        'error'
      );
      return;
    }
    if (!purpose.trim()) {
      showToast('Keperluan Wajib', 'Mohon isi alasan / keperluan pengambilan barang.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: parsedQty,
          actorUserId: recipientUserId || currentUser?.id,
          source: 'WEB',
          notes: `Keperluan: ${purpose.trim()}`,
          referenceId: referenceId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(
        'Barang Keluar Berhasil!',
        `Pengambilan ${parsedQty} ${selectedProduct?.unit} berhasil dicatat. Sisa stok: ${projectedStock} ${selectedProduct?.unit}.`
      );

      // Reset form
      setQuantity('');
      setPurpose('');
      setReferenceId('');

      // Refresh products to update stock
      const refreshRes = await fetch('/api/products?status=active&limit=100');
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setProducts(json.items || []);
      }
    } catch (err: any) {
      showToast('Gagal Mengeluarkan Barang', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-800 flex items-center justify-center border border-maroon-200">
            <ArrowUpFromLine className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Catat Pengambilan Barang (Stock Out)
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Pencatatan pemakaian barang operasional, ATK kantor, atau logistik divisi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-soft">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Pilih Barang */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Pilih Barang <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
                required
              >
                <option value="">-- Pilih Barang --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} — Tersedia: {p.currentStock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Kuantitas & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Jumlah Pengambilan ({selectedProduct?.unit || 'satuan'}){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentStock || undefined}
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Misal: 2"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-bold shadow-inner focus:outline-none focus:ring-2 ${
                    isExceeding
                      ? 'border-rose-400 text-rose-700 focus:ring-rose-200 focus:border-rose-600 bg-rose-50/70'
                      : 'border-slate-200/80 text-slate-900 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90'
                  }`}
                />
                {isExceeding && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Jumlah melebihi stok yang ada ({currentStock} {selectedProduct?.unit})
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Pengambilan</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Pemohon / Penerima */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Penerima / Pengguna Barang <span className="text-rose-500">*</span>
              </label>
              <select
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner font-medium"
                required
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role === 'ADMIN' ? 'Admin' : 'Staff'}
                  </option>
                ))}
              </select>
            </div>

            {/* Keperluan Pengambilan */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Keperluan / Peruntukan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Contoh: Kebutuhan cetak laporan keuangan bulanan audit internal"
                className="w-full px-3.5 py-2.5 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white/90 shadow-inner resize-none font-medium"
              />
            </div>

            {/* Action Submit */}
            <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Pencatat: <strong className="text-slate-700">{currentUser?.name || 'Administrator'}</strong>
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !selectedProductId || !parsedQty || isExceeding}
                className="btn-3d px-6 py-3 rounded-xl bg-maroon-800 hover:bg-maroon-700 text-white font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Memproses...' : 'Simpan Barang Keluar'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Calculation Preview Card (Required by UX Spec 6.7) */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 shadow-soft">
            <h3 className="text-xs font-black uppercase tracking-wider mb-3.5 flex items-center gap-1.5 text-maroon-800">
              <HelpCircle className="w-4 h-4" />
              Prakiraan Stok Sesudah Transaksi
            </h3>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80 shadow-inner">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Barang Dipilih</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedProduct.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    SKU: {selectedProduct.sku}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Stok Tersedia Saat Ini:</span>
                    <span className="font-bold text-slate-800">
                      {currentStock} {selectedProduct.unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-maroon-800 font-medium">
                    <span>Jumlah Dikeluarkan:</span>
                    <span className="font-bold text-sm">
                      -{parsedQty} {selectedProduct.unit}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between py-2 p-2.5 rounded-lg border ${
                      isExceeding
                        ? 'bg-rose-50 text-rose-900 border-rose-200'
                        : isNowLow
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-slate-50 text-slate-900 border-slate-200'
                    }`}
                  >
                    <span className="font-semibold">Sisa Stok Nanti:</span>
                    <span
                      className={`font-extrabold text-base ${
                        isExceeding
                          ? 'text-rose-600'
                          : isNowLow
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {isExceeding ? 'Tidak Cukup' : `${projectedStock} ${selectedProduct.unit}`}
                    </span>
                  </div>
                </div>

                {/* Conditional Alerts */}
                {isExceeding && (
                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Transaksi Ditahan:</strong> Stok fisik tidak mencukupi untuk memenuhi jumlah ini.
                    </p>
                  </div>
                )}

                {!isExceeding && isNowLow && parsedQty > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Peringatan Stok Rendah:</strong> Pengambilan ini akan membuat persediaan mencapai atau berada di bawah batas minimum ({minStock} {selectedProduct.unit}).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Pilih barang untuk melihat kalkulasi stok
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockOutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat formulir barang keluar...</div>}>
      <StockOutContent />
    </Suspense>
  );
}
