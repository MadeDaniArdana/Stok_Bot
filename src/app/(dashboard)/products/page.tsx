import { ProductsView } from '@/components/products/ProductsView';

/** Semua barang lintas jenis (dibuka dari peringatan stok kritis di dashboard). */
export default function ProductsPage() {
  return <ProductsView stockGroup={null} />;
}
