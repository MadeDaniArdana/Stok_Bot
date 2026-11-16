import { TaskProofPage } from '@/components/tasks/TaskProofPage';

export default function ProofPage({ params }: { params: { token: string } }) {
  return <TaskProofPage token={params.token} />;
}
