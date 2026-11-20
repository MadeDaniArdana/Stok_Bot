'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { clearSwrCache } from '@/lib/client-swr';
import { clearDistributionBootstrapCache } from '@/lib/distribution-bootstrap';

const USER_CACHE_KEY = 'stockflow_user_display_v1';

interface AuthContextType {
  currentUser: any | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: any | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!user) {
      window.sessionStorage.removeItem(USER_CACHE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      USER_CACHE_KEY,
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        telegram: user.telegram ? { username: user.telegram.username } : null,
      })
    );
  } catch {
    // Abaikan jika sessionStorage dinonaktifkan browser.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.status === 401) {
        writeCachedUser(null);
        clearSwrCache();
        clearDistributionBootstrapCache();
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.currentUser);
        writeCachedUser(data.currentUser);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      writeCachedUser(null);
      clearSwrCache();
      clearDistributionBootstrapCache();
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    // Tampilkan profil dari sessionStorage seketika tanpa mismatch SSR, lalu verifikasi ke server.
    const cached = readCachedUser();
    if (cached) {
      setCurrentUser(cached);
      setIsLoading(false);
    }
    refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({ currentUser, isLoading, refreshSession, logout }),
    [currentUser, isLoading, refreshSession, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
