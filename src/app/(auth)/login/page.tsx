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
    <div className="min-h-screen bg-[#FAF7F7] relative flex items-center justify-center p-4 overflow-hidden">
      {/* 3D Ambient Glow Blobs */}
      <div className="ambient-glow w-96 h-96 bg-maroon-300/35 -top-16 -left-16 pointer-events-none" />
      <div className="ambient-glow w-[30rem] h-[30rem] bg-rose-200/40 -bottom-20 -right-20 pointer-events-none" />
      <div className="ambient-glow w-72 h-72 bg-amber-200/25 top-1/2 left-1/3 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Glass Card */}
        <div className="glass-panel rounded-3xl shadow-[0_20px_50px_rgba(128,0,32,0.1)] border-2 border-white/85 p-6 sm:p-8 backdrop-blur-xl">
          {/* Brand */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-maroon-700 via-maroon-800 to-maroon-950 text-white flex items-center justify-center mx-auto shadow-maroon shadow-lg ring-2 ring-white/50 mb-3.5 transform-gpu hover:scale-110 hover:rotate-3 transition-all duration-300">
              <Boxes className="w-7 h-7 drop-shadow" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Masuk ke <span className="bg-gradient-to-r from-maroon-800 to-maroon-950 bg-clip-text text-transparent">StockFlow</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Sistem Manajemen Persediaan & Integrasi Telegram 3D
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stockflow.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 text-slate-900 font-medium shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 text-slate-900 font-medium shadow-inner"
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

            <div className="flex items-center justify-between text-[11px] font-medium">
              <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-maroon-800 focus:ring-maroon-500" />
                Ingat saya di perangkat ini
              </label>
              <span className="text-maroon-800 hover:underline cursor-pointer font-semibold">Lupa kata sandi?</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-3d w-full py-3 px-4 rounded-xl bg-maroon-800 hover:bg-maroon-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Personas */}
          <div className="mt-6 pt-5 border-t border-slate-200/60">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              Akses Cepat Mode Uji Coba (Demo Personas)
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => quickLogin('admin@stockflow.com')}
                className="p-3 rounded-2xl border border-maroon-200/80 bg-white/80 hover:bg-white text-maroon-900 transition-all text-left flex flex-col justify-between group shadow-sm hover:shadow-md hover:-translate-y-0.5 badge-3d"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-maroon-100 text-maroon-900 px-2 py-0.5 rounded-full border border-maroon-200/60">
                    Admin
                  </span>
                  <ShieldCheck className="w-4 h-4 text-maroon-800 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2.5">
                  <p className="font-black text-xs leading-tight text-slate-900">Budi Pratama</p>
                  <p className="text-[10px] text-maroon-800/80 truncate font-semibold">admin@stockflow.com</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('siti@stockflow.com')}
                className="p-3 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white text-slate-800 transition-all text-left flex flex-col justify-between group shadow-sm hover:shadow-md hover:-translate-y-0.5 badge-3d"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    Staff
                  </span>
                  <UserCheck className="w-4 h-4 text-slate-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2.5">
                  <p className="font-black text-xs leading-tight text-slate-900">Siti Rahma</p>
                  <p className="text-[10px] text-slate-500 truncate font-semibold">siti@stockflow.com</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4 font-medium">
          StockFlow v1.0 • Standar Operasional Gudang Modern 3D & Persediaan
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
