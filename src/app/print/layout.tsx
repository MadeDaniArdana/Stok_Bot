import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-server';

export const metadata: Metadata = { title: 'Cetak Dokumen - StockFlow' };
export const dynamic = 'force-dynamic';

/** Halaman cetak tanpa sidebar. Middleware sudah mewajibkan login; dicek ulang di sini. Tiap halaman membatasi perannya sendiri (admin, atau pemilik pengajuan untuk /print/request). */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser(false);
  if (!user) redirect('/login');
  return <div className="min-h-screen bg-slate-200 px-3 py-6 font-serif text-black print:bg-white print:p-0">{children}</div>;
}
