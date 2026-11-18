'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Send, CheckCircle2, AlertTriangle, ExternalLink, Clock } from 'lucide-react';
import { AdminProfileCard } from '@/components/settings/AdminProfileCard';

interface TelegramStatus {
  botUsername: string;
  isConfigured: boolean;
  linkedCount: number;
  failedUpdates: number;
}

/**
 * Pengaturan berisi hal yang benar-benar tersimpan atau berasal dari server:
 * profil admin (nama yang menyerahkan) dan info integrasi Telegram.
 * Kolom lama yang hanya tampilan (nama gudang, stok minimum default) sudah dihapus.
 */
export default function SettingsPage() {
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [telegramError, setTelegramError] = useState(false);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setTelegram)
      .catch(() => setTelegramError(true));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-800 flex items-center justify-center border border-maroon-200">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Pengaturan</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Profil admin dan informasi integrasi sistem</p>
      </div>

      <AdminProfileCard />

      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-4 text-sm">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-600" />
          Info Integrasi Telegram
        </h3>

        {telegramError ? (
          <p className="text-xs text-rose-700">Status bot tidak dapat dimuat saat ini.</p>
        ) : !telegram ? (
          <p className="text-xs text-slate-400">Memuat status bot...</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-[11px] text-slate-500">Bot</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-800">@{telegram.botUsername}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-[11px] text-slate-500">Status token</dt>
              <dd className={`mt-0.5 flex items-center gap-1 font-semibold ${telegram.isConfigured ? 'text-emerald-700' : 'text-rose-700'}`}>
                {telegram.isConfigured ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {telegram.isConfigured ? 'Terpasang' : 'Belum diisi'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-[11px] text-slate-500">Akun Telegram tertaut</dt>
              <dd className="mt-0.5 font-semibold text-slate-800">{telegram.linkedCount} akun</dd>
            </div>
          </dl>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Token bot, secret webhook, dan kunci AI disimpan di Environment Variables Vercel, tidak di halaman ini, demi keamanan.
        </p>
        <Link
          href="/telegram"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Kelola admin & QR bot di Integrasi Telegram
        </Link>
      </section>
    </div>
  );
}
