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
  Camera,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
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

  // Modal Link Kamera Bukti
  const [proofModalData, setProofModalData] = useState<{
    proofUrl: string;
    telegramSent: boolean;
    recipientName: string;
    productName: string;
    quantity: number;
    unit: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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

      // Tampilkan popup link kamera & status pengiriman Telegram
      if (data.data?.proofUrl) {
        setProofModalData({
          proofUrl: data.data.proofUrl,
          telegramSent: Boolean(data.data.telegramSent),
          recipientName: data.data.recipientUser?.name || 'Pegawai',
          productName: selectedProduct?.name || 'Barang',
          quantity: parsedQty,
          unit: selectedProduct?.unit || 'unit',
        });
      }

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
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-soft">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Pilih Barang */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Barang <span className="text-rose-500">*</span>
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
                    [{p.sku}] {p.name} — Tersedia: {p.currentStock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Kuantitas & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
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
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 ${
                    isExceeding
                      ? 'border-rose-400 text-rose-700 focus:ring-rose-200 focus:border-rose-600 bg-rose-50/50'
                      : 'border-slate-200 text-slate-900 focus:ring-maroon-500/20 focus:border-maroon-700'
                  }`}
                />
                {isExceeding && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Jumlah melebihi stok yang ada ({currentStock} {selectedProduct?.unit})
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Pengambilan</label>
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

            {/* Pemohon / Penerima */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Penerima / Pengguna Barang <span className="text-rose-500">*</span>
              </label>
              <select
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
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
              <label className="block font-semibold text-slate-700 mb-1">
                Keperluan / Peruntukan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Contoh: Kebutuhan cetak laporan keuangan bulanan audit internal"
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
                disabled={isSubmitting || !selectedProductId || !parsedQty || isExceeding}
                className="px-5 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold text-xs shadow-soft hover:shadow-maroon transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Memproses...' : 'Simpan Barang Keluar'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Calculation Preview Card (Required by UX Spec 6.7) */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-maroon-800">
              <HelpCircle className="w-4 h-4" />
              Prakiraan Stok Sesudah Transaksi
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

      {/* Modal Popup: Link Kamera & QR Code Bukti Fisik */}
      {proofModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-maroon-50 text-maroon-800 flex items-center justify-center border border-maroon-200">
                  <Camera className="w-5 h-5 text-maroon-800" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Link Kamera Bukti Fisik
                  </h3>
                  <p className="text-xs text-slate-500">
                    {proofModalData.productName} ({proofModalData.quantity} {proofModalData.unit})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setProofModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telegram delivery status */}
            {proofModalData.telegramSent ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Link telah <strong>otomatis terkirim</strong> ke Telegram{' '}
                  <strong>{proofModalData.recipientName}</strong>.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Pegawai belum menghubungkan Telegram. Mintalah pegawai memindai QR Code di bawah atau salin link ini.
                </span>
              </div>
            )}

            {/* QR Code for in-person desk scan */}
            <div className="text-center py-2 space-y-1">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  proofModalData.proofUrl
                )}`}
                alt="QR Code Kamera"
                className="w-36 h-36 mx-auto rounded-xl border border-slate-200 p-1.5 bg-white shadow-sm"
              />
              <p className="text-[11px] text-slate-400">
                Scan langsung menggunakan kamera HP pegawai
              </p>
            </div>

            {/* Link & Copy Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Link Kamera Tanpa Login:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={proofModalData.proofUrl}
                  className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(proofModalData.proofUrl);
                    setCopiedLink(true);
                    showToast('Link Disalin!', 'Link kamera bukti telah disalin ke clipboard.');
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-maroon-800 hover:bg-maroon-900 text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <a
                href={proofModalData.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-maroon-800 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Buka Kamera Sendiri</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={() => setProofModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Tutup Selesai
              </button>
            </div>
          </div>
        </div>
      )}
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
