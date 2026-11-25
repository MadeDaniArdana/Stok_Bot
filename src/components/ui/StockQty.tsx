import React from 'react';
import { getStockParts, type PackInfo } from '@/lib/product-units';
import { cn } from '@/lib/cn';

interface StockQtyProps {
  product: PackInfo;
  quantity: number;
  prefix?: string;
  align?: 'center' | 'end' | 'start';
  className?: string;
}

/**
 * Menampilkan jumlah stok secara ringkas di sel tabel:
 * bila terdiri dari kemasan + sisa satuan dasar (mis. 8 botol 330ml + 30 ml),
 * disusun 2 baris vertikal agar kolom tabel tetap ramping dan tidak memicu scroll samping.
 */
export function StockQty({ product, quantity, prefix = '', align = 'center', className }: StockQtyProps) {
  const sign = quantity < 0 && !prefix ? '-' : prefix;
  const { main, rest } = getStockParts(product, Math.abs(quantity));

  if (!rest) {
    return (
      <span className={cn('whitespace-nowrap', className)}>
        {sign}
        {main}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex flex-col leading-tight',
        align === 'end' ? 'items-end' : align === 'start' ? 'items-start' : 'items-center',
        className
      )}
    >
      <span className="whitespace-nowrap">
        {sign}
        {main}
      </span>
      <span className="whitespace-nowrap text-[10px] font-normal opacity-80">
        +{rest}
      </span>
    </span>
  );
}
