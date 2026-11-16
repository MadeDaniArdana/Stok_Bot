'use client';

import { useEffect } from 'react';

/** Mengirim error JavaScript di browser ke Log Error (maksimal 5 per halaman, tanpa duplikat). */
export function BrowserErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();

    const report = (kind: string, message: string, stack?: string) => {
      if (!message || sent.size >= 5 || sent.has(message)) return;
      sent.add(message);
      fetch('/api/logs/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, stack, page: window.location.pathname }),
        keepalive: true,
      }).catch(() => {});
    };

    const onError = (event: ErrorEvent) => report('error', event.message, event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report('unhandledrejection', reason instanceof Error ? reason.message : String(reason), reason?.stack);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
