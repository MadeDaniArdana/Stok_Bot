"use client";

import React, { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "../ui/Toast";
import { BrowserErrorReporter } from "../BrowserErrorReporter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAssistant = usePathname() === "/assistant";
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((open) => !open), []);

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
            mobileOpen={mobileOpen}
            onCloseMobile={closeMobile}
          />

          {/* Main Area */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
            <Header onToggleMobile={toggleMobile} />
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
        <BrowserErrorReporter />
      </ToastProvider>
    </AuthProvider>
  );
}
