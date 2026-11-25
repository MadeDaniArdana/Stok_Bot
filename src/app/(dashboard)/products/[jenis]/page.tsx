import { notFound } from 'next/navigation';
import { ProductsView } from '@/components/products/ProductsView';
import { STOCK_GROUPS, parseStockGroup } from '@/lib/stock-groups';

export function generateStaticParams() {
  return STOCK_GROUPS.map((group) => ({ jenis: group.slug }));
}
export const dynamicParams = false;

/** Master Barang ATK / Peralatan Listrik / Logistik. */
export default async function ProductsByGroupPage({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await params;
  const stockGroup = parseStockGroup(jenis);
  if (!stockGroup) notFound();
  return <ProductsView stockGroup={stockGroup} />;
}
