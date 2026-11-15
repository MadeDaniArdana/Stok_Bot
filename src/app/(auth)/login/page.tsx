'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Boxes,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function LoginForm() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState('admin@stockflow.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Find matching user from API
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      const users: any[] = data.availableUsers || [];
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (user) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        showToast('Login Berhasil', `Selamat datang kembali, ${user.name}!`);
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        showToast('Gagal Masuk', 'Kombinasi email atau password tidak cocok.', 'error');
        setIsLoading(false);
      }
    } catch (e: any) {
      showToast('Error', e.message, 'error');
      setIsLoading(false);
    }
  };

  const quickLogin = async (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('password123');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      const users: any[] = data.availableUsers || [];
      const user = users.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());

      if (user) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        showToast('Login Cepat Berhasil', `Masuk sebagai ${user.name}`);
        setTimeout(() => {
          router.push('/dashboard');
        }, 400);
      }
    } catch (e) {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF2F4] via-white to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
          {/* Brand */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-maroon-700 via-maroon-800 to-maroon-950 text-white flex items-center justify-center mx-auto shadow-maroon shadow-md mb-3">
              <Boxes className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Masuk ke <span className="text-maroon-800">StockFlow</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sistem Manajemen Persediaan & Integrasi Telegram Bot
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stockflow.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-maroon-800 focus:ring-maroon-500" />
                Ingat saya di perangkat ini
              </label>
              <span className="text-maroon-800 hover:underline cursor-pointer">Lupa kata sandi?</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white font-semibold text-xs shadow-soft hover:shadow-maroon transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Personas */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              Akses Cepat Mode Uji Coba (Demo Personas)
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickLogin('admin@stockflow.com')}
                className="p-2.5 rounded-xl border border-maroon-200 bg-maroon-50/60 hover:bg-maroon-100 text-maroon-900 transition-colors text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase bg-maroon-200/70 text-maroon-900 px-1.5 py-0.2 rounded">
                    Admin
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" />
                </div>
                <div className="mt-2">
                  <p className="font-bold text-xs leading-tight">Budi Pratama</p>
                  <p className="text-[10px] text-maroon-700/80 truncate">admin@stockflow.com</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('siti@stockflow.com')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                    Staff
                  </span>
                  <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="mt-2">
                  <p className="font-bold text-xs leading-tight">Siti Rahma</p>
                  <p className="text-[10px] text-slate-500 truncate">siti@stockflow.com</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          StockFlow v1.0 • Standar Operasional Gudang & Persediaan
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginForm />
    </ToastProvider>
  );
}
