import React from 'react';

export interface RequestRow {
  id: string;
  number: string;
  stockGroup: string;
  divisionName: string;
  requesterName: string;
  notes: string | null;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  distributionNumber: string | null;
  createdAt: string;
  items: { id: string; quantity: number; product: { name: string; unit: string } }[];
}

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
          <span className="text-slate-800">{item.product.name}</span>
          <span className="shrink-0 font-semibold text-slate-700">
            {item.quantity} {item.product.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
