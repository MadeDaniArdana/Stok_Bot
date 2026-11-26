import { DivisiRequestForm } from '@/components/requests/DivisiRequestForm';
import { getSessionUser } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function DivisiRequestPage() {
  const user = await getSessionUser();
  if (user?.role !== 'DIVISI') redirect(user ? '/dashboard' : '/login');

  const template = user.requestTemplateId
    ? await prisma.distributionTemplate.findFirst({
      where: { id: user.requestTemplateId, stockGroup: 'ATK' },
      select: {
        name: true,
        items: {
          where: { product: { isActive: true, category: { stockGroup: 'ATK' } } },
          orderBy: { sortOrder: 'asc' },
          select: { productId: true },
        },
      },
    })
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Buat Pengajuan ATK</h1>
        <p className="text-xs text-slate-500">Isi jumlah barang ATK yang dibutuhkan. Pengajuan akan diteruskan ke admin untuk direview dan di-ACC.</p>
      </div>
      <DivisiRequestForm divisionName={user.divisionName ?? user.name} template={template} />
    </div>
  );
}
