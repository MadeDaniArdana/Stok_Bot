'use client';

import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Package,
  X,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

export default function StockRequestsPage() {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // New Request Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const query = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const res = await fetch(`/api/stock/requests${query}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/products?status=active&limit=100').then((r) => r.json()).then((d) => setProducts(d.items || []));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || quantity <= 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          requesterId: currentUser?.id,
          quantity: Number(quantity),
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Permintaan Diajukan', 'Permintaan Anda telah tersimpan dan menunggu peninjauan Admin.');
      setIsModalOpen(false);
      setProductId('');
      setQuantity('');
      setNotes('');
      fetchRequests();
    } catch (err: any) {
      showToast('Gagal Mengajukan', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT' | 'FULFILL') => {
    try {
      const res = await fetch('/api/stock/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          reviewerId: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const actionText =
        action === 'APPROVE'
          ? 'Permintaan telah disetujui.'
          : action === 'REJECT'
          ? 'Permintaan ditolak.'
          : 'Permintaan berhasil dipenuhi! Stok telah terpotong.';

      showToast('Berhasil', actionText);
      fetchRequests();
    } catch (err: any) {
      showToast('Gagal Memproses', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Permintaan Pengambilan Barang
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Alur persetujuan (approval workflow) sebelum stok fisik dikeluarkan dari gudang
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white text-xs font-semibold shadow-soft hover:shadow-maroon transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengajuan Baru</span>
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto text-xs pb-1">
        {[
          { key: 'all', label: 'Semua Pengajuan' },
          { key: 'PENDING', label: 'Menunggu Persetujuan' },
          { key: 'APPROVED', label: 'Disetujui' },
          { key: 'FULFILLED', label: 'Telah Dikeluarkan' },
          { key: 'REJECTED', label: 'Ditolak' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-maroon-50 text-maroon-900 font-bold border-b-2 border-maroon-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Tgl Pengajuan</th>
                <th className="py-3.5 px-4">Barang Diminta</th>
                <th className="py-3.5 px-4 text-center">Jumlah</th>
                <th className="py-3.5 px-4">Pemohon</th>
                <th className="py-3.5 px-4">Keperluan</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Peninjau</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Memuat daftar permintaan...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada permintaan pada kategori status ini.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isApproved = r.status === 'APPROVED';
                  const isFulfilled = r.status === 'FULFILLED';
                  const isRejected = r.status === 'REJECTED';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{r.product?.name}</p>
                        <span className="font-mono text-[11px] text-slate-400">
                          {r.product?.sku}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-sm text-slate-900">
                        {r.quantity} {r.product?.unit}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800">{r.requester?.name}</p>
                        <span className="text-[10px] text-slate-400">{r.requester?.email}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs text-slate-600 line-clamp-2">
                        {r.notes || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Menunggu
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Disetujui
                          </span>
                        )}
                        {isFulfilled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Dikeluarkan
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Ditolak
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {r.reviewedBy ? (
                          <div>
                            <p className="font-medium text-slate-800">{r.reviewedBy.name}</p>
                            <span className="text-[10px] text-slate-400">
                              {r.reviewedAt &&
                                new Date(r.reviewedAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isAdmin && isPending && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAction(r.id, 'APPROVE')}
                              className="px-2.5 py-1 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 font-semibold text-[11px] border border-sky-200"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleAction(r.id, 'REJECT')}
                              className="px-2.5 py-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-[11px] border border-rose-200"
                            >
                              Tolak
                            </button>
                          </div>
                        )}

                        {isAdmin && isApproved && (
                          <button
                            onClick={() => handleAction(r.id, 'FULFILL')}
                            className="px-3 py-1 rounded-lg text-white bg-maroon-800 hover:bg-maroon-900 font-semibold text-[11px] shadow-sm"
                            title="Potong stok fisik dan serahkan barang"
                          >
                            Keluarkan Barang
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Pengajuan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-maroon-800" />
                Form Pengajuan Barang
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Barang <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                >
                  <option value="">Pilih barang...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Tersedia: {p.currentStock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Dibutuhkan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Misal: 2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keperluan / Peruntukan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Digunakan untuk presentasi klien meeting hari Kamis"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !productId || !quantity}
                  className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
