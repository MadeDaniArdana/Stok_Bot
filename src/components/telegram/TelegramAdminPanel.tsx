'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, UserPlus, Trash2, RefreshCw, ExternalLink, ShieldCheck, Download } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface AdminRow {
  telegramUserId: string;
  label: string | null;
  source: 'env' | 'web';
  linkedName: string | null;
  username: string | null;
}

interface Candidate {
  telegramUserId: string;
  username: string | null;
  name: string | null;
  lastSeen: string;
}

export function TelegramAdminPanel() {
  const { showToast } = useToast();
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/telegram/admins');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBotUrl(data.botUrl);
      setBotUsername(data.botUsername);
      setAdmins(data.admins);
      setCandidates(data.candidates);
    } catch (error) {
      showToast('Gagal memuat', error instanceof Error ? error.message : 'Terjadi kesalahan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!botUrl) return;
    QRCode.toDataURL(botUrl, { width: 480, margin: 1, color: { dark: '#5f0f22', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [botUrl]);

  const addAdmin = async (telegramUserId: string, label: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/telegram/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId, label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Admin ditambahkan', `ID ${telegramUserId} sekarang bisa membuat tugas di bot. Minta dia menekan Start lagi.`);
      setNewId('');
      setNewLabel('');
      await load();
    } catch (error) {
      showToast('Gagal', error instanceof Error ? error.message : 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (admin: AdminRow) => {
    if (!confirm(`Hapus akses admin untuk ID ${admin.telegramUserId}?`)) return;
    try {
      const res = await fetch(`/api/telegram/admins?telegramUserId=${encodeURIComponent(admin.telegramUserId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Admin dihapus', `ID ${admin.telegramUserId} tidak bisa lagi membuat tugas.`);
      await load();
    } catch (error) {
      showToast('Gagal', error instanceof Error ? error.message : 'Terjadi kesalahan', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* QR ke bot */}
      <div className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200 shadow-soft flex flex-col items-center text-center">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 self-start">
          <QrCode className="w-4 h-4 text-maroon-800" /> Scan untuk Buka Bot
        </h3>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={`QR code menuju bot Telegram @${botUsername}`} className="w-52 h-52 mt-4 rounded-lg border border-slate-100" />
        ) : (
          <div className="w-52 h-52 mt-4 rounded-lg bg-slate-50 flex items-center justify-center text-[11px] text-slate-400 px-4">
            {loading ? 'Membuat QR...' : 'TELEGRAM_BOT_USERNAME belum diisi'}
          </div>
        )}
        {botUrl && (
          <>
            <p className="text-xs font-semibold text-slate-800 mt-3">@{botUsername}</p>
            <div className="flex gap-2 mt-3">
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buka
              </a>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qr-${botUsername}.png`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh QR
                </a>
              )}
            </div>
          </>
        )}
        <ol className="text-[11px] text-slate-500 text-left mt-4 space-y-1 list-decimal list-inside self-stretch">
          <li>Calon admin scan QR ini lalu tekan <strong>Start</strong> di Telegram.</li>
          <li>Klik <strong>Segarkan</strong>; namanya muncul di daftar "Baru menghubungi bot".</li>
          <li>Klik <strong>Jadikan admin</strong>, lalu minta dia menekan Start sekali lagi.</li>
        </ol>
      </div>

      {/* Daftar admin */}
      <div className="lg:col-span-8 bg-white rounded-xl p-5 border border-slate-200 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Admin Telegram
          </h3>
          <button onClick={load} className="action-button action-info">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">Hanya ID di daftar ini yang bisa membuat tugas pemasangan lewat bot.</p>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
          {admins.length === 0 ? (
            <p className="p-4 text-xs text-slate-400 text-center">{loading ? 'Memuat...' : 'Belum ada admin Telegram.'}</p>
          ) : (
            admins.map((admin) => (
              <div key={admin.telegramUserId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {admin.label || admin.linkedName || 'Belum menekan Start'}
                    {admin.username && <span className="font-normal text-slate-500"> · @{admin.username}</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">ID {admin.telegramUserId}</p>
                </div>
                {admin.source === 'env' ? (
                  <span className="shrink-0 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full" title="Diatur lewat TELEGRAM_ADMIN_IDS di Vercel">
                    Admin utama
                  </span>
                ) : (
                  <button
                    onClick={() => removeAdmin(admin)}
                    className="action-button action-danger"
                    aria-label={`Hapus admin ${admin.telegramUserId}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Kandidat dari bot */}
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Baru menghubungi bot</p>
            <div className="divide-y divide-slate-100 border border-amber-200 bg-amber-50/40 rounded-lg">
              {candidates.map((candidate) => (
                <div key={candidate.telegramUserId} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {candidate.name || 'Tanpa nama'}
                      {candidate.username && <span className="font-normal text-slate-500"> · @{candidate.username}</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      ID {candidate.telegramUserId} ·{' '}
                      {new Date(candidate.lastSeen).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={() => addAdmin(candidate.telegramUserId, candidate.name || (candidate.username ? `@${candidate.username}` : ''))}
                    disabled={saving}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-maroon-800 hover:bg-maroon-900 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Jadikan admin
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tambah manual */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addAdmin(newId.trim(), newLabel.trim());
          }}
          className="flex flex-col sm:flex-row gap-2 pt-1"
        >
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="ID Telegram, mis. 1483361359"
            aria-label="ID Telegram"
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nama (opsional)"
            aria-label="Nama admin"
            maxLength={60}
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
          />
          <button
            type="submit"
            disabled={!newId || saving}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" /> Tambah
          </button>
        </form>
        <p className="text-[11px] text-slate-400">
          Tidak tahu ID-nya? Minta orangnya scan QR dan tekan Start; bot akan menampilkan ID Telegram miliknya.
        </p>
      </div>
    </div>
  );
}
