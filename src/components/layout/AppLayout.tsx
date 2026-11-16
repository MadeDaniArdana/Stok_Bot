'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from '../ui/Toast';
import { BrowserErrorReporter } from '../BrowserErrorReporter';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[#FDFBFB] flex">
          {/* Sidebar */}
          <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

          {/* Main Area */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
            <Header onToggleMobile={() => setMobileOpen(!mobileOpen)} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
          <BrowserErrorReporter />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
