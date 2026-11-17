import { redirect } from 'next/navigation';

interface LegacyStockInPageProps {
  searchParams: { productId?: string; mode?: string };
}

export default function StockInPage({ searchParams }: LegacyStockInPageProps) {
  const query = new URLSearchParams({ entry: 'stock' });
  if (typeof searchParams.productId === 'string' && searchParams.productId) {
    query.set('productId', searchParams.productId);
  }
  if (searchParams.mode === 'new') query.set('mode', 'new');
  redirect(`/products?${query.toString()}`);
}
