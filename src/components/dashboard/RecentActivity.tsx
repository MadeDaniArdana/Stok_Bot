'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Send, Globe, ArrowRight } from 'lucide-react';

interface Movement {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  source: string;
  notes?: string | null;
  createdAt: string;
  product: {
    name: string;
    sku: string;
    unit: string;
  };
  actor?: {
    name: string;
    role: string;
  } | null;
}

interface RecentActivityProps {
  movements: Movement[];
}

export function RecentActivity({ movements }: RecentActivityProps) {
  if (!movements || movements.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-xs text-slate-400">Belum ada transaksi mutasi stok pada periode ini.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-soft">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">Aktivitas Terkini</h3>
          <p className="text-xs text-slate-500 mt-0.5">Catatan pergerakan stok real-time</p>
        </div>
        <Link
          href="/stock/history"
          className="text-xs font-semibold text-maroon-800 hover:text-maroon-900 flex items-center gap-1 hover:underline"
        >
          Riwayat Lengkap <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {movements.map((m) => {
          const isIncoming = m.type === 'IN';
          const isReversal = m.type === 'REVERSAL';
          const isTelegram = m.source === 'TELEGRAM';

          const timeLabel = new Date(m.createdAt).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          });

          return (
            <div key={m.id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-start gap-3">
              {/* Icon pill */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isReversal
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : isIncoming
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isReversal ? (
                  <RotateCcw className="w-4 h-4" />
                ) : isIncoming ? (
                  <ArrowDownLeft className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {m.product.name}
                  </p>
                  <span
                    className={`font-mono text-xs font-extrabold ${
                      isIncoming ? 'text-emerald-600' : isReversal ? 'text-purple-600' : 'text-maroon-800'
                    }`}
                  >
                    {isIncoming ? '+' : isReversal ? '↺ ' : '-'}
                    {m.quantity} {m.product.unit}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {m.notes || (isIncoming ? 'Barang masuk ke gudang' : 'Pengambilan persediaan')}
                </p>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] text-slate-400">
                  <span>{timeLabel}</span>
                  <span>•</span>
                  <span className="font-medium text-slate-600">{m.actor?.name || 'Sistem'}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    {isTelegram ? (
                      <span className="inline-flex items-center gap-0.5 text-sky-600 bg-sky-50 px-1 py-0.2 rounded font-medium">
                        <Send className="w-2.5 h-2.5" /> Telegram
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-slate-600 bg-slate-100 px-1 py-0.2 rounded font-medium">
                        <Globe className="w-2.5 h-2.5" /> Web
                      </span>
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    Stok: {m.stockBefore} → <strong className="text-slate-700">{m.stockAfter}</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
