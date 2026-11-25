import { TaskProofPage } from '@/components/tasks/TaskProofPage';

/** Link foto bukti distribusi Peralatan Listrik untuk petugas (tanpa login). */
export default async function DistributionProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TaskProofPage token={token} apiBase="/api/distributions/proof" />;
}
