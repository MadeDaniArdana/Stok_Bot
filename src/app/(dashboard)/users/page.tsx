'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { cn } from '@/lib/cn';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  UserCheck,
  Send,
  Edit2,
  Power,
  X,
  Link as LinkIcon,
  Unlink,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';

export default function UsersPage() {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN' | 'USER' | 'DIVISI'>('USER');
  const [formPassword, setFormPassword] = useState('');
  const [formTgId, setFormTgId] = useState('');
  const [formTgUsername, setFormTgUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          password: formPassword || undefined,
          telegramUserId: formTgId.trim() || undefined,
          telegramUsername: formTgUsername.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Pengguna Ditambahkan', `Akun ${formName} berhasil dibuat.`);
      setIsAddOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      showToast('Gagal Menambah Pengguna', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          role: formRole,
          password: formPassword || undefined,
          telegramUserId: formTgId.trim() || undefined,
          telegramUsername: formTgUsername.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Perubahan Disimpan', `Profil ${formName} berhasil diperbarui.`);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      showToast('Gagal Menyimpan', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (u: any) => {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Status Pengguna Diperbarui', `Akun ${u.name} sekarang ${!u.isActive ? 'Aktif' : 'Nonaktif'}.`);
      fetchUsers();
    } catch (err: any) {
      showToast('Gagal Mengubah Status', err.message, 'error');
    }
  };

  const handleUnlinkTelegram = async (u: any) => {
    if (!confirm(`Lepas tautan Telegram untuk akun ${u.name}?`)) return;

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlinkTelegram: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Tautan Telegram Dilepas', `Akun Telegram untuk ${u.name} telah diputus.`);
      fetchUsers();
    } catch (err: any) {
      showToast('Gagal', err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Akun gagal dihapus.');
      showToast('Akun Dihapus', `Akun ${deleteTarget.name} (web${deleteTarget.telegram ? ' + Telegram' : ''}) telah dihapus permanen.`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      showToast('Gagal Menghapus', err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('USER');
    setFormPassword('');
    setFormTgId('');
    setFormTgUsername('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            Manajemen Pengguna & Otorisasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola hak akses Admin/Staff serta status pengaitan akun Telegram
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold shadow-soft hover:shadow-maroon transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th scope="col" className="w-10 py-3 px-2.5 text-center">No</th>
                <th className="py-3 px-3">Nama Pengguna</th>
                <th className="py-3 px-3">Email Login</th>
                <th className="py-3 px-2.5 text-center">Peran</th>
                <th className="py-3 px-3">Telegram</th>
                <th className="py-3 px-2.5 text-center">Status</th>
                <th className="py-3 px-2.5 text-center whitespace-nowrap">Transaksi</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : (
                users.map((u, index) => {
                  const isCur = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-2.5 text-center font-medium text-slate-600 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{u.name}</span>
                          {isCur && (
                            <span className="text-[10px] text-maroon-800 bg-maroon-50 px-1.5 py-0.2 rounded font-bold">
                              Anda
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 max-w-[14rem] truncate" title={u.email}>{u.email}</td>

                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-maroon-800 bg-maroon-50 px-2 py-0.5 rounded-full border border-maroon-200">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        ) : u.role === 'DIVISI' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                            <UserCheck className="w-3 h-3" /> Divisi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" /> Staff
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {u.telegram ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                              <Send className="w-2.5 h-2.5" />
                              @{u.telegram.username || u.telegram.telegramUserId}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleUnlinkTelegram(u)}
                                className="action-button action-icon action-danger"
                                aria-label={`Putus tautan Telegram ${u.name}`}
                                title="Putus Tautan Telegram"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Belum terhubung
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {u.isActive ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            Nonaktif
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono font-medium">
                        {u._count?.movements || 0}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setFormName(u.name);
                                setFormEmail(u.email);
                                setFormRole(u.role);
                                setFormTgId(u.telegram?.telegramUserId || '');
                                setFormTgUsername(u.telegram?.username || '');
                              }}
                              className="action-button action-icon action-edit"
                              aria-label={`Edit pengguna ${u.name}`}
                              title="Edit Pengguna"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {!isCur && (
                              <button
                                onClick={() => handleToggleActive(u)}
                                className={cn('action-button action-icon', u.isActive ? 'action-danger' : 'action-success')}
                                aria-label={`${u.isActive ? 'Nonaktifkan' : 'Aktifkan'} akun ${u.name}`}
                                title={u.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isCur && (
                              <button
                                onClick={() => setDeleteTarget(u)}
                                className="action-button action-icon action-danger"
                                aria-label={`Hapus akun ${u.name}`}
                                title="Hapus Akun Permanen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* Modal Add / Edit */}
      {(isAddOpen || editingUser) && (
        <ModalOverlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-maroon-800" />
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingUser ? handleUpdate : handleCreate}
              className="space-y-4 pt-4 text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Misal: Dewi Sartika"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingUser)}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="dewi@stockflow.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peran (Role) Akses <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e: any) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
                >
                  <option value="USER">Staff Gudang (Pengambilan & Cek Stok)</option>
                  <option value="ADMIN">Administrator (Hak Penuh Gudang)</option>
                  <option value="DIVISI">Akun Divisi (Pengajuan Barang)</option>
                </select>
              </div>

              {formRole === 'DIVISI' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kata Sandi Login {!editingUser && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    required={!editingUser}
                    minLength={8}
                    autoComplete="off"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Nama akun dipakai sebagai nama divisi di pengajuan (misal: Divisi Keuangan). Berikan email dan kata sandi ini kepada divisi.</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <p className="font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-xs text-sky-700">
                  <Send className="w-3.5 h-3.5" />
                  Kaitkan Identitas Telegram (Opsional)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Telegram User ID
                    </label>
                    <input
                      type="text"
                      value={formTgId}
                      onChange={(e) => setFormTgId(e.target.value)}
                      placeholder="Contoh: 78291044"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Username Telegram
                    </label>
                    <input
                      type="text"
                      value={formTgUsername}
                      onChange={(e) => setFormTgUsername(e.target.value)}
                      placeholder="sitirahma_ops"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Konfirmasi hapus akun permanen */}
      {deleteTarget && (
        <ModalOverlay role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-sm">
            <h3 id="delete-user-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" /> Hapus akun {deleteTarget.name}?
            </h3>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Akun ini akan dihapus <strong>permanen</strong> dan tidak bisa login ke web
              {deleteTarget.telegram ? <> maupun memakai bot Telegram (@{deleteTarget.telegram.username || deleteTarget.telegram.telegramUserId})</> : null}.
              Jika hanya ingin memblokir sementara, gunakan tombol <strong>Nonaktifkan</strong>.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
                <p className="font-bold">Ikut terhapus</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Akun login web</li>
                  {deleteTarget.telegram && <li>Tautan &amp; akses admin bot Telegram</li>}
                  <li>Notifikasi milik akun ini</li>
                </ul>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <p className="font-bold">Tetap tersimpan</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Riwayat stok ({deleteTarget._count?.movements ?? 0} transaksi)</li>
                  <li>Dokumen distribusi</li>
                  <li>Tugas &amp; foto pemasangan</li>
                </ul>
                <p className="mt-1 opacity-80">Nama {deleteTarget.name} tetap tercatat, ditandai &quot;(akun dihapus)&quot;.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs">
                Batal
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs disabled:opacity-50">
                {deleting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
