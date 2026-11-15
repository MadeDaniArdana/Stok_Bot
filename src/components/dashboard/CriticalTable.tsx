'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowRight, ArrowDownToLine } from 'lucide-react';

interface CriticalItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  isZero: boolean;
}

interface CriticalTableProps {
  items: CriticalItem[];
}

export function CriticalTable({ items }: CriticalTableProps) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center glass-panel rounded-2xl shadow-soft">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
          ✓
        </div>
        <h4 className="text-sm font-bold text-slate-800">Semua Stok Aman</h4>
        <p className="text-xs text-slate-500 mt-1">Tidak ada barang yang berada di bawah stok minimum saat ini.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-soft">
      <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm animate-pulse"></span>
            Stok Perlu Perhatian
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Barang habis atau telah mencapai batas minimum persediaan</p>
        </div>
        <Link
          href="/products?stockStatus=low"
          className="text-xs font-bold text-maroon-800 hover:text-maroon-950 flex items-center gap-1 hover:underline"
        >
          Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/60 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/50">
            <tr>
              <th className="py-3 px-4">Barang & SKU</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4 text-center">Stok Saat Ini</th>
              <th className="py-3 px-4 text-center">Batas Min.</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 text-slate-700">
            {items.map((item) => {
              const percentage = Math.min(100, Math.round((item.currentStock / (item.minimumStock || 1)) * 100));

              return (
                <tr key={item.id} className="hover:bg-white/60 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900 line-clamp-1">{item.name}</p>
                    <span className="font-mono text-[11px] text-slate-400">{item.sku}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{item.category}</td>
                  <td className="py-3 px-4 text-center font-black text-sm">
                    <span className={item.isZero ? 'text-rose-600' : 'text-amber-600'}>
                      {item.currentStock} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-500 font-medium">
                    {item.minimumStock} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.isZero ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100/80 text-rose-800 border border-rose-200/80 badge-3d">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Habis
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100/80 text-amber-800 border border-amber-200/80 badge-3d">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Rendah ({percentage}%)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/stock/in?productId=${item.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-maroon-50 hover:bg-maroon-100 text-maroon-900 border border-maroon-200 shadow-soft hover:shadow transition-all badge-3d"
                    >
                      <ArrowDownToLine className="w-3 h-3 text-maroon-800" />
                      Restock
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
