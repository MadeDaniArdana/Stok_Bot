'use client';

import React, { useState } from 'react';
import {
  Settings,
  Building,
  Clock,
  Shield,
  Key,
  Database,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { showToast } = useToast();

  const [warehouseName, setWarehouseName] = useState('StockFlow Warehouse Utama');
  const [timezone, setTimezone] = useState('Asia/Jakarta (WIB)');
  const [defaultMinStock, setDefaultMinStock] = useState('10');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Pengaturan Tersimpan', 'Preferensi konfigurasi operasional telah diperbarui.');
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-800 flex items-center justify-center border border-maroon-200">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Pengaturan Sistem Gudang
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Konfigurasi umum aplikasi, integrasi bot Telegram, dan parameter peringatan stok
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Warehouse Settings Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-maroon-800" />
            Profil & Operasional Gudang
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Fasilitas Gudang</label>
              <input
                type="text"
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Zona Waktu Operasional</label>
              <input
                type="text"
                disabled
                value={timezone}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Batas Default Ambang Stok Minimum
            </label>
            <input
              type="number"
              min="0"
              value={defaultMinStock}
              onChange={(e) => setDefaultMinStock(e.target.value)}
              className="w-48 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nilai acuan saat membuat master barang baru jika belum ditentukan secara spesifik.
            </p>
          </div>
        </div>

        {/* Telegram Secrets Preview (Masked for Security per PRD) */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-600" />
            Kredensial Integrasi Telegram (Environment Variables)
          </h3>
          <p className="text-xs text-slate-500">
            Sesuai pedoman keamanan arsitektur PRD, token sensitif disimpan di file <code>.env</code> dan tidak pernah terekspos langsung ke browser client.
          </p>

          <div className="space-y-3">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">TELEGRAM_BOT_USERNAME</span>
              <input
                type="text"
                disabled
                value="@stockflow_inventory_bot"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-700"
              />
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">TELEGRAM_BOT_TOKEN</span>
              <input
                type="text"
                disabled
                value="••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-400"
              />
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">TELEGRAM_WEBHOOK_SECRET</span>
              <input
                type="text"
                disabled
                value="••••••••••••••••••••••••••••••••"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold text-xs shadow-soft transition-all disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
}
