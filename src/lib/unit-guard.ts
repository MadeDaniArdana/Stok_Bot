/**
 * Pemeriksa pengaturan kemasan barang: "1 <kemasan> = <isi> <satuan dasar>".
 * Dipakai di form (peringatan + error) dan di server (hanya error) agar satuan tidak mudah tertukar,
 * mis. "1 pcs = 4 kotak" (terbalik) atau "1 botol 330ml = 1000 liter" (seharusnya ml).
 */

/** Satuan takaran: dimensi + nilai dalam satuan terkecil dimensi itu. */
const MEASURES: Record<string, { dim: 'volume' | 'mass'; factor: number; label: string }> = {
  ml: { dim: 'volume', factor: 1, label: 'ml' },
  cc: { dim: 'volume', factor: 1, label: 'cc' },
  l: { dim: 'volume', factor: 1000, label: 'liter' },
  liter: { dim: 'volume', factor: 1000, label: 'liter' },
  g: { dim: 'mass', factor: 1, label: 'gram' },
  gr: { dim: 'mass', factor: 1, label: 'gram' },
  gram: { dim: 'mass', factor: 1, label: 'gram' },
  ons: { dim: 'mass', factor: 100, label: 'ons' },
  kg: { dim: 'mass', factor: 1000, label: 'kg' },
  kilogram: { dim: 'mass', factor: 1000, label: 'kg' },
};

/** Tingkat ukuran wadah umum: 1 = isi satuan (paling kecil), 3 = kemasan besar. */
const CONTAINER_RANK: Record<string, number> = {
  pcs: 1, buah: 1, bh: 1, biji: 1, lembar: 1, tablet: 1, kapsul: 1, sachet: 1, saset: 1, batang: 1, unit: 1, pasang: 1, set: 1,
  botol: 2, kaleng: 2, pack: 2, pak: 2, roll: 2, rol: 2, rim: 2, tube: 2, pouch: 2, bungkus: 2, strip: 2, blister: 2, galon: 2,
  kotak: 3, box: 3, lusin: 3, dus: 3, karton: 3, krat: 3, ball: 3, bal: 3, drigen: 3, jerigen: 3, slop: 3, sak: 3, gross: 3, peti: 3,
};

function norm(unit: string) {
  return unit.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Kata pertama satuan tanpa ukuran, mis. "botol 330ml" -> "botol". */
function headWord(unit: string) {
  return norm(unit).split(' ')[0].replace(/\d.*$/, '');
}

/** Ukuran isi yang tertulis di nama satuan, mis. "botol 330ml" -> { value: 330, unit: 'ml' }. */
function sizeInName(unit: string): { value: number; unit: string } | null {
  const match = norm(unit).match(/(\d+(?:[.,]\d+)?)\s*(ml|cc|liter|l|gram|gr|g|kg|ons)\b/);
  if (!match) return null;
  return { value: Number(match[1].replace(',', '.')), unit: match[2] };
}

export interface PackCheck {
  /** Kesalahan pasti: server menolak, tombol simpan dinonaktifkan. */
  errors: string[];
  /** Kemungkinan salah: ditampilkan sebagai peringatan & konfirmasi sebelum simpan. */
  warnings: string[];
  /** true bila kemasan & satuan dasar kemungkinan tertukar (tawarkan tombol Tukar). */
  maybeSwapped: boolean;
  /** Isi yang disarankan, mis. 1000 untuk liter -> ml. */
  suggestedSize?: number;
}

export function checkPackSetup(packUnitRaw: string, packSize: number, baseUnitRaw: string): PackCheck {
  const result: PackCheck = { errors: [], warnings: [], maybeSwapped: false };
  const packUnit = norm(packUnitRaw);
  const baseUnit = norm(baseUnitRaw);
  if (!packUnit || !baseUnit) return result;

  if (packUnit === baseUnit) {
    result.errors.push('Satuan beli dan satuan dasar tidak boleh sama.');
    return result;
  }
  if (!Number.isSafeInteger(packSize) || packSize < 2) {
    result.errors.push('Isi per kemasan harus bilangan bulat minimal 2.');
    return result;
  }

  const packMeasure = MEASURES[packUnit];
  const baseMeasure = MEASURES[baseUnit];

  // 1. Dua satuan takaran (liter/ml, kg/gram): konversinya pasti.
  if (packMeasure && baseMeasure) {
    if (packMeasure.dim !== baseMeasure.dim) {
      result.errors.push(`${packMeasure.label} dan ${baseMeasure.label} bukan jenis takaran yang sama.`);
      return result;
    }
    if (packMeasure.factor <= baseMeasure.factor) {
      result.errors.push(
        `Terbalik: ${packMeasure.label} lebih kecil dari ${baseMeasure.label}. Satuan beli harus ${baseMeasure.label}, satuan dasar ${packMeasure.label}.`
      );
      result.maybeSwapped = true;
      return result;
    }
    const expected = packMeasure.factor / baseMeasure.factor;
    if (packSize !== expected) {
      result.errors.push(`1 ${packMeasure.label} = ${expected} ${baseMeasure.label}, bukan ${packSize}.`);
      result.suggestedSize = expected;
    }
    return result;
  }

  // 2. Satuan dasar takaran besar (liter/kg) dengan isi ratusan/ribuan: hampir pasti maksudnya ml/gram.
  if (baseMeasure && baseMeasure.factor >= 1000 && packSize >= 100) {
    const small = baseMeasure.dim === 'volume' ? 'ml' : 'gram';
    result.errors.push(
      `1 ${packUnit} = ${packSize} ${baseMeasure.label} tidak masuk akal. Jika maksudnya ${packSize} ${small}, ganti satuan dasar menjadi ${small}.`
    );
    return result;
  }

  // 3. Ukuran tertulis di nama kemasan, mis. "botol 330ml" dengan satuan dasar ml: isinya harus 330.
  const size = sizeInName(packUnit);
  if (size && baseMeasure) {
    const sizeMeasure = MEASURES[size.unit];
    if (sizeMeasure && sizeMeasure.dim === baseMeasure.dim) {
      const expected = (size.value * sizeMeasure.factor) / baseMeasure.factor;
      if (Number.isFinite(expected) && Math.abs(expected - packSize) > 1e-9) {
        result.warnings.push(`Nama satuan beli "${packUnit}" berarti isinya ${expected} ${baseMeasure.label}, tetapi diisi ${packSize}.`);
        if (Number.isInteger(expected) && expected >= 2) result.suggestedSize = expected;
      }
    }
  }

  // 4. Urutan wadah umum: kemasan seharusnya lebih besar dari satuan dasar (kotak > pcs).
  const packRank = CONTAINER_RANK[headWord(packUnit)] ?? (packMeasure ? 2 : undefined);
  const baseRank = CONTAINER_RANK[headWord(baseUnit)] ?? (baseMeasure ? 1 : undefined);
  if (packRank !== undefined && baseRank !== undefined && packRank < baseRank) {
    result.warnings.push(
      `Sepertinya terbalik: biasanya 1 ${baseUnit} berisi beberapa ${packUnit}, bukan 1 ${packUnit} berisi ${packSize} ${baseUnit}.`
    );
    result.maybeSwapped = true;
  }

  return result;
}
