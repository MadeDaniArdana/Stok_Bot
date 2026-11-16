'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { TelegramSimulator } from '@/components/telegram/TelegramSimulator';
import { useToast } from '@/components/ui/Toast';

export default function TelegramPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast('Tersalin!', `${label} berhasil disalin ke clipboard.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200">
              <Send className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Integrasi Telegram Bot & Webhook
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Admin membuat tugas pemasangan; bot mengirim link bukti yang dapat dibagikan melalui WhatsApp
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-soft transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon-700' : ''}`} />
          <span>Segarkan Status</span>
        </button>
      </div>

      {/* Bot & Webhook Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bot Status */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Status Bot</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              @{status?.botUsername || 'stockflow_bot'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Bot Aktif & Siap Menerima
          </p>
        </div>

        {/* Webhook Endpoint */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Webhook Gateway</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold">
              200 OK
            </span>
          </div>
          <div className="mt-3 truncate">
            <span className="text-xs font-mono text-slate-800 bg-slate-50 px-2 py-1 rounded block truncate">
              {status?.webhookUrl || '/api/telegram/webhook'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">HTTPS Secret Verified</p>
        </div>

        {/* Total Updates Processed */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Update Diproses</span>
            <span className="text-xs font-bold text-sky-600">Idempoten</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {status?.totalUpdates ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">transaksi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Gagal: <strong className="text-rose-600">{status?.failedUpdates ?? 0}</strong>
          </p>
        </div>

        {/* Linked Accounts */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Akun Terhubung</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {status?.linkedCount ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">staff aktif</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Hanya akun terhubung dapat transaksi</p>
        </div>
      </div>

      {/* Split View: Live Simulator on Left, Guide on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Live Simulator (7 cols) */}
        <div className="lg:col-span-7">
          <TelegramSimulator />
        </div>

        {/* Right: Technical Guide & Cheatsheet (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Format Cheatsheet */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-maroon-800">
              <Terminal className="w-4 h-4" />
              Format Standar Telegram (PRD)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Admin membuat tugas pemasangan menggunakan format berikut:
            </p>

            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-xs font-mono space-y-1 relative group">
              <p className="text-emerald-400 font-bold">TUGAS</p>
              <p>Barang: Lampu</p>
              <p>Jumlah: 1</p>
              <p>Pemasang: Singgih</p>
              <p>Lokasi: GSG</p>
              <button
                onClick={() =>
                  copyToClipboard(
                    'TUGAS\nBarang: Lampu\nJumlah: 1\nPemasang: Singgih\nLokasi: GSG',
                    'Template tugas pemasangan'
                  )
                }
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Salin Template"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="font-bold text-maroon-800">•</span>
                <p>
                  <strong>Perintah Langsung:</strong> <code>/stok</code> untuk ringkasan cepat, <code>/cari &lt;nama&gt;</code> untuk cek persediaan, <code>/riwayat</code> untuk histori pribadi.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-maroon-800">•</span>
                <p>
                  <strong>Ambiguitas Terproteksi:</strong> Jika nama barang cocok lebih dari 1 barang di katalog, bot akan meminta klarifikasi dan stok <em>tidak akan berkurang</em>.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-maroon-800">•</span>
                <p>
                  <strong>Pengurangan stok:</strong> Stok berkurang setelah pemasang mengirim foto bukti. Tugas yang menunggu bukti ditampilkan dengan perintah <code>/tugas</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Linking Account Guide */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Petunjuk Pengaitan Akun (Linking)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Untuk keamanan gudang, pesan Telegram hanya diterima dari pengguna terdaftar:
            </p>

            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2">
              <li>
                Buka bot Telegram StockFlow dan ketik <code>/start</code>.
              </li>
              <li>
                Kirim perintah <code>/link &lt;email_anda&gt;</code> (misal: <code>/link siti@stockflow.com</code>).
              </li>
              <li>
                Sistem akan memverifikasi email dan menautkan Telegram User ID Anda secara otomatis.
              </li>
              <li>
                Setelah admin terhubung dan ID Telegram admin ditambahkan ke <code>TELEGRAM_ADMIN_IDS</code>, admin dapat membuat tugas pemasangan. Pemasang tidak perlu akun Telegram.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Webhook Updates Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Jejak Audit Webhook Updates (Idempotency Log)
          </h3>
          <span className="text-[11px] text-slate-400">10 pembaruan terakhir</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Update ID</th>
                <th className="py-3 px-4">Waktu Diterima</th>
                <th className="py-3 px-4">Telegram User</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Ringkasan Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {!status?.recentUpdates || status.recentUpdates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada update webhook yang tercatat.
                  </td>
                </tr>
              ) : (
                status.recentUpdates.map((u: any) => {
                  let payloadParsed: any = null;
                  try {
                    payloadParsed = JSON.parse(u.payload || '{}');
                  } catch (e) {}

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {u.telegramUpdateId}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(u.receivedAt).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        ID: {u.telegramUserId || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.status === 'PROCESSED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : u.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md font-mono text-[11px] text-slate-500 truncate">
                        {payloadParsed?.message?.text || u.payload || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
