export const DIVISION_OPTIONS = [
  'Keuangan',
  'Tata Usaha Kemahasiswaan',
  'TU Warek',
  'FTIK',
  'FSIP',
  'FEB',
  'LPPM',
  'LPBM',
  'Perpustakaan',
  'Informasi',
  'TU Prodi',
  'TU SI',
  'TU IF',
];

export function normalizeDivisionName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export type RequestTemplateOption = { id: string; name: string; recipientUnit: string };

export function findDivisionTemplate(division: string, templates: RequestTemplateOption[]) {
  const key = (value: string) => normalizeDivisionName(value).toLowerCase();
  const normalized = key(division);
  if (!normalized) return undefined;

  const recipients = templates.filter((template) => key(template.recipientUnit) === normalized);
  if (recipients.length === 1) return recipients[0];

  const aliases: Record<string, string> = { 'tu warek': 'tata usaha warek' };
  const candidates = recipients.length > 1 ? recipients : templates;
  const matches = candidates.filter(
    (template) => key(template.name) === normalized || key(template.recipientUnit) === aliases[normalized]
  );
  return matches.length === 1 ? matches[0] : undefined;
}
