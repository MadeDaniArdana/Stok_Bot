'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from '../ui/Toast';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[#FAF7F7] relative flex overflow-hidden">
          {/* Ambient 3D Glowing Glassmorphism Background Blobs */}
          <div className="ambient-glow w-96 h-96 bg-maroon-300/30 -top-20 -right-20 pointer-events-none" />
          <div className="ambient-glow w-[32rem] h-[32rem] bg-rose-200/40 top-1/3 -left-32 pointer-events-none" />
          <div className="ambient-glow w-80 h-80 bg-amber-200/25 bottom-10 right-1/4 pointer-events-none" />

          {/* Sidebar */}
          <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

          {/* Main Area */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64 relative z-10">
            <Header onToggleMobile={() => setMobileOpen(!mobileOpen)} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
