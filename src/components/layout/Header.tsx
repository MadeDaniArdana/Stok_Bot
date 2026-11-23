'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Send,
  Clock,
  AlertTriangle,
  PackageX,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useToast } from '../ui/Toast';

/** Jam WIB; dipisah agar detak tiap detik tidak menggambar ulang seluruh header. */
function HeaderClock() {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () =>
      setTimeStr(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono font-medium">{timeStr}</span>;
}

interface HeaderProps {
  onToggleMobile: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({ onToggleMobile, sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { currentUser, logout } = useAuth();
  const { showToast } = useToast();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const lastCountFetchedRef = useRef(0);
  const showNotificationsRef = useRef(false);
  showNotificationsRef.current = showNotifications;

  // Polling ringan: hanya ambil unreadCount (1 query COUNT) selama dropdown ditutup.
  const loadUnreadCount = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCountFetchedRef.current < 15000) return;
    lastCountFetchedRef.current = now;
    try {
      const res = await fetch('/api/notifications?countOnly=1');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Daftar lengkap 25 notifikasi hanya diambil saat panel notifikasi dibuka.
  const loadFullNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setNotificationsLoaded(true);
        lastCountFetchedRef.current = Date.now();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount(true);
    // Cek jumlah notifikasi tiap 30 detik saat tab aktif; cek saat tab kembali dilihat (jeda minimal 15 detik).
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (showNotificationsRef.current) loadFullNotifications();
      else loadUnreadCount(true);
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (showNotificationsRef.current) loadFullNotifications();
      else loadUnreadCount(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadUnreadCount, loadFullNotifications]);

  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) loadFullNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast('Semua notifikasi ditandai telah dibaca');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden lg:inline-flex p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label={sidebarCollapsed ? 'Tampilkan menu samping' : 'Ringkas menu samping'}
            title={sidebarCollapsed ? 'Tampilkan menu' : 'Sembunyikan menu'}
          >
            <PanelLeftClose className="w-5 h-5 mini:hidden" />
            <PanelLeftOpen className="w-5 h-5 hidden mini:block" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5 text-maroon-700" />
          <HeaderClock />
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-medium">Gudang Utama (StockFlow)</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Telegram Quick Launch Button */}
        {/* Asisten AI dipindah dari sidebar ke sini agar menu tetap ringkas. */}
        <Link
          href="/assistant"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm"
          title="Buka Asisten AI"
          aria-label="Asisten AI"
        >
          <Bot className="w-3.5 h-3.5 text-maroon-700" />
          <span className="hidden md:inline">Asisten AI</span>
        </Link>

        <Link
          href="/telegram"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-maroon-50 text-maroon-800 hover:bg-maroon-100 border border-maroon-200 transition-colors shadow-sm"
          title="Buka Integrasi Telegram"
        >
          <Send className="w-3.5 h-3.5 text-maroon-700" />
          <span className="hidden md:inline">Telegram Bot</span>
        </Link>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className="relative p-2 rounded-lg text-slate-500 hover:text-maroon-800 hover:bg-maroon-50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-maroon-700 rounded-full px-1 border-2 border-white shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Pemberitahuan</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-maroon-100 text-maroon-800 font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} baru
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-maroon-800 hover:underline font-medium"
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notificationsLoading && !notificationsLoaded ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Memuat notifikasi...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Tidak ada notifikasi saat ini
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 ${
                        !n.isRead ? 'bg-maroon-50/40 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 mt-0.5">
                          {n.type === 'OUT_OF_STOCK' ? (
                            <PackageX className="w-4 h-4 text-rose-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleString('id-ID', {
                              timeZone: 'Asia/Jakarta',
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 text-center">
                <Link
                  href="/products?stockStatus=low"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-maroon-800 hover:text-maroon-900 flex items-center justify-center gap-1"
                >
                  Lihat Semua Stok Rendah <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50/30 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-maroon-800 to-maroon-950 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="hidden sm:block text-xs">
              <p className="font-semibold text-slate-800 leading-tight">
                {currentUser?.name ? currentUser.name.split(' ')[0] : 'Akun'}
              </p>
              <p className="text-[10px] text-maroon-800 font-medium">
                Administrator
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800">{currentUser?.name || 'Akun'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{currentUser?.email}</p>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full text-center text-xs text-rose-600 hover:bg-rose-50 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Keluar (Logout)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
