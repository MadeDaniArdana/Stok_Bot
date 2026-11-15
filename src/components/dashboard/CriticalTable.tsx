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
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          ✓
        </div>
        <h4 className="text-sm font-semibold text-slate-800">Semua Stok Aman</h4>
        <p className="text-xs text-slate-500 mt-1">Tidak ada barang yang berada di bawah stok minimum saat ini.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-soft">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            Stok Perlu Perhatian
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Barang habis atau telah mencapai batas minimum persediaan</p>
        </div>
        <Link
          href="/products?stockStatus=low"
          className="text-xs font-semibold text-maroon-800 hover:text-maroon-900 flex items-center gap-1 hover:underline"
        >
          Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Barang & SKU</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4 text-center">Stok Saat Ini</th>
              <th className="py-3 px-4 text-center">Batas Min.</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {items.map((item) => {
              const percentage = Math.min(100, Math.round((item.currentStock / (item.minimumStock || 1)) * 100));

              return (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                    <span className="font-mono text-[11px] text-slate-400">{item.sku}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.category}</td>
                  <td className="py-3 px-4 text-center font-bold text-sm">
                    <span className={item.isZero ? 'text-rose-600' : 'text-amber-600'}>
                      {item.currentStock} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-500">
                    {item.minimumStock} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.isZero ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Habis
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Rendah ({percentage}%)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/stock/in?productId=${item.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-maroon-50 text-maroon-800 hover:bg-maroon-100 border border-maroon-200 transition-colors"
                    >
                      <ArrowDownToLine className="w-3 h-3" />
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
