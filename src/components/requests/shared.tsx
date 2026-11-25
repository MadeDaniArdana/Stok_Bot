import React from 'react';
import { formatItemQuantity } from '@/lib/product-units';

export interface RequestRow {
  id: string;
  number: string;
  stockGroup: string;
  /** "Kepada" */
  divisionName: string;
  requesterName: string;
  receiverName: string | null;
  notes: string | null;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  distributionNumber: string | null;
  approvedDate: string | null;
  storageLocation: string | null;
  createdAt: string;
  items: RequestItemRow[];
}

export interface RequestItemRow {
  id: string;
  productId: string | null;
  customName: string | null;
  customUnit: string | null;
  quantity: number;
  approvedQuantity: number | null;
  noStock: boolean;
  product: { id: string; name: string; unit: string; packUnit: string | null; packSize: number | null } | null;
}

export const itemName = (item: RequestItemRow) => item.product?.name ?? item.customName ?? '-';
export const itemQty = (item: RequestItemRow, quantity: number) =>
  item.product ? formatItemQuantity(quantity, item.product.unit, item.product) : ` `;

const STATUS: Record<RequestRow['status'], { label: string; className: string }> = {
  PENDING: { label: 'Menunggu', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PROCESSING: { label: 'Diproses', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  APPROVED: { label: 'Disetujui', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Ditolak', className: 'bg-rose-50 text-rose-800 border-rose-200' },
};

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function StatusBadge({ status }: { status: RequestRow['status'] }) {
  const s = STATUS[status];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.className}`}>{s.label}</span>;
}

export function ItemsList({ items }: { items: RequestRow['items'] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
          <span className="text-slate-800">
            {itemName(item)}
            {!item.product && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Di luar daftar</span>}
          </span>
          <span className="shrink-0 text-right font-semibold text-slate-700">
            {itemQty(item, item.quantity)}
            {item.approvedQuantity !== null && item.approvedQuantity !== item.quantity && (
              <span className="block text-[11px] font-medium text-emerald-700">ACC {itemQty(item, item.approvedQuantity)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}