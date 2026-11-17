'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/components/layout/AuthContext';
import { useToast } from '@/components/ui/Toast';

/**
 * Nama admin yang login. Nama ini otomatis dipakai sebagai "Yang Menyerahkan"
 * pada Form Distribusi ATK/Logistik dan di bagian tanda tangan form cetak.
 */
export function AdminProfileCard() {
  const { currentUser, refreshSession } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name);
  }, [currentUser?.name]);

  const trimmed = name.trim().replace(/\s+/g, ' ');
  const changed = Boolean(currentUser) && trimmed !== currentUser.name;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !trimmed || !changed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Nama gagal disimpan.');
      await refreshSession();
      showToast('Nama Diperbarui', `Form distribusi berikutnya memakai nama "${trimmed}" sebagai yang menyerahkan.`);
    } catch (error: any) {
      showToast('Gagal Menyimpan', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white rounded-xl p-6 border border-slate-200 shadow-soft space-y-4 text-sm">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <UserRound className="w-4 h-4 text-maroon-800" />
        Profil Admin
      </h3>
      <div>
        <label htmlFor="admin-name" className="block font-semibold text-slate-700 mb-1">
          Nama Admin (Yang Menyerahkan)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="admin-name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Sri Wahyuni, S.Kom."
            disabled={!currentUser || saving}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!changed || !trimmed || saving}
            className="shrink-0 px-5 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 text-white font-semibold text-xs disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Nama'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Dipakai otomatis sebagai <strong>Yang Menyerahkan</strong> di Form Distribusi ATK dan Logistik serta tanda tangan form cetak.
          Tulis lengkap dengan gelar bila perlu. Nama di setiap form tetap bisa diubah sebelum disimpan.
        </p>
      </div>
    </form>
  );
}
