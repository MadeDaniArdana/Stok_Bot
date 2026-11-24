"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "../ui/Toast";
import { BrowserErrorReporter } from "../BrowserErrorReporter";
import { RequestAlert } from "../requests/RequestAlert";

const SIDEBAR_KEY = "stockflow:sidebar-collapsed";

export function AppLayout({ children, variant = 'admin' }: { children: React.ReactNode; variant?: 'admin' | 'divisi' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAssistant = usePathname() === "/assistant";
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((open) => !open), []);

  // Sidebar desktop bisa diringkas jadi deretan ikon; pilihan diingat per browser.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(document.documentElement.dataset.sidebar === "mini");
    } catch {}
  }, []);
  const setCollapsedSaved = useCallback((value: boolean) => {
    setCollapsed(value);
    // Tampilan diatur CSS lewat atribut ini; state hanya untuk logika (label, klik ikon).
    if (value) document.documentElement.dataset.sidebar = "mini";
    else delete document.documentElement.dataset.sidebar;
    try {
      localStorage.setItem(SIDEBAR_KEY, value ? "1" : "0");
    } catch {}
  }, []);
  const toggleCollapsed = useCallback(() => setCollapsedSaved(!collapsed), [collapsed, setCollapsedSaved]);
  const expandSidebar = useCallback(() => setCollapsedSaved(false), [setCollapsedSaved]);

  return (
    <AuthProvider>
      <ToastProvider>
        <div
          className={
            isAssistant
              ? "h-dvh overflow-hidden bg-[#FDFBFB] flex"
              : "min-h-screen bg-[#FDFBFB] flex"
          }
        >
          {/* Sidebar */}
          <Sidebar
            variant={variant}
            mobileOpen={mobileOpen}
            onCloseMobile={closeMobile}
            collapsed={collapsed}
            onExpand={expandSidebar}
            onToggleCollapse={toggleCollapsed}
          />

          {/* Main Area */}
          <div
            className="flex-1 flex flex-col min-w-0 transition-[padding] duration-300 lg:pl-64 lg:mini:pl-[4.5rem]"
          >
            <Header variant={variant} onToggleMobile={toggleMobile} sidebarCollapsed={collapsed} onToggleSidebar={toggleCollapsed} />
            <main
              className={
                isAssistant
                  ? "flex-1 min-h-0 w-full p-4 sm:p-6"
                  : "flex-1 w-full p-4 sm:p-6"
              }
            >
              {children}
            </main>
          </div>
        </div>
        {variant === 'admin' && <RequestAlert />}
        <BrowserErrorReporter />
      </ToastProvider>
    </AuthProvider>
  );
}
