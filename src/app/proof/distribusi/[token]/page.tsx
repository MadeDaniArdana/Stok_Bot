import { TaskProofPage } from '@/components/tasks/TaskProofPage';

/** Link foto bukti distribusi Peralatan Listrik untuk petugas (tanpa login). */
export default function DistributionProofPage({ params }: { params: { token: string } }) {
  return <TaskProofPage token={params.token} apiBase="/api/distributions/proof" />;
}
