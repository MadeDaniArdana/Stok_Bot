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
      <div className="p-8 text-center glass-panel rounded-2xl shadow-soft">
        <p className="text-xs text-slate-400 font-medium">Belum ada transaksi mutasi stok pada periode ini.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-soft">
      <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Aktivitas Terkini</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Catatan pergerakan stok real-time</p>
        </div>
        <Link
          href="/stock/history"
          className="text-xs font-bold text-maroon-800 hover:text-maroon-950 flex items-center gap-1 hover:underline"
        >
          Riwayat Lengkap <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100/80">
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
            <div key={m.id} className="p-4 hover:bg-white/60 transition-colors flex items-start gap-3.5">
              {/* Icon pill */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-white/60 ${
                  isReversal
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-purple-500/20'
                    : isIncoming
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-maroon-700 to-maroon-900 text-white shadow-maroon/20'
                }`}
              >
                {isReversal ? (
                  <RotateCcw className="w-4 h-4 drop-shadow-sm" />
                ) : isIncoming ? (
                  <ArrowDownLeft className="w-4 h-4 drop-shadow-sm" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 drop-shadow-sm" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {m.product.name}
                  </p>
                  <span
                    className={`font-mono text-xs font-black ${
                      isIncoming ? 'text-emerald-600' : isReversal ? 'text-purple-600' : 'text-maroon-800'
                    }`}
                  >
                    {isIncoming ? '+' : isReversal ? '↺ ' : '-'}
                    {m.quantity} {m.product.unit}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
                  {m.notes || (isIncoming ? 'Barang masuk ke gudang' : 'Pengambilan persediaan')}
                </p>

                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                  <span>{timeLabel}</span>
                  <span>•</span>
                  <span className="font-bold text-slate-600">{m.actor?.name || 'Sistem'}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    {isTelegram ? (
                      <span className="inline-flex items-center gap-0.5 text-sky-700 bg-sky-100/70 border border-sky-200/60 px-2 py-0.2 rounded-full font-bold badge-3d">
                        <Send className="w-2.5 h-2.5" /> Telegram
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.2 rounded-full font-bold badge-3d">
                        <Globe className="w-2.5 h-2.5" /> Web
                      </span>
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    Stok: {m.stockBefore} → <strong className="text-slate-800 font-bold">{m.stockAfter}</strong>
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
