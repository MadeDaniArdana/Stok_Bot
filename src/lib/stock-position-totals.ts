type StockPositionQuantities = {
  unit: string;
  openingStock: number;
  inQty: number;
  totalAvailable: number;
  outQty: number;
  adjustment: number;
  closingStock: number;
};

export function summarizeStockByUnit(rows: readonly StockPositionQuantities[]) {
  const totals = new Map<string, StockPositionQuantities & { itemCount: number }>();
  for (const row of rows) {
    const unit = row.unit.trim().toLowerCase() || 'tanpa satuan';
    const subtotal = totals.get(unit);
    if (!subtotal) {
      const { openingStock, inQty, totalAvailable, outQty, adjustment, closingStock } = row;
      totals.set(unit, { unit, openingStock, inQty, totalAvailable, outQty, adjustment, closingStock, itemCount: 1 });
      continue;
    }
    subtotal.itemCount += 1;
    subtotal.openingStock += row.openingStock;
    subtotal.inQty += row.inQty;
    subtotal.totalAvailable += row.totalAvailable;
    subtotal.outQty += row.outQty;
    subtotal.adjustment += row.adjustment;
    subtotal.closingStock += row.closingStock;
  }
  return Array.from(totals.values()).sort((a, b) => a.unit.localeCompare(b.unit, 'id'));
}
