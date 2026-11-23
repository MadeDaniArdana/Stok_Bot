"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDownToLine,
  Check,
} from "lucide-react";
import { formatStock } from '@/lib/product-units';

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

function StockStatus({ item }: { item: CriticalItem }) {
  const Icon = item.isZero ? AlertCircle : AlertTriangle;
  return (
    <span
      className={
        item.isZero
          ? "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
          : "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"
      }
    >
      <Icon className="size-3 shrink-0" />
      {item.isZero ? "Habis" : "Menipis"}
    </span>
  );
}

function RestockLink({ item }: { item: CriticalItem }) {
  return (
    <Link
      href={`/products?entry=stock&productId=${encodeURIComponent(item.id)}`}
      aria-label={`Restock ${item.name}`}
      className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      <ArrowDownToLine className="size-3 shrink-0" />
      Restock
    </Link>
  );
}

export function CriticalTable({ items }: { items: CriticalItem[] }) {
  if (!items?.length) {
    return (
      <div className="min-w-0 self-start rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="size-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800">
          Semua Stok Aman
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Tidak ada barang yang berada di bawah stok minimum saat ini.
        </p>
      </div>
    );
  }

  return (
    <section
      data-critical-stock
      className="critical-stock min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="size-2 shrink-0 rounded-full bg-rose-500" />
            Stok Perlu Perhatian
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Barang habis atau mencapai batas minimum persediaan
          </p>
        </div>
        <Link
          href="/products?stockStatus=low"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-maroon-800 hover:underline"
        >
          Lihat Semua
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="critical-stock-table">
        <table className="w-full table-fixed text-left text-sm tabular-nums">
          <colgroup>
            <col style={{ width: "44%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Barang
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">Stok</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">
                Status
              </th>
              <th className="whitespace-nowrap px-2 py-3 text-center font-medium">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="break-words px-4 py-4 align-top">
                  <p className="font-medium leading-6 text-slate-900">
                    {item.name}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                    {item.sku}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    {item.category}
                  </p>
                </td>
                <td className="px-3 py-4 align-top">
                  <p
                    className={
                      item.isZero
                        ? "whitespace-nowrap font-semibold leading-6 text-rose-600"
                        : "whitespace-nowrap font-semibold leading-6 text-amber-600"
                    }
                  >
                    {formatStock(item, item.currentStock)}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-xs leading-5 text-slate-500">
                    Min. {formatStock(item, item.minimumStock)}
                  </p>
                </td>
                <td className="px-2 py-4 align-top">
                  <StockStatus item={item} />
                </td>
                <td className="px-2 py-4 text-center align-top">
                  <RestockLink item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="critical-stock-list divide-y divide-slate-100">
        {items.map((item) => (
          <article key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="break-words text-sm font-medium leading-6 text-slate-900">
                  {item.name}
                </h4>
                <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                  {item.sku}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {item.category}
                </p>
              </div>
              <StockStatus item={item} />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <dl className="flex gap-5 tabular-nums">
                <div>
                  <dt className="text-xs text-slate-500">Sisa stok</dt>
                  <dd
                    className={
                      item.isZero
                        ? "mt-1 text-sm font-semibold text-rose-600"
                        : "mt-1 text-sm font-semibold text-amber-600"
                    }
                  >
                    {formatStock(item, item.currentStock)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Minimum</dt>
                  <dd className="mt-1 text-sm text-slate-600">
                    {formatStock(item, item.minimumStock)}
                  </dd>
                </div>
              </dl>
              <RestockLink item={item} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
