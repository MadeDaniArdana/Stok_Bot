import { TaskProofPage } from '@/components/tasks/TaskProofPage';

export default async function ProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TaskProofPage token={token} />;
}
